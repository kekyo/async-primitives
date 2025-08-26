/**
 * Tests for Semaphore functionality
 * These tests verify the behavior of the semaphore for managing limited concurrent access
 */

import { describe, it, expect } from 'vitest';
import { createSemaphore } from '../src/primitives/semaphore.js';
import { delay } from '../src/primitives/delay.js';

describe('Semaphore', () => {
  describe('Basic functionality', () => {
    it('should allow acquisitions up to the semaphore count', async () => {
      const semaphore = createSemaphore(3);

      // Initially all resources should be available
      expect(semaphore.availableCount).toBe(3);
      expect(semaphore.pendingCount).toBe(0);

      const handle1 = await semaphore.acquire();
      expect(semaphore.availableCount).toBe(2);
      expect(handle1.isActive).toBe(true);

      const handle2 = await semaphore.acquire();
      expect(semaphore.availableCount).toBe(1);
      expect(handle2.isActive).toBe(true);

      const handle3 = await semaphore.acquire();
      expect(semaphore.availableCount).toBe(0);
      expect(handle3.isActive).toBe(true);

      // Release resources
      handle1.release();
      expect(semaphore.availableCount).toBe(1);
      expect(handle1.isActive).toBe(false);

      handle2.release();
      expect(semaphore.availableCount).toBe(2);

      handle3.release();
      expect(semaphore.availableCount).toBe(3);
    });

    it('should throw error for invalid initial count', () => {
      expect(() => createSemaphore(0)).toThrow('Semaphore count must be greater than 0');
      expect(() => createSemaphore(-1)).toThrow('Semaphore count must be greater than 0');
      expect(() => createSemaphore(-100)).toThrow('Semaphore count must be greater than 0');
    });

    it('should handle multiple releases safely (idempotent)', async () => {
      const semaphore = createSemaphore(2);

      const handle = await semaphore.acquire();
      expect(semaphore.availableCount).toBe(1);
      expect(handle.isActive).toBe(true);

      // First release
      handle.release();
      expect(semaphore.availableCount).toBe(2);
      expect(handle.isActive).toBe(false);

      // Multiple subsequent releases should be ignored
      handle.release();
      handle.release();
      handle.release();
      expect(semaphore.availableCount).toBe(2);
      expect(handle.isActive).toBe(false);
    });

    it('should provide pending count information', async () => {
      const semaphore = createSemaphore(1);

      expect(semaphore.pendingCount).toBe(0);

      // Acquire the only available resource
      const handle1 = await semaphore.acquire();
      expect(semaphore.pendingCount).toBe(0);

      // Start multiple tasks that will queue up
      const task2Promise = (async () => {
        const handle = await semaphore.acquire();
        handle.release();
      })();

      await delay(10);
      expect(semaphore.pendingCount).toBe(1);

      const task3Promise = (async () => {
        const handle = await semaphore.acquire();
        handle.release();
      })();

      await delay(10);
      expect(semaphore.pendingCount).toBe(2);

      // Release the first resource
      handle1.release();

      // Wait for all tasks to complete
      await Promise.all([task2Promise, task3Promise]);
      expect(semaphore.pendingCount).toBe(0);
      expect(semaphore.availableCount).toBe(1);
    });
  });

  describe('Concurrent access control', () => {
    it('should block when all resources are acquired', async () => {
      const semaphore = createSemaphore(2);
      const results: string[] = [];

      const task = async (id: string) => {
        results.push(`${id}: requesting`);
        const handle = await semaphore.acquire();
        try {
          results.push(`${id}: acquired`);
          await delay(20);
          results.push(`${id}: working`);
        } finally {
          handle.release();
        }
        results.push(`${id}: released`);
      };

      // Start 3 tasks with only 2 resources available
      await Promise.all([task('A'), task('B'), task('C')]);

      // Should have processed all tasks
      expect(results.filter(r => r.includes('acquired')).length).toBe(3);
      expect(results.filter(r => r.includes('released')).length).toBe(3);

      // Verify final state
      expect(semaphore.availableCount).toBe(2);
      expect(semaphore.pendingCount).toBe(0);
    });

    it('should maintain FIFO order for pending acquisitions', async () => {
      const semaphore = createSemaphore(1);
      const results: string[] = [];

      // Hold the semaphore
      const initialHandle = await semaphore.acquire();

      // Queue up multiple acquisitions
      const task = async (id: string) => {
        const handle = await semaphore.acquire();
        try {
          results.push(id);
        } finally {
          handle.release();
        }
      };

      const promises = [
        task('First'),
        task('Second'),
        task('Third')
      ];

      // Give time for all to queue
      await delay(10);
      expect(semaphore.pendingCount).toBe(3);

      // Release and let them process
      initialHandle.release();
      await Promise.all(promises);

      // Should maintain FIFO order
      expect(results).toEqual(['First', 'Second', 'Third']);
    });
  });

  describe('AbortSignal support', () => {
    it('should handle AbortSignal cancellation while waiting', async () => {
      const semaphore = createSemaphore(1);
      const controller = new AbortController();

      // Hold the semaphore
      const handle1 = await semaphore.acquire();

      // Try to acquire with abort signal
      let caughtError: Error | null = null;
      const acquirePromise = (async () => {
        try {
          const handle = await semaphore.acquire(controller.signal);
          handle.release();
        } catch (error) {
          caughtError = error as Error;
        }
      })();

      // Abort after a short delay
      await delay(10);
      controller.abort();

      await acquirePromise;

      expect(caughtError).toBeTruthy();
      expect((caughtError as Error).message).toContain('aborted');
      expect(semaphore.pendingCount).toBe(0);

      handle1.release();
      expect(semaphore.availableCount).toBe(1);
    });

    it('should reject immediately if signal is already aborted', async () => {
      const semaphore = createSemaphore(2);
      const controller = new AbortController();
      controller.abort(); // Abort before calling acquire

      let caughtError: Error | null = null;
      try {
        const handle = await semaphore.acquire(controller.signal);
        handle.release();
      } catch (error) {
        caughtError = error as Error;
      }

      expect(caughtError).toBeTruthy();
      expect((caughtError as Error).message).toContain('aborted');
      expect(semaphore.availableCount).toBe(2);
    });

    it('should handle multiple simultaneous AbortSignal cancellations', async () => {
      const semaphore = createSemaphore(1);
      const controllers = Array.from({ length: 5 }, () => new AbortController());

      // Hold the semaphore
      const handle1 = await semaphore.acquire();

      const errors: Error[] = [];
      const promises = controllers.map(async (controller) => {
        try {
          const handle = await semaphore.acquire(controller.signal);
          handle.release();
        } catch (error) {
          errors.push(error as Error);
        }
      });

      // Wait for all to queue
      await delay(10);
      expect(semaphore.pendingCount).toBe(5);

      // Abort all signals
      controllers.forEach(controller => controller.abort());

      await Promise.all(promises);

      // All should have been aborted
      expect(errors).toHaveLength(5);
      errors.forEach(error => {
        expect(error.message).toContain('aborted');
      });

      expect(semaphore.pendingCount).toBe(0);
      handle1.release();
    });
  });

  describe('Error handling', () => {
    it('should release resource even when errors occur', async () => {
      const semaphore = createSemaphore(2);

      let caughtError: Error | null = null;
      try {
        const handle = await semaphore.acquire();
        try {
          expect(semaphore.availableCount).toBe(1);
          // Throw an error to test cleanup
          throw new Error('Test error');
        } finally {
          handle.release();
        }
      } catch (error) {
        caughtError = error as Error;
      }

      expect(caughtError?.message).toBe('Test error');
      expect(semaphore.availableCount).toBe(2);

      // Should be able to acquire again
      const handle = await semaphore.acquire();
      expect(semaphore.availableCount).toBe(1);
      handle.release();
      expect(semaphore.availableCount).toBe(2);
    });
  });

  describe('Resource management patterns', () => {
    it('should work with using statement (Symbol.dispose)', async () => {
      const semaphore = createSemaphore(3);

      {
        using handle1 = await semaphore.acquire();
        using handle2 = await semaphore.acquire();
        using handle3 = await semaphore.acquire();

        expect(semaphore.availableCount).toBe(0);
        expect(handle1.isActive).toBe(true);
        expect(handle2.isActive).toBe(true);
        expect(handle3.isActive).toBe(true);
      }

      // All should be released after the using block
      expect(semaphore.availableCount).toBe(3);
    });

    it('should handle nested semaphore acquisitions', async () => {
      const semaphore1 = createSemaphore(2);
      const semaphore2 = createSemaphore(2);

      const handle1 = await semaphore1.acquire();
      try {
        expect(semaphore1.availableCount).toBe(1);

        const handle2 = await semaphore2.acquire();
        try {
          expect(semaphore2.availableCount).toBe(1);

          // Both semaphores are held
          expect(handle1.isActive).toBe(true);
          expect(handle2.isActive).toBe(true);

        } finally {
          handle2.release();
        }
        expect(semaphore2.availableCount).toBe(2);

      } finally {
        handle1.release();
      }
      expect(semaphore1.availableCount).toBe(2);
    });
  });

  describe('Race condition edge cases', () => {
    it('should handle rapid acquire/release cycles', async () => {
      const semaphore = createSemaphore(5);
      const iterations = 100;
      const results: number[] = [];

      const tasks = Array.from({ length: iterations }, async (_, i) => {
        const handle = await semaphore.acquire();
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
      expect(semaphore.availableCount).toBe(5);
      expect(semaphore.pendingCount).toBe(0);
    });

    it('should handle concurrent abort and release race condition', async () => {
      const semaphore = createSemaphore(2);
      const controller = new AbortController();

      // Acquire both resources
      const handle1 = await semaphore.acquire();
      const handle2 = await semaphore.acquire();

      let caughtError: Error | null = null;
      const acquirePromise = (async () => {
        try {
          const handle = await semaphore.acquire(controller.signal);
          handle.release();
        } catch (error) {
          caughtError = error as Error;
        }
      })();

      await delay(10);

      // Race condition: abort and release at the same time
      setTimeout(() => controller.abort(), 0);
      setTimeout(() => handle1.release(), 0);

      await acquirePromise;

      // Should either succeed or be aborted, but not hang
      if (caughtError) {
        expect(caughtError.message).toContain('aborted');
      }

      // Clean up
      handle2.release();
      if (!caughtError) {
        // If acquisition succeeded, one resource was consumed
        expect(semaphore.availableCount).toBeLessThanOrEqual(2);
      } else {
        // If aborted, both resources should be available
        await delay(10);
        expect(semaphore.availableCount).toBe(2);
      }
    });

    it('should handle maxConsecutiveCalls threshold correctly', async () => {
      const semaphore = createSemaphore(3, 5); // Low threshold for testing
      const results: number[] = [];
      const iterations = 30;

      const tasks = Array.from({ length: iterations }, async (_, i) => {
        const handle = await semaphore.acquire();
        try {
          results.push(i);
        } finally {
          handle.release();
        }
      });

      await Promise.all(tasks);

      expect(results).toHaveLength(iterations);
      expect(semaphore.availableCount).toBe(3);
      expect(semaphore.pendingCount).toBe(0);
    });

    it('should maintain queue integrity when items are removed during processing', async () => {
      const semaphore = createSemaphore(1);
      const controller1 = new AbortController();
      const controller2 = new AbortController();

      // Hold the semaphore
      const handle1 = await semaphore.acquire();

      const errors: Error[] = [];
      
      const promise1 = (async () => {
        try {
          const handle = await semaphore.acquire(controller1.signal);
          handle.release();
        } catch (error) {
          errors.push(error as Error);
        }
      })();

      const promise2 = (async () => {
        try {
          const handle = await semaphore.acquire(controller2.signal);
          handle.release();
        } catch (error) {
          errors.push(error as Error);
        }
      })();

      const promise3 = (async () => {
        try {
          const handle = await semaphore.acquire(); // No abort signal
          handle.release();
        } catch (error) {
          errors.push(error as Error);
        }
      })();

      await delay(10);
      expect(semaphore.pendingCount).toBe(3);

      // Abort the first two
      controller1.abort();
      controller2.abort();

      // Release the semaphore
      handle1.release();

      await Promise.all([promise1, promise2, promise3]);

      expect(errors).toHaveLength(2);
      expect(semaphore.availableCount).toBe(1);
      expect(semaphore.pendingCount).toBe(0);
    });
  });
});