import { Bench } from 'tinybench';
import { createMutex, createSemaphore, createReaderWriterLock } from '../../src/index.js';

export function createComparisonBenchmarks(bench: Bench) {
  // Single resource management comparison: Mutex vs Semaphore(1)
  bench
    .add('[Comparison] Mutex single acquire/release', async () => {
      const mutex = createMutex();
      const handle = await mutex.lock();
      handle.release();
    })
    .add('[Comparison] Semaphore(1) single acquire/release', async () => {
      const semaphore = createSemaphore(1);
      const handle = await semaphore.acquire();
      handle.release();
    });

  // Sequential operations comparison
  bench
    .add('[Comparison] Mutex sequential (50x)', async () => {
      const mutex = createMutex();
      for (let i = 0; i < 50; i++) {
        const handle = await mutex.lock();
        handle.release();
      }
    })
    .add('[Comparison] Semaphore(1) sequential (50x)', async () => {
      const semaphore = createSemaphore(1);
      for (let i = 0; i < 50; i++) {
        const handle = await semaphore.acquire();
        handle.release();
      }
    })
    .add('[Comparison] RWLock write-only sequential (50x)', async () => {
      const lock = createReaderWriterLock();
      for (let i = 0; i < 50; i++) {
        const handle = await lock.writeLock();
        handle.release();
      }
    });

  // Concurrent exclusive access comparison
  bench
    .add('[Comparison] Mutex concurrent (20x)', async () => {
      const mutex = createMutex();
      const promises = Array.from({ length: 20 }, async () => {
        const handle = await mutex.lock();
        await Promise.resolve();
        handle.release();
      });
      await Promise.all(promises);
    })
    .add('[Comparison] Semaphore(1) concurrent (20x)', async () => {
      const semaphore = createSemaphore(1);
      const promises = Array.from({ length: 20 }, async () => {
        const handle = await semaphore.acquire();
        await Promise.resolve();
        handle.release();
      });
      await Promise.all(promises);
    })
    .add('[Comparison] RWLock write-only concurrent (20x)', async () => {
      const lock = createReaderWriterLock();
      const promises = Array.from({ length: 20 }, async () => {
        const handle = await lock.writeLock();
        await Promise.resolve();
        handle.release();
      });
      await Promise.all(promises);
    });

  // Multiple resource management: Semaphore(N) vs Multiple Mutexes
  bench
    .add('[Comparison] Semaphore(5) for pool (20 requests)', async () => {
      const semaphore = createSemaphore(5);
      const promises = Array.from({ length: 20 }, async () => {
        const handle = await semaphore.acquire();
        await Promise.resolve();
        handle.release();
      });
      await Promise.all(promises);
    })
    .add('[Comparison] 5 Mutexes round-robin (20 requests)', async () => {
      const mutexes = Array.from({ length: 5 }, () => createMutex());
      const promises = Array.from({ length: 20 }, async (_, index) => {
        const mutex = mutexes[index % 5];
        const handle = await mutex.lock();
        await Promise.resolve();
        handle.release();
      });
      await Promise.all(promises);
    });

  // Read-mostly pattern comparison
  bench
    .add('[Comparison] RWLock read-mostly (90% read)', async () => {
      const lock = createReaderWriterLock();
      const operations: Promise<void>[] = [];
      
      for (let i = 0; i < 50; i++) {
        if (i % 10 === 0) {
          operations.push((async () => {
            const handle = await lock.writeLock();
            handle.release();
          })());
        } else {
          operations.push((async () => {
            const handle = await lock.readLock();
            handle.release();
          })());
        }
      }
      
      await Promise.all(operations);
    })
    .add('[Comparison] Mutex for read-mostly (simulated)', async () => {
      const mutex = createMutex();
      const operations: Promise<void>[] = [];
      
      for (let i = 0; i < 50; i++) {
        operations.push((async () => {
          const handle = await mutex.lock();
          handle.release();
        })());
      }
      
      await Promise.all(operations);
    });

  // Real-world scenario: Connection Pool
  bench
    .add('[Scenario] Connection Pool - Semaphore(3)', async () => {
      const pool = createSemaphore(3);
      const connections: Promise<void>[] = [];
      
      // Simulate 10 connection requests
      for (let i = 0; i < 10; i++) {
        connections.push((async () => {
          const conn = await pool.acquire();
          // Simulate connection usage
          await Promise.resolve();
          conn.release();
        })());
      }
      
      await Promise.all(connections);
    });

  // Real-world scenario: Cache Access Pattern
  bench
    .add('[Scenario] Cache - RWLock (70% read, 30% write)', async () => {
      const cache = createReaderWriterLock();
      const operations: Promise<void>[] = [];
      
      for (let i = 0; i < 30; i++) {
        if (i % 10 < 7) {
          // 70% cache reads
          operations.push((async () => {
            const handle = await cache.readLock();
            await Promise.resolve();
            handle.release();
          })());
        } else {
          // 30% cache updates
          operations.push((async () => {
            const handle = await cache.writeLock();
            await Promise.resolve();
            handle.release();
          })());
        }
      }
      
      await Promise.all(operations);
    });

  // Real-world scenario: Critical Section Protection
  bench
    .add('[Scenario] Critical Section - Mutex', async () => {
      const mutex = createMutex();
      const tasks: Promise<void>[] = [];
      
      // Simulate 15 tasks accessing critical section
      for (let i = 0; i < 15; i++) {
        tasks.push((async () => {
          const guard = await mutex.lock();
          // Simulate critical section work
          await Promise.resolve();
          guard.release();
        })());
      }
      
      await Promise.all(tasks);
    });

  // High contention comparison
  bench
    .add('[HighContention] Mutex (50 concurrent)', async () => {
      const mutex = createMutex();
      const promises = Array.from({ length: 50 }, async () => {
        const handle = await mutex.lock();
        handle.release();
      });
      await Promise.all(promises);
    })
    .add('[HighContention] Semaphore(1) (50 concurrent)', async () => {
      const semaphore = createSemaphore(1);
      const promises = Array.from({ length: 50 }, async () => {
        const handle = await semaphore.acquire();
        handle.release();
      });
      await Promise.all(promises);
    })
    .add('[HighContention] Semaphore(10) (50 concurrent)', async () => {
      const semaphore = createSemaphore(10);
      const promises = Array.from({ length: 50 }, async () => {
        const handle = await semaphore.acquire();
        handle.release();
      });
      await Promise.all(promises);
    })
    .add('[HighContention] RWLock writes (50 concurrent)', async () => {
      const lock = createReaderWriterLock();
      const promises = Array.from({ length: 50 }, async () => {
        const handle = await lock.writeLock();
        handle.release();
      });
      await Promise.all(promises);
    })
    .add('[HighContention] RWLock reads (50 concurrent)', async () => {
      const lock = createReaderWriterLock();
      const promises = Array.from({ length: 50 }, async () => {
        const handle = await lock.readLock();
        handle.release();
      });
      await Promise.all(promises);
    });
}