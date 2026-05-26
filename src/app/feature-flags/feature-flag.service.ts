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
      // TypeScript 4.x does not narrow Partial<T>[keyof T] after an `in` check,
      // so the value remains `boolean | undefined`. The `?? false` handles the
      // theoretical undefined case defensively; at runtime the value is always
      // a boolean because _setFlagOverridesForTesting only accepts FeatureFlags values.
      return _testOverrides[flag] ?? false;
    }
    // this.flags is FeatureFlags (non-partial). TypeScript types all values as
    // boolean, but callers can pass stale/removed keys at runtime (e.g. a call-site
    // not yet updated after a flag was deleted). The ?? false preserves the documented
    // "unknown keys return false" contract. no-unnecessary-condition is suppressed here
    // because the safety value is intentional defensive coding, not dead code.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- unknown-key safety contract (see JSDoc)
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
    // See comment in isEnabled(): TypeScript 4 does not narrow Partial<T>[keyof T]
    // after `in`, so ?? false is a defensive fallback; value is always boolean at runtime.
    return _testOverrides[flag] ?? false;
  }
  // environment.featureFlags is FeatureFlags (non-partial). See isEnabled() comment:
  // the ?? false is an intentional safety net for stale call-sites that pass removed
  // flag keys at runtime. Suppressed no-unnecessary-condition for the same reason.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- unknown-key safety contract (see JSDoc)
  return environment.featureFlags[flag] ?? false;
}
