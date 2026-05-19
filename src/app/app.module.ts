import { CUSTOM_ELEMENTS_SCHEMA, ErrorHandler, NgModule, NO_ERRORS_SCHEMA } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { TelemetryErrorHandler } from './telemetry/telemetry-error-handler';
import { RouterTelemetryService } from './telemetry/router-telemetry.service';
import { WebVitalsService } from './telemetry/web-vitals.service';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule
  ],
  providers: [
    // Replace Angular's default ErrorHandler with the telemetry-aware version.
    // All unhandled exceptions now emit an error.unhandled counter metric.
    { provide: ErrorHandler, useClass: TelemetryErrorHandler },
  ],
  bootstrap: [AppComponent],
  schemas: [
    CUSTOM_ELEMENTS_SCHEMA,
    NO_ERRORS_SCHEMA
  ]
})
export class AppModule {
  // Inject services here so they start collecting before any navigation or
  // user interaction occurs — RouterTelemetryService must see NavigationStart,
  // and WebVitalsService must register observers before the page loads.
  constructor(
    private readonly _routerTelemetry: RouterTelemetryService,
    private readonly _webVitals: WebVitalsService,
  ) {}
}
