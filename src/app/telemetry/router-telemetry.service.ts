/**
 * RouterTelemetryService — measures Angular route navigation duration.
 *
 * Listens to Router events and emits a `route.navigation_ms` timing metric
 * for every completed or errored navigation. Start/end are keyed by
 * `navigationId` so concurrent navigations are tracked independently.
 *
 * Must be injected once at startup (AppComponent constructor or APP_INITIALIZER)
 * so the subscription is established before any navigation occurs.
 */

import { Injectable, OnDestroy } from '@angular/core';
import { Router, NavigationStart, NavigationEnd, NavigationError, NavigationCancel } from '@angular/router';
import { Subscription } from 'rxjs';
import { TelemetryService } from './telemetry.service';
import { isFlagEnabled } from '../feature-flags/feature-flag.service';

@Injectable({ providedIn: 'root' })
export class RouterTelemetryService implements OnDestroy {
  private readonly starts = new Map<number, number>(); // navigationId → performance.now()
  private readonly sub: Subscription;

  constructor(private readonly router: Router, private readonly telemetry: TelemetryService) {
    // Feature flag guard: when enableTelemetry is OFF this service is a no-op.
    // Subscribe unconditionally so Angular does not complain about an
    // uninitialised field; the subscription immediately unsubscribes.
    if (!isFlagEnabled('enableTelemetry')) {
      this.sub = Subscription.EMPTY;
      return;
    }

    this.sub = this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.starts.set(event.id, performance.now());
      } else if (
        event instanceof NavigationEnd ||
        event instanceof NavigationError ||
        event instanceof NavigationCancel
      ) {
        const t0 = this.starts.get(event.id);
        if (t0 !== undefined) {
          const durationMs = performance.now() - t0;
          const outcome =
            event instanceof NavigationEnd ? 'success' :
            event instanceof NavigationError ? 'error' : 'cancelled';

          this.telemetry.timing('route.navigation_ms', durationMs, {
            url: event.url,
            outcome,
          });

          this.starts.delete(event.id);
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
