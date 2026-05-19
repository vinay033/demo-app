import { CUSTOM_ELEMENTS_SCHEMA, ErrorHandler, NgModule, NO_ERRORS_SCHEMA } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { TelemetryErrorHandler } from './telemetry/telemetry-error-handler';
import { RouterTelemetryService } from './telemetry/router-telemetry.service';
import { WebVitalsService } from './telemetry/web-vitals.service';
import { isFlagEnabled } from './feature-flags/feature-flag.service';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule
  ],
  providers: [
    // Feature flag: enableTelemetry
    // OFF → Angular's default ErrorHandler is used; no metrics collected.
    // ON  → unhandled exceptions emit an error.unhandled counter metric.
    // Remove this ternary (keep TelemetryErrorHandler unconditionally) once
    // the flag has been ON in production for ≥ 2 release cycles.
    isFlagEnabled('enableTelemetry')
      ? { provide: ErrorHandler, useClass: TelemetryErrorHandler }
      : { provide: ErrorHandler, useClass: ErrorHandler },
  ],
  bootstrap: [AppComponent],
  schemas: [
    CUSTOM_ELEMENTS_SCHEMA,
    NO_ERRORS_SCHEMA
  ]
})
export class AppModule {
  // RouterTelemetryService and WebVitalsService are always injected so they
  // start before any navigation/paint. Each service guards its own
  // initialisation logic with isFlagEnabled('enableTelemetry') internally,
  // so they are zero-cost no-ops when the flag is off.
  constructor(
    private readonly _routerTelemetry: RouterTelemetryService,
    private readonly _webVitals: WebVitalsService,
  ) {}
}
