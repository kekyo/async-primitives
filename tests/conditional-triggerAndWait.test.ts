/**
 * Tests for triggerAndWait functionality
 * These tests verify the atomic operation behavior of triggerAndWait
 */

import { describe, it, expect } from 'vitest';
import {
  createManuallyConditional,
  createConditional,
  LockHandle,
  createMutex,
  createSemaphore,
  createReaderWriterLock,
} from '../src/index.js';
import { delay } from '../src/primitives/delay.js';

describe('Conditional.triggerAndWait', () => {
  describe('Basic functionality', () => {
    it('should trigger one waiter and wait on another conditional', async () => {
      const cond1 = createConditional();
      const cond2 = createConditional();

      let waiter1Resolved = false;
      let waiter2Resolved = false;

      // Start waiting on cond1
      const wait1Promise = cond1.wait().then(() => {
        waiter1Resolved = true;
      });

      // Start triggerAndWait - should trigger cond1 and wait on cond2
      const triggerAndWaitPromise = cond1
        .triggerAndWait(cond2.waiter)
        .then(() => {
          waiter2Resolved = true;
        });

      // Give time for async operations to process
      await delay(10);

      // cond1 should be triggered
      expect(waiter1Resolved).toBe(true);
      // But triggerAndWait should still be waiting on cond2
      expect(waiter2Resolved).toBe(false);

      // Now trigger cond2
      cond2.trigger();

      // Wait for everything to complete
      await Promise.all([wait1Promise, triggerAndWaitPromise]);

      expect(waiter1Resolved).toBe(true);
      expect(waiter2Resolved).toBe(true);
    });

    it('should work with ManuallyConditional that is already raised', async () => {
      const cond1 = createConditional();
      const cond2 = createManuallyConditional();

      // Raise cond2 before triggerAndWait
      cond2.raise();

      let waiter1Resolved = false;

      // Start waiting on cond1
      const wait1Promise = cond1.wait().then(() => {
        waiter1Resolved = true;
      });

      // triggerAndWait should complete immediately since cond2 is raised
      const handle = await cond1.triggerAndWait(cond2.waiter);

      // Wait for cond1 waiter
      await wait1Promise;

      expect(waiter1Resolved).toBe(true);
      expect(handle).toBeDefined();
      expect(handle.isActive).toBe(false); // Dummy handle
    });

    it('should handle abort signal', async () => {
      const cond1 = createConditional();
      const cond2 = createConditional();
      const controller = new AbortController();

      // Start waiting on cond1
      const wait1Promise = cond1.wait();

      // Start triggerAndWait with abort signal
      const triggerAndWaitPromise = cond1.triggerAndWait(
        cond2.waiter,
        controller.signal
      );

      // Abort after a delay
      await delay(10);
      controller.abort();

      // triggerAndWait should throw
      await expect(triggerAndWaitPromise).rejects.toThrow('aborted');

      // But cond1 waiter should have been resolved
      await expect(wait1Promise).resolves.toBeDefined();
    });

    it('should handle pre-aborted signal', async () => {
      const cond1 = createConditional();
      const cond2 = createConditional();
      const controller = new AbortController();

      // Abort before starting
      controller.abort();

      // Should throw immediately
      await expect(
        cond1.triggerAndWait(cond2.waiter, controller.signal)
      ).rejects.toThrow('aborted');
    });
  });

  describe('Atomicity tests', () => {
    it('should maintain atomicity between trigger and wait', async () => {
      const cond1 = createConditional();
      const cond2 = createConditional();
      const cond3 = createConditional();

      const executionOrder: string[] = [];

      // Set up multiple waiters
      const wait1 = cond1.wait().then(() => {
        executionOrder.push('cond1-waiter');
      });

      const wait2 = cond2.wait().then(() => {
        executionOrder.push('cond2-waiter');
      });

      // Start triggerAndWait
      const triggerAndWait = cond1.triggerAndWait(cond3.waiter).then(() => {
        executionOrder.push('triggerAndWait-complete');
      });

      // Trigger cond2 and cond3 in sequence
      await delay(10);
      cond2.trigger();
      cond3.trigger();

      // Wait for all to complete
      await Promise.all([wait1, wait2, triggerAndWait]);

      // Verify execution order
      expect(executionOrder).toEqual([
        'cond1-waiter', // Triggered by triggerAndWait
        'cond2-waiter', // Triggered separately
        'triggerAndWait-complete', // Completed after cond3 trigger
      ]);
    });

    it('should work correctly with self-reference (potential deadlock)', async () => {
      const cond = createConditional();

      // This will deadlock - trigger removes one waiter but then waits on itself
      // Since we don't detect deadlocks, this will hang
      const triggerAndWaitPromise = cond.triggerAndWait(cond.waiter);

      // Should not resolve within timeout
      const timeoutPromise = delay(100).then(() => 'timeout');
      const result = await Promise.race([
        triggerAndWaitPromise,
        timeoutPromise,
      ]);

      expect(result).toBe('timeout');
    });
  });

  describe('Integration with other Waitables', () => {
    it('should work with objects that support prepareWait', async () => {
      const cond1 = createConditional();
      const cond2 = createConditional();

      // Both support prepareWait, so atomicity should be maintained
      let waiter1Resolved = false;

      const wait1 = cond1.wait().then(() => {
        waiter1Resolved = true;
      });

      const triggerWait = cond1.triggerAndWait(cond2.waiter);

      await delay(10);
      expect(waiter1Resolved).toBe(true);

      cond2.trigger();
      await triggerWait;
    });

    it('should fallback gracefully for objects without prepareWait', async () => {
      const cond = createConditional();

      // Create a simple waitable with prepareWait that returns null (fallback mode)
      const simpleWaitable = {
        waiter: {
          wait: async (signal?: AbortSignal) => {
            await delay(50);
            return {
              isActive: false,
              release: () => {},
              [Symbol.dispose]: () => {},
            } as LockHandle;
          },
          prepareWait: () => null, // Returns null to trigger fallback
        },
      };

      let waiterResolved = false;
      const wait1 = cond.wait().then(() => {
        waiterResolved = true;
      });

      // Should still work but without atomicity guarantee
      const handle = await cond.triggerAndWait(simpleWaitable.waiter);

      expect(waiterResolved).toBe(true);
      expect(handle).toBeDefined();
    });

    it('should work with Mutex waiter', async () => {
      const cond = createConditional();
      const mutex = createMutex();

      // Acquire the mutex to block the waiter
      const lock1 = await mutex.lock();

      let waiterResolved = false;
      const wait1 = cond.wait().then(() => {
        waiterResolved = true;
      });

      // Start triggerAndWait - should trigger cond and wait for mutex
      const triggerWaitPromise = cond.triggerAndWait(mutex.waiter);

      // Give time for trigger to execute
      await delay(10);

      // Conditional should have been triggered
      expect(waiterResolved).toBe(true);

      // triggerAndWait should still be waiting for mutex
      let triggerAndWaitResolved = false;
      triggerWaitPromise.then(() => {
        triggerAndWaitResolved = true;
      });

      await delay(10);
      expect(triggerAndWaitResolved).toBe(false);

      // Release the mutex
      lock1.release();

      // Now triggerAndWait should complete
      const handle = await triggerWaitPromise;
      expect(handle).toBeDefined();
      expect(handle.isActive).toBe(true);

      // Clean up
      handle.release();
    });

    it('should work with Semaphore waiter', async () => {
      const cond = createConditional();
      const semaphore = createSemaphore(2); // 2 resources

      // Acquire all resources to block the waiter
      const handle1 = await semaphore.acquire();
      const handle2 = await semaphore.acquire();

      let waiterResolved = false;
      const wait1 = cond.wait().then(() => {
        waiterResolved = true;
      });

      // Start triggerAndWait - should trigger cond and wait for semaphore
      const triggerWaitPromise = cond.triggerAndWait(semaphore.waiter);

      // Give time for trigger to execute
      await delay(10);

      // Conditional should have been triggered
      expect(waiterResolved).toBe(true);

      // triggerAndWait should still be waiting for semaphore
      let triggerAndWaitResolved = false;
      triggerWaitPromise.then(() => {
        triggerAndWaitResolved = true;
      });

      await delay(10);
      expect(triggerAndWaitResolved).toBe(false);

      // Release one resource
      handle1.release();

      // Now triggerAndWait should complete
      const handle = await triggerWaitPromise;
      expect(handle).toBeDefined();
      expect(handle.isActive).toBe(true);

      // Verify semaphore state
      expect(semaphore.availableCount).toBe(0); // One resource taken by triggerAndWait

      // Clean up
      handle.release();
      handle2.release();
    });

    it('should work with ReaderWriterLock readWaiter', async () => {
      const cond = createConditional();
      const rwLock = createReaderWriterLock();

      // Acquire write lock to block readers
      const writeLock = await rwLock.writeLock();

      let waiterResolved = false;
      const wait1 = cond.wait().then(() => {
        waiterResolved = true;
      });

      // Start triggerAndWait - should trigger cond and wait for read lock
      const triggerWaitPromise = cond.triggerAndWait(rwLock.readWaiter);

      // Give time for trigger to execute
      await delay(10);

      // Conditional should have been triggered
      expect(waiterResolved).toBe(true);

      // triggerAndWait should still be waiting for read lock
      let triggerAndWaitResolved = false;
      triggerWaitPromise.then(() => {
        triggerAndWaitResolved = true;
      });

      await delay(10);
      expect(triggerAndWaitResolved).toBe(false);

      // Release write lock
      writeLock.release();

      // Now triggerAndWait should complete with read lock
      const handle = await triggerWaitPromise;
      expect(handle).toBeDefined();
      expect(handle.isActive).toBe(true);

      // Verify lock state
      expect(rwLock.currentReaders).toBe(1);
      expect(rwLock.hasWriter).toBe(false);

      // Clean up
      handle.release();
    });

    it('should work with ReaderWriterLock writeWaiter', async () => {
      const cond = createConditional();
      const rwLock = createReaderWriterLock();

      // Acquire read locks to block writers
      const readLock1 = await rwLock.readLock();
      const readLock2 = await rwLock.readLock();

      let waiterResolved = false;
      const wait1 = cond.wait().then(() => {
        waiterResolved = true;
      });

      // Start triggerAndWait - should trigger cond and wait for write lock
      const triggerWaitPromise = cond.triggerAndWait(rwLock.writeWaiter);

      // Give time for trigger to execute
      await delay(10);

      // Conditional should have been triggered
      expect(waiterResolved).toBe(true);

      // triggerAndWait should still be waiting for write lock
      let triggerAndWaitResolved = false;
      triggerWaitPromise.then(() => {
        triggerAndWaitResolved = true;
      });

      await delay(10);
      expect(triggerAndWaitResolved).toBe(false);

      // Release all read locks
      readLock1.release();
      readLock2.release();

      // Now triggerAndWait should complete with write lock
      const handle = await triggerWaitPromise;
      expect(handle).toBeDefined();
      expect(handle.isActive).toBe(true);

      // Verify lock state
      expect(rwLock.currentReaders).toBe(0);
      expect(rwLock.hasWriter).toBe(true);

      // Clean up
      handle.release();
    });
  });

  describe('ManuallyConditional specific behavior', () => {
    it('should clear raised flag when triggering', async () => {
      const cond = createManuallyConditional();
      const cond2 = createConditional();

      // Raise the conditional
      cond.raise();

      // triggerAndWait should clear the raised flag
      const triggerWaitPromise = cond.triggerAndWait(cond2.waiter);

      // New waiter should have to wait
      let newWaiterResolved = false;
      const newWait = cond.wait().then(() => {
        newWaiterResolved = true;
      });

      await delay(10);
      expect(newWaiterResolved).toBe(false);

      // Complete the triggerAndWait
      cond2.trigger();
      await triggerWaitPromise;

      // New waiter still waiting
      expect(newWaiterResolved).toBe(false);

      // Need to raise again
      cond.raise();
      await newWait;
      expect(newWaiterResolved).toBe(true);
    });

    it('should handle multiple waiters correctly', async () => {
      const cond1 = createManuallyConditional();
      const cond2 = createConditional();

      const waiters: Promise<void>[] = [];
      const resolved: boolean[] = [false, false, false];

      // Create multiple waiters
      for (let i = 0; i < 3; i++) {
        const index = i;
        waiters.push(
          cond1.wait().then(() => {
            resolved[index] = true;
          })
        );
      }

      // triggerAndWait should only trigger one
      const triggerWaitPromise = cond1.triggerAndWait(cond2.waiter);

      await delay(10);

      // Only one waiter should be resolved
      const resolvedCount = resolved.filter((r) => r).length;
      expect(resolvedCount).toBe(1);

      // Complete triggerAndWait
      cond2.trigger();
      await triggerWaitPromise;

      // Raise to resolve remaining waiters
      cond1.raise();
      await Promise.all(waiters);

      // All should be resolved now
      expect(resolved.every((r) => r)).toBe(true);
    });
  });
});
