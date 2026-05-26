import { Injectable, OnDestroy, InjectionToken, Inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { TelemetryService } from './telemetry.service';
import { isFlagEnabled } from '../feature-flags/feature-flag.service';
import { LOG_PREFIX } from './resilience';

/**
 * Controls the interval between periodic flushes (in ms).
 * Override in tests via `{ provide: TELEMETRY_FLUSH_INTERVAL_MS, useValue: 100 }`
 * to avoid waiting 30 s in fakeAsync tests.
 */
export const TELEMETRY_FLUSH_INTERVAL_MS = new InjectionToken<number>(
  'TELEMETRY_FLUSH_INTERVAL_MS',
  { providedIn: 'root', factory: () => 30_000 },
);

/**
 * TelemetryFlushService
 *
 * Listens to browser lifecycle events and flushes the TelemetryService
 * ring buffer to the configured collector endpoint:
 *
 *   pagehide         — fired when the page is being unloaded (most reliable)
 *   visibilitychange — fired when the tab is hidden (covers background tab close)
 *   setInterval      — periodic flush every TELEMETRY_FLUSH_INTERVAL_MS
 *                      (only when `enablePeriodicFlush` flag is ON)
 *
 * Design decisions:
 * - Uses `environment.telemetryEndpoint`; empty string → flush() no-ops silently.
 * - Both event handlers and the interval are removed in ngOnDestroy.
 * - Periodic flush is gated behind `enablePeriodicFlush` feature flag (default
 *   OFF in production) — enables safe graduated rollout of the higher-frequency
 *   beacon behaviour.
 * - Each periodic flush emits a `telemetry.flush.periodic` counter for
 *   observability (visible in Performance panel > User Timings).
 */
@Injectable()
export class TelemetryFlushService implements OnDestroy {
  private _intervalId: ReturnType<typeof setInterval> | null = null;

  private readonly _onPageHide = (): void => {
    this._flush('pagehide');
  };

  private readonly _onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      this._flush('visibilitychange');
    }
  };

  constructor(
    private readonly _telemetry: TelemetryService,
    @Inject(TELEMETRY_FLUSH_INTERVAL_MS) private readonly _intervalMs: number,
  ) {
    console.log(LOG_PREFIX, 'flush service initialised — listening for pagehide / visibilitychange');
    window.addEventListener('pagehide', this._onPageHide);
    document.addEventListener('visibilitychange', this._onVisibilityChange);

    if (isFlagEnabled('enablePeriodicFlush')) {
      console.log(LOG_PREFIX, `periodic flush enabled — interval ${this._intervalMs} ms`);
      this._intervalId = setInterval(() => this._periodicFlush(), this._intervalMs);
    } else {
      console.log(LOG_PREFIX, 'periodic flush disabled (enablePeriodicFlush=false)');
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('pagehide', this._onPageHide);
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  private _periodicFlush(): void {
    const buffered = this._telemetry.events.length;
    console.log(LOG_PREFIX, `periodic flush — ${buffered} event(s) in buffer`);
    // Telemetry hook: emit a counter each time the periodic flush fires so
    // the flush cadence is visible in the Performance panel and any backend.
    this._telemetry.counter('telemetry.flush.periodic', 1, {
      buffered: String(buffered),
    });
    this._telemetry.flush(environment.telemetryEndpoint);
  }

  private _flush(trigger: 'pagehide' | 'visibilitychange'): void {
    const buffered = this._telemetry.events.length;
    console.log(LOG_PREFIX, `flush triggered — ${buffered} event(s) in buffer`);
    this._telemetry.flush(environment.telemetryEndpoint);
  }
}
