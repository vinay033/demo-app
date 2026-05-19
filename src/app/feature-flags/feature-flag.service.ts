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
   * Unknown keys return false (safe default).
   */
  isEnabled(flag: keyof FeatureFlags): boolean {
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
 */
export function isFlagEnabled(flag: keyof FeatureFlags): boolean {
  return environment.featureFlags[flag] ?? false;
}
