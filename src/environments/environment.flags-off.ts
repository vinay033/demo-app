/**
 * environment.flags-off.ts — all feature flags disabled.
 *
 * Used by the `flags-off` Angular test configuration to run the full test suite
 * with every flag set to false. This validates that every flag guard correctly
 * produces the expected no-op / fallback behaviour.
 *
 * Used by CI matrix: ng test --configuration=flags-off
 * NOT used in production builds (environment.prod.ts handles prod defaults).
 *
 * See docs/feature-flags.md for the full lifecycle guide.
 */
import { FeatureFlags } from '../app/feature-flags/feature-flag.service';

const featureFlags: FeatureFlags = {
  enableTelemetry: false,
  enableReduxMonitor: false,
  enableMfeTiming: false,
};

export const environment = {
  production: false, // still a test build — not production
  featureFlags,
};
