import { TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { TelemetryFlushService, TELEMETRY_FLUSH_INTERVAL_MS } from './telemetry-flush.service';
import { TelemetryService } from './telemetry.service';
import { environment } from '../../environments/environment';
import { _setFlagOverridesForTesting } from '../feature-flags/feature-flag.service';
import { LOG_PREFIX } from './resilience';

/** Short interval (ms) used in all periodic-flush tests — avoids waiting 30 s. */
const TEST_INTERVAL_MS = 100;

function createModule(periodicFlushOn: boolean, spyLog = true) {
  _setFlagOverridesForTesting({ enableTelemetry: true, enablePeriodicFlush: periodicFlushOn });
  TestBed.configureTestingModule({
    providers: [
      TelemetryFlushService,
      TelemetryService,
      { provide: TELEMETRY_FLUSH_INTERVAL_MS, useValue: TEST_INTERVAL_MS },
    ],
  });
  const telemetry = TestBed.inject(TelemetryService);
  const flushSpy = spyOn(telemetry, 'flush').and.returnValue(true);
  if (spyLog) spyOn(console, 'log');
  const service = TestBed.inject(TelemetryFlushService);
  return { service, telemetry, flushSpy };
}

describe('TelemetryFlushService', () => {
  let service: TelemetryFlushService;
  let telemetry: TelemetryService;
  let flushSpy: jasmine.Spy;

  beforeEach(() => {
    ({ service, telemetry, flushSpy } = createModule(false /* periodic OFF by default */));
  });

  afterEach(() => _setFlagOverridesForTesting(null));

  // ── pagehide ──────────────────────────────────────────────────────────────

  it('calls flush() with the configured endpoint on pagehide', () => {
    window.dispatchEvent(new Event('pagehide'));

    expect(flushSpy).toHaveBeenCalledOnceWith(environment.telemetryEndpoint);
  });

  it('calls flush() exactly once per pagehide event', () => {
    window.dispatchEvent(new Event('pagehide'));
    window.dispatchEvent(new Event('pagehide'));

    expect(flushSpy).toHaveBeenCalledTimes(2);
  });

  // ── visibilitychange ──────────────────────────────────────────────────────

  it('calls flush() when document visibility changes to hidden', () => {
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden', writable: true, configurable: true,
    });

    document.dispatchEvent(new Event('visibilitychange'));

    expect(flushSpy).toHaveBeenCalledOnceWith(environment.telemetryEndpoint);
  });

  it('does NOT call flush() when document visibility changes to visible', () => {
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible', writable: true, configurable: true,
    });

    document.dispatchEvent(new Event('visibilitychange'));

    expect(flushSpy).not.toHaveBeenCalled();
  });

  // ── endpoint config ───────────────────────────────────────────────────────

  it('passes the endpoint URL from environment — flush() decides whether to send', () => {
    window.dispatchEvent(new Event('pagehide'));

    expect(flushSpy).toHaveBeenCalledWith(environment.telemetryEndpoint);
  });

  // ── teardown ──────────────────────────────────────────────────────────────

  it('removes event listeners on ngOnDestroy — no flush after destroy', () => {
    service.ngOnDestroy();
    flushSpy.calls.reset();

    window.dispatchEvent(new Event('pagehide'));
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden', writable: true, configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(flushSpy).not.toHaveBeenCalled();
  });

  it('can be destroyed and re-created without stale listeners accumulating', () => {
    service.ngOnDestroy();

    // Re-create fresh instance
    TestBed.resetTestingModule();
    _setFlagOverridesForTesting({ enableTelemetry: true, enablePeriodicFlush: false });
    TestBed.configureTestingModule({
      providers: [
        TelemetryFlushService,
        TelemetryService,
        { provide: TELEMETRY_FLUSH_INTERVAL_MS, useValue: TEST_INTERVAL_MS },
      ],
    });
    const telemetry2 = TestBed.inject(TelemetryService);
    const flushSpy2 = spyOn(telemetry2, 'flush').and.returnValue(true);
    // console.log is already spied — do not re-spy
    TestBed.inject(TelemetryFlushService);

    window.dispatchEvent(new Event('pagehide'));

    // Only the new instance's flush is called — old one was torn down
    expect(flushSpy2).toHaveBeenCalledTimes(1);
    expect(flushSpy).not.toHaveBeenCalled(); // old spy untouched
  });

  // ── logging ───────────────────────────────────────────────────────────────

  it('logs an init message on construction with LOG_PREFIX', () => {
    expect(console.log).toHaveBeenCalledWith(
      LOG_PREFIX,
      'flush service initialised — listening for pagehide / visibilitychange',
    );
  });

  it('logs a flush-triggered message with buffer count on pagehide', () => {
    (console.log as jasmine.Spy).calls.reset();
    telemetry.counter('test.event', 1); // add 1 event to buffer
    window.dispatchEvent(new Event('pagehide'));

    expect(console.log).toHaveBeenCalledWith(
      LOG_PREFIX,
      'flush triggered — 1 event(s) in buffer',
    );
  });

  it('logs flush-triggered with 0 when buffer is empty', () => {
    (console.log as jasmine.Spy).calls.reset();
    window.dispatchEvent(new Event('pagehide'));

    expect(console.log).toHaveBeenCalledWith(
      LOG_PREFIX,
      'flush triggered — 0 event(s) in buffer',
    );
  });

  // ── periodic flush — FLAG OFF ─────────────────────────────────────────────

  describe('periodic flush — enablePeriodicFlush: false (default/prod)', () => {
    it('does NOT schedule an interval when flag is OFF', fakeAsync(() => {
      // flushSpy already set up in outer beforeEach with flag OFF
      tick(TEST_INTERVAL_MS * 5); // advance 5× the interval

      // Only direct event-based flushes count; no periodic calls
      expect(flushSpy).not.toHaveBeenCalled();
    }));

    it('logs that periodic flush is disabled during init', () => {
      expect(console.log).toHaveBeenCalledWith(
        LOG_PREFIX,
        'periodic flush disabled (enablePeriodicFlush=false)',
      );
    });

    it('ngOnDestroy completes without error when no interval was scheduled', () => {
      expect(() => service.ngOnDestroy()).not.toThrow();
    });
  });

  // ── periodic flush — FLAG ON ──────────────────────────────────────────────

  describe('periodic flush — enablePeriodicFlush: true', () => {
    let svcOn: TelemetryFlushService;
    let telOn: TelemetryService;
    let flushSpyOn: jasmine.Spy;
    let counterSpy: jasmine.Spy;

    /** Helper: create the service inside fakeAsync so setInterval is tracked. */
    function setupPeriodicService() {
      service.ngOnDestroy(); // stop outer service listeners
      TestBed.resetTestingModule();
      _setFlagOverridesForTesting({ enableTelemetry: true, enablePeriodicFlush: true });
      TestBed.configureTestingModule({
        providers: [
          TelemetryFlushService,
          TelemetryService,
          { provide: TELEMETRY_FLUSH_INTERVAL_MS, useValue: TEST_INTERVAL_MS },
        ],
      });
      telOn = TestBed.inject(TelemetryService);
      flushSpyOn = spyOn(telOn, 'flush').and.returnValue(true);
      counterSpy = spyOn(telOn, 'counter').and.callThrough();
      svcOn = TestBed.inject(TelemetryFlushService);
    }

    afterEach(() => {
      if (svcOn) svcOn.ngOnDestroy();
    });

    it('logs that periodic flush is enabled with the interval during init', fakeAsync(() => {
      setupPeriodicService();
      expect(console.log).toHaveBeenCalledWith(
        LOG_PREFIX,
        `periodic flush enabled — interval ${TEST_INTERVAL_MS} ms`,
      );
      discardPeriodicTasks();
    }));

    it('calls flush() after one interval elapses', fakeAsync(() => {
      setupPeriodicService();
      tick(TEST_INTERVAL_MS);

      expect(flushSpyOn).toHaveBeenCalledOnceWith(environment.telemetryEndpoint);
      discardPeriodicTasks();
    }));

    it('calls flush() N times after N intervals', fakeAsync(() => {
      setupPeriodicService();
      tick(TEST_INTERVAL_MS * 3);

      expect(flushSpyOn).toHaveBeenCalledTimes(3);
      discardPeriodicTasks();
    }));

    it('emits telemetry.flush.periodic counter on each interval', fakeAsync(() => {
      setupPeriodicService();
      tick(TEST_INTERVAL_MS * 2);

      const periodicCalls = counterSpy.calls.all().filter(
        c => c.args[0] === 'telemetry.flush.periodic',
      );
      expect(periodicCalls.length).toBe(2);
      expect(periodicCalls[0].args[2]).toEqual(jasmine.objectContaining({ buffered: jasmine.any(String) }));
      discardPeriodicTasks();
    }));

    it('stops the interval after ngOnDestroy — no further flush calls', fakeAsync(() => {
      setupPeriodicService();
      tick(TEST_INTERVAL_MS); // first tick fires
      flushSpyOn.calls.reset();

      svcOn.ngOnDestroy();
      tick(TEST_INTERVAL_MS * 5); // advance further — should be silent

      expect(flushSpyOn).not.toHaveBeenCalled();
    }));

    it('does NOT fire periodic flush when pagehide arrives between intervals', fakeAsync(() => {
      setupPeriodicService();
      // pagehide fires independently of interval
      window.dispatchEvent(new Event('pagehide'));
      tick(TEST_INTERVAL_MS);

      // 1 pagehide + 1 interval = 2 total calls
      expect(flushSpyOn).toHaveBeenCalledTimes(2);
      discardPeriodicTasks();
    }));
  });
});

