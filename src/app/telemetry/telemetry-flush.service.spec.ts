import { TestBed } from '@angular/core/testing';
import { TelemetryFlushService } from './telemetry-flush.service';
import { TelemetryService } from './telemetry.service';
import { environment } from '../../environments/environment';
import { _setFlagOverridesForTesting } from '../feature-flags/feature-flag.service';

describe('TelemetryFlushService', () => {
  let service: TelemetryFlushService;
  let telemetry: TelemetryService;
  let flushSpy: jasmine.Spy;

  beforeEach(() => {
    _setFlagOverridesForTesting({ enableTelemetry: true });
    TestBed.configureTestingModule({
      providers: [TelemetryFlushService, TelemetryService],
    });
    telemetry = TestBed.inject(TelemetryService);
    flushSpy = spyOn(telemetry, 'flush').and.returnValue(true);
    service = TestBed.inject(TelemetryFlushService);
    spyOn(console, 'log');
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

    // The service passes whatever environment.telemetryEndpoint holds.
    // TelemetryService.flush() is responsible for the empty-string guard.
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
    _setFlagOverridesForTesting({ enableTelemetry: true });
    TestBed.configureTestingModule({
      providers: [TelemetryFlushService, TelemetryService],
    });
    const telemetry2 = TestBed.inject(TelemetryService);
    const flushSpy2 = spyOn(telemetry2, 'flush').and.returnValue(true);
    TestBed.inject(TelemetryFlushService);

    window.dispatchEvent(new Event('pagehide'));

    // Only the new instance's flush is called — old one was torn down
    expect(flushSpy2).toHaveBeenCalledTimes(1);
    expect(flushSpy).not.toHaveBeenCalled(); // old spy untouched
  });
});
