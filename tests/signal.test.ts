/**
 * Tests for ManualSignal functionality
 * These tests verify the core behavior of manual signal operations
 */

import { describe, it, expect } from 'vitest';
import { createManualSignal } from '../src/primitives/signal.js';
import { delay } from '../src/primitives/delay.js';

describe('createManualSignal', () => {
  describe('Basic wait/set functionality', () => {
    it('should wait for signal and resolve when set', async () => {
      const signal = createManualSignal();
      let resolved = false;

      // Start waiting
      const waitPromise = signal.wait().then(() => {
        resolved = true;
      });

      // Should not be resolved immediately
      await delay(10);
      expect(resolved).toBe(false);

      // Set the signal
      signal.set();

      // Should resolve now
      await waitPromise;
      expect(resolved).toBe(true);
    });

    it('should return immediately when signal is already set', async () => {
      const signal = createManualSignal();
      
      // Set the signal first
      signal.set();

      // Wait should return immediately
      const startTime = Date.now();
      await signal.wait();
      const endTime = Date.now();

      // Should complete very quickly (less than 5ms)
      expect(endTime - startTime).toBeLessThan(5);
    });

    it('should abort wait when AbortSignal is triggered', async () => {
      const signal = createManualSignal();
      const abortController = new AbortController();
      
      let aborted = false;
      let resolved = false;

      // Start waiting with abort signal
      const waitPromise = signal.wait(abortController.signal)
        .then(() => {
          resolved = true;
        })
        .catch(() => {
          aborted = true;
        });

      // Should not be resolved or aborted yet
      await delay(10);
      expect(resolved).toBe(false);
      expect(aborted).toBe(false);

      // Abort the operation
      abortController.abort();

      // Should be aborted now
      await waitPromise;
      expect(resolved).toBe(false);
      expect(aborted).toBe(true);
    });

    it('should allow multiple waiters to be resolved by single set', async () => {
      const signal = createManualSignal();
      const results: number[] = [];

      // Create multiple waiters
      const waiters = Array.from({ length: 5 }, (_, i) =>
        signal.wait().then(() => {
          results.push(i);
        })
      );

      // Should not be resolved yet
      await delay(10);
      expect(results).toHaveLength(0);

      // Set the signal once
      signal.set();

      // All waiters should resolve
      await Promise.all(waiters);
      expect(results).toHaveLength(5);
      expect(results.sort()).toEqual([0, 1, 2, 3, 4]);
    });

    it('should reset signal and wait again after set', async () => {
      const signal = createManualSignal();
      
      // Set the signal
      signal.set();
      
      // Wait should return immediately
      await signal.wait();
      
      // Reset the signal
      signal.reset();
      
      let resolved = false;
      
      // Start waiting again
      const waitPromise = signal.wait().then(() => {
        resolved = true;
      });
      
      // Should not be resolved immediately after reset
      await delay(10);
      expect(resolved).toBe(false);
      
      // Set again
      signal.set();
      
      // Should resolve now
      await waitPromise;
      expect(resolved).toBe(true);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle already aborted signal', async () => {
      const signal = createManualSignal();
      const abortController = new AbortController();
      
      // Abort before waiting
      abortController.abort();
      
      let error: Error | undefined;
      try {
        await signal.wait(abortController.signal);
      } catch (err) {
        error = err as Error;
      }
      
      expect(error).toBeDefined();
      expect(error!.message).toBe('Signal aborted');
    });

    it('should handle multiple set calls idempotently', async () => {
      const signal = createManualSignal();
      
      // Set multiple times
      signal.set();
      signal.set();
      signal.set();
      
      // Wait should still return immediately
      const startTime = Date.now();
      await signal.wait();
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(5);
    });

    it('should handle multiple reset calls', async () => {
      const signal = createManualSignal();
      
      // Set then reset multiple times
      signal.set();
      signal.reset();
      signal.reset();
      signal.reset();
      
      let resolved = false;
      
      // Should still wait after multiple resets
      const waitPromise = signal.wait().then(() => {
        resolved = true;
      });
      
      await delay(10);
      expect(resolved).toBe(false);
      
      signal.set();
      await waitPromise;
      expect(resolved).toBe(true);
    });

    it('should handle concurrent set and wait operations', async () => {
      const signal = createManualSignal();
      const results: string[] = [];
      
      // Start multiple concurrent operations
      const operations = [
        // Waiters
        ...Array.from({ length: 10 }, (_, i) =>
          signal.wait().then(() => results.push(`waiter-${i}`))
        ),
        // Setters (only first should take effect)
        ...Array.from({ length: 5 }, (_, i) =>
          delay(Math.random() * 10).then(() => {
            signal.set();
            results.push(`setter-${i}`);
          })
        )
      ];
      
      await Promise.all(operations);
      
      // All waiters should have resolved
      const waiterResults = results.filter(r => r.startsWith('waiter-'));
      expect(waiterResults).toHaveLength(10);
      
      // At least one setter should have executed
      const setterResults = results.filter(r => r.startsWith('setter-'));
      expect(setterResults.length).toBeGreaterThan(0);
    });

    it('should handle abort during concurrent waits', async () => {
      const signal = createManualSignal();
      const abortController = new AbortController();
      const results: string[] = [];
      
      // Create multiple waiters, some with abort signal, some without
      const waiters = [
        // Regular waiters
        ...Array.from({ length: 3 }, (_, i) =>
          signal.wait().then(() => results.push(`regular-${i}`))
        ),
        // Abortable waiters
        ...Array.from({ length: 3 }, (_, i) =>
          signal.wait(abortController.signal)
            .then(() => results.push(`abortable-${i}`))
            .catch(() => results.push(`aborted-${i}`))
        )
      ];
      
      // Abort some waiters
      setTimeout(() => abortController.abort(), 10);
      
      // Set the signal after abort
      setTimeout(() => signal.set(), 20);
      
      await Promise.all(waiters);
      
      // Regular waiters should resolve
      const regularResults = results.filter(r => r.startsWith('regular-'));
      expect(regularResults).toHaveLength(3);
      
      // Abortable waiters should be aborted
      const abortedResults = results.filter(r => r.startsWith('aborted-'));
      expect(abortedResults).toHaveLength(3);
      
      // No abortable waiters should have resolved
      const abortableResults = results.filter(r => r.startsWith('abortable-'));
      expect(abortableResults).toHaveLength(0);
    });
  });

  describe('Complex scenarios', () => {
    it('should handle rapid set/reset cycles', async () => {
      const signal = createManualSignal();
      const results: number[] = [];
      
      // Perform rapid set/reset cycles
      for (let i = 0; i < 10; i++) {
        signal.set();
        await signal.wait();
        results.push(i);
        signal.reset();
      }
      
      expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it('should handle interleaved operations', async () => {
      const signal = createManualSignal();
      const timeline: string[] = [];
      
      // Start a waiter
      const waiter1 = signal.wait().then(() => timeline.push('waiter1-resolved'));
      
      // Add some delay
      await delay(5);
      timeline.push('delay-1');
      
      // Add another waiter
      const waiter2 = signal.wait().then(() => timeline.push('waiter2-resolved'));
      
      // Add more delay
      await delay(5);
      timeline.push('delay-2');
      
      // Set the signal
      signal.set();
      timeline.push('signal-set');
      
      // Wait for all
      await Promise.all([waiter1, waiter2]);
      
      expect(timeline).toEqual([
        'delay-1',
        'delay-2', 
        'signal-set',
        'waiter1-resolved',
        'waiter2-resolved'
      ]);
    });

    it('should maintain state consistency under stress', async () => {
      const signal = createManualSignal();
      const resolvedCount = { value: 0 };
      const abortedCount = { value: 0 };
      
      // Create many concurrent operations
      const operations: Promise<void>[] = [];
      
      for (let i = 0; i < 50; i++) {
        // Some operations will be aborted
        if (i % 5 === 0) {
          const abortController = new AbortController();
          operations.push(
            signal.wait(abortController.signal)
              .then(() => resolvedCount.value++)
              .catch(() => abortedCount.value++)
          );
          setTimeout(() => abortController.abort(), Math.random() * 20);
        } else {
          operations.push(
            signal.wait().then(() => resolvedCount.value++)
          );
        }
      }
      
      // Set the signal after some time
      setTimeout(() => signal.set(), 30);
      
      await Promise.all(operations);
      
      // Most operations should resolve, some should abort
      expect(resolvedCount.value + abortedCount.value).toBe(50);
      expect(resolvedCount.value).toBeGreaterThan(30);
      expect(abortedCount.value).toBeGreaterThan(0);
    });
  });
});