import {
  chunkArray,
  scheduleBeaconRetry,
  safeCallback,
  DEFAULT_RETRY_OPTIONS,
  BEACON_CHUNK_EVENTS,
  RetryOptions,
} from './resilience';

// Validate exported constants shape at import time
const _: RetryOptions = DEFAULT_RETRY_OPTIONS; void _;

describe('resilience helpers', () => {

  // ── chunkArray ──────────────────────────────────────────────────────────

  describe('chunkArray', () => {
    it('splits an array evenly into chunks of the requested size', () => {
      expect(chunkArray([1, 2, 3, 4, 5, 6], 2)).toEqual([[1, 2], [3, 4], [5, 6]]);
    });

    it('puts the remainder in the last (shorter) chunk', () => {
      expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('returns a single chunk when array is smaller than size', () => {
      expect(chunkArray([1, 2], 10)).toEqual([[1, 2]]);
    });

    it('returns an empty array for an empty input', () => {
      expect(chunkArray([], 5)).toEqual([]);
    });

    it('returns single-element chunks when size is 1', () => {
      expect(chunkArray(['a', 'b', 'c'], 1)).toEqual([['a'], ['b'], ['c']]);
    });

    it('does not mutate the source array', () => {
      const src = [1, 2, 3];
      chunkArray(src, 2);
      expect(src).toEqual([1, 2, 3]);
    });

    it('throws RangeError for size ≤ 0', () => {
      expect(() => chunkArray([1], 0)).toThrowError(RangeError);
      expect(() => chunkArray([1], -1)).toThrowError(RangeError);
    });

    it('BEACON_CHUNK_EVENTS constant produces chunks under the 64 KB browser limit', () => {
      // Worst-case event: ~150 bytes serialised
      const worstCase = JSON.stringify({
        type: 'timing', name: 'route.navigation_ms', value: 999,
        tags: { url: '/very/long/path/to/some/deeply/nested/route/component', outcome: 'success' },
        timestamp: Date.now(),
      });
      const bytesPerChunk = worstCase.length * BEACON_CHUNK_EVENTS;
      expect(bytesPerChunk).toBeLessThan(64 * 1024); // 64 KB browser limit
    });
  });

  // ── scheduleBeaconRetry ─────────────────────────────────────────────────

  describe('scheduleBeaconRetry', () => {
    let sendBeaconSpy: jasmine.Spy;

    beforeEach(() => {
      jasmine.clock().install();
      sendBeaconSpy = spyOn(navigator, 'sendBeacon');
    });

    afterEach(() => {
      jasmine.clock().uninstall();
    });

    it('does nothing when maxAttempts is 0', () => {
      const opts: RetryOptions = { maxAttempts: 0, baseDelayMs: 100, maxDelayMs: 1000 };
      scheduleBeaconRetry('https://example.com', new Blob(['x']), opts);
      jasmine.clock().tick(10_000);
      expect(sendBeaconSpy).not.toHaveBeenCalled();
    });

    it('fires after baseDelayMs on first retry', () => {
      sendBeaconSpy.and.returnValue(true);
      const opts: RetryOptions = { maxAttempts: 1, baseDelayMs: 500, maxDelayMs: 5000 };
      scheduleBeaconRetry('https://example.com', new Blob(['x']), opts);

      expect(sendBeaconSpy).not.toHaveBeenCalled(); // not immediate
      jasmine.clock().tick(500);
      expect(sendBeaconSpy).toHaveBeenCalledTimes(1);
    });

    it('schedules a second retry with doubled delay when first retry fails', () => {
      sendBeaconSpy.and.returnValue(false);
      const opts: RetryOptions = { maxAttempts: 2, baseDelayMs: 1000, maxDelayMs: 30_000 };
      scheduleBeaconRetry('https://example.com', new Blob(['x']), opts);

      jasmine.clock().tick(1000); // attempt 1 → fails
      expect(sendBeaconSpy).toHaveBeenCalledTimes(1);

      jasmine.clock().tick(2000); // attempt 2 (2× delay) → fails
      expect(sendBeaconSpy).toHaveBeenCalledTimes(2);

      jasmine.clock().tick(60_000); // no further attempts
      expect(sendBeaconSpy).toHaveBeenCalledTimes(2);
    });

    it('stops retrying after a successful attempt', () => {
      let calls = 0;
      sendBeaconSpy.and.callFake(() => ++calls === 2); // fail once, then succeed
      const opts: RetryOptions = { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 5000 };
      scheduleBeaconRetry('https://example.com', new Blob(['x']), opts);

      jasmine.clock().tick(100);  // attempt 1 → fails
      jasmine.clock().tick(200);  // attempt 2 → succeeds
      jasmine.clock().tick(10_000); // no further attempts
      expect(sendBeaconSpy).toHaveBeenCalledTimes(2);
    });

    it('caps delay at maxDelayMs', () => {
      sendBeaconSpy.and.returnValue(false);
      const opts: RetryOptions = { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 1500 };
      scheduleBeaconRetry('https://example.com', new Blob(['x']), opts);

      jasmine.clock().tick(1000); // attempt 1 (1000 ms)
      jasmine.clock().tick(1500); // attempt 2 (capped at 1500 ms, not 2000 ms)
      jasmine.clock().tick(1500); // attempt 3 (capped at 1500 ms)
      expect(sendBeaconSpy).toHaveBeenCalledTimes(3);
    });

    it('uses DEFAULT_RETRY_OPTIONS when no options are passed', () => {
      sendBeaconSpy.and.returnValue(true);
      scheduleBeaconRetry('https://example.com', new Blob(['x']));

      // First retry fires after baseDelayMs = 1000 ms
      jasmine.clock().tick(999);
      expect(sendBeaconSpy).not.toHaveBeenCalled();
      jasmine.clock().tick(1);
      expect(sendBeaconSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ── safeCallback ───────────────────────────────────────────────────────

  describe('safeCallback', () => {
    it('passes the argument through to the wrapped function', () => {
      const received: number[] = [];
      const wrapped = safeCallback((n: number) => received.push(n));
      wrapped(42);
      expect(received).toEqual([42]);
    });

    it('catches a thrown exception and calls onError', () => {
      const errors: unknown[] = [];
      const wrapped = safeCallback(
        () => { throw new Error('boom'); },
        (err) => errors.push(err),
      );
      expect(() => wrapped(undefined as unknown as never)).not.toThrow();
      expect(errors.length).toBe(1);
      expect(errors[0] instanceof Error).toBeTrue();
      expect((errors[0] as Error).message).toBe('boom');
    });

    it('uses console.error as the default onError handler', () => {
      const spy = spyOn(console, 'error');
      const wrapped = safeCallback((_n: number) => { throw new Error('silent-boom'); });
      wrapped(0);
      expect(spy).toHaveBeenCalledWith('[telemetry] observer error', jasmine.any(Error));
    });

    it('does not call onError when the wrapped function succeeds', () => {
      const errors: unknown[] = [];
      const wrapped = safeCallback((_: number) => { /* ok */ }, (e) => errors.push(e));
      wrapped(1);
      expect(errors).toEqual([]);
    });

    it('works with multiple sequential calls — each exception is independent', () => {
      const errors: unknown[] = [];
      let callCount = 0;
      const wrapped = safeCallback(
        (n: number) => {
          callCount++;
          if (n % 2 === 0) throw new Error(`even: ${n}`);
        },
        (err) => errors.push(err),
      );
      wrapped(1); wrapped(2); wrapped(3); wrapped(4);
      expect(callCount).toBe(4);
      expect(errors.length).toBe(2);
    });
  });

});
