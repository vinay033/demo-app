// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

import { FeatureFlags } from '../app/feature-flags/feature-flag.service';

const featureFlags: FeatureFlags = {
  /** Gate all telemetry instrumentation (error handler, router timing, web-vitals). */
  enableTelemetry: true,
  /** Gate the Redux dispatch-count monitor in sub-app1. */
  enableReduxMonitor: true,
  /** Gate the mfeTimed() load-timing wrapper in app-routing. */
  enableMfeTiming: true,
};

export const environment = {
  production: false,

  /**
   * Telemetry collector endpoint.
   * Empty string = disabled (dev default — no beacons sent).
   * Set to a real URL (e.g. https://collector.example.com/metrics) to enable.
   */
  telemetryEndpoint: '',

  /**
   * Feature flags — development defaults.
   * All flags default ON in dev so engineers can exercise new behaviour
   * without extra setup. Flip individual flags to false to test the
   * disabled code path locally.
   *
   * See docs/feature-flags.md for the full lifecycle guide.
   */
  featureFlags,
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
