import { TestBed } from '@angular/core/testing';
import { TelemetryService } from './telemetry.service';
import { TelemetryErrorHandler } from './telemetry-error-handler';

describe('TelemetryErrorHandler', () => {
  let handler: TelemetryErrorHandler;
  let telemetry: TelemetryService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TelemetryErrorHandler, TelemetryService],
    });
    handler = TestBed.inject(TelemetryErrorHandler);
    telemetry = TestBed.inject(TelemetryService);
    spyOn(console, 'error'); // suppress console output in test runner
  });

  it('records an error.unhandled counter on Error', () => {
    handler.handleError(new Error('boom'));
    expect(telemetry.events.length).toBe(1);
    expect(telemetry.events[0].type).toBe('counter');
    expect(telemetry.events[0].name).toBe('error.unhandled');
    expect(telemetry.events[0].value).toBe(1);
  });

  it('tags the event with the error name', () => {
    handler.handleError(new TypeError('bad type'));
    expect(telemetry.events[0].tags?.['error_name']).toBe('TypeError');
  });

  it('tags the event with a truncated error message', () => {
    const long = 'x'.repeat(200);
    handler.handleError(new Error(long));
    expect(telemetry.events[0].tags?.['error_message'].length).toBeLessThanOrEqual(120);
  });

  it('handles non-Error thrown values', () => {
    handler.handleError('plain string error');
    expect(telemetry.events[0].tags?.['error_name']).toBe('UnknownError');
  });

  it('still calls console.error so the original error is visible', () => {
    const err = new Error('visible');
    handler.handleError(err);
    expect(console.error).toHaveBeenCalledWith(err);
  });

  it('increments the counter on each error', () => {
    handler.handleError(new Error('first'));
    handler.handleError(new Error('second'));
    expect(telemetry.events.length).toBe(2);
  });
});