// ── TelemetryErrorHandler — flag guard (issue #14) ───────────────────────────

import { TelemetryErrorHandler } from './telemetry-error-handler';

describe('TelemetryErrorHandler', () => {
  let handler: TelemetryErrorHandler;
  let telemetry: jasmine.SpyObj<TelemetryService>;

  function setup(flagOn: boolean) {
    _setFlagOverridesForTesting({ enableTelemetry: flagOn });
    telemetry = jasmine.createSpyObj('TelemetryService', ['counter']);
    handler = new TelemetryErrorHandler(telemetry);
  }

  afterEach(() => _setFlagOverridesForTesting(null));

  describe('enableTelemetry: true', () => {
    beforeEach(() => setup(true));

    it('emits error.unhandled counter', () => {
      spyOn(console, 'error');
      handler.handleError(new Error('boom'));
      expect(telemetry.counter).toHaveBeenCalledOnceWith(
        'error.unhandled', 1,
        jasmine.objectContaining({ error_name: 'Error', error_message: 'boom' }),
      );
    });
  });

  describe('enableTelemetry: false (flag OFF)', () => {
    beforeEach(() => setup(false));

    it('does NOT emit any telemetry counter', () => {
      spyOn(console, 'error');
      handler.handleError(new Error('boom'));
      expect(telemetry.counter).not.toHaveBeenCalled();
    });

    it('still logs to console.error (dev visibility preserved)', () => {
      const spy = spyOn(console, 'error');
      handler.handleError(new Error('visible'));
      expect(spy).toHaveBeenCalled();
    });
  });
});

