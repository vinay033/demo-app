import { FeatureFlags } from '../app/feature-flags/feature-flag.service';

const featureFlags: FeatureFlags = {
  enableTelemetry: false,
  enableReduxMonitor: false,
  enableMfeTiming: false,
};

export const environment = {
  production: true,

  /**
   * Telemetry collector endpoint.
   * Replace with the real ingest URL before deploying.
   * Empty string keeps flush() a safe no-op (guard in TelemetryService).
   */
  telemetryEndpoint: '',

  /**
   * Feature flags — production defaults.
   * All flags default OFF in production. Enable a flag here (or via CI
   * environment injection) only after the feature has been validated in
   * staging. Remove the flag and its guard code once the feature is
   * permanently enabled and the rollback window has passed.
   *
   * See docs/feature-flags.md for the full lifecycle guide.
   */
  featureFlags,
};
