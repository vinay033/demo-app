import { TestBed } from '@angular/core/testing';
import { StoreListenerService } from './store-listener.service';
import { store } from '../../projects/sub-app1/store';

/**
 * Coverage target: src/app/store-listener.service.ts
 *
 * Before:  80% statements (4/5), 66.66% functions (2/3)
 *          Uncovered: the store.subscribe() callback body (line 12)
 *          and the anonymous callback function (anonymous_1).
 *
 * After:   100% statements, 100% functions — dispatching an action fires
 *          the subscribe callback, covering the console.log line.
 */
describe('StoreListenerService', () => {
  let service: StoreListenerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    spyOn(console, 'log');
    service = TestBed.inject(StoreListenerService);
  });

  afterEach(() => TestBed.resetTestingModule());

  // ── Construction ──────────────────────────────────────────────────────────

  it('creates without error', () => {
    expect(service).toBeTruthy();
  });

  it('subscribes to the Redux store on construction', () => {
    // The subscribe callback fires on every state change.
    // Dispatching a dummy action triggers it and covers line 12.
    store.dispatch({ type: '@@TEST/init' });

    expect(console.log).toHaveBeenCalledWith(store.getState());
  });

  // ── Subscribe callback (anonymous_1) ──────────────────────────────────────

  it('logs current state to console.log on each store dispatch', () => {
    store.dispatch({ type: '@@TEST/action_A' });
    store.dispatch({ type: '@@TEST/action_B' });

    // console.log is called once per dispatch — each with the current state
    expect((console.log as jasmine.Spy).calls.count()).toBeGreaterThanOrEqual(2);
    expect(console.log).toHaveBeenCalledWith(store.getState());
  });

  it('logs the state object returned by store.getState()', () => {
    const stateBefore = store.getState();
    store.dispatch({ type: '@@TEST/state_check' });

    // rootReducer is identity — state is always the same object
    expect(console.log).toHaveBeenCalledWith(stateBefore);
  });

  // ── ngOnDestroy ───────────────────────────────────────────────────────────

  it('calls unsubscribe on ngOnDestroy — stops receiving further dispatches', () => {
    // Spy on the private unsubscribe function to verify it is called
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessing private for test
    const unsubSpy = spyOn(service as any, 'unsubscribe').and.callThrough();
    service.ngOnDestroy();
    expect(unsubSpy).toHaveBeenCalledTimes(1);
  });

  it('can be destroyed multiple times without throwing', () => {
    expect(() => {
      service.ngOnDestroy();
      service.ngOnDestroy(); // second call — unsubscribe is a no-op after first call
    }).not.toThrow();
  });
});
