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
import {
  chunkArray,
  scheduleBeaconRetry,
  BEACON_CHUNK_EVENTS,
  LOG_PREFIX,
  RetryOptions,
} from './resilience';

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
   * Resilience improvements over a bare sendBeacon call:
   *   • URL guard     — returns false immediately for an empty/missing URL
   *   • API guard     — returns false in SSR / non-browser environments
   *   • Chunking      — splits the buffer into ≤200-event batches (~30 KB each)
   *                     to stay under the browser's ~64 KB sendBeacon limit
   *   • Retry backoff — schedules up to 3 retries (1 s → 2 s → 4 s) for any
   *                     chunk that the browser rejects (ok = false); stops
   *                     sending further chunks on first failure
   *
   * @param url          Collector endpoint, e.g. 'https://ingest.example.com/metrics'
   * @param retryOptions Override retry defaults (optional)
   * @returns            true if every chunk was accepted on the first attempt
   */
  flush(url: string, retryOptions?: RetryOptions): boolean {
    // Guard: empty URL — sendBeacon would throw TypeError
    if (!url) {
      console.warn(LOG_PREFIX, 'flush() called with empty URL — skipped');
      return false;
    }

    // Guard: sendBeacon unavailable (SSR / Node / pre-Chrome-39 browsers)
    if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
      return false;
    }

    if (this.events.length === 0) return true;

    // Split into ≤BEACON_CHUNK_EVENTS batches to stay under the ~64 KB limit.
    // At ~150 bytes/event, 200 events ≈ 30 KB — half the browser limit.
    const chunks = chunkArray(this.events, BEACON_CHUNK_EVENTS);
    let sentCount = 0;
    let allSent = true;

    for (const chunk of chunks) {
      const blob = new Blob(
        [chunk.map(e => JSON.stringify(e)).join('\n')],
        { type: 'application/x-ndjson' },
      );
      let ok: boolean;
      try {
        ok = navigator.sendBeacon(url, blob);
      } catch (err) {
        // sendBeacon can throw TypeError for malformed URLs or if the browser
        // rejects the call entirely. Treat as a permanent failure for this chunk.
        console.error(LOG_PREFIX, 'sendBeacon threw — flush aborted', err);
        allSent = false;
        break;
      }
      if (ok) {
        sentCount += chunk.length;
      } else {
        allSent = false;
        // Retry this chunk; stop sending further chunks — if one fails,
        // subsequent ones are likely to fail too (browser queue full, etc.).
        scheduleBeaconRetry(url, blob, retryOptions);
        break;
      }
    }

    // Remove successfully sent events from the front of the ring buffer.
    if (sentCount > 0) {
      this.events.splice(0, sentCount);
    }

    return allSent;
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
    console.log(`${LOG_PREFIX} ${event.type} ${event.name}=${event.value}${unit}${tagStr}`);
  }
}
