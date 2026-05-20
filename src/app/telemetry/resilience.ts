/**
 * resilience.ts — lightweight resilience utilities for the telemetry module.
 *
 * Three helpers are exported:
 *
 *   chunkArray<T>          — splits an array into fixed-size batches
 *   scheduleBeaconRetry    — retries a failed sendBeacon call with exponential backoff
 *   safeCallback<T>        — wraps a callback so observer-context exceptions are caught
 *
 * Design constraints
 * ──────────────────
 * • No Angular DI: all helpers are pure functions / closures so they can be
 *   called from store.ts and other files that run outside the Angular DI tree.
 * • No external dependencies: zero new packages.
 * • Synchronous paths only: sendBeacon is fire-and-forget (returns boolean).
 *   Retries are scheduled via setTimeout and do NOT block the calling thread.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface RetryOptions {
  /** Maximum number of retry attempts after the first failure. Default: 3 */
  readonly maxAttempts: number;
  /** Delay before the first retry in ms. Doubles on each subsequent attempt. Default: 1 000 */
  readonly baseDelayMs: number;
  /** Upper cap on the computed delay (prevents multi-minute waits). Default: 30 000 */
  readonly maxDelayMs: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

/**
 * Maximum events per sendBeacon batch.
 *
 * Rationale: a worst-case telemetry event serialises to ~150 bytes.
 * 200 events × 150 bytes = 30 KB — well under the ~64 KB browser limit for
 * sendBeacon, leaving headroom for unusually verbose tag values.
 */
export const BEACON_CHUNK_EVENTS = 200;

export const DEFAULT_RETRY_OPTIONS: Readonly<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
};

// ── chunkArray ─────────────────────────────────────────────────────────────

/**
 * Splits `arr` into consecutive sub-arrays of at most `size` items.
 *
 * @example
 *   chunkArray([1, 2, 3, 4, 5], 2)  // → [[1, 2], [3, 4], [5]]
 *   chunkArray([], 10)               // → []
 */
export function chunkArray<T>(arr: readonly T[], size: number): T[][] {
  if (size <= 0) throw new RangeError(`chunkArray: size must be > 0, got ${size}`);
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ── scheduleBeaconRetry ────────────────────────────────────────────────────

/**
 * Schedules up to `options.maxAttempts` retries for a `sendBeacon` call that
 * returned `false`.
 *
 * Each retry fires after an exponentially increasing delay:
 *   attempt 1 → baseDelayMs   (e.g. 1 000 ms)
 *   attempt 2 → baseDelayMs × 2  (e.g. 2 000 ms)
 *   attempt 3 → baseDelayMs × 4  (e.g. 4 000 ms)
 *   … capped at maxDelayMs
 *
 * Retries are NOT guaranteed to execute if the page unloads before the
 * setTimeout fires — this is acceptable because the data is already in the
 * ring buffer and will be included in the next session's flush.
 *
 * @param url       sendBeacon destination URL
 * @param blob      Blob payload (pre-serialised NDJSON chunk)
 * @param options   Retry configuration (defaults to DEFAULT_RETRY_OPTIONS)
 * @param attempt   Current attempt number — callers should omit this (default: 1)
 */
export function scheduleBeaconRetry(
  url: string,
  blob: Blob,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS,
  attempt = 1,
): void {
  if (attempt > options.maxAttempts) return;

  const delay = Math.min(
    options.baseDelayMs * Math.pow(2, attempt - 1),
    options.maxDelayMs,
  );

  setTimeout(() => {
    const ok = navigator.sendBeacon(url, blob);
    if (!ok) {
      scheduleBeaconRetry(url, blob, options, attempt + 1);
    }
  }, delay);
}

// ── safeCallback ───────────────────────────────────────────────────────────

/**
 * Wraps `fn` so that any synchronous exception it throws is caught and
 * forwarded to `onError` instead of propagating up.
 *
 * Use-case: browser PerformanceObserver / web-vitals callbacks run in a
 * context where uncaught exceptions are **silently swallowed** by the browser.
 * Wrapping with safeCallback ensures the error is at least visible via the
 * Angular ErrorHandler (or a custom onError handler) rather than disappearing.
 *
 * @param fn       The callback to protect
 * @param onError  Optional handler; defaults to `console.error`
 *
 * @example
 *   onLCP(safeCallback(report, (err) => errorHandler.handleError(err)));
 */
export function safeCallback<T>(
  fn: (arg: T) => void,
  onError: (err: unknown) => void = (err) => console.error('[telemetry] observer error', err),
): (arg: T) => void {
  return (arg: T): void => {
    try {
      fn(arg);
    } catch (err) {
      onError(err);
    }
  };
}
