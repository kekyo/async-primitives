import { Bench } from 'tinybench';
import { createReaderWriterLock } from '../../src/index.js';

export function createReaderWriterLockBenchmarks(bench: Bench) {
  // Basic operations
  bench
    .add('ReaderWriterLock readLock acquire/release', async () => {
      const lock = createReaderWriterLock();
      const handle = await lock.readLock();
      handle.release();
    })
    .add('ReaderWriterLock writeLock acquire/release', async () => {
      const lock = createReaderWriterLock();
      const handle = await lock.writeLock();
      handle.release();
    });

  // Sequential read operations
  bench
    .add('ReaderWriterLock sequential reads (100x)', async () => {
      const lock = createReaderWriterLock();
      for (let i = 0; i < 100; i++) {
        const handle = await lock.readLock();
        handle.release();
      }
    })
    .add('ReaderWriterLock sequential writes (100x)', async () => {
      const lock = createReaderWriterLock();
      for (let i = 0; i < 100; i++) {
        const handle = await lock.writeLock();
        handle.release();
      }
    });

  // Concurrent readers
  bench
    .add('ReaderWriterLock concurrent readers (10x)', async () => {
      const lock = createReaderWriterLock();
      const promises = Array.from({ length: 10 }, async () => {
        const handle = await lock.readLock();
        await Promise.resolve(); // Simulate some work
        handle.release();
      });
      await Promise.all(promises);
    })
    .add('ReaderWriterLock concurrent readers (20x)', async () => {
      const lock = createReaderWriterLock();
      const promises = Array.from({ length: 20 }, async () => {
        const handle = await lock.readLock();
        await Promise.resolve(); // Simulate some work
        handle.release();
      });
      await Promise.all(promises);
    });

  // Read-heavy workload (90% reads, 10% writes)
  bench
    .add('ReaderWriterLock read-heavy (100 ops)', async () => {
      const lock = createReaderWriterLock();
      const operations: Promise<void>[] = [];
      
      for (let i = 0; i < 100; i++) {
        if (i % 10 === 0) {
          // 10% writes
          operations.push((async () => {
            const handle = await lock.writeLock();
            await Promise.resolve();
            handle.release();
          })());
        } else {
          // 90% reads
          operations.push((async () => {
            const handle = await lock.readLock();
            await Promise.resolve();
            handle.release();
          })());
        }
      }
      
      await Promise.all(operations);
    });

  // Write-heavy workload (10% reads, 90% writes)
  bench
    .add('ReaderWriterLock write-heavy (100 ops)', async () => {
      const lock = createReaderWriterLock();
      const operations: Promise<void>[] = [];
      
      for (let i = 0; i < 100; i++) {
        if (i % 10 === 0) {
          // 10% reads
          operations.push((async () => {
            const handle = await lock.readLock();
            await Promise.resolve();
            handle.release();
          })());
        } else {
          // 90% writes
          operations.push((async () => {
            const handle = await lock.writeLock();
            await Promise.resolve();
            handle.release();
          })());
        }
      }
      
      await Promise.all(operations);
    });

  // Balanced workload (50% reads, 50% writes)
  bench
    .add('ReaderWriterLock balanced (100 ops)', async () => {
      const lock = createReaderWriterLock();
      const operations: Promise<void>[] = [];
      
      for (let i = 0; i < 100; i++) {
        if (i % 2 === 0) {
          // 50% reads
          operations.push((async () => {
            const handle = await lock.readLock();
            await Promise.resolve();
            handle.release();
          })());
        } else {
          // 50% writes
          operations.push((async () => {
            const handle = await lock.writeLock();
            await Promise.resolve();
            handle.release();
          })());
        }
      }
      
      await Promise.all(operations);
    });

  // Different maxConsecutiveCalls values
  bench
    .add('ReaderWriterLock maxCalls=10 mixed (100 ops)', async () => {
      const lock = createReaderWriterLock(10);
      const operations: Promise<void>[] = [];
      
      for (let i = 0; i < 100; i++) {
        if (i % 3 === 0) {
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
    .add('ReaderWriterLock maxCalls=50 mixed (100 ops)', async () => {
      const lock = createReaderWriterLock(50);
      const operations: Promise<void>[] = [];
      
      for (let i = 0; i < 100; i++) {
        if (i % 3 === 0) {
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
    });

  // Write-preferring policy test
  bench
    .add('ReaderWriterLock write-preference test (50 ops)', async () => {
      const lock = createReaderWriterLock();
      const operations: Promise<void>[] = [];
      
      // Start with some readers, then add writers to test preference
      for (let i = 0; i < 25; i++) {
        operations.push((async () => {
          const handle = await lock.readLock();
          await Promise.resolve();
          handle.release();
        })());
      }
      
      for (let i = 0; i < 25; i++) {
        operations.push((async () => {
          const handle = await lock.writeLock();
          await Promise.resolve();
          handle.release();
        })());
      }
      
      await Promise.all(operations);
    });
}