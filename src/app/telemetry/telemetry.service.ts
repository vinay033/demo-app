/**
 * TelemetryService — central metric sink.
 *
 * All instrumentation points write here. The backend is console-based by
 * default and is intentionally trivial to swap: replace the `_emit` method
 * body with a Sentry, Datadog, or OpenTelemetry call and nothing else changes.
 *
 * Metric types
 * ─────────────
 * counter   – monotonically increasing integer (e.g. error count)
 * timing    – duration in milliseconds (e.g. route load time)
 * gauge     – point-in-time value (e.g. dispatch rate per minute)
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
  /** In-memory store — useful for tests and local inspection. */
  readonly events: TelemetryEvent[] = [];

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
   * Swap this method body to route metrics to a real backend.
   *
   * Sentry example:
   *   Sentry.metrics.increment(event.name, event.value, { tags: event.tags });
   *
   * Datadog RUM example:
   *   DD_RUM.addTiming(event.name, event.value);
   *
   * OpenTelemetry example:
   *   meter.createCounter(event.name).add(event.value, event.tags);
   */
  private _emit(event: Omit<TelemetryEvent, 'timestamp'>): void {
    const full: TelemetryEvent = { ...event, timestamp: Date.now() };
    this.events.push(full);

    const tagStr = event.tags
      ? ' ' + Object.entries(event.tags).map(([k, v]) => `${k}=${v}`).join(' ')
      : '';
    const unit = event.type === 'timing' ? 'ms' : '';
    console.log(`[telemetry] ${event.type} ${event.name}=${event.value}${unit}${tagStr}`);
  }
}
