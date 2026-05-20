import { Injectable, OnDestroy } from '@angular/core';
import { environment } from '../../environments/environment';
import { TelemetryService } from './telemetry.service';

/**
 * TelemetryFlushService
 *
 * Listens to two browser lifecycle events and flushes the TelemetryService
 * ring buffer to the configured collector endpoint:
 *
 *   pagehide         — fired when the page is being unloaded (most reliable)
 *   visibilitychange — fired when the tab is hidden (covers background tab close)
 *
 * Design decisions:
 * - Uses `environment.telemetryEndpoint`; empty string → flush() no-ops silently.
 * - Both handlers are removed in ngOnDestroy for clean teardown in tests/SSR.
 * - Service is only provided when the enableTelemetry flag is on (AppModule).
 */
@Injectable()
export class TelemetryFlushService implements OnDestroy {
  private readonly _onPageHide = (): void => {
    this._flush();
  };

  private readonly _onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      this._flush();
    }
  };

  constructor(private readonly _telemetry: TelemetryService) {
    window.addEventListener('pagehide', this._onPageHide);
    document.addEventListener('visibilitychange', this._onVisibilityChange);
  }

  ngOnDestroy(): void {
    window.removeEventListener('pagehide', this._onPageHide);
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
  }

  private _flush(): void {
    this._telemetry.flush(environment.telemetryEndpoint);
  }
}
