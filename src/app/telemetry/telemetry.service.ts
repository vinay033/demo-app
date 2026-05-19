/**
 * TelemetryService — central metric sink backed by the browser Performance API.
 *
 * Every metric is written as a `performance.mark()` entry so it appears
 * in Chrome DevTools > Performance panel > User Timings without any extra
 * tooling. Timing metrics additionally create a `performance.measure()`.
 *
 * All events are buffered in `this.events` for in-process inspection and for
 * the `flush()` export method which ships the buffer to any HTTP endpoint via
 * `navigator.sendBeacon` (fire-and-forget, survives page unload).
 *
 * ── Adding a real backend ────────────────────────────────────────────────────
 * Option A — sendBeacon to a collector (already wired, just call flush()):
 *   ngOnDestroy / beforeunload: this.telemetry.flush('https://collector/ingest')
 *
 * Option B — Sentry:
 *   Sentry.metrics.increment(event.name, event.value, { tags: event.tags });
 *
 * Option C — OpenTelemetry:
 *   meter.createCounter(event.name).add(event.value, event.tags ?? {});
 *
 * Metric types
 * ─────────────
 * counter  – monotonically increasing integer  (e.g. error.unhandled)
 * timing   – duration in milliseconds          (e.g. route.navigation_ms)
 * gauge    – point-in-time value               (e.g. redux dispatch count)
 */

import { Injectable } from '@angular/core';

export interface TelemetryEvent {
  type: 'counter' | 'timing' | 'gauge';
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp: number; // Date.now()
}

@Injectable({ providedIn: 'root' })
export class TelemetryService {
  /** In-memory ring buffer — capped at 500 events to avoid unbounded growth. */
  readonly events: TelemetryEvent[] = [];
  private static readonly MAX_EVENTS = 500;

  counter(name: string, increment = 1, tags?: Record<string, string>): void {
    this._emit({ type: 'counter', name, value: increment, tags });
  }

  timing(name: string, durationMs: number, tags?: Record<string, string>): void {
    this._emit({ type: 'timing', name, value: Math.round(durationMs), tags });
  }

  gauge(name: string, value: number, tags?: Record<string, string>): void {
    this._emit({ type: 'gauge', name, value, tags });
  }

  /**
   * Flush the in-memory buffer to an HTTP endpoint using navigator.sendBeacon.
   * sendBeacon is fire-and-forget and survives page unload — safe to call in
   * ngOnDestroy or a 'visibilitychange' / 'pagehide' listener.
   *
   * The payload is newline-delimited JSON (NDJSON), one event per line.
   *
   * @param url  Collector endpoint, e.g. 'https://ingest.example.com/metrics'
   * @returns    true if the browser accepted the beacon, false otherwise
   */
  flush(url: string): boolean {
    if (this.events.length === 0) return true;
    const ndjson = this.events.map(e => JSON.stringify(e)).join('\n');
    const blob = new Blob([ndjson], { type: 'application/x-ndjson' });
    const ok = navigator.sendBeacon(url, blob);
    if (ok) this.events.length = 0; // clear buffer on successful handoff
    return ok;
  }

  private _emit(event: Omit<TelemetryEvent, 'timestamp'>): void {
    const full: TelemetryEvent = { ...event, timestamp: Date.now() };

    // Ring-buffer: drop the oldest event when the cap is reached
    if (this.events.length >= TelemetryService.MAX_EVENTS) {
      this.events.shift();
    }
    this.events.push(full);

    // ── Performance API ────────────────────────────────────────────────────
    // Mark the event so it appears in DevTools > Performance > User Timings.
    // Tag values are encoded into the mark name as key:value pairs so they
    // survive the string-only constraint of the Performance API.
    const tagSuffix = event.tags
      ? '|' + Object.entries(event.tags).map(([k, v]) => `${k}:${v}`).join(',')
      : '';
    const markName = `telemetry:${event.type}:${event.name}${tagSuffix}`;

    try {
      performance.mark(markName, { detail: full });

      // For timing metrics, also create a measure so the duration bar renders
      // in the DevTools flame chart. We use a synthetic start mark offset by
      // the duration so the measure ends "now".
      if (event.type === 'timing') {
        const startMark = `${markName}:start`;
        performance.mark(startMark, {
          startTime: performance.now() - event.value,
        });
        performance.measure(event.name, startMark, markName);
      }
    } catch {
      // Performance API unavailable (SSR / test environments without jsdom timing)
    }

    // ── Console output (dev-mode visibility) ──────────────────────────────
    const tagStr = event.tags
      ? ' ' + Object.entries(event.tags).map(([k, v]) => `${k}=${v}`).join(' ')
      : '';
    const unit = event.type === 'timing' ? 'ms' : '';
    console.log(`[telemetry] ${event.type} ${event.name}=${event.value}${unit}${tagStr}`);
  }
}
