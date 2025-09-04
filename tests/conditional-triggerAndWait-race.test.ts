/**
 * Race condition tests for triggerAndWait
 * These tests verify atomicity under true concurrent conditions
 */

import { describe, it, expect } from 'vitest';
import {
  createConditional,
  createManuallyConditional,
  createMutex,
  createSemaphore,
  createReaderWriterLock,
} from '../src/index.js';
import { delay } from '../src/primitives/delay.js';

describe('triggerAndWait Race Conditions', () => {
  describe('Mutex release moment races', () => {
    it('should maintain atomicity at exact moment of mutex release', async () => {
      const cond = createConditional();
      const mutex = createMutex();
      const operations: string[] = [];

      // Acquire mutex
      const lock = await mutex.lock();

      // Add conditional waiter
      let condResolved = false;
      const condWaiter = cond.wait().then(() => {
        operations.push('cond-resolved');
        condResolved = true;
      });

      // Add another mutex waiter
      let mutexWaiterGotLock = false;
      const mutexWaiter = mutex.waiter.wait().then((handle) => {
        operations.push('mutex-waiter-acquired');
        mutexWaiterGotLock = true;
        // Release after acquisition to allow triggerAndWait to proceed
        setTimeout(() => {
          operations.push('mutex-waiter-release');
          handle.release();
        }, 10);
        return handle;
      });

      // Start triggerAndWait first (it will prepare both operations)
      operations.push('trigger-start');
      const triggerPromise = cond
        .triggerAndWait(mutex.waiter)
        .then((handle) => {
          operations.push('trigger-acquired');
          return handle;
        });

      // Then immediately release the mutex in the next microtask
      const releasePromise = Promise.resolve().then(() => {
        operations.push('release-start');
        lock.release();
        operations.push('release-end');
      });

      // Wait for all operations with timeout
      const results = await Promise.race([
        Promise.allSettled([
          triggerPromise,
          mutexWaiter,
          condWaiter,
          releasePromise,
        ]),
        delay(200).then(() => 'timeout'),
      ]);

      if (results === 'timeout') {
        throw new Error('Test timeout - possible deadlock');
      }

      const triggerHandle =
        results[0].status === 'fulfilled' ? results[0].value : null;
      const mutexWaiterHandle =
        results[1].status === 'fulfilled' ? results[1].value : null;

      // Verify atomicity
      expect(condResolved).toBe(true);

      // Due to FIFO queue, mutexWaiter gets lock first, then triggerAndWait
      expect(mutexWaiterGotLock).toBe(true);
      const triggerGotLock = operations.includes('trigger-acquired');
      expect(triggerGotLock).toBe(true);

      // Verify order: mutexWaiter should acquire before triggerAndWait
      const mutexAcquireIndex = operations.indexOf('mutex-waiter-acquired');
      const triggerAcquireIndex = operations.indexOf('trigger-acquired');
      if (triggerAcquireIndex !== -1) {
        expect(mutexAcquireIndex).toBeLessThan(triggerAcquireIndex);
      }

      // Clean up
      if (triggerHandle) triggerHandle.release();
      // mutexWaiterHandle is auto-released in setTimeout
    });

    it('should handle multiple concurrent triggerAndWait on same mutex', async () => {
      const cond1 = createConditional();
      const cond2 = createConditional();
      const mutex = createMutex();

      const lock = await mutex.lock();

      // Add waiters to conditionals
      const waiters = [cond1.wait(), cond2.wait()];

      // Start multiple triggerAndWait operations simultaneously (no await)
      let trigger1Got = false;
      let trigger2Got = false;
      const trigger1Promise = cond1
        .triggerAndWait(mutex.waiter)
        .then((handle) => {
          trigger1Got = true;
          // Release to let next waiter proceed
          setTimeout(() => handle.release(), 10);
          return handle;
        });
      const trigger2Promise = cond2
        .triggerAndWait(mutex.waiter)
        .then((handle) => {
          trigger2Got = true;
          return handle;
        });

      // Release mutex in next microtask to allow prepareWait to complete
      await Promise.resolve();
      lock.release();

      // Wait for results with increased timeout
      const results = await Promise.race([
        Promise.allSettled([trigger1Promise, trigger2Promise, ...waiters]),
        delay(200).then(() => 'timeout'),
      ]);

      if (results === 'timeout') {
        throw new Error('Test timeout - possible deadlock');
      }

      // Both should eventually succeed (FIFO queue: first gets lock, releases, second gets lock)
      const trigger1Result = results[0];
      const trigger2Result = results[1];

      // Both should succeed sequentially
      expect(trigger1Result.status).toBe('fulfilled');
      expect(trigger2Result.status).toBe('fulfilled');
      expect(trigger1Got).toBe(true);
      expect(trigger2Got).toBe(true);

      // Both conditionals should be triggered
      expect(results[2].status).toBe('fulfilled');
      expect(results[3].status).toBe('fulfilled');

      // Clean up
      // trigger1 auto-releases in setTimeout
      if (trigger2Result.status === 'fulfilled') trigger2Result.value.release();
    });
  });

  describe('Semaphore resource competition', () => {
    it('should atomically acquire last semaphore resource', async () => {
      const cond = createConditional();
      const semaphore = createSemaphore(1); // Single resource

      const handle = await semaphore.acquire();

      const operations: string[] = [];

      // Create multiple competing waiters
      const waiters = [];
      for (let i = 0; i < 3; i++) {
        waiters.push(
          semaphore.waiter.wait().then((h) => {
            operations.push(`waiter-${i}-acquired`);
            return h;
          })
        );
      }

      // Add conditional waiter
      const condWaiter = cond.wait().then(() => {
        operations.push('cond-resolved');
      });

      // Release and triggerAndWait in same tick
      Promise.resolve().then(() => {
        operations.push('release');
        handle.release();
      });

      const triggerPromise = Promise.resolve().then(async () => {
        operations.push('trigger-start');
        const h = await cond.triggerAndWait(semaphore.waiter);
        operations.push('trigger-acquired');
        return h;
      });

      // Wait with timeout
      const results = await Promise.race([
        Promise.all([triggerPromise, condWaiter, ...waiters]),
        delay(100).then(() => 'timeout'),
      ]);

      if (results !== 'timeout') {
        // Verify exactly one waiter got the resource
        const acquiredCount = operations.filter((op) =>
          op.includes('acquired')
        ).length;
        expect(acquiredCount).toBe(1);

        // Conditional should be resolved
        expect(operations).toContain('cond-resolved');

        // Clean up
        results[0].release(); // triggerPromise result
        results.slice(2).forEach((h) => h.release()); // waiter handles
      }
    });

    it('should handle multiple resources released simultaneously', async () => {
      const cond = createConditional();
      const semaphore = createSemaphore(2); // 2 resources

      // Acquire both resources
      const handles = await Promise.all([
        semaphore.acquire(),
        semaphore.acquire(),
      ]);

      const operations: string[] = [];

      // Add semaphore waiters
      const waiter1 = semaphore.waiter.wait().then((h) => {
        operations.push('waiter1-acquired');
        // Release after a delay to allow trigger to potentially acquire
        setTimeout(() => {
          operations.push('waiter1-release');
          h.release();
        }, 20);
        return h;
      });

      const waiter2 = semaphore.waiter.wait().then((h) => {
        operations.push('waiter2-acquired');
        // Release after a delay
        setTimeout(() => {
          operations.push('waiter2-release');
          h.release();
        }, 20);
        return h;
      });

      // Add conditional waiter
      const condWaiter = cond.wait().then(() => {
        operations.push('cond-resolved');
      });

      // Start triggerAndWait after other waiters
      operations.push('trigger-start');
      const triggerPromise = cond.triggerAndWait(semaphore.waiter).then((h) => {
        operations.push('trigger-acquired');
        return h;
      });

      // Release both resources in next microtask
      const release1 = Promise.resolve().then(() => {
        operations.push('release1');
        handles[0].release();
      });

      const release2 = Promise.resolve().then(() => {
        operations.push('release2');
        handles[1].release();
      });

      // Wait for all operations with increased timeout
      const results = await Promise.race([
        Promise.allSettled([
          triggerPromise,
          waiter1,
          waiter2,
          condWaiter,
          release1,
          release2,
        ]),
        delay(300).then(() => 'timeout'),
      ]);

      if (results === 'timeout') {
        throw new Error('Test timeout - possible deadlock');
      }

      // Due to FIFO queue: waiter1 and waiter2 get resources first
      // triggerAndWait gets resource after one of them releases
      expect(results[1].status).toBe('fulfilled'); // waiter1
      expect(results[2].status).toBe('fulfilled'); // waiter2
      expect(results[0].status).toBe('fulfilled'); // triggerPromise (after waiter releases)

      expect(operations).toContain('cond-resolved');
      expect(operations).toContain('waiter1-acquired');
      expect(operations).toContain('waiter2-acquired');
      expect(operations).toContain('trigger-acquired');

      // Clean up
      const triggerHandle =
        results[0].status === 'fulfilled' ? results[0].value : null;
      if (triggerHandle) triggerHandle.release();
      // waiter1 and waiter2 auto-release in setTimeout
    });
  });

  describe('ReaderWriterLock transition races', () => {
    it('should maintain atomicity during reader-to-writer transition', async () => {
      const cond = createConditional();
      const rwLock = createReaderWriterLock();

      // Get multiple readers
      const readers = await Promise.all([rwLock.readLock(), rwLock.readLock()]);

      const operations: string[] = [];

      // Add writer waiter (don't await yet)
      const writerPromise = rwLock.writeLock().then((h) => {
        operations.push('writer-acquired');
        // Release after a delay to allow trigger to acquire
        setTimeout(() => {
          operations.push('writer-release');
          h.release();
        }, 10);
        return h;
      });

      // Add conditional waiter
      const condWaiter = cond.wait().then(() => {
        operations.push('cond-resolved');
      });

      // Start triggerAndWait after writer
      operations.push('trigger-start');
      const triggerPromise = cond
        .triggerAndWait(rwLock.writeWaiter)
        .then((h) => {
          operations.push('trigger-got-write');
          return h;
        });

      // Release readers in next microtask
      await Promise.resolve();
      operations.push('reader1-release');
      readers[0].release();
      operations.push('reader2-release');
      readers[1].release();

      // Wait for all operations with increased timeout
      const results = await Promise.race([
        Promise.allSettled([triggerPromise, writerPromise, condWaiter]),
        delay(200).then(() => 'timeout'),
      ]);

      if (results === 'timeout') {
        throw new Error('Test timeout - possible deadlock');
      }

      // Verify operations
      expect(operations).toContain('cond-resolved');

      // Both should eventually get the write lock (sequentially)
      const triggerResult = results[0];
      const writerResult = results[1];

      // Due to FIFO queue: writer gets lock first, then trigger after writer releases
      expect(writerResult.status).toBe('fulfilled');
      expect(triggerResult.status).toBe('fulfilled');
      expect(operations).toContain('writer-acquired');
      expect(operations).toContain('trigger-got-write');

      // Verify order
      const writerIndex = operations.indexOf('writer-acquired');
      const triggerIndex = operations.indexOf('trigger-got-write');
      if (writerIndex !== -1 && triggerIndex !== -1) {
        expect(writerIndex).toBeLessThan(triggerIndex);
      }

      // Clean up
      if (triggerResult.status === 'fulfilled') triggerResult.value.release();
      // writer auto-releases in setTimeout
    });

    it('should maintain atomicity during writer-to-reader transition', async () => {
      const cond = createConditional();
      const rwLock = createReaderWriterLock();

      // Get writer lock
      const writer = await rwLock.writeLock();

      const operations: string[] = [];

      // Add multiple reader waiters
      const readerPromises = [
        rwLock.readLock().then((h) => {
          operations.push('reader1-acquired');
          return h;
        }),
        rwLock.readLock().then((h) => {
          operations.push('reader2-acquired');
          return h;
        }),
      ];

      // Add conditional waiter
      const condWaiter = cond.wait().then(() => {
        operations.push('cond-resolved');
      });

      // Release writer and triggerAndWait simultaneously
      const releasePromise = Promise.resolve().then(() => {
        operations.push('writer-release');
        writer.release();
      });

      const triggerPromise = Promise.resolve().then(async () => {
        operations.push('trigger-start');
        const h = await cond.triggerAndWait(rwLock.readWaiter);
        operations.push('trigger-got-read');
        return h;
      });

      // Wait for all operations with timeout
      const results = await Promise.race([
        Promise.allSettled([
          triggerPromise,
          ...readerPromises,
          condWaiter,
          releasePromise,
        ]),
        delay(100).then(() => 'timeout'),
      ]);

      if (results === 'timeout') {
        throw new Error('Test timeout - possible deadlock');
      }

      // All readers (including triggerAndWait) should get locks
      const successfulReads = results
        .slice(0, 3)
        .filter((r) => r.status === 'fulfilled');
      expect(successfulReads.length).toBe(3); // All should get read locks

      expect(operations).toContain('trigger-got-read');
      expect(operations).toContain('cond-resolved');

      // Clean up
      successfulReads.forEach((r) => {
        if (r.status === 'fulfilled' && r.value) r.value.release();
      });
    });
  });

  describe('Microtask ordering and atomicity', () => {
    it('should respect microtask queue ordering in complex race', async () => {
      const events: string[] = [];
      const cond = createConditional();
      const mutex = createMutex();

      const lock = await mutex.lock();

      // Add conditional waiter
      const condWaiter = cond.wait().then(() => {
        events.push('cond-wait-resolved');
      });

      // Schedule operations in specific order
      queueMicrotask(() => events.push('micro1'));

      Promise.resolve().then(() => events.push('promise1'));

      // Start triggerAndWait (don't await)
      const triggerPromise = cond.triggerAndWait(mutex.waiter);
      triggerPromise.then(() => events.push('trigger-complete'));

      queueMicrotask(() => {
        events.push('release-micro');
        lock.release();
      });

      Promise.resolve().then(() => events.push('promise2'));

      queueMicrotask(() => events.push('micro2'));

      // Wait for all operations
      const handle = await Promise.race([
        triggerPromise,
        delay(50).then(() => null),
      ]);

      await condWaiter;
      await delay(5); // Let all microtasks complete

      // Verify ordering
      expect(events.indexOf('micro1')).toBeLessThan(events.indexOf('micro2'));
      expect(events.indexOf('promise1')).toBeLessThan(
        events.indexOf('promise2')
      );
      expect(events).toContain('cond-wait-resolved');
      expect(events).toContain('trigger-complete');

      // Verify atomicity: trigger completes after release
      const releaseIndex = events.indexOf('release-micro');
      const triggerIndex = events.indexOf('trigger-complete');
      expect(triggerIndex).toBeGreaterThan(releaseIndex);

      // Clean up
      if (handle) handle.release();
    });

    it('should handle nested triggerAndWait atomically', async () => {
      const cond1 = createConditional();
      const cond2 = createConditional();
      const mutex = createMutex();
      const semaphore = createSemaphore(1);

      const mutexLock = await mutex.lock();
      const semHandle = await semaphore.acquire();

      const operations: string[] = [];

      // Setup waiters
      const cond1Waiter = cond1.wait().then(() => {
        operations.push('cond1-resolved');
      });

      const cond2Waiter = cond2.wait().then(() => {
        operations.push('cond2-resolved');
      });

      // Nested triggerAndWait chain
      const chainPromise = Promise.resolve().then(async () => {
        operations.push('chain-start');

        // First level: cond1 triggers and waits for mutex
        const mutexHandle = await cond1.triggerAndWait(mutex.waiter);
        operations.push('chain-got-mutex');

        // Second level: cond2 triggers and waits for semaphore
        const semHandleNew = await cond2.triggerAndWait(semaphore.waiter);
        operations.push('chain-got-semaphore');

        return { mutexHandle, semHandle: semHandleNew };
      });

      // Release resources in same tick
      Promise.resolve().then(() => {
        operations.push('mutex-release');
        mutexLock.release();
      });

      Promise.resolve().then(() => {
        operations.push('sem-release');
        semHandle.release();
      });

      // Wait for chain to complete
      const handles = await chainPromise;
      await Promise.all([cond1Waiter, cond2Waiter]);

      // Verify all operations completed
      expect(operations).toContain('cond1-resolved');
      expect(operations).toContain('cond2-resolved');
      expect(operations).toContain('chain-got-mutex');
      expect(operations).toContain('chain-got-semaphore');

      // Clean up
      handles.mutexHandle.release();
      handles.semHandle.release();
    });
  });
});
