/**
 * Tests for delay function functionality
 * These tests verify the delay behavior including AbortSignal support
 */

import { describe, it, expect, vi } from 'vitest';
import { delay } from '../src/primitives/delay.js';

describe('delay', () => {
  describe('Basic functionality', () => {
    it('should resolve after the specified delay', async () => {
      const startTime = Date.now();

      await delay(50);

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Allow some tolerance for timing precision
      expect(elapsed).toBeGreaterThanOrEqual(45);
      expect(elapsed).toBeLessThan(100);
    });

    it('should resolve immediately with zero delay', async () => {
      const startTime = Date.now();

      await delay(0);

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Should resolve very quickly (within 10ms)
      expect(elapsed).toBeLessThan(10);
    });

    it('should handle multiple concurrent delays', async () => {
      const results: number[] = [];
      const startTime = Date.now();

      const promises = [
        delay(20).then(() => results.push(1)),
        delay(10).then(() => results.push(2)),
        delay(30).then(() => results.push(3)),
      ];

      await Promise.all(promises);

      // Results should be in order of completion (shortest delay first)
      expect(results).toEqual([2, 1, 3]);

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Should complete in roughly 30ms (the longest delay)
      expect(elapsed).toBeGreaterThanOrEqual(25);
      expect(elapsed).toBeLessThan(50);
    });
  });

  describe('AbortSignal support', () => {
    it('should cancel delay when signal is aborted', async () => {
      const controller = new AbortController();
      const startTime = Date.now();

      // Cancel the delay after 20ms
      setTimeout(() => controller.abort(), 20);

      let caughtError: Error | null = null;
      try {
        await delay(100, controller.signal);
      } catch (error) {
        caughtError = error as Error;
      }

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      expect(caughtError).toBeTruthy();
      expect(caughtError?.message).toBe('Delay was aborted');

      // Should be aborted quickly, not wait for the full 100ms
      expect(elapsed).toBeLessThan(50);
    });

    it('should reject immediately if signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort(); // Abort before calling delay

      const startTime = Date.now();

      let caughtError: Error | null = null;
      try {
        await delay(100, controller.signal);
      } catch (error) {
        caughtError = error as Error;
      }

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      expect(caughtError).toBeTruthy();
      expect(caughtError?.message).toBe('Delay was aborted');

      // Should reject immediately (within 5ms)
      expect(elapsed).toBeLessThan(5);
    });

    it('should work normally without AbortSignal', async () => {
      const startTime = Date.now();

      await delay(30);

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(25);
      expect(elapsed).toBeLessThan(50);
    });

    it('should clean up timeout when aborted', async () => {
      const controller = new AbortController();

      // Start a long delay
      const delayPromise = delay(1000, controller.signal);

      // Abort immediately
      controller.abort();

      let caughtError: Error | null = null;
      try {
        await delayPromise;
      } catch (error) {
        caughtError = error as Error;
      }

      expect(caughtError).toBeTruthy();
      expect(caughtError?.message).toBe('Delay was aborted');
    });

    it('should handle multiple delays with the same AbortSignal', async () => {
      const controller = new AbortController();
      const results: string[] = [];
      const errors: Error[] = [];

      const delays = [
        delay(50, controller.signal)
          .then(() => results.push('delay1'))
          .catch((error) => errors.push(error)),
        delay(100, controller.signal)
          .then(() => results.push('delay2'))
          .catch((error) => errors.push(error)),
        delay(150, controller.signal)
          .then(() => results.push('delay3'))
          .catch((error) => errors.push(error)),
      ];

      // Abort after 25ms (before any delay completes)
      setTimeout(() => controller.abort(), 25);

      await Promise.all(delays);

      expect(results).toHaveLength(0); // No delays should complete
      expect(errors).toHaveLength(3); // All should be aborted
      expect(
        errors.every((error) => error.message === 'Delay was aborted')
      ).toBe(true);
    });

    it('should not affect delays without AbortSignal when other delays are aborted', async () => {
      const controller = new AbortController();
      const results: string[] = [];

      const withSignal = delay(100, controller.signal)
        .then(() => results.push('with-signal'))
        .catch(() => results.push('aborted'));

      const withoutSignal = delay(50).then(() =>
        results.push('without-signal')
      );

      // Abort the first delay after 25ms
      setTimeout(() => controller.abort(), 25);

      await Promise.all([withSignal, withoutSignal]);

      // Both should complete, but order may vary depending on timing
      expect(results).toHaveLength(2);
      expect(results).toContain('without-signal');
      expect(results).toContain('aborted');
    });
  });

  describe('Edge cases', () => {
    it('should handle very small delays', async () => {
      const startTime = Date.now();

      await delay(1);

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Should complete quickly
      expect(elapsed).toBeLessThan(20);
    });

    it('should handle abort signal that is removed during delay', async () => {
      const controller = new AbortController();

      const delayPromise = delay(50, controller.signal);

      // Don't abort, just let it complete normally
      const result = await delayPromise;

      expect(result).toBeUndefined(); // delay resolves with undefined
    });

    it('should handle concurrent abort calls', async () => {
      const controller = new AbortController();

      const delayPromise = delay(100, controller.signal);

      // Multiple abort calls should be handled gracefully
      setTimeout(() => {
        controller.abort();
        controller.abort(); // Second abort call
      }, 20);

      let caughtError: Error | null = null;
      try {
        await delayPromise;
      } catch (error) {
        caughtError = error as Error;
      }

      expect(caughtError).toBeTruthy();
      expect(caughtError?.message).toBe('Delay was aborted');
    });
  });

  describe('Integration with Promise utilities', () => {
    it('should work with Promise.race', async () => {
      const result = await Promise.race([
        delay(100).then(() => 'slow'),
        delay(50).then(() => 'fast'),
      ]);

      expect(result).toBe('fast');
    });

    it('should work with Promise.allSettled when some are aborted', async () => {
      const controller = new AbortController();

      setTimeout(() => controller.abort(), 25);

      const results = await Promise.allSettled([
        delay(50, controller.signal),
        delay(30),
        delay(100, controller.signal),
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].status).toBe('rejected');
      expect(results[1].status).toBe('fulfilled');
      expect(results[2].status).toBe('rejected');

      expect((results[0] as PromiseRejectedResult).reason.message).toBe(
        'Delay was aborted'
      );
      expect((results[2] as PromiseRejectedResult).reason.message).toBe(
        'Delay was aborted'
      );
    });
  });
});
