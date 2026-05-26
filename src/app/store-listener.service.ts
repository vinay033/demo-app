import { Injectable, OnDestroy } from '@angular/core';
import { Store, Unsubscribe } from 'redux';
import { store } from '../../projects/sub-app1/store';
import { TelemetryService } from './telemetry/telemetry.service';
import { isFlagEnabled } from './feature-flags/feature-flag.service';
import { LOG_PREFIX } from './telemetry/resilience';

@Injectable({ providedIn: 'root' })
export class StoreListenerService implements OnDestroy {
  private readonly store: Store = store;
  private unsubscribe: Unsubscribe;
  private dispatchCount = 0;

  constructor(private readonly telemetry: TelemetryService) {
    if (isFlagEnabled('enableReduxMonitor')) {
      console.log(LOG_PREFIX, 'redux store monitor initialised — dispatch count tracking active');
    } else {
      console.log(LOG_PREFIX, 'redux monitor disabled — dispatch count not tracked');
    }

    this.unsubscribe = this.store.subscribe(() => {
      this.dispatchCount++;
      if (isFlagEnabled('enableReduxMonitor')) {
        this.telemetry.gauge('redux.dispatch_count', this.dispatchCount);
      }
    });
  }

  ngOnDestroy(): void {
    this.unsubscribe();
  }
}
