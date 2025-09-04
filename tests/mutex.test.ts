/**
 * Basic tests for Mutex functionality
 * These tests verify the core behavior of the promise-based mutex
 */

import { describe, it, expect } from 'vitest';
import { createMutex, createAsyncLock } from '../src/index.js';
import { delay } from '../src/primitives/delay.js';

describe('Mutex', () => {
  describe('Basic functionality', () => {
    it('should acquire and release lock automatically', async () => {
      const locker = createMutex();

      // Initially should not be locked
      expect(locker.isLocked).toBe(false);

      const handle = await locker.lock();
      try {
        // Should be locked now
        expect(locker.isLocked).toBe(true);
        expect(handle.isActive).toBe(true);
      } finally {
        handle.release();
      }

      // Should be unlocked after using block
      expect(locker.isLocked).toBe(false);
    });

    it('should provide pending count information', async () => {
      const locker = createMutex();

      expect(locker.pendingCount).toBe(0);

      // Start two tasks that will compete for the lock
      const task1Promise = (async () => {
        const handle = await locker.lock();
        try {
          await delay(50);
        } finally {
          handle.release();
        }
      })();

      // Wait a bit for task1 to acquire the lock
      await delay(10);

      const task2Promise = (async () => {
        const handle = await locker.lock();
        handle.release();
      })();

      // Wait a bit for task2 to queue up
      await delay(10);

      expect(locker.pendingCount).toBe(1); // task2 should be pending

      await Promise.all([task1Promise, task2Promise]);
      expect(locker.pendingCount).toBe(0);
    });
  });

  describe('Sequential access', () => {
    it('should enforce sequential access to critical sections', async () => {
      const locker = createMutex();
      const results: string[] = [];

      const task = async (id: string) => {
        results.push(`${id}: requesting`);
        const handle = await locker.lock();
        try {
          results.push(`${id}: acquired`);
          await delay(10);
          results.push(`${id}: working`);
        } finally {
          handle.release();
        }
        results.push(`${id}: released`);
      };

      await Promise.all([task('A'), task('B')]);

      // Should execute sequentially
      const expected = [
        'A: requesting',
        'B: requesting',
        'A: acquired',
        'A: working',
        'A: released',
        'B: acquired',
        'B: working',
        'B: released',
      ];

      expect(results).toEqual(expected);
    });
  });

  describe('AbortSignal support', () => {
    it('should handle AbortSignal cancellation', async () => {
      const locker = createMutex();
      const controller = new AbortController();

      // Hold the lock
      let lockReleased = false;
      const holdLock = async () => {
        const handle = await locker.lock();
        try {
          await delay(100);
        } finally {
          handle.release();
        }
        lockReleased = true;
      };

      const holdTask = holdLock();

      // Try to acquire with abort signal
      let caughtError: Error | null = null;
      const cancellableTask = async () => {
        try {
          const handle = await locker.lock(controller.signal);
          handle.release();
        } catch (error) {
          caughtError = error as Error;
        }
      };

      const cancelTask = cancellableTask();

      // Abort after a short delay
      setTimeout(() => controller.abort(), 20);

      await Promise.all([holdTask, cancelTask]);

      expect(lockReleased).toBe(true);
      expect(caughtError).toBeTruthy();
      expect((caughtError as unknown as Error).message).toContain('aborted');
    });

    it('should reject immediately if signal is already aborted', async () => {
      const locker = createMutex();
      const controller = new AbortController();
      controller.abort(); // Abort before calling lock

      let caughtError: Error | null = null;
      try {
        const handle = await locker.lock(controller.signal);
        handle.release();
      } catch (error) {
        caughtError = error as Error;
      }

      expect(caughtError).toBeTruthy();
      expect((caughtError as unknown as Error).message).toContain('aborted');
    });
  });

  describe('Error handling', () => {
    it('should release lock automatically even when errors occur', async () => {
      const locker = createMutex();

      let caughtError: Error | null = null;
      try {
        const handle = await locker.lock();
        try {
          expect(locker.isLocked).toBe(true);

          // Throw an error to test cleanup
          throw new Error('Test error');
        } finally {
          handle.release();
        }
      } catch (error) {
        caughtError = error as Error;
      }

      expect(caughtError?.message).toBe('Test error');

      // Lock should be released even after error
      expect(locker.isLocked).toBe(false);

      // Should be able to acquire lock again
      const handle = await locker.lock();
      try {
        expect(locker.isLocked).toBe(true);
      } finally {
        handle.release();
      }
      expect(locker.isLocked).toBe(false);
    });
  });

  describe('Multiple locks', () => {
    it('should handle multiple independent locks correctly', async () => {
      const locker1 = createAsyncLock();
      const locker2 = createAsyncLock();

      const results: string[] = [];

      const task = async (
        lockName: string,
        asyncLock: ReturnType<typeof createAsyncLock>
      ) => {
        results.push(`${lockName}: requesting`);
        const handle = await asyncLock.lock();
        try {
          results.push(`${lockName}: acquired`);
          await delay(20);
          results.push(`${lockName}: working`);
        } finally {
          handle.release();
        }
        results.push(`${lockName}: released`);
      };

      // Both locks should be able to work concurrently
      await Promise.all([task('Lock1', locker1), task('Lock2', locker2)]);

      // Both should have completed
      expect(results).toContain('Lock1: released');
      expect(results).toContain('Lock2: released');
      expect(results.filter((r) => r.includes('acquired')).length).toBe(2);
    });

    it('should handle nested lock acquisition with proper cleanup order', async () => {
      const locker1 = createAsyncLock();
      const locker2 = createAsyncLock();

      const results: string[] = [];

      const handle1 = await locker1.lock();
      try {
        results.push('Lock1 acquired');

        const handle2 = await locker2.lock();
        try {
          results.push('Lock2 acquired');

          // Both locks are held here
          expect(locker1.isLocked).toBe(true);
          expect(locker2.isLocked).toBe(true);
        } finally {
          // Lock 2 is released first (reverse order)
          handle2.release();
        }
        results.push('Lock2 released');
        expect(locker2.isLocked).toBe(false);
        expect(locker1.isLocked).toBe(true);
      } finally {
        // Lock 1 is released second
        handle1.release();
      }
      results.push('Lock1 released');

      expect(results).toEqual([
        'Lock1 acquired',
        'Lock2 acquired',
        'Lock2 released',
        'Lock1 released',
      ]);

      expect(locker1.isLocked).toBe(false);
      expect(locker2.isLocked).toBe(false);
    });
  });

  describe('Lock handle', () => {
    it('should track handle active state correctly', async () => {
      const locker = createMutex();

      let handle: any;
      const lockHandle = await locker.lock();
      try {
        handle = lockHandle;

        expect(handle.isActive).toBe(true);
      } finally {
        handle.release();
      }

      // Handle should be inactive after disposal
      expect(handle.isActive).toBe(false);
    });
  });

  describe('Race condition edge cases', () => {
    it('should handle rapid lock/release cycles without deadlock', async () => {
      const locker = createMutex();
      const iterations = 100;
      const results: number[] = [];

      // Simulate rapid lock acquisitions and releases
      const tasks = Array.from({ length: iterations }, async (_, i) => {
        const handle = await locker.lock();
        try {
          results.push(i);
          // Minimal delay to allow potential race conditions
          await delay(1);
        } finally {
          handle.release();
        }
      });

      await Promise.all(tasks);

      expect(results).toHaveLength(iterations);
      expect(locker.isLocked).toBe(false);
      expect(locker.pendingCount).toBe(0);
    });

    it('should handle AbortSignal race condition with simultaneous abort and resolve', async () => {
      const locker = createMutex();
      const controller = new AbortController();

      // Hold the lock to force queuing
      const firstHandle = await locker.lock();

      let caughtError: Error | null = null;
      const secondLockPromise = (async () => {
        try {
          const handle = await locker.lock(controller.signal);
          handle.release();
        } catch (error) {
          caughtError = error as Error;
        }
      })();

      // Race condition: abort the signal at the same time as releasing the first lock
      await delay(10);
      setTimeout(() => controller.abort(), 0);
      setTimeout(() => firstHandle.release(), 0);

      await secondLockPromise;

      // Wait a bit more to ensure the lock is fully released
      await delay(10);

      // The operation should either succeed or be aborted, but not hang
      if (caughtError) {
        expect((caughtError as Error).message).toContain('aborted');
      }
      expect(locker.isLocked).toBe(false);
    });

    it('should handle multiple simultaneous AbortSignal cancellations', async () => {
      const locker = createMutex();
      const controllers = Array.from(
        { length: 10 },
        () => new AbortController()
      );

      // Hold the lock to force queuing
      const firstHandle = await locker.lock();

      const errors: Error[] = [];
      const lockPromises = controllers.map(async (controller) => {
        try {
          const handle = await locker.lock(controller.signal);
          handle.release();
        } catch (error) {
          errors.push(error as Error);
        }
      });

      // Abort all signals simultaneously
      await delay(10);
      controllers.forEach((controller) => controller.abort());

      // Release the first lock
      firstHandle.release();

      await Promise.all(lockPromises);

      // All operations should have been aborted
      expect(errors).toHaveLength(10);
      errors.forEach((error) => {
        expect(error.message).toContain('aborted');
      });
      expect(locker.isLocked).toBe(false);
      expect(locker.pendingCount).toBe(0);
    });

    it('should handle handle.release() called multiple times concurrently', async () => {
      const locker = createMutex();
      const handle = await locker.lock();

      // Call release multiple times concurrently
      const releasePromises = Array.from({ length: 5 }, () =>
        Promise.resolve().then(() => handle.release())
      );

      await Promise.all(releasePromises);

      expect(handle.isActive).toBe(false);
      expect(locker.isLocked).toBe(false);

      // Should be able to acquire lock again
      const newHandle = await locker.lock();
      expect(locker.isLocked).toBe(true);
      newHandle.release();
    });

    it('should handle concurrent AbortSignal abort and handle release', async () => {
      const locker = createMutex();
      const controller = new AbortController();

      // Hold the lock
      const firstHandle = await locker.lock();

      let caughtError: Error | null = null;
      const secondLockPromise = (async () => {
        try {
          const handle = await locker.lock(controller.signal);
          handle.release();
        } catch (error) {
          caughtError = error as Error;
        }
      })();

      await delay(10);

      // Race condition: abort and release at exactly the same time
      const abortPromise = new Promise((resolve) => {
        setTimeout(() => {
          controller.abort();
          resolve(undefined);
        }, 0);
      });

      const releasePromise = new Promise((resolve) => {
        setTimeout(() => {
          firstHandle.release();
          resolve(undefined);
        }, 0);
      });

      await Promise.all([abortPromise, releasePromise, secondLockPromise]);

      // Should either succeed or be aborted, no hanging
      if (caughtError) {
        expect((caughtError as Error).message).toContain('aborted');
      }
      expect(locker.isLocked).toBe(false);
    });

    it('should handle maxConsecutiveCalls threshold correctly under heavy load', async () => {
      const locker = createAsyncLock(5); // Low threshold for testing
      const results: number[] = [];
      const iterations = 50;

      const tasks = Array.from({ length: iterations }, async (_, i) => {
        const handle = await locker.lock();
        try {
          results.push(i);
        } finally {
          handle.release();
        }
      });

      await Promise.all(tasks);

      expect(results).toHaveLength(iterations);
      expect(locker.isLocked).toBe(false);
      expect(locker.pendingCount).toBe(0);
    });

    it('should maintain queue integrity when items are removed during processing', async () => {
      const locker = createMutex();
      const controller1 = new AbortController();
      const controller2 = new AbortController();

      // Hold the lock
      const firstHandle = await locker.lock();

      const errors: Error[] = [];

      // Queue multiple items
      const promise1 = (async () => {
        try {
          const handle = await locker.lock(controller1.signal);
          handle.release();
        } catch (error) {
          errors.push(error as Error);
        }
      })();

      const promise2 = (async () => {
        try {
          const handle = await locker.lock(controller2.signal);
          handle.release();
        } catch (error) {
          errors.push(error as Error);
        }
      })();

      const promise3 = (async () => {
        try {
          const handle = await locker.lock(); // No abort signal
          handle.release();
        } catch (error) {
          errors.push(error as Error);
        }
      })();

      await delay(10);
      expect(locker.pendingCount).toBe(3);

      // Abort the first two items
      controller1.abort();
      controller2.abort();

      // Release the lock
      firstHandle.release();

      await Promise.all([promise1, promise2, promise3]);

      expect(errors).toHaveLength(2);
      expect(locker.isLocked).toBe(false);
      expect(locker.pendingCount).toBe(0);
    });
  });

  describe('Backward compatibility', () => {
    it('should support deprecated createAsyncLock function', async () => {
      // Should be able to use deprecated name without errors
      const locker = createAsyncLock();

      expect(locker.isLocked).toBe(false);

      const handle = await locker.lock();
      expect(locker.isLocked).toBe(true);
      handle.release();

      expect(locker.isLocked).toBe(false);
    });
  });
});
