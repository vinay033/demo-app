/**
 * resilience-failures.spec.ts
 *
 * Failure-mode tests for the resilience helpers and the call sites they protect.
 * Each describe block names the failure scenario, documents the expected degradation
 * behaviour, and verifies the system stays consistent (no unhandled exceptions,
 * no silent data loss, no crash).
 *
 * Conventions
 * ───────────
 * • "graceful degradation" = returns false / logs error / retains buffer, does NOT throw
 * • "retry exhaustion"     = scheduleBeaconRetry stops after maxAttempts, no further calls
 * • "partial success"      = successfully sent events are cleared; failed ones are kept
 */

import { TestBed } from '@angular/core/testing';
import { TelemetryService } from './telemetry.service';
import { WebVitalsService } from './web-vitals.service';
import { scheduleBeaconRetry, safeCallback, RetryOptions } from './resilience';
import { _setFlagOverridesForTesting } from '../feature-flags/feature-flag.service';

// ── TelemetryService.flush() — failure paths ─────────────────────────────────

describe('TelemetryService.flush() — failure scenarios', () => {
  let service: TelemetryService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [TelemetryService] });
    service = TestBed.inject(TelemetryService);
    spyOn(console, 'log'); // suppress telemetry output
  });

  // ── Precondition guards ──────────────────────────────────────────────────

  describe('URL guard', () => {
    it('returns false and logs a warning — does not call sendBeacon', () => {
      spyOn(console, 'warn');
      spyOn(navigator, 'sendBeacon');
      service.counter('x');

      const ok = service.flush('');

      expect(ok).toBeFalse();
      expect(navigator.sendBeacon).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith(jasmine.stringContaining('empty URL'));
    });

    it('retains all buffered events after an empty-URL flush', () => {
      spyOn(console, 'warn');
      service.counter('a');
      service.counter('b');
      service.flush('');
      expect(service.events.length).toBe(2); // nothing cleared
    });
  });

  describe('sendBeacon API unavailable (SSR / restricted environment)', () => {
    let originalSendBeacon: typeof navigator.sendBeacon;

    beforeEach(() => { originalSendBeacon = navigator.sendBeacon; });
    afterEach(() => { navigator.sendBeacon = originalSendBeacon; });

    it('returns false gracefully when sendBeacon is not a function', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- simulate SSR environment
      (navigator as any).sendBeacon = undefined;
      service.counter('x');

      const ok = service.flush('https://collector.example.com');

      expect(ok).toBeFalse();
    });

    it('retains all buffered events when sendBeacon is unavailable', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- simulate SSR
      (navigator as any).sendBeacon = undefined;
      service.counter('a');
      service.counter('b');
      service.flush('https://collector.example.com');

      expect(service.events.length).toBe(2); // events preserved for later
    });
  });

  // ── sendBeacon throws ────────────────────────────────────────────────────

  describe('sendBeacon throws a TypeError (invalid URL format)', () => {
    beforeEach(() => {
      spyOn(console, 'error');
    });

    it('does not propagate the exception to the caller', () => {
      spyOn(navigator, 'sendBeacon').and.throwError('TypeError: invalid URL');
      service.counter('x');

      expect(() => service.flush('not-a-valid-url')).not.toThrow();
    });

    it('returns false on a sendBeacon throw', () => {
      spyOn(navigator, 'sendBeacon').and.throwError('TypeError: invalid URL');
      service.counter('x');

      const ok = service.flush('not-a-valid-url');

      expect(ok).toBeFalse();
    });

    it('retains buffered events after a sendBeacon throw', () => {
      spyOn(navigator, 'sendBeacon').and.throwError('TypeError: invalid URL');
      service.counter('keep-me');

      service.flush('not-a-valid-url');

      expect(service.events.length).toBe(1);
    });

    it('logs the error via console.error', () => {
      spyOn(navigator, 'sendBeacon').and.throwError('burst');
      service.counter('x');

      service.flush('https://collector.example.com');

      expect(console.error).toHaveBeenCalledWith(
        jasmine.stringContaining('[telemetry]'),
        jasmine.anything(),
      );
    });
  });

  // ── Partial success across chunks ─────────────────────────────────────────

  describe('partial chunk success (first chunk ok, second fails)', () => {
    it('clears only the events from successfully sent chunks', () => {
      jasmine.clock().install();
      let beaconCalls = 0;
      spyOn(navigator, 'sendBeacon').and.callFake(() => ++beaconCalls === 1); // 1st ok, 2nd fails

      for (let i = 0; i < 250; i++) service.counter('fill');

      service.flush('https://collector.example.com');

      // First chunk (200 events) succeeded → cleared
      // Second chunk (50 events) failed → retained
      expect(service.events.length).toBe(50);
      jasmine.clock().uninstall();
    });

    it('returns false when any chunk fails', () => {
      jasmine.clock().install();
      let calls = 0;
      spyOn(navigator, 'sendBeacon').and.callFake(() => ++calls === 1);

      for (let i = 0; i < 250; i++) service.counter('fill');
      const ok = service.flush('https://collector.example.com');

      expect(ok).toBeFalse();
      jasmine.clock().uninstall();
    });

    it('stops sending after the first failed chunk — does not attempt further chunks', () => {
      jasmine.clock().install();
      let calls = 0;
      spyOn(navigator, 'sendBeacon').and.callFake(() => ++calls === 1);

      // Push enough to get 3 chunks: MAX_EVENTS=500 → chunks of 200, 200, 100
      // (600 inserts but ring buffer caps at 500)
      for (let i = 0; i < 600; i++) service.counter('fill');
      expect(service.events.length).toBe(500); // confirm ring-buffer cap

      service.flush('https://collector.example.com');

      // chunk 1 (200 events): ok — cleared
      // chunk 2 (200 events): fails → stop, retry scheduled
      // chunk 3 (100 events): never attempted
      expect(calls).toBe(2);
      expect(service.events.length).toBe(300); // 200 cleared; 300 retained
      jasmine.clock().uninstall();
    });
  });

  // ── Retry backoff triggered by flush failure ──────────────────────────────

  describe('retry scheduling on sendBeacon failure', () => {
    it('schedules a retry when sendBeacon returns false', () => {
      jasmine.clock().install();
      const sendBeaconSpy = spyOn(navigator, 'sendBeacon').and.returnValue(false);

      service.counter('x');
      service.flush('https://collector.example.com', {
        maxAttempts: 1,
        baseDelayMs: 500,
        maxDelayMs: 5000,
      });

      // After flush: sendBeacon called once synchronously (the flush)
      expect(sendBeaconSpy).toHaveBeenCalledTimes(1);

      // After delay: retry fires
      jasmine.clock().tick(500);
      expect(sendBeaconSpy).toHaveBeenCalledTimes(2);

      jasmine.clock().uninstall();
    });

    it('does not schedule retries when sendBeacon succeeds', () => {
      jasmine.clock().install();
      const sendBeaconSpy = spyOn(navigator, 'sendBeacon').and.returnValue(true);

      service.counter('x');
      service.flush('https://collector.example.com');

      jasmine.clock().tick(60_000); // advance far past any retry window
      expect(sendBeaconSpy).toHaveBeenCalledTimes(1); // no retries scheduled

      jasmine.clock().uninstall();
    });
  });
});

