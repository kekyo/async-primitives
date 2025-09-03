/**
 * Integration tests for race conditions between different async primitives
 * These tests verify the behavior when multiple primitives interact under concurrent conditions
 */

import { describe, it, expect, vi } from 'vitest';
import { createMutex } from '../src/index.js';
import { createDeferred } from '../src/primitives/deferred.js';
import { onAbort } from '../src/primitives/abort-hook.js';
import { delay } from '../src/primitives/delay.js';

describe('Integration Race Conditions', () => {
  describe('Mutex + Deferred interactions', () => {
    it('should handle lock acquisition with deferred resolution under heavy concurrency', async () => {
      const locker = createMutex();
      const deferred = createDeferred<string>();
      const results: string[] = [];

      // Task that acquires lock and waits for deferred
      const lockAndWaitTask = async (id: string) => {
        const handle = await locker.lock();
        try {
          const result = await deferred.promise;
          results.push(`${id}: ${result}`);
        } finally {
          handle.release();
        }
      };

      // Start multiple concurrent tasks
      const tasks = Array.from({ length: 10 }, (_, i) =>
        lockAndWaitTask(`task-${i}`)
      );

      // Resolve deferred after tasks are queued
      setTimeout(() => deferred.resolve('shared-result'), 20);

      await Promise.all(tasks);

      expect(results).toHaveLength(10);
      results.forEach((result) => {
        expect(result).toMatch(/^task-\d+: shared-result$/);
      });
    });

    it('should handle deferred resolution controlling lock acquisition', async () => {
      const locker = createMutex();
      const deferred = createDeferred<boolean>();
      const results: string[] = [];

      const conditionalLockTask = async (id: string) => {
        const shouldProceed = await deferred.promise;
        if (shouldProceed) {
          const handle = await locker.lock();
          try {
            results.push(`${id}: acquired lock`);
            await delay(5);
          } finally {
            handle.release();
          }
        } else {
          results.push(`${id}: skipped lock`);
        }
      };

      // Start tasks that depend on deferred resolution
      const tasks = Array.from({ length: 5 }, (_, i) =>
        conditionalLockTask(`task-${i}`)
      );

      // Resolve to proceed after delay
      setTimeout(() => deferred.resolve(true), 10);

      await Promise.all(tasks);

      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result).toMatch(/^task-\d+: acquired lock$/);
      });
    });
  });

  describe('AsyncLock + AbortSignal + Deferred interactions', () => {
    it('should handle complex abort scenarios with lock and deferred', async () => {
      const locker = createMutex();
      const deferred = createDeferred<string>();
      const controller = new AbortController();
      const results: string[] = [];
      const errors: Error[] = [];

      const complexTask = async (id: string) => {
        try {
          // Register abort handler
          const abortHandle = onAbort(controller.signal, () => {
            results.push(`${id}: aborted`);
          });

          // Acquire lock with abort signal
          const lockHandle = await locker.lock(controller.signal);
          try {
            // Wait for deferred with potential abort
            const result = await deferred.promise;
            results.push(`${id}: completed with ${result}`);
          } finally {
            lockHandle.release();
            abortHandle.release();
          }
        } catch (error) {
          errors.push(error as Error);
          results.push(`${id}: failed`);
        }
      };

      // Start tasks
      const tasks = Array.from({ length: 5 }, (_, i) =>
        complexTask(`task-${i}`)
      );

      // Create a race condition: resolve deferred and abort simultaneously
      setTimeout(() => {
        deferred.resolve('success');
        controller.abort();
      }, 30);

      await Promise.all(tasks);

      // Either all tasks succeed or all are aborted, but no hanging
      expect(results.length + errors.length).toBeGreaterThanOrEqual(5);
    });

    it('should handle cascading abort signals across multiple primitives', async () => {
      const locker = createMutex();
      const controller1 = new AbortController();
      const controller2 = new AbortController();
      const deferred = createDeferred<void>();

      let abortCount = 0;
      const results: string[] = [];

      // Set up cascading abort
      const handle1 = onAbort(controller1.signal, () => {
        abortCount++;
        results.push('controller1 aborted');
        controller2.abort(); // Cascade the abort
      });

      const handle2 = onAbort(controller2.signal, () => {
        abortCount++;
        results.push('controller2 aborted');
        deferred.resolve(); // Complete the deferred
      });

      // Task that uses controller2
      const taskPromise = (async () => {
        try {
          const lockHandle = await locker.lock(controller2.signal);
          try {
            await deferred.promise;
            results.push('task completed');
          } finally {
            lockHandle.release();
          }
        } catch (error) {
          results.push('task aborted');
        }
      })();

      // Trigger the cascade
      controller1.abort();

      await taskPromise;

      expect(abortCount).toBe(2);
      expect(results).toContain('controller1 aborted');
      expect(results).toContain('controller2 aborted');
    });
  });

  describe('All primitives interaction under stress', () => {
    it('should handle complex scenario with all primitives under concurrent load', async () => {
      const locker = createMutex(3); // Low maxConsecutiveCalls for testing
      const controllers = Array.from(
        { length: 10 },
        () => new AbortController()
      );
      const deferreds = Array.from({ length: 3 }, () =>
        createDeferred<number>()
      );
      const results: string[] = [];
      const errors: Error[] = [];

      const complexTask = async (id: number) => {
        const controller = controllers[id];
        const deferredIndex = id % 3;
        const deferred = deferreds[deferredIndex];

        try {
          // Set up abort handling
          const abortHandle = onAbort(controller.signal, () => {
            results.push(`task-${id}: received abort signal`);
          });

          // Acquire lock with abort support
          const lockHandle = await locker.lock(controller.signal);
          try {
            results.push(`task-${id}: acquired lock`);

            // Wait for deferred resolution
            const value = await deferred.promise;
            results.push(`task-${id}: got deferred value ${value}`);

            // Simulate some work
            await delay(2);
            results.push(`task-${id}: completed work`);
          } finally {
            lockHandle.release();
            abortHandle.release();
          }
        } catch (error) {
          errors.push(error as Error);
          results.push(`task-${id}: caught error`);
        }
      };

      // Start all tasks
      const tasks = Array.from({ length: 10 }, (_, i) => complexTask(i));

      // Resolve deferreds at different times
      setTimeout(() => deferreds[0].resolve(100), 10);
      setTimeout(() => deferreds[1].resolve(200), 20);
      setTimeout(() => deferreds[2].resolve(300), 30);

      // Abort some controllers
      setTimeout(() => {
        controllers[1].abort();
        controllers[3].abort();
        controllers[7].abort();
      }, 25);

      await Promise.all(tasks);

      // Verify that the system handled the complexity without deadlocks
      expect(locker.isLocked).toBe(false);
      expect(locker.pendingCount).toBe(0);

      // Some tasks should have completed, some should have been aborted
      const completedTasks = results.filter((r) =>
        r.includes('completed work')
      ).length;
      const abortedTasks = errors.length;

      expect(completedTasks + abortedTasks).toBeLessThanOrEqual(10);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle rapid primitive creation and destruction', async () => {
      const operations: Promise<void>[] = [];
      const results: string[] = [];

      // Rapidly create and use different primitives
      for (let i = 0; i < 50; i++) {
        const operation = (async () => {
          const locker = createMutex();
          const deferred = createDeferred<string>();
          const controller = new AbortController();

          const handle = await locker.lock();
          try {
            const abortHandle = onAbort(controller.signal, () => {
              results.push(`operation-${i}: aborted`);
            });

            deferred.resolve(`result-${i}`);
            const result = await deferred.promise;

            results.push(`operation-${i}: ${result}`);
            abortHandle.release();
          } finally {
            handle.release();
          }
        })();
        operations.push(operation);
      }

      await Promise.all(operations);

      expect(results).toHaveLength(50);
      results.forEach((result, index) => {
        expect(result).toBe(`operation-${index}: result-${index}`);
      });
    });
  });

  describe('Error propagation across primitives', () => {
    it('should handle errors propagating through primitive interactions', async () => {
      const locker = createMutex();
      const deferred = createDeferred<void>();
      const controller = new AbortController();
      const errors: Error[] = [];

      const errorTask = async (id: string) => {
        try {
          const abortHandle = onAbort(controller.signal, () => {
            throw new Error(`Abort callback error in ${id}`);
          });

          const lockHandle = await locker.lock(controller.signal);
          try {
            await deferred.promise;
            throw new Error(`Task error in ${id}`);
          } finally {
            lockHandle.release();
            abortHandle.release();
          }
        } catch (error) {
          errors.push(error as Error);
        }
      };

      const tasks = Array.from({ length: 3 }, (_, i) => errorTask(`task-${i}`));

      // Reject the deferred to trigger errors
      setTimeout(() => deferred.reject(new Error('Deferred error')), 10);

      await Promise.all(tasks);

      expect(errors).toHaveLength(3);
      errors.forEach((error) => {
        expect(error.message).toContain('Deferred error');
      });
    });
  });
});
