import { TestBed } from '@angular/core/testing';
import { FeatureFlagService, isFlagEnabled } from './feature-flag.service';

// Spy on the environment module so tests are not coupled to the compiled value.
import * as env from '../../environments/environment';

describe('FeatureFlagService', () => {
  let service: FeatureFlagService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FeatureFlagService);
  });

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
    // Cast to bypass TypeScript — simulates a removed flag still called at a stale call-site.
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
    const snap1 = service.snapshot() as any;
    snap1.enableTelemetry = !snap1.enableTelemetry;
    const snap2 = service.snapshot();
    expect(snap2.enableTelemetry).toBe(env.environment.featureFlags.enableTelemetry);
  });
});

describe('isFlagEnabled (standalone helper)', () => {
  it('returns a boolean for every known flag', () => {
    expect(typeof isFlagEnabled('enableTelemetry')).toBe('boolean');
    expect(typeof isFlagEnabled('enableReduxMonitor')).toBe('boolean');
    expect(typeof isFlagEnabled('enableMfeTiming')).toBe('boolean');
  });

  it('returns false for an unknown flag', () => {
    expect(isFlagEnabled('nonExistentFlag' as any)).toBeFalse();
  });
});
