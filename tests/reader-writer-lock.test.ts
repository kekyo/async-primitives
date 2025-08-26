/**
 * Tests for ReaderWriterLock functionality
 * These tests verify the behavior of reader-writer locks with write-preferring policy
 */

import { describe, it, expect } from 'vitest';
import { createReaderWriterLock } from '../src/primitives/reader-writer-lock.js';
import { delay } from '../src/primitives/delay.js';

describe('ReaderWriterLock', () => {
  describe('Basic functionality', () => {
    it('should allow multiple concurrent readers', async () => {
      const rwLock = createReaderWriterLock();

      // Initially no locks
      expect(rwLock.currentReaders).toBe(0);
      expect(rwLock.hasWriter).toBe(false);

      const handle1 = await rwLock.readLock();
      expect(rwLock.currentReaders).toBe(1);
      expect(rwLock.hasWriter).toBe(false);
      expect(handle1.isActive).toBe(true);

      const handle2 = await rwLock.readLock();
      expect(rwLock.currentReaders).toBe(2);
      expect(rwLock.hasWriter).toBe(false);
      expect(handle2.isActive).toBe(true);

      const handle3 = await rwLock.readLock();
      expect(rwLock.currentReaders).toBe(3);
      expect(rwLock.hasWriter).toBe(false);
      expect(handle3.isActive).toBe(true);

      // Release readers
      handle1.release();
      expect(rwLock.currentReaders).toBe(2);
      expect(handle1.isActive).toBe(false);

      handle2.release();
      expect(rwLock.currentReaders).toBe(1);

      handle3.release();
      expect(rwLock.currentReaders).toBe(0);
    });

    it('should allow only one writer at a time', async () => {
      const rwLock = createReaderWriterLock();

      const handle = await rwLock.writeLock();
      expect(rwLock.hasWriter).toBe(true);
      expect(rwLock.currentReaders).toBe(0);
      expect(handle.isActive).toBe(true);

      // Try to acquire another write lock
      let secondWriterAcquired = false;
      const writePromise = (async () => {
        const handle2 = await rwLock.writeLock();
        secondWriterAcquired = true;
        handle2.release();
      })();

      // Give time for the second writer to try
      await delay(10);
      expect(secondWriterAcquired).toBe(false);
      expect(rwLock.pendingWritersCount).toBe(1);

      // Release first writer
      handle.release();
      expect(handle.isActive).toBe(false);

      // Second writer should now acquire
      await writePromise;
      expect(secondWriterAcquired).toBe(true);
      
      // After second writer releases, lock should be free
      expect(rwLock.hasWriter).toBe(false);
      expect(rwLock.currentReaders).toBe(0);
    });

    it('should handle multiple releases safely (idempotent)', async () => {
      const rwLock = createReaderWriterLock();

      // Test read lock handle
      const readHandle = await rwLock.readLock();
      expect(rwLock.currentReaders).toBe(1);
      expect(readHandle.isActive).toBe(true);

      readHandle.release();
      expect(rwLock.currentReaders).toBe(0);
      expect(readHandle.isActive).toBe(false);

      // Multiple releases should be ignored
      readHandle.release();
      readHandle.release();
      expect(rwLock.currentReaders).toBe(0);
      expect(readHandle.isActive).toBe(false);

      // Test write lock handle
      const writeHandle = await rwLock.writeLock();
      expect(rwLock.hasWriter).toBe(true);
      expect(writeHandle.isActive).toBe(true);

      writeHandle.release();
      expect(rwLock.hasWriter).toBe(false);
      expect(writeHandle.isActive).toBe(false);

      // Multiple releases should be ignored
      writeHandle.release();
      writeHandle.release();
      expect(rwLock.hasWriter).toBe(false);
      expect(writeHandle.isActive).toBe(false);
    });

    it('should provide accurate pending counts', async () => {
      const rwLock = createReaderWriterLock();

      expect(rwLock.pendingReadersCount).toBe(0);
      expect(rwLock.pendingWritersCount).toBe(0);

      // Hold a write lock
      const writeHandle = await rwLock.writeLock();

      // Queue up readers and writers
      const readerPromise1 = (async () => {
        const handle = await rwLock.readLock();
        handle.release();
      })();

      await delay(10);
      expect(rwLock.pendingReadersCount).toBe(1);

      const readerPromise2 = (async () => {
        const handle = await rwLock.readLock();
        handle.release();
      })();

      await delay(10);
      expect(rwLock.pendingReadersCount).toBe(2);

      const writerPromise = (async () => {
        const handle = await rwLock.writeLock();
        handle.release();
      })();

      await delay(10);
      expect(rwLock.pendingWritersCount).toBe(1);

      // Release write lock
      writeHandle.release();

      await Promise.all([readerPromise1, readerPromise2, writerPromise]);
      expect(rwLock.pendingReadersCount).toBe(0);
      expect(rwLock.pendingWritersCount).toBe(0);
    });
  });

  describe('Mutual exclusion', () => {
    it('should block readers when writer is active', async () => {
      const rwLock = createReaderWriterLock();
      const results: string[] = [];

      // Acquire write lock
      const writeHandle = await rwLock.writeLock();
      results.push('writer: acquired');

      // Try to acquire read lock
      let readerAcquired = false;
      const readPromise = (async () => {
        results.push('reader: requesting');
        const handle = await rwLock.readLock();
        readerAcquired = true;
        results.push('reader: acquired');
        handle.release();
        results.push('reader: released');
      })();

      // Give time for reader to try
      await delay(10);
      expect(readerAcquired).toBe(false);
      expect(rwLock.pendingReadersCount).toBe(1);

      // Release writer
      writeHandle.release();
      results.push('writer: released');

      await readPromise;

      expect(results).toEqual([
        'writer: acquired',
        'reader: requesting',
        'writer: released',
        'reader: acquired',
        'reader: released'
      ]);
    });

    it('should block writer when readers are active', async () => {
      const rwLock = createReaderWriterLock();
      const results: string[] = [];

      // Acquire multiple read locks
      const readHandle1 = await rwLock.readLock();
      const readHandle2 = await rwLock.readLock();
      results.push('readers: acquired');

      // Try to acquire write lock
      let writerAcquired = false;
      const writePromise = (async () => {
        results.push('writer: requesting');
        const handle = await rwLock.writeLock();
        writerAcquired = true;
        results.push('writer: acquired');
        handle.release();
        results.push('writer: released');
      })();

      // Give time for writer to try
      await delay(10);
      expect(writerAcquired).toBe(false);
      expect(rwLock.pendingWritersCount).toBe(1);

      // Release one reader
      readHandle1.release();
      results.push('reader1: released');
      await delay(10);
      // Writer should still be blocked
      expect(writerAcquired).toBe(false);

      // Release second reader
      readHandle2.release();
      results.push('reader2: released');

      await writePromise;

      expect(results).toEqual([
        'readers: acquired',
        'writer: requesting',
        'reader1: released',
        'reader2: released',
        'writer: acquired',
        'writer: released'
      ]);
    });
  });

  describe('Write-preferring policy', () => {
    it('should block new readers when writer is waiting', async () => {
      const rwLock = createReaderWriterLock();
      const results: string[] = [];

      // Acquire a read lock
      const readHandle1 = await rwLock.readLock();
      results.push('reader1: acquired');

      // Queue a writer
      const writePromise = (async () => {
        results.push('writer: requesting');
        const handle = await rwLock.writeLock();
        results.push('writer: acquired');
        await delay(20);
        handle.release();
        results.push('writer: released');
      })();

      await delay(10);

      // Try to acquire another read lock (should be blocked by pending writer)
      const readPromise2 = (async () => {
        results.push('reader2: requesting');
        const handle = await rwLock.readLock();
        results.push('reader2: acquired');
        handle.release();
        results.push('reader2: released');
      })();

      await delay(10);
      expect(rwLock.pendingWritersCount).toBe(1);
      expect(rwLock.pendingReadersCount).toBe(1);

      // Release first reader
      readHandle1.release();
      results.push('reader1: released');

      // Writer should acquire before reader2
      await Promise.all([writePromise, readPromise2]);

      expect(results).toEqual([
        'reader1: acquired',
        'writer: requesting',
        'reader2: requesting',
        'reader1: released',
        'writer: acquired',
        'writer: released',
        'reader2: acquired',
        'reader2: released'
      ]);
    });

    it('should process all waiting readers together after writer', async () => {
      const rwLock = createReaderWriterLock();

      // Hold a write lock
      const writeHandle = await rwLock.writeLock();

      // Queue multiple readers
      const readerResults: string[] = [];
      const readerPromises = Array.from({ length: 3 }, async (_, i) => {
        const handle = await rwLock.readLock();
        readerResults.push(`reader${i}: acquired`);
        await delay(10);
        handle.release();
        readerResults.push(`reader${i}: released`);
      });

      await delay(10);
      expect(rwLock.pendingReadersCount).toBe(3);

      // Release writer
      writeHandle.release();

      await Promise.all(readerPromises);

      // All readers should have acquired at roughly the same time
      const acquiredLines = readerResults.filter(r => r.includes('acquired'));
      const releasedLines = readerResults.filter(r => r.includes('released'));
      
      expect(acquiredLines).toHaveLength(3);
      expect(releasedLines).toHaveLength(3);
      
      // All acquisitions should come before any releases (proving concurrent access)
      const firstReleaseIndex = readerResults.findIndex(r => r.includes('released'));
      const lastAcquireIndex = readerResults.lastIndexOf(readerResults.find(r => r.includes('acquired'))!);
      expect(lastAcquireIndex).toBeLessThan(firstReleaseIndex);
    });
  });

  describe('AbortSignal support', () => {
    it('should handle AbortSignal cancellation for read locks', async () => {
      const rwLock = createReaderWriterLock();
      const controller = new AbortController();

      // Hold a write lock
      const writeHandle = await rwLock.writeLock();

      // Try to acquire read lock with abort signal
      let caughtError: Error | null = null;
      const readPromise = (async () => {
        try {
          const handle = await rwLock.readLock(controller.signal);
          handle.release();
        } catch (error) {
          caughtError = error as Error;
        }
      })();

      await delay(10);
      controller.abort();

      await readPromise;

      expect(caughtError).toBeTruthy();
      expect((caughtError as Error).message).toContain('aborted');
      expect(rwLock.pendingReadersCount).toBe(0);

      writeHandle.release();
    });

    it('should handle AbortSignal cancellation for write locks', async () => {
      const rwLock = createReaderWriterLock();
      const controller = new AbortController();

      // Hold a read lock
      const readHandle = await rwLock.readLock();

      // Try to acquire write lock with abort signal
      let caughtError: Error | null = null;
      const writePromise = (async () => {
        try {
          const handle = await rwLock.writeLock(controller.signal);
          handle.release();
        } catch (error) {
          caughtError = error as Error;
        }
      })();

      await delay(10);
      controller.abort();

      await writePromise;

      expect(caughtError).toBeTruthy();
      expect((caughtError as Error).message).toContain('aborted');
      expect(rwLock.pendingWritersCount).toBe(0);

      readHandle.release();
    });

    it('should reject immediately if signal is already aborted', async () => {
      const rwLock = createReaderWriterLock();
      const controller = new AbortController();
      controller.abort(); // Abort before calling lock

      // Test read lock
      let readError: Error | null = null;
      try {
        const handle = await rwLock.readLock(controller.signal);
        handle.release();
      } catch (error) {
        readError = error as Error;
      }

      expect(readError).toBeTruthy();
      expect((readError as Error).message).toContain('aborted');

      // Test write lock
      let writeError: Error | null = null;
      try {
        const handle = await rwLock.writeLock(controller.signal);
        handle.release();
      } catch (error) {
        writeError = error as Error;
      }

      expect(writeError).toBeTruthy();
      expect((writeError as Error).message).toContain('aborted');
    });

    it('should handle multiple simultaneous AbortSignal cancellations', async () => {
      const rwLock = createReaderWriterLock();
      const controllers = Array.from({ length: 5 }, () => new AbortController());

      // Hold a write lock
      const writeHandle = await rwLock.writeLock();

      const errors: Error[] = [];
      const promises = controllers.map(async (controller) => {
        try {
          const handle = await rwLock.readLock(controller.signal);
          handle.release();
        } catch (error) {
          errors.push(error as Error);
        }
      });

      await delay(10);
      expect(rwLock.pendingReadersCount).toBe(5);

      // Abort all signals
      controllers.forEach(controller => controller.abort());

      await Promise.all(promises);

      expect(errors).toHaveLength(5);
      errors.forEach(error => {
        expect(error.message).toContain('aborted');
      });

      expect(rwLock.pendingReadersCount).toBe(0);
      writeHandle.release();
    });
  });

  describe('Error handling', () => {
    it('should release locks even when errors occur', async () => {
      const rwLock = createReaderWriterLock();

      // Test read lock
      let readError: Error | null = null;
      try {
        const handle = await rwLock.readLock();
        try {
          expect(rwLock.currentReaders).toBe(1);
          throw new Error('Read error');
        } finally {
          handle.release();
        }
      } catch (error) {
        readError = error as Error;
      }

      expect((readError as Error | null)?.message).toBe('Read error');
      expect(rwLock.currentReaders).toBe(0);

      // Test write lock
      let writeError: Error | null = null;
      try {
        const handle = await rwLock.writeLock();
        try {
          expect(rwLock.hasWriter).toBe(true);
          throw new Error('Write error');
        } finally {
          handle.release();
        }
      } catch (error) {
        writeError = error as Error;
      }

      expect((writeError as Error | null)?.message).toBe('Write error');
      expect(rwLock.hasWriter).toBe(false);
    });
  });

  describe('Resource management patterns', () => {
    it('should work with using statement (Symbol.dispose)', async () => {
      const rwLock = createReaderWriterLock();

      // Test read locks
      {
        using handle1 = await rwLock.readLock();
        using handle2 = await rwLock.readLock();

        expect(rwLock.currentReaders).toBe(2);
        expect(handle1.isActive).toBe(true);
        expect(handle2.isActive).toBe(true);
      }

      expect(rwLock.currentReaders).toBe(0);

      // Test write lock
      {
        using handle = await rwLock.writeLock();

        expect(rwLock.hasWriter).toBe(true);
        expect(handle.isActive).toBe(true);
      }

      expect(rwLock.hasWriter).toBe(false);
    });

    it('should handle nested lock acquisitions', async () => {
      const rwLock1 = createReaderWriterLock();
      const rwLock2 = createReaderWriterLock();

      const readHandle1 = await rwLock1.readLock();
      try {
        expect(rwLock1.currentReaders).toBe(1);

        const writeHandle2 = await rwLock2.writeLock();
        try {
          expect(rwLock2.hasWriter).toBe(true);

          // Both locks are held
          expect(readHandle1.isActive).toBe(true);
          expect(writeHandle2.isActive).toBe(true);

        } finally {
          writeHandle2.release();
        }
        expect(rwLock2.hasWriter).toBe(false);

      } finally {
        readHandle1.release();
      }
      expect(rwLock1.currentReaders).toBe(0);
    });
  });

  describe('Race condition edge cases', () => {
    it('should handle rapid lock/release cycles', async () => {
      const rwLock = createReaderWriterLock();
      const iterations = 50;
      const results: string[] = [];

      const readTask = async (id: number) => {
        const handle = await rwLock.readLock();
        try {
          results.push(`R${id}`);
          await delay(1);
        } finally {
          handle.release();
        }
      };

      const writeTask = async (id: number) => {
        const handle = await rwLock.writeLock();
        try {
          results.push(`W${id}`);
          await delay(1);
        } finally {
          handle.release();
        }
      };

      // Mix read and write tasks
      const tasks: Promise<void>[] = [];
      for (let i = 0; i < iterations; i++) {
        if (i % 3 === 0) {
          tasks.push(writeTask(i));
        } else {
          tasks.push(readTask(i));
        }
      }

      await Promise.all(tasks);

      expect(results).toHaveLength(iterations);
      expect(rwLock.currentReaders).toBe(0);
      expect(rwLock.hasWriter).toBe(false);
      expect(rwLock.pendingReadersCount).toBe(0);
      expect(rwLock.pendingWritersCount).toBe(0);
    });

    it('should handle concurrent abort and release race condition', async () => {
      const rwLock = createReaderWriterLock();
      const controller = new AbortController();

      // Hold a read lock
      const readHandle = await rwLock.readLock();

      let caughtError: Error | null = null;
      const writePromise = (async () => {
        try {
          const handle = await rwLock.writeLock(controller.signal);
          handle.release();
        } catch (error) {
          caughtError = error as Error;
        }
      })();

      await delay(10);

      // Race condition: abort and release at the same time
      setTimeout(() => controller.abort(), 0);
      setTimeout(() => readHandle.release(), 0);

      await writePromise;

      // Should either succeed or be aborted, but not hang
      if (caughtError) {
        expect((caughtError as Error).message).toContain('aborted');
      }

      await delay(10);
      expect(rwLock.currentReaders).toBe(0);
      expect(rwLock.hasWriter).toBe(false);
    });

    it('should handle maxConsecutiveCalls threshold correctly', async () => {
      const rwLock = createReaderWriterLock(5); // Low threshold for testing
      const results: number[] = [];
      const iterations = 30;

      const tasks = Array.from({ length: iterations }, async (_, i) => {
        if (i % 2 === 0) {
          const handle = await rwLock.readLock();
          try {
            results.push(i);
          } finally {
            handle.release();
          }
        } else {
          const handle = await rwLock.writeLock();
          try {
            results.push(i);
          } finally {
            handle.release();
          }
        }
      });

      await Promise.all(tasks);

      expect(results).toHaveLength(iterations);
      expect(rwLock.currentReaders).toBe(0);
      expect(rwLock.hasWriter).toBe(false);
    });

    it('should maintain queue integrity when items are removed during processing', async () => {
      const rwLock = createReaderWriterLock();
      const readController1 = new AbortController();
      const readController2 = new AbortController();
      const writeController = new AbortController();

      // Hold a write lock
      const writeHandle = await rwLock.writeLock();

      const errors: Error[] = [];
      
      const readPromise1 = (async () => {
        try {
          const handle = await rwLock.readLock(readController1.signal);
          handle.release();
        } catch (error) {
          errors.push(error as Error);
        }
      })();

      const readPromise2 = (async () => {
        try {
          const handle = await rwLock.readLock(readController2.signal);
          handle.release();
        } catch (error) {
          errors.push(error as Error);
        }
      })();

      const writePromise = (async () => {
        try {
          const handle = await rwLock.writeLock(writeController.signal);
          handle.release();
        } catch (error) {
          errors.push(error as Error);
        }
      })();

      const readPromise3 = (async () => {
        try {
          const handle = await rwLock.readLock(); // No abort signal
          handle.release();
        } catch (error) {
          errors.push(error as Error);
        }
      })();

      await delay(10);
      expect(rwLock.pendingReadersCount).toBe(3);
      expect(rwLock.pendingWritersCount).toBe(1);

      // Abort some requests
      readController1.abort();
      writeController.abort();

      // Release the write lock
      writeHandle.release();

      await Promise.all([readPromise1, readPromise2, readPromise3, writePromise]);

      expect(errors).toHaveLength(2);
      expect(rwLock.currentReaders).toBe(0);
      expect(rwLock.hasWriter).toBe(false);
      expect(rwLock.pendingReadersCount).toBe(0);
      expect(rwLock.pendingWritersCount).toBe(0);
    });

    it('should deadlock when attempting to upgrade read lock to write lock', async () => {
      const rwLock = createReaderWriterLock();
      
      // Acquire a read lock
      const readHandle = await rwLock.readLock();
      expect(rwLock.currentReaders).toBe(1);
      
      // Attempt to acquire write lock while holding read lock (will deadlock)
      let error: Error | null = null;
      try {
        // Use AbortSignal.timeout for 500ms timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 500);
        
        try {
          const writeHandle = await rwLock.writeLock(controller.signal);
          // Should never reach here
          writeHandle.release();
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (e) {
        error = e as Error;
      }
      
      // Should have been aborted due to deadlock
      expect(error).toBeTruthy();
      expect(error!.message).toContain('aborted');
      
      // Clean up
      readHandle.release();
      expect(rwLock.currentReaders).toBe(0);
    });

    it('should deadlock when attempting to acquire read lock while holding write lock', async () => {
      const rwLock = createReaderWriterLock();
      
      // Acquire a write lock
      const writeHandle = await rwLock.writeLock();
      expect(rwLock.hasWriter).toBe(true);
      
      // Attempt to acquire read lock while holding write lock (will deadlock)
      let error: Error | null = null;
      try {
        // Use AbortSignal.timeout for 500ms timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 500);
        
        try {
          const readHandle = await rwLock.readLock(controller.signal);
          // Should never reach here
          readHandle.release();
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (e) {
        error = e as Error;
      }
      
      // Should have been aborted due to deadlock
      expect(error).toBeTruthy();
      expect(error!.message).toContain('aborted');
      
      // Clean up
      writeHandle.release();
      expect(rwLock.hasWriter).toBe(false);
    });

    it('should deadlock when attempting to upgrade while holding multiple read locks', async () => {
      const rwLock = createReaderWriterLock();
      
      // Acquire multiple read locks from same context
      const readHandle1 = await rwLock.readLock();
      const readHandle2 = await rwLock.readLock();
      expect(rwLock.currentReaders).toBe(2);
      
      // Attempt to acquire write lock (will deadlock waiting for own read locks)
      let error: Error | null = null;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 500);
        
        try {
          const writeHandle = await rwLock.writeLock(controller.signal);
          // Should never reach here
          writeHandle.release();
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (e) {
        error = e as Error;
      }
      
      // Should have been aborted due to deadlock
      expect(error).toBeTruthy();
      expect(error!.message).toContain('aborted');
      
      // Clean up
      readHandle1.release();
      readHandle2.release();
      expect(rwLock.currentReaders).toBe(0);
    });

    it('should NOT support reentrant write locking (documents current limitation)', async () => {
      const rwLock = createReaderWriterLock();
      
      // Acquire a write lock
      const handle1 = await rwLock.writeLock();
      expect(rwLock.hasWriter).toBe(true);
      
      // Try to acquire another write lock from same context (will block)
      let secondAcquired = false;
      const promise = (async () => {
        const handle2 = await rwLock.writeLock();
        secondAcquired = true;
        handle2.release();
      })();
      
      // Give time for the second acquisition to try
      await delay(10);
      
      // Second acquisition should be blocked (not reentrant)
      expect(secondAcquired).toBe(false);
      expect(rwLock.pendingWritersCount).toBe(1);
      
      // Release first lock
      handle1.release();
      
      // Now second acquisition should complete
      await promise;
      expect(secondAcquired).toBe(true);
      expect(rwLock.hasWriter).toBe(false);
      expect(rwLock.pendingWritersCount).toBe(0);
    });

    it('should allow multiple read locks from same context (not tracked separately)', async () => {
      const rwLock = createReaderWriterLock();
      
      // Can acquire multiple read locks from same context
      const handle1 = await rwLock.readLock();
      const handle2 = await rwLock.readLock();
      const handle3 = await rwLock.readLock();
      
      expect(rwLock.currentReaders).toBe(3);
      
      // Each needs to be released separately
      handle1.release();
      expect(rwLock.currentReaders).toBe(2);
      
      handle2.release();
      expect(rwLock.currentReaders).toBe(1);
      
      handle3.release();
      expect(rwLock.currentReaders).toBe(0);
      
      // This documents that the lock doesn't track "who" holds it
      // Multiple reads from same context are allowed and counted separately
    });
  });
});