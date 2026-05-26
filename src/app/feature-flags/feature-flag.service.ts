import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

/**
 * FeatureFlags — canonical type for all flags in this workspace.
 *
 * ADD a flag:   append a new key with type `boolean`.
 * REMOVE a flag: delete the key here AND in both environment files,
 *                then remove every `isEnabled('<flag>')` call-site.
 *
 * Naming convention: `enable<FeatureName>` (camelCase, positive assertion).
 *
 * See docs/feature-flags.md for the full lifecycle guide.
 */
export interface FeatureFlags {
  /** Gate all telemetry instrumentation (error handler, router timing, web-vitals). */
  enableTelemetry: boolean;
  /** Gate the Redux dispatch-count monitor in sub-app1. */
  enableReduxMonitor: boolean;
  /** Gate the mfeTimed() load-timing wrapper in app-routing. */
  enableMfeTiming: boolean;
  /**
   * Gate the periodic (interval-based) flush in TelemetryFlushService.
   *
   * When ON:  TelemetryFlushService flushes the ring buffer every
   *           TELEMETRY_FLUSH_INTERVAL_MS (default 30 s) in addition to
   *           the existing pagehide / visibilitychange triggers. Each
   *           periodic flush emits a `telemetry.flush.periodic` counter.
   *
   * When OFF: Only pagehide / visibilitychange trigger a flush (original
   *           behaviour). No setInterval is scheduled — zero overhead.
   *
   * Safety: default OFF in production. Enable only after validating that
   * the collector endpoint handles the increased request frequency.
   *
   * Rollback: set `enablePeriodicFlush: false` in environment.prod.ts
   *           and redeploy — the interval is never scheduled.
   */
  enablePeriodicFlush: boolean;
}

// ── Testing seam ─────────────────────────────────────────────────────────────
// Tests that need to exercise the flag-OFF code path call
// _setFlagOverridesForTesting() in beforeEach / afterEach.
// Production and dev builds never call this function.
let _testOverrides: Partial<FeatureFlags> | null = null;

/**
 * Override specific flags for the duration of a test.
 * Call with `null` in afterEach to restore the environment default.
 *
 * ```typescript
 * beforeEach(() => _setFlagOverridesForTesting({ enableTelemetry: false }));
 * afterEach(() => _setFlagOverridesForTesting(null));
 * ```
 */
export function _setFlagOverridesForTesting(overrides: Partial<FeatureFlags> | null): void {
  _testOverrides = overrides;
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * FeatureFlagService — injectable service for checking feature flag state.
 *
 * Inject this service anywhere in the Angular DI tree:
 *
 *   constructor(private flags: FeatureFlagService) {}
 *
 *   if (this.flags.isEnabled('enableTelemetry')) { ... }
 *
 * Outside the DI tree (e.g. Redux enhancers) call the standalone helper:
 *
 *   import { isFlagEnabled } from './feature-flag.service';
 *   if (isFlagEnabled('enableReduxMonitor')) { ... }
 */
@Injectable({ providedIn: 'root' })
export class FeatureFlagService {
  private readonly flags: FeatureFlags = environment.featureFlags;

  /**
   * Returns true when the named flag is enabled in the current environment.
   * Test overrides (via _setFlagOverridesForTesting) take precedence.
   * Unknown keys return false (safe default).
   */
  isEnabled(flag: keyof FeatureFlags): boolean {
    if (_testOverrides !== null && flag in _testOverrides) {
      return _testOverrides[flag]!;
    }
    return this.flags[flag] ?? false;
  }

  /**
   * Returns a snapshot of all flags — useful for diagnostics or logging.
   */
  snapshot(): Readonly<FeatureFlags> {
    return { ...this.flags };
  }
}

/**
 * Standalone helper for use outside Angular DI (Redux enhancers, factory fns).
 * Reads directly from the compiled environment object — no injection required.
 * Test overrides (via _setFlagOverridesForTesting) take precedence.
 */
export function isFlagEnabled(flag: keyof FeatureFlags): boolean {
  if (_testOverrides !== null && flag in _testOverrides) {
    return _testOverrides[flag]!;
  }
  return environment.featureFlags[flag] ?? false;
}
