import { TestBed } from '@angular/core/testing';
import { TelemetryService } from './telemetry.service';

describe('TelemetryService', () => {
  let service: TelemetryService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [TelemetryService] });
    service = TestBed.inject(TelemetryService);
    spyOn(console, 'log'); // suppress output in test runner
  });

  // ── counter ────────────────────────────────────────────────────────────────
  describe('counter()', () => {
    it('appends a counter event', () => {
      service.counter('page.view');
      expect(service.events[0].type).toBe('counter');
      expect(service.events[0].name).toBe('page.view');
      expect(service.events[0].value).toBe(1);
    });

    it('accepts a custom increment', () => {
      service.counter('batch.items', 5);
      expect(service.events[0].value).toBe(5);
    });

    it('attaches tags', () => {
      service.counter('error.unhandled', 1, { error_name: 'TypeError' });
      expect(service.events[0].tags?.['error_name']).toBe('TypeError');
    });
  });

  // ── timing ─────────────────────────────────────────────────────────────────
  describe('timing()', () => {
    it('appends a timing event', () => {
      service.timing('route.navigation_ms', 123.7);
      expect(service.events[0].type).toBe('timing');
      expect(service.events[0].name).toBe('route.navigation_ms');
    });

    it('rounds fractional milliseconds', () => {
      service.timing('route.navigation_ms', 99.9);
      expect(service.events[0].value).toBe(100);
    });
  });

  // ── gauge ──────────────────────────────────────────────────────────────────
  describe('gauge()', () => {
    it('appends a gauge event', () => {
      service.gauge('web_vitals.cls', 42);
      expect(service.events[0].type).toBe('gauge');
      expect(service.events[0].value).toBe(42);
    });
  });

  // ── ring buffer ────────────────────────────────────────────────────────────
  describe('ring buffer', () => {
    it('stores up to 500 events without dropping', () => {
      for (let i = 0; i < 500; i++) service.counter('x');
      expect(service.events.length).toBe(500);
    });

    it('drops the oldest event when cap is exceeded', () => {
      for (let i = 0; i < 500; i++) service.counter('fill', i + 1);
      service.counter('new.event');
      // First event (value=1) was dropped; last event is the new one
      expect(service.events[0].value).toBe(2);
      expect(service.events[service.events.length - 1].name).toBe('new.event');
    });

    it('never exceeds 500 events under sustained load', () => {
      for (let i = 0; i < 1000; i++) service.counter('spam');
      expect(service.events.length).toBe(500);
    });
  });

  // ── flush ──────────────────────────────────────────────────────────────────
  describe('flush()', () => {
    it('returns true and clears events when sendBeacon succeeds', () => {
      spyOn(navigator, 'sendBeacon').and.returnValue(true);
      service.counter('a');
      service.counter('b');

      const ok = service.flush('https://collector.example.com/metrics');

      expect(ok).toBeTrue();
      expect(navigator.sendBeacon).toHaveBeenCalledOnceWith(
        'https://collector.example.com/metrics',
        jasmine.any(Blob),
      );
      expect(service.events.length).toBe(0);
    });

    it('returns false and retains events when sendBeacon fails', () => {
      jasmine.clock().install();
      spyOn(navigator, 'sendBeacon').and.returnValue(false);
      service.counter('keep');

      const ok = service.flush('https://collector.example.com/metrics');

      expect(ok).toBeFalse();
      expect(service.events.length).toBe(1);
      jasmine.clock().uninstall();
    });

    it('returns true immediately when there are no events', () => {
      spyOn(navigator, 'sendBeacon');
      const ok = service.flush('https://collector.example.com/metrics');
      expect(ok).toBeTrue();
      expect(navigator.sendBeacon).not.toHaveBeenCalled();
    });

    it('returns false and warns when URL is empty', () => {
      spyOn(navigator, 'sendBeacon');
      spyOn(console, 'warn');
      service.counter('x');
      const ok = service.flush('');
      expect(ok).toBeFalse();
      expect(navigator.sendBeacon).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith(
        jasmine.stringContaining('[telemetry]'),
        jasmine.stringContaining('empty URL'),
      );
    });

    it('sends NDJSON: one JSON object per line', () => {
      let capturedBlob: Blob | undefined;
      spyOn(navigator, 'sendBeacon').and.callFake((_url: string, body: Blob) => {
        capturedBlob = body;
        return true;
      });
      service.counter('ev1');
      service.counter('ev2');
      service.flush('https://x');

      expect(capturedBlob!.type).toBe('application/x-ndjson');
    });

    it('splits a large buffer into multiple chunks and sends each separately', () => {
      spyOn(navigator, 'sendBeacon').and.returnValue(true);
      // Add 250 events — should produce 2 chunks (200 + 50) for BEACON_CHUNK_EVENTS=200
      for (let i = 0; i < 250; i++) service.counter('x');

      service.flush('https://collector.example.com/metrics');

      expect((navigator.sendBeacon as jasmine.Spy).calls.count()).toBe(2);
      expect(service.events.length).toBe(0); // all sent
    });

    it('stops sending further chunks after a chunk failure and retains unsent events', () => {
      jasmine.clock().install();
      let beaconCalls = 0;
      spyOn(navigator, 'sendBeacon').and.callFake(() => ++beaconCalls !== 1); // first call fails
      for (let i = 0; i < 250; i++) service.counter('x'); // 2 chunks: 200 + 50

      service.flush('https://collector.example.com/metrics');

      // Only 1 sendBeacon call attempted (stopped at failure)
      expect(beaconCalls).toBe(1);
      // All 250 events retained (first chunk failed, second never sent)
      expect(service.events.length).toBe(250);
      jasmine.clock().uninstall();
    });
  });

  // ── timestamp ──────────────────────────────────────────────────────────────
  it('records a Unix timestamp on every event', () => {
    const before = Date.now();
    service.counter('ts.test');
    const after = Date.now();
    expect(service.events[0].timestamp).toBeGreaterThanOrEqual(before);
    expect(service.events[0].timestamp).toBeLessThanOrEqual(after);
  });
});
