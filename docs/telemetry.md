# Telemetry Observability Guide

How to view, query, and extend the instrumentation added in this repo.

---

## What is instrumented

| Metric name | Type | Tags | Emitted by |
|---|---|---|---|
| `error.unhandled` | counter | `error_name` | `TelemetryErrorHandler` |
| `route.navigation_ms` | timing (ms) | `url`, `nav_id` | `RouterTelemetryService` |
| `redux.dispatch` | counter | `action` | `dispatchMonitorEnhancer` (store.ts) |
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
[telemetry] timing  route.navigation_ms=87ms   url=/products nav_id=6051
[telemetry] counter redux.dispatch=1            action=SET_ITEMS
[telemetry] timing  web_vitals.lcp=1820ms       rating=needs-improvement navigation_type=navigate
[telemetry] gauge   web_vitals.cls=80           rating=good navigation_type=navigate
[telemetry] counter error.unhandled=1           error_name=TypeError
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

## Viewing metrics in staging / production

The app ships a `TelemetryService.flush(url)` method that sends the entire
in-memory buffer to any HTTP endpoint as **newline-delimited JSON (NDJSON)**
using `navigator.sendBeacon`.

### Wire a real collector (three options)

#### Option A — Generic NDJSON endpoint (zero extra deps)

Call `flush()` on page hide so no events are lost on navigation/close:

```typescript
// app.component.ts
import { TelemetryService } from './telemetry/telemetry.service';

export class AppComponent implements OnInit {
  constructor(private telemetry: TelemetryService) {}

  @HostListener('window:pagehide')
  onPageHide(): void {
    this.telemetry.flush('https://ingest.example.com/metrics');
  }
}
```

Each line of the NDJSON body is one event object:

```json
{"type":"timing","name":"route.navigation_ms","value":87,"tags":{"url":"/products","nav_id":"6051"},"timestamp":1716087060123}
{"type":"counter","name":"error.unhandled","value":1,"tags":{"error_name":"TypeError"},"timestamp":1716087061002}
```

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

1. **Add a new metric** — call `this.telemetry.counter/timing/gauge(name, value, tags)` anywhere
   that has access to `TelemetryService` via Angular DI.

2. **Change the backend** — edit `TelemetryService._emit()`. The rest of the codebase
   is unaffected; all instrumentation points call `_emit` through the three public methods.

3. **Add a tag** — pass a new key in the `tags` object; it flows to the Performance API
   mark name, the console line, and the NDJSON payload automatically.

4. **Lower the ring-buffer cap** — change `MAX_EVENTS` in `telemetry.service.ts`
   (currently 500). Lower values reduce memory at the cost of losing early events.

---

## File map

```
src/app/telemetry/
├── telemetry.service.ts          Central sink — ring buffer, Performance API, flush()
├── telemetry-error-handler.ts    Replaces Angular ErrorHandler → error.unhandled counter
├── router-telemetry.service.ts   Subscribes to Router events → route.navigation_ms timing
├── web-vitals.service.ts         Wires web-vitals on*() → web_vitals.* metrics
├── telemetry.service.spec.ts     12 specs: counter/timing/gauge, ring buffer, flush()
├── telemetry-error-handler.spec.ts   6 specs
├── router-telemetry.service.spec.ts  6 specs
└── web-vitals.service.spec.ts        3 specs
scripts/
└── verify-telemetry.mjs          Local verification: npm run verify:telemetry
```
