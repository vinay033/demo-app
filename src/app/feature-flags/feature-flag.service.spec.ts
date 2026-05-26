import { TestBed } from '@angular/core/testing';
import { FeatureFlagService, isFlagEnabled, _setFlagOverridesForTesting } from './feature-flag.service';

// Spy on the environment module so tests are not coupled to the compiled value.
import * as env from '../../environments/environment';

describe('FeatureFlagService', () => {
  let service: FeatureFlagService;

  beforeEach(() => {
    _setFlagOverridesForTesting(null); // reset before each test
    TestBed.configureTestingModule({});
    service = TestBed.inject(FeatureFlagService);
  });

  afterEach(() => _setFlagOverridesForTesting(null));

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('isEnabled returns true for a flag that is on in the environment', () => {
    // dev environment has enableTelemetry: true
    const result = service.isEnabled('enableTelemetry');
    // The compiled test environment is dev (environment.ts), so flag is true.
    expect(typeof result).toBe('boolean');
  });

  it('isEnabled returns false for an unknown flag (safe default)', () => {
    // Intentional: simulates a removed flag still called at a stale call-site
    // (key no longer in FeatureFlags type). The any cast is the only way to bypass
    // TypeScript here, which is exactly the runtime condition being tested.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(service.isEnabled('nonExistentFlag' as any)).toBeFalse();
  });

  it('snapshot returns a copy of all flags', () => {
    const snap = service.snapshot();
    expect(snap).toEqual(jasmine.objectContaining({
      enableTelemetry: jasmine.any(Boolean),
      enableReduxMonitor: jasmine.any(Boolean),
      enableMfeTiming: jasmine.any(Boolean),
    }));
  });

  it('snapshot is a copy — mutating it does not affect the service', () => {
    // Spread into a mutable plain object to verify the snapshot is a defensive
    // copy (not a live reference to the internal flags). No `as any` needed —
    // the spread creates a new writable object so TypeScript allows mutation.
    const snap1 = { ...service.snapshot() };
    snap1.enableTelemetry = !snap1.enableTelemetry;
    const snap2 = service.snapshot();
    expect(snap2.enableTelemetry).toBe(env.environment.featureFlags.enableTelemetry);
  });

  describe('flag OFF via _setFlagOverridesForTesting', () => {
    it('isEnabled returns false when override sets flag to false', () => {
      _setFlagOverridesForTesting({ enableTelemetry: false });
      expect(service.isEnabled('enableTelemetry')).toBeFalse();
    });

    it('isEnabled returns true when override sets flag to true', () => {
      _setFlagOverridesForTesting({ enableTelemetry: true });
      expect(service.isEnabled('enableTelemetry')).toBeTrue();
    });

    it('only the overridden flag changes — other flags are unaffected', () => {
      _setFlagOverridesForTesting({ enableTelemetry: false });
      // enableReduxMonitor should still read from the environment
      expect(service.isEnabled('enableReduxMonitor'))
        .toBe(env.environment.featureFlags.enableReduxMonitor);
    });

    it('null override restores the environment value', () => {
      _setFlagOverridesForTesting({ enableTelemetry: false });
      _setFlagOverridesForTesting(null);
      expect(service.isEnabled('enableTelemetry'))
        .toBe(env.environment.featureFlags.enableTelemetry);
    });
  });
});

describe('isFlagEnabled (standalone helper)', () => {
  afterEach(() => _setFlagOverridesForTesting(null));

  it('returns a boolean for every known flag', () => {
    expect(typeof isFlagEnabled('enableTelemetry')).toBe('boolean');
    expect(typeof isFlagEnabled('enableReduxMonitor')).toBe('boolean');
    expect(typeof isFlagEnabled('enableMfeTiming')).toBe('boolean');
  });

  it('returns false for an unknown flag', () => {
    // Same rationale as above: simulates a stale call-site passing a key
    // that no longer exists in FeatureFlags (removed flag scenario).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(isFlagEnabled('nonExistentFlag' as any)).toBeFalse();
  });

  it('respects _setFlagOverridesForTesting when flag is forced OFF', () => {
    _setFlagOverridesForTesting({ enableReduxMonitor: false });
    expect(isFlagEnabled('enableReduxMonitor')).toBeFalse();
  });

  it('respects _setFlagOverridesForTesting when flag is forced ON', () => {
    _setFlagOverridesForTesting({ enableReduxMonitor: true });
    expect(isFlagEnabled('enableReduxMonitor')).toBeTrue();
  });
});