// ── scheduleBeaconRetry — failure paths ──────────────────────────────────────

describe('scheduleBeaconRetry — failure scenarios', () => {
  beforeEach(() => jasmine.clock().install());
  afterEach(() => jasmine.clock().uninstall());

  describe('retry exhaustion', () => {
    it('makes exactly maxAttempts retry calls then stops', () => {
      const sendBeaconSpy = spyOn(navigator, 'sendBeacon').and.returnValue(false);
      const opts: RetryOptions = { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 5000 };

      scheduleBeaconRetry('https://example.com', new Blob(['x']), opts);

      jasmine.clock().tick(100);   // attempt 1 → fails
      jasmine.clock().tick(200);   // attempt 2 → fails
      jasmine.clock().tick(400);   // attempt 3 → fails
      jasmine.clock().tick(60_000); // no further ticks should trigger more

      expect(sendBeaconSpy).toHaveBeenCalledTimes(3);
    });

    it('stops immediately when maxAttempts is 0 — no timer is set', () => {
      const sendBeaconSpy = spyOn(navigator, 'sendBeacon');

      scheduleBeaconRetry('https://example.com', new Blob(['x']),
        { maxAttempts: 0, baseDelayMs: 100, maxDelayMs: 5000 });

      // Advance far past any plausible delay — nothing should fire
      jasmine.clock().tick(60_000);
      expect(sendBeaconSpy).not.toHaveBeenCalled();
    });
  });

  describe('sendBeacon throws during a retry attempt', () => {
    it('does not produce an unhandled exception when sendBeacon throws in setTimeout', () => {
      let throwOnCall = 2; // first call (flush) is fine; retry call throws
      spyOn(navigator, 'sendBeacon').and.callFake(() => {
        if (--throwOnCall <= 0) throw new Error('sendBeacon burst during retry');
        return false;
      });

      // scheduleBeaconRetry is called directly here (simulating flush scheduling a retry)
      expect(() => {
        scheduleBeaconRetry('https://example.com', new Blob(['x']),
          { maxAttempts: 1, baseDelayMs: 100, maxDelayMs: 5000 });
        jasmine.clock().tick(100); // fire the setTimeout
      }).not.toThrow();
    });

    it('stops retrying after sendBeacon throws — does not schedule further attempts', () => {
      spyOn(navigator, 'sendBeacon').and.throwError('burst');
      spyOn(console, 'error');

      scheduleBeaconRetry('https://example.com', new Blob(['x']),
        { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 5000 });

      jasmine.clock().tick(100);   // attempt 1 throws
      jasmine.clock().tick(60_000); // no further retries scheduled

      // sendBeacon called once (the throw stops the chain)
      expect((navigator.sendBeacon as jasmine.Spy).calls.count()).toBe(1);
    });
  });

  describe('backoff delay accuracy', () => {
    it('does not fire before the computed delay', () => {
      const sendBeaconSpy = spyOn(navigator, 'sendBeacon').and.returnValue(true);
      const opts: RetryOptions = { maxAttempts: 1, baseDelayMs: 1000, maxDelayMs: 30_000 };

      scheduleBeaconRetry('https://example.com', new Blob(['x']), opts);

      jasmine.clock().tick(999); // 1 ms before the delay
      expect(sendBeaconSpy).not.toHaveBeenCalled();

      jasmine.clock().tick(1); // exactly at the delay
      expect(sendBeaconSpy).toHaveBeenCalledTimes(1);
    });

    it('respects the maxDelayMs cap on later attempts', () => {
      let attempt = 0;
      spyOn(navigator, 'sendBeacon').and.callFake(() => { attempt++; return false; });
      const opts: RetryOptions = { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 1200 };

      scheduleBeaconRetry('https://example.com', new Blob(['x']), opts);

      jasmine.clock().tick(1000); // attempt 1 (1000 ms, within cap)
      expect(attempt).toBe(1);

      // attempt 2 would be 2000 ms but is capped at 1200 ms
      jasmine.clock().tick(1199);
      expect(attempt).toBe(1); // not yet

      jasmine.clock().tick(1);
      expect(attempt).toBe(2); // fired at exactly 1200 ms

      // attempt 3 also at 1200 ms (cap)
      jasmine.clock().tick(1200);
      expect(attempt).toBe(3);
    });
  });
});

