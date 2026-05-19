/**
 * Contract test: environment object shape
 *
 * All three projects (demo-app, sub-app1, sub-app2) consume the same
 * environment object. sub-app1 and sub-app2 re-export from this file,
 * so a single spec here covers the shared contract.
 *
 * Rules enforced:
 *   1. `production` key must exist and be a boolean.
 *   2. `featureFlags` key must exist with exactly the documented flag names.
 *   3. No extra keys are allowed without a deliberate review of this file.
 *   4. dev and prod shapes must be structurally identical (only values differ).
 */

import { environment as devEnv } from './environment';
import { environment as prodEnv } from './environment.prod';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Asserts that `obj` has exactly the keys listed in `expectedKeys`. */
function assertExactKeys(obj: object, expectedKeys: string[], label: string): void {
  const actual = Object.keys(obj).sort();
  const expected = [...expectedKeys].sort();
  expect(actual)
    .withContext(`${label} must have exactly the keys [${expected.join(', ')}]`)
    .toEqual(expected);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('environment object — shape contract', () => {

  describe('dev environment (environment.ts)', () => {
    it('contains the required "production" key', () => {
      expect(Object.prototype.hasOwnProperty.call(devEnv, 'production')).toBeTrue();
    });

    it('"production" is a boolean', () => {
      expect(typeof devEnv.production).toBe('boolean');
    });

    it('"production" is false in dev', () => {
      expect(devEnv.production).toBeFalse();
    });

    it('has no undocumented extra keys', () => {
      // UPDATE THIS LIST when you intentionally add a new environment key.
      const ALLOWED_KEYS = ['production', 'featureFlags'];
      assertExactKeys(devEnv, ALLOWED_KEYS, 'dev environment');
    });

    it('featureFlags contains exactly the documented flags', () => {
      // UPDATE THIS LIST when you add or remove a feature flag.
      // See docs/feature-flags.md and src/app/feature-flags/feature-flag.service.ts.
      const ALLOWED_FLAGS = ['enableTelemetry', 'enableReduxMonitor', 'enableMfeTiming'];
      assertExactKeys(devEnv.featureFlags, ALLOWED_FLAGS, 'dev featureFlags');
    });

    it('all featureFlags values are booleans', () => {
      Object.entries(devEnv.featureFlags).forEach(([key, value]) => {
        expect(typeof value)
          .withContext(`dev featureFlags.${key} must be a boolean`)
          .toBe('boolean');
      });
    });
  });

  describe('prod environment (environment.prod.ts)', () => {
    it('contains the required "production" key', () => {
      expect(Object.prototype.hasOwnProperty.call(prodEnv, 'production')).toBeTrue();
    });

    it('"production" is a boolean', () => {
      expect(typeof prodEnv.production).toBe('boolean');
    });

    it('"production" is true in prod', () => {
      expect(prodEnv.production).toBeTrue();
    });

    it('has no undocumented extra keys', () => {
      const ALLOWED_KEYS = ['production', 'featureFlags'];
      assertExactKeys(prodEnv, ALLOWED_KEYS, 'prod environment');
    });

    it('featureFlags contains exactly the documented flags', () => {
      const ALLOWED_FLAGS = ['enableTelemetry', 'enableReduxMonitor', 'enableMfeTiming'];
      assertExactKeys(prodEnv.featureFlags, ALLOWED_FLAGS, 'prod featureFlags');
    });

    it('all featureFlags values are booleans', () => {
      Object.entries(prodEnv.featureFlags).forEach(([key, value]) => {
        expect(typeof value)
          .withContext(`prod featureFlags.${key} must be a boolean`)
          .toBe('boolean');
      });
    });
  });

  describe('dev / prod structural parity', () => {
    it('dev and prod have the same set of keys', () => {
      const devKeys = Object.keys(devEnv).sort();
      const prodKeys = Object.keys(prodEnv).sort();
      expect(devKeys)
        .withContext('dev and prod environment objects must share the same keys')
        .toEqual(prodKeys);
    });

    it('dev and prod featureFlags have the same set of flag names', () => {
      const devFlags = Object.keys(devEnv.featureFlags).sort();
      const prodFlags = Object.keys(prodEnv.featureFlags).sort();
      expect(devFlags)
        .withContext('dev and prod featureFlags must have the same flag names')
        .toEqual(prodFlags);
    });
  });
});
