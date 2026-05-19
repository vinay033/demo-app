import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { Router, NavigationStart, NavigationEnd, NavigationError, NavigationCancel } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { Subject } from 'rxjs';
import { TelemetryService } from './telemetry.service';
import { RouterTelemetryService } from './router-telemetry.service';
import { _setFlagOverridesForTesting } from '../feature-flags/feature-flag.service';

describe('RouterTelemetryService', () => {
  let service: RouterTelemetryService;
  let telemetry: TelemetryService;
  let events$: Subject<any>;

  beforeEach(() => {
    // Explicitly force flag ON so these specs pass in BOTH CI modes:
    // - default (environment.ts: all ON) — override is redundant but harmless
    // - flags-off (environment.flags-off.ts: all OFF) — override ensures ON behaviour is tested
    _setFlagOverridesForTesting({ enableTelemetry: true });
    events$ = new Subject();
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [
        RouterTelemetryService,
        TelemetryService,
        { provide: Router, useValue: { events: events$.asObservable() } },
      ],
    });
    service = TestBed.inject(RouterTelemetryService);
    telemetry = TestBed.inject(TelemetryService);
  });

  afterEach(() => {
    service.ngOnDestroy();
    _setFlagOverridesForTesting(null);
  });

  // ── Flag ON (default dev behaviour) ──────────────────────────────────────

  it('emits a route.navigation_ms timing on NavigationEnd', fakeAsync(() => {
    events$.next(new NavigationStart(1, '/home'));
    tick(50);
    events$.next(new NavigationEnd(1, '/home', '/home'));

    expect(telemetry.events.length).toBe(1);
    expect(telemetry.events[0].type).toBe('timing');
    expect(telemetry.events[0].name).toBe('route.navigation_ms');
    expect(telemetry.events[0].value).toBeGreaterThanOrEqual(0);
  }));

  it('tags outcome=success on NavigationEnd', fakeAsync(() => {
    events$.next(new NavigationStart(2, '/about'));
    tick(10);
    events$.next(new NavigationEnd(2, '/about', '/about'));

    expect(telemetry.events[0].tags?.['outcome']).toBe('success');
  }));

  it('tags outcome=error on NavigationError', fakeAsync(() => {
    events$.next(new NavigationStart(3, '/bad'));
    tick(5);
    events$.next(new NavigationError(3, '/bad', new Error('404')));

    expect(telemetry.events[0].tags?.['outcome']).toBe('error');
  }));

  it('tags outcome=cancelled on NavigationCancel', fakeAsync(() => {
    events$.next(new NavigationStart(4, '/slow'));
    tick(5);
    events$.next(new NavigationCancel(4, '/slow', 'guard rejected'));

    expect(telemetry.events[0].tags?.['outcome']).toBe('cancelled');
  }));

  it('does not emit a timing when NavigationEnd fires with no matching Start', () => {
    events$.next(new NavigationEnd(99, '/orphan', '/orphan'));
    expect(telemetry.events.length).toBe(0);
  });

  it('tracks multiple concurrent navigations independently', fakeAsync(() => {
    events$.next(new NavigationStart(10, '/a'));
    tick(20);
    events$.next(new NavigationStart(11, '/b'));
    tick(10);
    events$.next(new NavigationEnd(10, '/a', '/a'));
    events$.next(new NavigationEnd(11, '/b', '/b'));

    expect(telemetry.events.length).toBe(2);
    expect(telemetry.events[0].tags?.['url']).toBe('/a');
    expect(telemetry.events[1].tags?.['url']).toBe('/b');
  }));

  // ── Flag OFF ──────────────────────────────────────────────────────────────

  describe('when enableTelemetry is OFF', () => {
    beforeEach(() => {
      _setFlagOverridesForTesting({ enableTelemetry: false });
      // Re-create the service so it picks up the override at construction time.
      TestBed.resetTestingModule();
      events$ = new Subject();
      TestBed.configureTestingModule({
        imports: [RouterTestingModule],
        providers: [
          RouterTelemetryService,
          TelemetryService,
          { provide: Router, useValue: { events: events$.asObservable() } },
        ],
      });
      service = TestBed.inject(RouterTelemetryService);
      telemetry = TestBed.inject(TelemetryService);
    });

    it('does not record any events when flag is OFF', fakeAsync(() => {
      events$.next(new NavigationStart(1, '/home'));
      tick(50);
      events$.next(new NavigationEnd(1, '/home', '/home'));

      expect(telemetry.events.length).toBe(0);
    }));

    it('ngOnDestroy does not throw when flag is OFF (Subscription.EMPTY path)', () => {
      expect(() => service.ngOnDestroy()).not.toThrow();
    });
  });
});
