import { createStore, Store, StoreEnhancer, AnyAction } from 'redux';
import { isFlagEnabled } from '../../../src/app/feature-flags/feature-flag.service';

export interface AppState {
  [key: string]: unknown;
}

function rootReducer(state: AppState = {}): AppState {
  return state;
}

/**
 * dispatchMonitorEnhancer — Redux store enhancer that counts every dispatched
 * action and logs a metric to the console.
 *
 * To forward to a real backend, replace the console.log with a call to your
 * telemetry sink. The enhancer cannot inject Angular services directly (it runs
 * outside the Angular DI tree), so accept a callback if needed:
 *
 *   createMonitorEnhancer((name, tags) => telemetry.counter(name, 1, tags))
 *
 * Signal to watch: >100 dispatches/min with no user interaction = probable loop.
 */
function dispatchMonitorEnhancer(): StoreEnhancer {
  const counts: Record<string, number> = {};

  return (createStoreFn: any) => (reducer: any, preloadedState: any) => {
    const inner = createStoreFn(reducer, preloadedState);

    const dispatch = (action: AnyAction) => {
      const type: string = action?.type ?? '@@UNKNOWN';
      counts[type] = (counts[type] ?? 0) + 1;
      console.log(`[redux] dispatch type=${type} total=${counts[type]}`);
      return inner.dispatch(action);
    };

    return { ...inner, dispatch };
  };
}

// Feature flag: enableReduxMonitor
// OFF → store is created without the monitor enhancer (zero overhead).
// ON  → every dispatch is counted and logged.
// Remove the ternary and use dispatchMonitorEnhancer() unconditionally
// once the flag has been ON in production for ≥ 2 release cycles.
export const store: Store<AppState> = isFlagEnabled('enableReduxMonitor')
  ? createStore(rootReducer, dispatchMonitorEnhancer())
  : createStore(rootReducer);
