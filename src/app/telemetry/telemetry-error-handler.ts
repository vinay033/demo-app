/**
 * TelemetryErrorHandler — replaces Angular's default ErrorHandler.
 *
 * Catches every unhandled exception in the Angular zone and records it as a
 * `error.unhandled` counter metric. The original error is still logged to the
 * console so developer experience is unchanged.
 *
 * Wired in AppModule:
 *   providers: [{ provide: ErrorHandler, useClass: TelemetryErrorHandler }]
 */

import { ErrorHandler, Injectable } from '@angular/core';
import { TelemetryService } from './telemetry.service';
import { errorToMeta } from './resilience';

@Injectable()
export class TelemetryErrorHandler implements ErrorHandler {
  constructor(private readonly telemetry: TelemetryService) {}

  handleError(error: unknown): void {
    const { name, message } = errorToMeta(error);

    this.telemetry.counter('error.unhandled', 1, {
      error_name: name,
      // Truncate message to 120 chars — safe for tag values in most backends
      error_message: message.slice(0, 120),
    });

    // Preserve default Angular behaviour: log to console
    console.error(error);
  }
}
