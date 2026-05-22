/**
 * Contract test: TelemetryService public API
 *
 * TelemetryService is the single sink consumed by five services:
 *   RouterTelemetryService, TelemetryErrorHandler, WebVitalsService,
 *   TelemetryFlushService, and StoreListenerService (indirectly).
 *
 * This spec pins the *public boundary* — the interface that all callers
 * depend on. Any change that breaks these tests is a breaking change that
 * requires all five callers to be reviewed and updated.
 *
 * ── Update process ──────────────────────────────────────────────────────────
 * 1. Change the public API in telemetry.service.ts.
 * 2. Update the affected 'it' blocks below with the new expected behaviour.
 * 3. Update docs/telemetry.md "Extending" and "File map" sections in the
 *    same PR (doc-with-code policy).
 * 4. Run: ng test demo-app --no-watch --browsers=ChromeHeadlessCI
 * 5. Update all five caller services if their DI or call-site assumptions change.
 *
 * ── What is NOT tested here ─────────────────────────────────────────────────
 * Internal implementation (ring-buffer eviction, NDJSON serialisation,
 * Performance API integration) is covered by telemetry.service.spec.ts.
 * This file tests only the *observable contract* a caller can rely on.
 */

import { TelemetryService } from './telemetry.service';
import type { TelemetryEvent } from './telemetry.service';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSvc(): TelemetryService {
  return new TelemetryService();
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('TelemetryService — public API contract', () => {

  // ── TelemetryEvent interface shape ─────────────────────────────────────
  // These tests verify that events recorded via the public methods conform
  // to the TelemetryEvent interface shape that downstream consumers (flush,
  // Performance API, NDJSON serialiser) depend on.

  describe('TelemetryEvent shape', () => {
    let svc: TelemetryService;
    beforeEach(() => { svc = makeSvc(); });

    it('counter() emits a well-typed TelemetryEvent', () => {
      // Using TelemetryEvent as the explicit type here ensures that if the
      // interface fields change (e.g., type renamed, value removed), this
      // assignment fails at compile time — not silently at runtime.
      svc.counter('my.metric');
      const event: TelemetryEvent = svc.events[0];
      expect(event.type).toBe('counter');
    });

    it('timing() emits an event with type "timing"', () => {
      svc.timing('my.metric', 100);
      expect(svc.events[0].type).toBe('timing');
    });

    it('gauge() emits an event with type "gauge"', () => {
      svc.gauge('my.metric', 42);
      expect(svc.events[0].type).toBe('gauge');
    });

    it('every emitted event has a string name', () => {
      svc.counter('hits', 1);
      expect(typeof svc.events[0].name).toBe('string');
    });

    it('every emitted event has a numeric value', () => {
      svc.counter('hits', 5);
      expect(typeof svc.events[0].value).toBe('number');
    });

    it('every emitted event has a numeric timestamp', () => {
      // Rationale: the NDJSON payload includes timestamp — if it becomes
      // undefined the backend will reject or silently drop the event.
      const before = Date.now();
      svc.counter('hits');
      const after = Date.now();
      const ts = svc.events[0].timestamp;
      expect(typeof ts).toBe('number');
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });

    it('event tags are undefined when not provided', () => {
      // Rationale: callers that read event.tags?.['key'] must not receive
      // an empty object instead of undefined — that would break tag presence checks.
      svc.counter('hits');
      expect(svc.events[0].tags).toBeUndefined();
    });

    it('event tags are the exact object passed by the caller', () => {
      svc.counter('hits', 1, { route: '/home', status: '200' });
      expect(svc.events[0].tags).toEqual({ route: '/home', status: '200' });
    });

    it('type field is one of the three documented union members', () => {
      svc.counter('a');
      svc.timing('b', 1);
      svc.gauge('c', 1);
      const types = svc.events.map(e => e.type);
      types.forEach(t =>
        expect(['counter', 'timing', 'gauge']).toContain(t)
      );
    });
  });

  // ── counter() contract ──────────────────────────────────────────────────

  describe('counter()', () => {
    let svc: TelemetryService;
    beforeEach(() => { svc = makeSvc(); });

    it('records the given name', () => {
      svc.counter('error.unhandled');
      expect(svc.events[0].name).toBe('error.unhandled');
    });

    it('defaults increment to 1 when not provided', () => {
      // Rationale: callers like TelemetryErrorHandler call counter(name, 1)
      // explicitly, but any caller that omits the increment must get 1.
      svc.counter('hits');
      expect(svc.events[0].value).toBe(1);
    });

    it('records the provided increment value', () => {
      svc.counter('batch.processed', 42);
      expect(svc.events[0].value).toBe(42);
    });
  });

  // ── timing() contract ───────────────────────────────────────────────────

  describe('timing()', () => {
    let svc: TelemetryService;
    beforeEach(() => { svc = makeSvc(); });

    it('records the given name', () => {
      svc.timing('route.navigation_ms', 87);
      expect(svc.events[0].name).toBe('route.navigation_ms');
    });

    it('records the provided duration (rounded to integer ms)', () => {
      // Rationale: RouterTelemetryService passes Date.now() differences which
      // can be floating-point. timing() must round so downstream comparisons
      // are stable and NDJSON does not contain fractional milliseconds.
      svc.timing('op', 87.6);
      expect(svc.events[0].value).toBe(88);
    });

    it('rounds down for values < .5', () => {
      svc.timing('op', 87.4);
      expect(svc.events[0].value).toBe(87);
    });
  });

  // ── gauge() contract ────────────────────────────────────────────────────

  describe('gauge()', () => {
    let svc: TelemetryService;
    beforeEach(() => { svc = makeSvc(); });

    it('records the given name', () => {
      svc.gauge('web_vitals.cls', 80);
      expect(svc.events[0].name).toBe('web_vitals.cls');
    });

    it('records the provided value without rounding', () => {
      // Rationale: CLS scores are unitless ratios stored as score×1000 integers,
      // but callers should not need to pre-round — gauge() preserves what it gets.
      svc.gauge('score', 123.456);
      expect(svc.events[0].value).toBe(123.456);
    });
  });

  // ── events buffer contract ──────────────────────────────────────────────

  describe('events buffer', () => {
    let svc: TelemetryService;
    beforeEach(() => { svc = makeSvc(); });

    it('events is an array accessible on the service instance', () => {
      // Rationale: TelemetryFlushService reads svc.events.length indirectly
      // via flush(); any helper that inspects the buffer also needs this.
      expect(Array.isArray(svc.events)).toBeTrue();
    });

    it('events starts empty', () => {
      expect(svc.events.length).toBe(0);
    });

    it('each call to counter/timing/gauge appends exactly one event', () => {
      svc.counter('a');
      expect(svc.events.length).toBe(1);
      svc.timing('b', 1);
      expect(svc.events.length).toBe(2);
      svc.gauge('c', 1);
      expect(svc.events.length).toBe(3);
    });
  });

  // ── flush() contract ────────────────────────────────────────────────────

  describe('flush()', () => {
    let svc: TelemetryService;
    beforeEach(() => { svc = makeSvc(); });

    it('returns false for an empty URL', () => {
      // Rationale: TelemetryFlushService sets telemetryEndpoint to '' in dev.
      // flush('') must be a safe no-op, not throw.
      expect(svc.flush('')).toBeFalse();
    });

    it('does not throw for an empty URL', () => {
      expect(() => svc.flush('')).not.toThrow();
    });

    it('returns a boolean (true or false), never undefined or void', () => {
      // Rationale: callers may branch on the return value to decide whether
      // to schedule a retry or surface an error. undefined would silently
      // break truthy/falsy guards.
      const result = svc.flush('');
      expect(typeof result).toBe('boolean');
    });

    it('returns true for an empty buffer (nothing to send)', () => {
      // Rationale: empty buffer = "all events sent" (vacuously true).
      // TelemetryFlushService should treat a true return as success.
      spyOn(navigator, 'sendBeacon').and.returnValue(true);
      expect(svc.flush('https://collector.example.com')).toBeTrue();
    });

    it('clears the buffer on a successful flush', () => {
      spyOn(navigator, 'sendBeacon').and.returnValue(true);
      svc.counter('hit');
      svc.flush('https://collector.example.com');
      expect(svc.events.length).toBe(0);
    });
  });
});
