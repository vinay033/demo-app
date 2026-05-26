# Telemetry Subsystem — Developer Guide

> **Doc-with-code policy:** This file must be updated in the same PR as any
> change to `src/app/telemetry/`. See the [extension guide](#extending-the-instrumentation)
> before adding new metrics.

How to view, query, extend, and safely operate the telemetry instrumentation in this repo.

---

## What is instrumented

| Metric name | Type | Tags | Emitted by |
|---|---|---|---|
| `error.unhandled` | counter | `error_name` | `TelemetryErrorHandler` |
| `route.navigation_ms` | timing (ms) | `url`, `outcome` | `RouterTelemetryService` |
| `redux.dispatch` | counter | `action` | `dispatchMonitorEnhancer` (store.ts) |
| `redux.dispatch_count` | gauge | _(none)_ | `StoreListenerService` |
| `web_vitals.lcp` | timing (ms) | `rating`, `navigation_type` | `WebVitalsService` |
| `web_vitals.fcp` | timing (ms) | `rating`, `navigation_type` | `WebVitalsService` |
| `web_vitals.ttfb` | timing (ms) | `rating`, `navigation_type` | `WebVitalsService` |
| `web_vitals.inp` | timing (ms) | `rating`, `navigation_type` | `WebVitalsService` |
| `web_vitals.cls` | gauge (score × 1000) | `rating`, `navigation_type` | `WebVitalsService` |

---

## Viewing metrics in development

### 1 · Browser DevTools — Console

Every event is written to `console.log` in the format:

```
[telemetry] <type> <name>=<value>[unit] [tag=value ...]
```

Example lines you will see while navigating the app:

```
[telemetry] timing  route.navigation_ms=87ms   url=/products outcome=success
[telemetry] counter redux.dispatch=1            action=SET_ITEMS
[telemetry] gauge   redux.dispatch_count=5
[telemetry] timing  web_vitals.lcp=1820ms       rating=needs-improvement navigation_type=navigate
[telemetry] gauge   web_vitals.cls=80           rating=good navigation_type=navigate
[telemetry] counter error.unhandled=1           error_name=TypeError
```

**Service lifecycle logs** (emitted at init / flag-check time, not as buffered metrics):

```
[telemetry] router telemetry initialised
[telemetry] navigation success — /products (87ms)
[telemetry] navigation error — /bad-route (45ms)
[telemetry] navigation cancelled — /guarded (12ms)
[telemetry] redux store monitor initialised — dispatch count tracking active
[telemetry] redux monitor disabled — dispatch count not tracked
[telemetry] flush service initialised — listening for pagehide / visibilitychange
[telemetry] flush triggered — 12 event(s) in buffer
[telemetry] flush triggered — buffer empty, nothing to send
```

Filter by `[telemetry]` in the Console filter box to isolate all events.

### 2 · Browser DevTools — Performance panel (User Timings)

Every event is recorded as a `performance.mark()` entry.  
Timing events additionally create a `performance.measure()` bar.

Steps to view:
1. Open DevTools → **Performance** tab
2. Click **Record**, perform actions (navigate, trigger errors)
3. Stop recording
4. In the flame chart scroll to **Timings** → **User Timing**
5. You will see bars labelled `route.navigation_ms`, `web_vitals.lcp`, etc.

Mark name format: `telemetry:<type>:<name>[|<tag>:<value>,...]`

Example: `telemetry:timing:route.navigation_ms|url:/home,nav_id:6051`

### 3 · In-page buffer inspection (browser console)

The in-memory ring buffer (last 500 events) is accessible at runtime:

```javascript
// In the browser DevTools console while the app is running:
const svc = ng.getComponent(document.querySelector('app-root'))
  ?._injector?.get(ng.probe ? undefined : window['TelemetryService']);

// Simpler — inject from the Angular injector (dev builds only):
ng.injector?.get?.('TelemetryService');
```

Or add a temporary debug hook in `AppComponent`:

```typescript
constructor(public telemetry: TelemetryService) {
  (window as any).__telemetry = telemetry;
}
```

Then in the console: `__telemetry.events` shows the full buffer array.

### 4 · Local verification script

Exercises all four instrumentation points without starting the dev server:

```bash
npm run verify:telemetry
```

Expected output (abbreviated):

```
══ 1 · Unhandled error counter  (TelemetryErrorHandler)
[telemetry] counter error.unhandled=1 error_name=TypeError
[telemetry] counter error.unhandled=1 error_name=RangeError
  ✔ 2 error events in buffer (total=2)

══ 2 · Route navigation timing  (RouterTelemetryService)
[telemetry] timing route.navigation_ms=312ms url=/home nav_id=1494
[telemetry] timing route.navigation_ms=87ms url=/products nav_id=6051
[telemetry] timing route.navigation_ms=1450ms url=/checkout nav_id=7508
  ✔ 3 navigation timings recorded

══ 3 · Redux dispatch rate  (dispatchMonitorEnhancer)
[telemetry] counter redux.dispatch=1 action=SET_ITEMS
[telemetry] counter redux.dispatch=1 action=CLEAR_ITEMS
  ✔ 4 dispatch events recorded

══ 4 · Web Vitals  (WebVitalsService)
[telemetry] timing web_vitals.lcp=1820ms rating=needs-improvement navigation_type=navigate
[telemetry] timing web_vitals.fcp=980ms rating=good navigation_type=navigate
[telemetry] timing web_vitals.ttfb=210ms rating=good navigation_type=navigate
[telemetry] timing web_vitals.inp=185ms rating=good navigation_type=navigate
[telemetry] gauge web_vitals.cls=80 rating=good navigation_type=navigate
  ✔ 5 web-vitals events recorded (LCP/FCP/TTFB/INP/CLS)

══ 5 · Ring-buffer cap
  ✔ Inserted 600 events → buffer holds 500 (100 oldest dropped)

══ 6 · flush() → navigator.sendBeacon
  ✔ Payload: 1729 bytes NDJSON, buffer cleared

  Performance API calls
    marks:    621
    measures: 7  (one per timing event ✔)
```

---

## Configuration

Both flags live in the `environment.*` files:

| Key | Dev default | Prod default | Effect |
|---|---|---|---|
| `enableTelemetry` | `true` | `true` | Gates all telemetry providers in `AppModule` |
| `telemetryEndpoint` | `''` (empty) | `''` (**must set**) | URL passed to `flush()`; empty → flush no-ops silently |

### Wire a real endpoint (production)

Set `telemetryEndpoint` in `src/environments/environment.prod.ts`:

```typescript
// src/environments/environment.prod.ts
export const environment = {
  production: true,
  enableTelemetry: true,
  telemetryEndpoint: 'https://ingest.example.com/metrics',  // ← set this
};
```

> **Risk:** If you deploy with `telemetryEndpoint: ''`, events accumulate in the
> ring buffer and are silently dropped when the page closes. No error is surfaced.
> Always validate this key before deploying — the contract spec
> (`src/environments/environment.contract.spec.ts`) will fail if the key is removed.

### Disable telemetry entirely

```typescript
// src/environments/environment.ts  (or environment.prod.ts)
enableTelemetry: false,
```

When `false`, none of the telemetry providers are registered. `TelemetryService`
itself is not provided and Angular will throw if anything attempts to inject it.

---

## Auto-flush lifecycle (TelemetryFlushService)

`TelemetryFlushService` is provided automatically when `enableTelemetry` is `true`.
It listens to two browser lifecycle events and calls `flush(environment.telemetryEndpoint)`:

| Event | Why |
|---|---|
| `window:pagehide` | Most reliable signal that the page is unloading (back/forward cache aware) |
| `document:visibilitychange → hidden` | Covers background-tab close (pagehide may not fire) |

**You do not need to wire flush() manually** — the service handles it.

> **Risk: SSR / non-browser environments.** `TelemetryFlushService` accesses
> `window` and `document` in its constructor. If rendered server-side (Angular
> Universal), wrap the service registration in `isPlatformBrowser()` or it will
> throw `ReferenceError: window is not defined`.

```typescript
// Safe SSR pattern (if Universal is added later):
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';

// In AppModule providers:
...(isFlagEnabled('enableTelemetry') && isPlatformBrowser(inject(PLATFORM_ID))
    ? [TelemetryFlushService]
    : []),
```

---

## Viewing metrics in staging / production

The app ships a `TelemetryService.flush(url)` method that sends the entire
in-memory buffer to any HTTP endpoint as **newline-delimited JSON (NDJSON)**
using `navigator.sendBeacon`. `TelemetryFlushService` calls this automatically on
page hide/visibility change — you only need to set the endpoint URL (see [Configuration](#configuration)).

### NDJSON payload format

Each line of the beacon body is one event object:

```json
{"type":"timing","name":"route.navigation_ms","value":87,"tags":{"url":"/products","nav_id":"6051"},"timestamp":1716087060123}
{"type":"counter","name":"error.unhandled","value":1,"tags":{"error_name":"TypeError"},"timestamp":1716087061002}
```

### Wire a real collector (backend options)

#### Option A — Generic NDJSON endpoint (zero extra deps)

Set `environment.telemetryEndpoint` (see [Configuration](#configuration)).
The flush lifecycle is already wired via `TelemetryFlushService`.

> **Stale-doc warning:** Earlier versions of this guide showed wiring `flush()`
> manually in `AppComponent`. That approach is superseded — **remove any manual
> `flush()` calls from `AppComponent`** to avoid double-flushing.

#### Option B — Sentry

```typescript
// in TelemetryService._emit(), replace console.log with:
import * as Sentry from '@sentry/angular';

if (event.type === 'timing') {
  Sentry.metrics.distribution(event.name, event.value, { unit: 'millisecond', tags: event.tags });
} else if (event.type === 'counter') {
  Sentry.metrics.increment(event.name, event.value, { tags: event.tags });
} else {
  Sentry.metrics.gauge(event.name, event.value, { tags: event.tags });
}
```

View in: **Sentry → Metrics** (requires Sentry SDK ≥ 7.88 with metrics feature flag).

#### Option C — OpenTelemetry

```typescript
import { metrics } from '@opentelemetry/api';
const meter = metrics.getMeter('demo-app');

// Replace console.log in _emit():
const counter = meter.createCounter(event.name);
counter.add(event.value, event.tags);
```

View in: **Jaeger / Grafana Tempo / Honeycomb** — any OTel-compatible backend.

### Where to find specific metrics in production

| What you want to see | Where to look |
|---|---|
| All `[telemetry]` lines in real-time | Browser console, filtered to `[telemetry]` |
| Timing bars (LCP, navigation, etc.) | DevTools Performance panel → User Timings |
| LCP / FCP / INP ratings | Chrome UX Report or `web_vitals.*` tags in your backend |
| Error spike | Query `error.unhandled` counter grouped by `error_name` |
| Slowest routes | Sort `route.navigation_ms` by `value` DESC, grouped by `url` |
| Noisy Redux actions | Sort `redux.dispatch` by count, grouped by `action` |

---

## Extending the instrumentation

### Add a new metric (inline)

Call `this.telemetry.counter/timing/gauge(name, value, tags)` anywhere that
has access to `TelemetryService` via Angular DI:

```typescript
// Any Angular service or component:
constructor(private readonly telemetry: TelemetryService) {}

this.telemetry.timing('checkout.payment_ms', durationMs, { gateway: 'stripe' });
this.telemetry.counter('cart.item_added', 1, { category });
this.telemetry.gauge('session.cart_value', totalCents);
```

### Add a new telemetry service (subsystem instrumentation)

For a whole subsystem, create a dedicated service following the pattern of
`RouterTelemetryService` (`src/app/telemetry/router-telemetry.service.ts`):

```typescript
// src/app/telemetry/my-feature-telemetry.service.ts
import { Injectable, OnDestroy } from '@angular/core';
import { TelemetryService } from './telemetry.service';

@Injectable({ providedIn: 'root' })
export class MyFeatureTelemetryService implements OnDestroy {
  constructor(private readonly telemetry: TelemetryService) {
    // wire subscriptions / observers here
  }

  ngOnDestroy(): void {
    // unsubscribe to avoid memory leaks
  }
}
```

Then add a spec file `my-feature-telemetry.service.spec.ts` and update this doc's
[File map](#file-map) in the same PR.

> **Risk:** Forgetting `ngOnDestroy` / unsubscribing will cause ghost subscriptions
> in tests that reuse the Angular `TestBed`. Always implement `OnDestroy`.

### Change the backend

Edit `TelemetryService._emit()` in `src/app/telemetry/telemetry.service.ts`.
All instrumentation paths call `_emit` through the three public methods —
no other files need changing.

> **Risk:** `_emit()` is called synchronously on every metric. Adding a slow or
> async operation here will block the calling code. Keep `_emit()` O(1) and
> side-effect free except for the Performance API calls and console output already present.

### Add a tag

Pass a new key in the `tags` object. Tags flow automatically to:
- the Performance API mark name (`telemetry:<type>:<name>|<tag>:<value>`)
- the console log line
- the NDJSON flush payload

### Adjust the ring-buffer cap

Change `MAX_EVENTS` in `src/app/telemetry/telemetry.service.ts` (currently **500**).

| `MAX_EVENTS` | Memory ~(at 150 B/event) | Trade-off |
|---|---|---|
| 500 (default) | ~75 KB peak | Sufficient for most SPAs |
| 200 | ~30 KB | Low-memory or mobile-first apps |
| 1000 | ~150 KB | High-throughput apps with many metrics |

> **Risk:** Raising `MAX_EVENTS` above 500 without also lowering `BEACON_CHUNK_EVENTS`
> may produce beacon payloads that approach the browser's ~64 KB limit per chunk.
> Keep `MAX_EVENTS ≤ BEACON_CHUNK_EVENTS × 3` as a conservative rule.

### Use `safeCallback` for observer-context code

Wrap any callback registered with `PerformanceObserver`, `IntersectionObserver`, or
similar browser APIs in `safeCallback` so exceptions are caught and routed to the
Angular `ErrorHandler` instead of being silently swallowed:

```typescript
import { safeCallback } from './resilience';

// Without safeCallback: exceptions are lost silently
observer.observe({ type: 'paint', buffered: true });

// With safeCallback: exceptions reach TelemetryErrorHandler
onLCP(safeCallback(
  (metric) => this.telemetry.timing('web_vitals.lcp', metric.value),
  (err) => this.errorHandler.handleError(err),
));
```

### Use `errorToMeta` when recording error tags

When recording error information as metric tags, always use `errorToMeta` from
`src/app/telemetry/resilience.ts`. It safely handles non-Error thrown values
(strings, numbers, null) that would otherwise produce a confusing `[object Object]` tag:

```typescript
import { errorToMeta } from './resilience';

try { /* ... */ } catch (err) {
  const { name, message } = errorToMeta(err);
  this.telemetry.counter('my_feature.error', 1, {
    error_name: name,
    error_message: message.slice(0, 120),
  });
}
```

---

## Resilience & reliability

### Retry with exponential backoff

When `navigator.sendBeacon` returns `false` (browser queue full), the telemetry
service schedules retries via `scheduleBeaconRetry` (`src/app/telemetry/resilience.ts`).

| Parameter | Default | Location | When to change |
|---|---|---|---|
| `maxAttempts` | `3` | `DEFAULT_RETRY_OPTIONS` in `resilience.ts` | Raise for unreliable networks; lower for battery-sensitive mobile |
| `baseDelayMs` | `1 000` ms | `DEFAULT_RETRY_OPTIONS` | Raise if your backend has a higher rate-limit window |
| `maxDelayMs` | `30 000` ms | `DEFAULT_RETRY_OPTIONS` | Lower for low-priority apps that should give up sooner |
| `BEACON_CHUNK_EVENTS` | `200` events | `resilience.ts` | Lower if observing 413/payload-too-large errors at the collector |

Backoff formula: `delay = min(baseDelayMs × 2^(attempt-1), maxDelayMs)`

```
attempt 1 → 1 000 ms
attempt 2 → 2 000 ms
attempt 3 → 4 000 ms  (then gives up)
```

### Chunked delivery

The ring buffer is flushed in chunks of `BEACON_CHUNK_EVENTS` (200) events per beacon
call. This keeps each payload under ~30 KB, well within the browser's ~64 KB limit.

### sendBeacon throw guard

If `sendBeacon` throws (e.g., invalid URL, cross-origin restriction), the exception
is caught and logged via `console.error`. Retries are not attempted on a throw
(only on `sendBeacon` returning `false`).

> **Risk:** A throw from `sendBeacon` means the chunk is permanently lost. Monitor
> `[telemetry] sendBeacon threw` in your error tracking system as an alert that
> events are being dropped.

---

## Risk notes

| Risk | Severity | Mitigation |
|---|---|---|
| `telemetryEndpoint` left empty in prod | **High** — silent data loss | Validate in CI; env contract spec catches removal but not empty-string |
| SSR / Angular Universal: `window` not defined | **High** — server crash | Guard `TelemetryFlushService` with `isPlatformBrowser()` before registering |
| `_emit()` blocking the call site | **Medium** — UX jank | Keep `_emit()` synchronous and O(1); never add HTTP calls inside it |
| Ghost subscriptions from missing `ngOnDestroy` | **Medium** — test pollution | All telemetry services implement `OnDestroy`; new services must too |
| `MAX_EVENTS` too high → oversized beacon | **Low** — 413 at collector | Keep `MAX_EVENTS ≤ BEACON_CHUNK_EVENTS × 3` |
| Feature flag `enableTelemetry: false` removes all providers | **Low** — DI crash if misused | Never inject `TelemetryService` from code outside `enableTelemetry` guard |
| Sensitive data in tags | **Medium** — PII leak | Never put user-identifying data (email, userId) in tag values; tags land in NDJSON payload and browser performance marks |

---

## File map

```
src/app/telemetry/
│
│  ── Core services ──────────────────────────────────────────────────────────
├── telemetry.service.ts              Central sink — ring buffer (MAX_EVENTS=500),
│                                     Performance API marks/measures, flush()
├── telemetry-error-handler.ts        Replaces Angular ErrorHandler → error.unhandled
├── router-telemetry.service.ts       Router events → route.navigation_ms timing
├── web-vitals.service.ts             web-vitals on*() → web_vitals.* metrics
├── telemetry-flush.service.ts        Page-lifecycle flush (pagehide + visibilitychange)
│                                     reads environment.telemetryEndpoint automatically
│
│  ── Shared utilities ───────────────────────────────────────────────────────
└── resilience.ts                     LOG_PREFIX, errorToMeta(), chunkArray(),
                                      scheduleBeaconRetry(), safeCallback()
                                      No Angular DI — safe to import from any context

src/app/telemetry/  (specs)
├── telemetry.service.contract.spec.ts 25 specs: public API contract — event shape,
│                                               counter/timing/gauge, flush() return values
│                                               UPDATE THIS when the public API changes
├── telemetry.service.spec.ts         17 specs: internal ring buffer, Performance API,
│                                               flush() resilience implementation
├── telemetry-error-handler.spec.ts    6 specs
├── router-telemetry.service.spec.ts   8 specs
├── web-vitals.service.spec.ts         6 specs
├── telemetry-flush.service.spec.ts    7 specs: lifecycle flush, endpoint passthrough
├── resilience.spec.ts                31 specs: LOG_PREFIX, errorToMeta, chunkArray,
│                                              scheduleBeaconRetry, safeCallback
└── resilience-failures.spec.ts       27 specs: sendBeacon throw, SSR, partial chunks,
                                                retry exhaustion, safeCallback edge cases

projects/sub-app1/src/app/
└── store.contract.spec.ts            13 specs: AppState schema, public Redux API
                                                (getState, subscribe, dispatch, unsubscribe)
                                                UPDATE THIS when the store API changes

scripts/
└── verify-telemetry.mjs              Local verification: npm run verify:telemetry

src/environments/
├── environment.contract.spec.ts      15 specs: key allowlist, type guards, dev/prod parity
│                                               UPDATE THIS when an env key is added/removed
├── environment.ts                    telemetryEndpoint: '', enableTelemetry: true
└── environment.prod.ts               telemetryEndpoint: '' (must be set before deploy)
```

### Dependency graph (simplified)

```
AppModule
  └─► (enableTelemetry flag)
        ├─► TelemetryService          ← all services inject this
        ├─► TelemetryErrorHandler     ─► errorToMeta()  ─► resilience.ts
        ├─► RouterTelemetryService
        ├─► WebVitalsService          ─► safeCallback() ─► resilience.ts
        └─► TelemetryFlushService     reads environment.telemetryEndpoint
                                      calls TelemetryService.flush()
```

---

## Contract test update process

Three contract boundaries are actively guarded by specs. Follow this checklist
whenever you change the code at one of these boundaries:

### 1 · `TelemetryService` public API (`telemetry.service.contract.spec.ts`)

Triggered by: changes to `counter()`, `timing()`, `gauge()`, `flush()` signatures,
`TelemetryEvent` interface fields, or the `events` buffer visibility.

```
1. Change the public API in telemetry.service.ts
2. Update the affected 'it' blocks in telemetry.service.contract.spec.ts
3. Update the "Extending" and "File map" sections in docs/telemetry.md
4. ng test demo-app --no-watch --browsers=ChromeHeadlessCI  →  must be green
5. Review all 5 caller services for call-site impact
```

### 2 · Redux store API (`store.contract.spec.ts`)

Triggered by: changes to `AppState` shape, `rootReducer`, store enhancers,
or the Redux `Store` API surface used by `StoreListenerService`.

```
1. Change store.ts / rootReducer
2. Update INITIAL_STATE_SCHEMA (add properties/required entries for new keys)
3. Update the 'it' blocks for any API surface change
4. ng test sub-app1 --no-watch --browsers=ChromeHeadlessCI  →  must be green
5. Treat this file as the breaking-change signal for all store consumers
```

### 3 · Environment object shape (`environment.contract.spec.ts`)

Triggered by: adding/removing keys in `environment.ts` or `environment.prod.ts`,
or adding/removing feature flags in `featureFlags`.

```
1. Add or remove the key in both environment.ts and environment.prod.ts
2. Update ALLOWED_KEYS (and ALLOWED_FLAGS if a flag changed)
3. ng test demo-app --no-watch --browsers=ChromeHeadlessCI  →  must be green
4. Check docs/feature-flags.md if a flag changed
```

### Running all contract tests at once

```bash
ng test demo-app --no-watch --browsers=ChromeHeadlessCI
ng test sub-app1 --no-watch --browsers=ChromeHeadlessCI
```

Both must be green before merging any PR that touches a guarded boundary.


---

## Logging & metrics pattern

All telemetry module files share a single, consistent logging convention. Understanding it lets you validate instrumentation quickly without adding extra tooling.

### The pattern

Every `console.*` call in `src/app/telemetry/` follows this structure:

```typescript
console.log(LOG_PREFIX, '<lifecycle message>');           // info/lifecycle
console.warn(LOG_PREFIX, '<degraded state message>');     // soft failure
console.error(LOG_PREFIX, '<hard failure message>', err); // error with cause
```

`LOG_PREFIX` is `'[telemetry]'` — exported from `resilience.ts` and imported by every file in the folder. Grepping or filtering by `[telemetry]` in the browser console shows all subsystem output in one view.

### What each file logs

| File | Event | Level | Message |
|---|---|---|---|
| `resilience.ts` | sendBeacon retry chain stops | `error` | `sendBeacon threw during retry — stopping retry chain` |
| `resilience.ts` | `safeCallback` observer error | `error` | `observer error <err>` |
| `telemetry.service.ts` | flush called with empty URL | `warn` | `flush() called with empty URL — skipped` |
| `telemetry.service.ts` | sendBeacon throws on flush | `error` | `sendBeacon threw — flush aborted <err>` |
| `telemetry.service.ts` | every metric emitted | `log` | `[telemetry] <type> <name>=<value>[ms] [tags]` |
| `telemetry-error-handler.ts` | unhandled Angular error caught | `error` | `unhandled error: <err>` |
| `telemetry-flush.service.ts` | service constructed | `log` | `flush service initialised — listening for pagehide / visibilitychange` |
| `telemetry-flush.service.ts` | pagehide / visibilitychange fires | `log` | `flush triggered — N event(s) in buffer` |
| `router-telemetry.service.ts` | service constructed, flag ON | `log` | `router telemetry initialised` |
| `router-telemetry.service.ts` | constructed, flag OFF | `log` | `telemetry disabled — router timing not active` |
| `web-vitals.service.ts` | observers registered, flag ON | `log` | `web vitals collection initialised` |
| `web-vitals.service.ts` | constructed, flag OFF | `log` | `telemetry disabled — web vitals not collected` |
| `web-vitals.service.ts` | observer registration throws | `error` | `web-vitals observer registration failed <err>` |

### How to validate in the browser

1. Open the app with `ng serve` (or `npm start`).
2. Open Chrome DevTools → **Console** tab.
3. In the filter box type: `[telemetry]`

You should see the following on page load:

```
[telemetry] flush service initialised — listening for pagehide / visibilitychange
[telemetry] router telemetry initialised
[telemetry] web vitals collection initialised
```

When you navigate between routes:
```
[telemetry] timing route.navigation_ms=42ms url=/about outcome=success
```

When Web Vitals fire (after interaction or page hide):
```
[telemetry] gauge web_vitals.cls=5 rating=good navigation_type=navigate
[telemetry] timing web_vitals.lcp=1234ms rating=good navigation_type=navigate
```

To see Performance API marks alongside logs, open the **Performance** panel → record a short session → look in **User Timings** for `telemetry:*` entries.

### How to validate with the flag OFF

Set `enableTelemetry: false` in `src/environments/environment.ts` and reload. You should see:

```
[telemetry] telemetry disabled — router timing not active
[telemetry] telemetry disabled — web vitals not collected
```

And **no** metric log lines or flush-trigger logs.

### How to validate with tests

All logging assertions are covered by specs in `src/app/telemetry/`:

```bash
# Run all telemetry specs (fast, headless):
ng test demo-app --no-watch --browsers=ChromeHeadlessCI \
  --include="src/app/telemetry/**"
```

Specs that assert log output:

| Spec file | What is asserted |
|---|---|
| `resilience.spec.ts` | `safeCallback` default uses `console.error(LOG_PREFIX, 'observer error', err)` |
| `resilience-failures.spec.ts` | Retry chain log; flush `console.warn` for empty URL |
| `telemetry.service.spec.ts` | `console.warn` for empty URL flush |
| `telemetry-error-handler.spec.ts` | `console.error(LOG_PREFIX, 'unhandled error:', err)` |
| `telemetry-flush.service.spec.ts` | Init log; flush-triggered log with buffer count |
| `router-telemetry.service.spec.ts` | Init log (flag ON); disabled log (flag OFF) |
| `web-vitals.service.spec.ts` | Init log (flag ON); disabled log (flag OFF) |

### Adding a new log line

Follow this checklist when adding console output to the telemetry folder:

1. Import `LOG_PREFIX` from `./resilience` — do not inline the string.
2. Use the appropriate level: `log` for lifecycle, `warn` for soft failures, `error` for hard failures with cause.
3. Multi-argument form: `console.error(LOG_PREFIX, 'message', err)` — do not template-embed LOG_PREFIX.
4. Add or update a spec assertion: spy on `console.log`/`warn`/`error` **before** injecting the service, then assert the exact call signature.
