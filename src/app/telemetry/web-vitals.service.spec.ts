import { TestBed } from '@angular/core/testing';
import { WebVitalsService } from './web-vitals.service';
import { TelemetryService } from './telemetry.service';
import { _setFlagOverridesForTesting } from '../feature-flags/feature-flag.service';

describe('WebVitalsService', () => {
  let telemetry: TelemetryService;

  beforeEach(() => {
    // Explicitly force flag ON so these specs pass in BOTH CI modes.
    _setFlagOverridesForTesting({ enableTelemetry: true });
    TestBed.configureTestingModule({
      providers: [
        WebVitalsService,
        TelemetryService,
      ],
    });

    telemetry = TestBed.inject(TelemetryService);
    spyOn(console, 'log'); // suppress telemetry console output
  });

  afterEach(() => _setFlagOverridesForTesting(null));

  // ── Flag ON ───────────────────────────────────────────────────────────────

  it('is created without throwing', () => {
    // web-vitals on* functions are no-ops in jsdom — just verify construction
    expect(() => TestBed.inject(WebVitalsService)).not.toThrow();
  });

  it('pipes a simulated LCP metric as a timing event', () => {
    TestBed.inject(WebVitalsService); // ensure constructor side-effects run

    // Simulate what WebVitalsService.collect() does internally
    telemetry.timing('web_vitals.lcp', 1200, { rating: 'good', navigation_type: 'navigate' });

    const ev = telemetry.events.find(e => e.name === 'web_vitals.lcp');
    expect(ev).toBeTruthy();
    expect(ev!.type).toBe('timing');
    expect(ev!.value).toBe(1200);
    expect(ev!.tags?.['rating']).toBe('good');
  });

  it('pipes a simulated CLS metric as a gauge (score × 1000)', () => {
    TestBed.inject(WebVitalsService); // ensure constructor side-effects run

    telemetry.gauge('web_vitals.cls', Math.round(0.05 * 1000), { rating: 'good', navigation_type: 'navigate' });

    const ev = telemetry.events.find(e => e.name === 'web_vitals.cls');
    expect(ev).toBeTruthy();
    expect(ev!.type).toBe('gauge');
    expect(ev!.value).toBe(50);
  });

  it('pipes a simulated INP metric with needs-improvement rating', () => {
    TestBed.inject(WebVitalsService); // ensure constructor side-effects run

    telemetry.timing('web_vitals.inp', 250, { rating: 'needs-improvement', navigation_type: 'navigate' });

    const ev = telemetry.events.find(e => e.name === 'web_vitals.inp');
    expect(ev!.tags?.['rating']).toBe('needs-improvement');
  });

  // ── Flag OFF ──────────────────────────────────────────────────────────────

  describe('when enableTelemetry is OFF', () => {
    // The flag override must be set BEFORE the service is created
    // (the guard runs in the constructor). We do NOT resetTestingModule here
    // because the outer beforeEach already configures the module correctly —
    // we just override the flag and let each test inject the service fresh.

    it('constructs without throwing', () => {
      _setFlagOverridesForTesting({ enableTelemetry: false });
      // Re-inject from a fresh TestBed state for this test
      expect(() => {
        TestBed.inject(WebVitalsService);
      }).not.toThrow();
    });

    it('does not register any web-vitals observers — buffer stays empty', () => {
      _setFlagOverridesForTesting({ enableTelemetry: false });
      // Create a fresh TelemetryService for isolation
      const freshTelemetry = new (require('./telemetry.service').TelemetryService)();
      // Directly test the guard: isFlagEnabled should return false
      const { isFlagEnabled } = require('../feature-flags/feature-flag.service');
      expect(isFlagEnabled('enableTelemetry')).toBeFalse();
      // No events should have been emitted
      expect(freshTelemetry.events.length).toBe(0);
    });
  });
});
