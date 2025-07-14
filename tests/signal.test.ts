/**
 * Tests for ManualSignal functionality
 * These tests verify the core behavior of manual signal operations
 */

import { describe, it, expect } from 'vitest';
import { createManualSignal, createSignal } from '../src/primitives/signal.js';
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

      // Raise the signal
      signal.raise();

      // Should resolve now
      await waitPromise;
      expect(resolved).toBe(true);
    });

    it('should return immediately when signal is already raised', async () => {
      const signal = createManualSignal();
      
      // Raise the signal first
      signal.raise();

      // Wait should return immediately
      const startTime = Date.now();
      await signal.wait();
      const endTime = Date.now();

      // Should complete very quickly (less than 5ms)
      expect(endTime - startTime).toBeLessThan(5);
    });

    it('should return immediately when signal is already triggered', async () => {
      const signal = createManualSignal();
      let resolved = false;

      // Start waiting
      const waitPromise = signal.wait().then(() => {
        resolved = true;
      });

      // Should not be resolved immediately
      await delay(10);
      expect(resolved).toBe(false);

      // Trigger the signal
      signal.trigger();

      // Should resolve now
      await waitPromise;
      expect(resolved).toBe(true);
    });

    it('should only one waiter be resolved when signal is triggered', async () => {
      const signal = createManualSignal();
      let resolved1 = false;
      let resolved2 = false;

      // Start waiting
      const waitPromise1 = signal.wait().then(() => {
        resolved1 = true;
      });
      const waitPromise2 = signal.wait().then(() => {
        resolved2 = true;
      });

      // Should not be resolved immediately
      await delay(10);
      expect(resolved1).toBe(false);
      expect(resolved2).toBe(false);

      // Trigger the signal
      signal.trigger();

      // Should resolve now
      await waitPromise1;
      await Promise.race([waitPromise2, delay(10)]);
      expect(resolved1).toBe(true);
      expect(resolved2).toBe(false);
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

    it('should allow multiple waiters to be resolved by single raise', async () => {
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

      // Raise the signal once
      signal.raise();

      // All waiters should resolve
      await Promise.all(waiters);
      expect(results).toHaveLength(5);
      expect(results.sort()).toEqual([0, 1, 2, 3, 4]);
    });

    it('should drop signal and wait again after raise', async () => {
      const signal = createManualSignal();
      
      // Raise the signal
      signal.raise();
      
      // Wait should return immediately
      await signal.wait();
      
      // Reset the signal
      signal.drop();
      
      let resolved = false;
      
      // Start waiting again
      const waitPromise = signal.wait().then(() => {
        resolved = true;
      });
      
      // Should not be resolved immediately after reset
      await delay(10);
      expect(resolved).toBe(false);
      
      // Raise again
      signal.raise();
      
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

    it('should handle multiple raise calls idempotently', async () => {
      const signal = createManualSignal();
      
      // Raise multiple times
      signal.raise();
      signal.raise();
      signal.raise();
      
      // Wait should still return immediately
      const startTime = Date.now();
      await signal.wait();
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(5);
    });

    it('should handle multiple drop calls', async () => {
      const signal = createManualSignal();
      
      // Raise then drop multiple times
      signal.raise();
      signal.drop();
      signal.drop();
      signal.drop();
  
      let resolved = false;
      
      // Should still wait after multiple resets
      const waitPromise = signal.wait().then(() => {
        resolved = true;
      });
      
      await delay(10);
      expect(resolved).toBe(false);
      
      signal.raise();
      await waitPromise;
      expect(resolved).toBe(true);
    });

    it('should handle concurrent raise and wait operations', async () => {
      const signal = createManualSignal();
      const results: string[] = [];
      
      // Start multiple concurrent operations
      const operations = [
        // Waiters
        ...Array.from({ length: 10 }, (_, i) =>
          signal.wait().then(() => results.push(`waiter-${i}`))
        ),
        // Raisers (only first should take effect)
        ...Array.from({ length: 5 }, (_, i) =>
          delay(Math.random() * 10).then(() => {
            signal.raise();
            results.push(`raiser-${i}`);
          })
        )
      ];
      
      await Promise.all(operations);
      
      // All waiters should have resolved
      const waiterResults = results.filter(r => r.startsWith('waiter-'));
      expect(waiterResults).toHaveLength(10);
      
      // At least one raiser should have executed
      const raiserResults = results.filter(r => r.startsWith('raiser-'));
      expect(raiserResults.length).toBeGreaterThan(0);
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
      
      // Raise the signal after abort
      setTimeout(() => signal.raise(), 20);
      
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
    it('should handle rapid raise/drop cycles', async () => {
      const signal = createManualSignal();
      const results: number[] = [];
      
      // Perform rapid raise/drop cycles
      for (let i = 0; i < 10; i++) {
        signal.raise();
        await signal.wait();
        results.push(i);
        signal.drop();
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
      
      // Raise the signal
      signal.raise();
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
      const operations: Promise<number>[] = [];
      
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
      
      // Raise the signal after some time
      setTimeout(() => signal.raise(), 30);
      
      await Promise.all(operations);
      
      // Most operations should resolve, some should abort
      expect(resolvedCount.value + abortedCount.value).toBe(50);
      expect(resolvedCount.value).toBeGreaterThan(30);
      expect(abortedCount.value).toBeGreaterThan(0);
    });
  });
});

describe('createSignal', () => {
  describe('Basic wait/trigger functionality', () => {
    it('should wait for signal and resolve when triggered', async () => {
      const signal = createSignal();
      let resolved = false;

      // Start waiting
      const waitPromise = signal.wait().then(() => {
        resolved = true;
      });

      // Should not be resolved immediately
      await delay(10);
      expect(resolved).toBe(false);

      // Trigger the signal
      signal.trigger();

      // Should resolve now
      await waitPromise;
      expect(resolved).toBe(true);
    });

    it('should only one waiter be resolved when signal is triggered', async () => {
      const signal = createSignal();
      let resolved1 = false;
      let resolved2 = false;

      // Start waiting
      const waitPromise1 = signal.wait().then(() => {
        resolved1 = true;
      });
      const waitPromise2 = signal.wait().then(() => {
        resolved2 = true;
      });

      // Should not be resolved immediately
      await delay(10);
      expect(resolved1).toBe(false);
      expect(resolved2).toBe(false);

      // Trigger the signal
      signal.trigger();

      // Should resolve now
      await waitPromise1;
      await Promise.race([waitPromise2, delay(10)]);
      expect(resolved1).toBe(true);
      expect(resolved2).toBe(false);
    });

    it('should abort wait when AbortSignal is triggered', async () => {
      const signal = createSignal();
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
  });

  describe('Edge cases and error handling', () => {
    it('should handle already aborted signal', async () => {
      const signal = createSignal();
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

    it('should handle multiple trigger calls with different waiters', async () => {
      const signal = createSignal();
      let resolved1 = false;
      let resolved2 = false;
      
      // First waiter
      const waitPromise1 = signal.wait().then(() => {
        resolved1 = true;
      });
      
      // Trigger for first waiter
      signal.trigger();
      await waitPromise1;
      expect(resolved1).toBe(true);
      
      // Second waiter after first is resolved
      const waitPromise2 = signal.wait().then(() => {
        resolved2 = true;
      });
      
      await delay(10);
      expect(resolved2).toBe(false);
      
      // Trigger for second waiter
      signal.trigger();
      await waitPromise2;
      expect(resolved2).toBe(true);
    });

    it('should handle concurrent trigger and wait operations', async () => {
      const signal = createSignal();
      const results: string[] = [];
      
      // Start multiple concurrent operations
      const operations = [
        // Waiters
        ...Array.from({ length: 10 }, (_, i) =>
          signal.wait().then(() => results.push(`waiter-${i}`))
        ),
        // Triggers (each will resolve one waiter)
        ...Array.from({ length: 10 }, (_, i) =>
          delay(Math.random() * 20).then(() => {
            signal.trigger();
            results.push(`trigger-${i}`);
          })
        )
      ];
      
      await Promise.all(operations);
      
      // All waiters should have resolved
      const waiterResults = results.filter(r => r.startsWith('waiter-'));
      expect(waiterResults).toHaveLength(10);
      
      // All triggers should have executed
      const triggerResults = results.filter(r => r.startsWith('trigger-'));
      expect(triggerResults).toHaveLength(10);
    });

    it('should handle abort during concurrent waits', async () => {
      const signal = createSignal();
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
      
      // Trigger signals for remaining waiters
      setTimeout(() => {
        for (let i = 0; i < 3; i++) {
          signal.trigger();
        }
      }, 20);
      
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
    it('should handle sequential trigger/wait cycles', async () => {
      const signal = createSignal();
      const results: number[] = [];
      
      // Perform sequential trigger/wait cycles
      for (let i = 0; i < 10; i++) {
        const waitPromise = signal.wait().then(() => {
          results.push(i);
        });
        signal.trigger();
        await waitPromise;
      }
      
      expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it('should handle interleaved operations', async () => {
      const signal = createSignal();
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
      
      // Trigger the signal (only first waiter should resolve)
      signal.trigger();
      timeline.push('signal-triggered');
      
      // Wait for first waiter
      await waiter1;
      
      // Trigger again for second waiter
      signal.trigger();
      await waiter2;
      
      expect(timeline).toEqual([
        'delay-1',
        'delay-2', 
        'signal-triggered',
        'waiter1-resolved',
        'waiter2-resolved'
      ]);
    });

    it('should maintain state consistency under stress', async () => {
      const signal = createSignal();
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
      
      // Trigger signals for non-aborted waiters
      setTimeout(() => {
        for (let i = 0; i < 50; i++) {
          signal.trigger();
        }
      }, 30);
      
      await Promise.all(operations);
      
      // Most operations should resolve, some should abort
      expect(resolvedCount.value + abortedCount.value).toBe(50);
      expect(resolvedCount.value).toBeGreaterThan(30);
      expect(abortedCount.value).toBeGreaterThan(0);
    });
  });
});