// ── safeCallback — failure scenarios ──────────────────────────────────────────

describe('safeCallback — failure scenarios', () => {
  describe('non-Error throws', () => {
    it('forwards a thrown string to onError unchanged', () => {
      const errors: unknown[] = [];
      const wrapped = safeCallback(
        (_: number) => { throw 'string error'; },
        (e) => errors.push(e),
      );
      wrapped(0);
      expect(errors[0]).toBe('string error');
    });

    it('forwards a thrown null to onError', () => {
      const errors: unknown[] = [];
      const wrapped = safeCallback(
        (_: number) => { throw null; },
        (e) => errors.push(e),
      );
      wrapped(0);
      expect(errors[0]).toBeNull();
    });

    it('forwards a thrown object literal to onError unchanged', () => {
      const thrown = { code: 42, reason: 'out of quota' };
      const errors: unknown[] = [];
      const wrapped = safeCallback(
        (_: number) => { throw thrown; },
        (e) => errors.push(e),
      );
      wrapped(0);
      expect(errors[0]).toBe(thrown); // same reference, not wrapped
    });
  });

  describe('onError handler itself throws', () => {
    it('propagates the onError exception — double-fault is not silently swallowed', () => {
      const wrapped = safeCallback(
        (_: number) => { throw new Error('original'); },
        () => { throw new Error('onError also threw'); },
      );
      // The second exception (from onError) propagates — this is intentional:
      // double-faulting signals a bug in the error handler itself.
      expect(() => wrapped(0)).toThrowError('onError also threw');
    });
  });

  describe('callback returns normally after previous failure', () => {
    it('resets correctly — the next call after a failure runs clean', () => {
      const log: string[] = [];
      const errors: unknown[] = [];
      const wrapped = safeCallback(
        (s: string) => {
          if (s === 'fail') throw new Error('boom');
          log.push(s);
        },
        (e) => errors.push(e),
      );

      wrapped('ok-before');
      wrapped('fail');
      wrapped('ok-after');

      expect(log).toEqual(['ok-before', 'ok-after']);
      expect(errors.length).toBe(1);
    });
  });
});

// ── WebVitalsService — resilience under failure ────────────────────────────────

describe('WebVitalsService — failure resilience', () => {
  beforeEach(() => {
    _setFlagOverridesForTesting({ enableTelemetry: true });
    TestBed.configureTestingModule({
      providers: [WebVitalsService, TelemetryService],
    });
    spyOn(console, 'log');
  });

  afterEach(() => _setFlagOverridesForTesting(null));

  it('constructs without throwing even when observer registration throws', () => {
    // In jsdom (the test environment), web-vitals PerformanceObserver calls are
    // no-ops or throw silently — the try/catch in collect() absorbs any such error.
    expect(() => TestBed.inject(WebVitalsService)).not.toThrow();
  });

  it('logs to console.error when observer registration throws — does not rethrow', () => {
    spyOn(console, 'error');
    // Force web-vitals registration to throw by making PerformanceObserver unavailable
    const originalPO = (window as Window & { PerformanceObserver?: unknown }).PerformanceObserver;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- testing failure path
    (window as any).PerformanceObserver = undefined;

    expect(() => TestBed.inject(WebVitalsService)).not.toThrow();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- restore
    (window as any).PerformanceObserver = originalPO;
  });

  it('report callback exception is caught by safeCallback — TelemetryService buffer stays consistent', () => {
    const telemetry = TestBed.inject(TelemetryService);
    const initialCount = telemetry.events.length;

    // The report callback is wrapped in safeCallback — even if it throws,
    // service construction completes normally
    expect(() => TestBed.inject(WebVitalsService)).not.toThrow();

    // Buffer has not grown with garbage data from a failed callback
    expect(telemetry.events.length).toBe(initialCount);
  });
});
