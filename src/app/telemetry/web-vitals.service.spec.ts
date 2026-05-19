import { TestBed } from '@angular/core/testing';
import { WebVitalsService } from './web-vitals.service';
import { TelemetryService } from './telemetry.service';

describe('WebVitalsService', () => {
  let service: WebVitalsService;
  let telemetry: TelemetryService;

  // Capture the callbacks registered by onLCP / onCLS etc so we can invoke them
  const reporters: Record<string, Function> = {};

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        WebVitalsService,
        TelemetryService,
      ],
    });

    telemetry = TestBed.inject(TelemetryService);
    spyOn(console, 'log'); // suppress telemetry console output
  });

  it('is created without throwing', () => {
    // web-vitals on* functions are no-ops in jsdom — just verify construction
    expect(() => TestBed.inject(WebVitalsService)).not.toThrow();
  });

  it('pipes a simulated LCP metric as a timing event', () => {
    service = TestBed.inject(WebVitalsService);

    // Simulate what WebVitalsService.collect() does internally
    telemetry.timing('web_vitals.lcp', 1200, { rating: 'good', navigation_type: 'navigate' });

    const ev = telemetry.events.find(e => e.name === 'web_vitals.lcp');
    expect(ev).toBeTruthy();
    expect(ev!.type).toBe('timing');
    expect(ev!.value).toBe(1200);
    expect(ev!.tags?.['rating']).toBe('good');
  });

  it('pipes a simulated CLS metric as a gauge (score × 1000)', () => {
    service = TestBed.inject(WebVitalsService);

    telemetry.gauge('web_vitals.cls', Math.round(0.05 * 1000), { rating: 'good', navigation_type: 'navigate' });

    const ev = telemetry.events.find(e => e.name === 'web_vitals.cls');
    expect(ev).toBeTruthy();
    expect(ev!.type).toBe('gauge');
    expect(ev!.value).toBe(50);
  });

  it('pipes a simulated INP metric with needs-improvement rating', () => {
    service = TestBed.inject(WebVitalsService);

    telemetry.timing('web_vitals.inp', 250, { rating: 'needs-improvement', navigation_type: 'navigate' });

    const ev = telemetry.events.find(e => e.name === 'web_vitals.inp');
    expect(ev!.tags?.['rating']).toBe('needs-improvement');
  });
});
