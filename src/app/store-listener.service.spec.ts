import { TestBed } from '@angular/core/testing';
import { StoreListenerService } from './store-listener.service';
import { TelemetryService } from './telemetry/telemetry.service';
import { _setFlagOverridesForTesting } from './feature-flags/feature-flag.service';
import { store } from '../../projects/sub-app1/store';
import { LOG_PREFIX } from './telemetry/resilience';

describe('StoreListenerService', () => {
  let service: StoreListenerService;
  let telemetrySpy: jasmine.SpyObj<TelemetryService>;

  beforeEach(() => {
    telemetrySpy = jasmine.createSpyObj('TelemetryService', ['gauge']);
    TestBed.configureTestingModule({
      providers: [{ provide: TelemetryService, useValue: telemetrySpy }],
    });
    spyOn(console, 'log');
  });

  afterEach(() => {
    _setFlagOverridesForTesting(null);
    TestBed.resetTestingModule();
  });

  // ── Construction ──────────────────────────────────────────────────────────

  it('creates without error', () => {
    service = TestBed.inject(StoreListenerService);
    expect(service).toBeTruthy();
  });

  it('does NOT log state to console on dispatch', () => {
    _setFlagOverridesForTesting({ enableReduxMonitor: true });
    service = TestBed.inject(StoreListenerService);
    store.dispatch({ type: '@@TEST/init' });
    expect(console.log).not.toHaveBeenCalledWith(store.getState());
  });

  // ── LOG_PREFIX lifecycle logs ─────────────────────────────────────────────

  it('logs init message with LOG_PREFIX when enableReduxMonitor is ON', () => {
    _setFlagOverridesForTesting({ enableReduxMonitor: true });
    service = TestBed.inject(StoreListenerService);
    expect(console.log).toHaveBeenCalledWith(
      LOG_PREFIX,
      'redux store monitor initialised — dispatch count tracking active',
    );
  });

  it('logs disabled message with LOG_PREFIX when enableReduxMonitor is OFF', () => {
    _setFlagOverridesForTesting({ enableReduxMonitor: false });
    service = TestBed.inject(StoreListenerService);
    expect(console.log).toHaveBeenCalledWith(
      LOG_PREFIX,
      'redux monitor disabled — dispatch count not tracked',
    );
  });

  // ── Flag ON: telemetry gauge emitted ──────────────────────────────────────

  it('emits redux.dispatch_count gauge when enableReduxMonitor is ON', () => {
    _setFlagOverridesForTesting({ enableReduxMonitor: true });
    service = TestBed.inject(StoreListenerService);

    store.dispatch({ type: '@@TEST/action_A' });
    expect(telemetrySpy.gauge).toHaveBeenCalledWith('redux.dispatch_count', jasmine.any(Number));
  });

  it('increments the dispatch count on each action', () => {
    _setFlagOverridesForTesting({ enableReduxMonitor: true });
    service = TestBed.inject(StoreListenerService);

    store.dispatch({ type: '@@TEST/inc_1' });
    store.dispatch({ type: '@@TEST/inc_2' });

    const calls = telemetrySpy.gauge.calls.allArgs();
    const counts = calls.map(([, v]) => v as number);
    // Each dispatch should increment the count
    expect(counts[counts.length - 1]).toBeGreaterThan(counts[0]);
  });

  // ── Flag OFF: no telemetry emitted ────────────────────────────────────────

  it('does NOT emit gauge when enableReduxMonitor is OFF', () => {
    _setFlagOverridesForTesting({ enableReduxMonitor: false });
    service = TestBed.inject(StoreListenerService);

    store.dispatch({ type: '@@TEST/no_gauge' });
    expect(telemetrySpy.gauge).not.toHaveBeenCalled();
  });

  // ── ngOnDestroy ───────────────────────────────────────────────────────────

  it('calls unsubscribe on ngOnDestroy', () => {
    service = TestBed.inject(StoreListenerService);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessing private for test
    const unsubSpy = spyOn(service as any, 'unsubscribe').and.callThrough();
    service.ngOnDestroy();
    expect(unsubSpy).toHaveBeenCalledTimes(1);
  });

  it('can be destroyed multiple times without throwing', () => {
    service = TestBed.inject(StoreListenerService);
    expect(() => {
      service.ngOnDestroy();
      service.ngOnDestroy();
    }).not.toThrow();
  });
});
