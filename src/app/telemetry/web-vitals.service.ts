/**
 * WebVitalsService — collects Core Web Vitals via the `web-vitals` library
 * and pipes them into TelemetryService as timing/gauge metrics.
 *
 * Metrics collected:
 *   LCP  – Largest Contentful Paint   (timing, ms) — loading perception
 *   CLS  – Cumulative Layout Shift     (gauge, score × 1000) — visual stability
 *   INP  – Interaction to Next Paint   (timing, ms) — responsiveness
 *   FCP  – First Contentful Paint      (timing, ms) — initial render
 *   TTFB – Time to First Byte          (timing, ms) — server / network
 *
 * Each metric carries a `rating` tag ('good' | 'needs-improvement' | 'poor')
 * and a `navigation_type` tag for segmentation (navigate / reload / prerender…).
 *
 * Flushing to a backend
 * ─────────────────────
 * Web Vitals fire on page-hide/unload. Wire the flush in AppComponent or a
 * root-level HostListener:
 *
 *   @HostListener('window:visibilitychange')
 *   onVisibilityChange() {
 *     if (document.visibilityState === 'hidden') {
 *       this.telemetry.flush('https://collector.example.com/vitals');
 *     }
 *   }
 */

import { Injectable } from '@angular/core';
import { onLCP, onCLS, onINP, onFCP, onTTFB } from 'web-vitals';
import type { MetricType } from 'web-vitals';
import { TelemetryService } from './telemetry.service';
import { isFlagEnabled } from '../feature-flags/feature-flag.service';
import { safeCallback, LOG_PREFIX } from './resilience';

@Injectable({ providedIn: 'root' })
export class WebVitalsService {
  constructor(private readonly telemetry: TelemetryService) {
    // Feature flag guard: skip observer registration when telemetry is OFF.
    if (!isFlagEnabled('enableTelemetry')) {
      return;
    }
    this.collect();
  }

  private collect(): void {
    // safeCallback wraps `report` so any exception thrown during metric
    // processing (e.g. telemetry service torn down before LCP fires) is caught
    // and logged rather than silently swallowed by the PerformanceObserver runtime.
    const report = safeCallback((metric: MetricType): void => {
      const tags: Record<string, string> = {
        rating: metric.rating,
        navigation_type: metric.navigationType,
      };

      // CLS is a unitless score (0–∞); store ×1000 as integer to use gauge type
      if (metric.name === 'CLS') {
        this.telemetry.gauge(
          `web_vitals.cls`,
          Math.round(metric.value * 1000),
          tags,
        );
      } else {
        this.telemetry.timing(
          `web_vitals.${metric.name.toLowerCase()}`,
          metric.value,
          tags,
        );
      }
    });

    // Guard the registration calls: in restricted browser environments
    // (e.g. privacy-hardened profiles, older browsers) PerformanceObserver
    // construction may throw. A single catch here prevents an observer setup
    // failure from propagating to the Angular error boundary.
    try {
      onLCP(report);
      onCLS(report);
      onINP(report);
      onFCP(report);
      onTTFB(report);
    } catch (err) {
      console.error(LOG_PREFIX, 'web-vitals observer registration failed', err);
    }
  }
}
