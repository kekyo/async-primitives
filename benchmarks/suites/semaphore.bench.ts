import { Bench } from 'tinybench';
import { createSemaphore } from '../../src/index.js';

export function createSemaphoreBenchmarks(bench: Bench) {
  // Basic acquire/release with different counts
  bench
    .add('Semaphore(1) acquire/release', async () => {
      const semaphore = createSemaphore(1);
      const handle = await semaphore.acquire();
      handle.release();
    })
    .add('Semaphore(2) acquire/release', async () => {
      const semaphore = createSemaphore(2);
      const handle = await semaphore.acquire();
      handle.release();
    })
    .add('Semaphore(5) acquire/release', async () => {
      const semaphore = createSemaphore(5);
      const handle = await semaphore.acquire();
      handle.release();
    })
    .add('Semaphore(10) acquire/release', async () => {
      const semaphore = createSemaphore(10);
      const handle = await semaphore.acquire();
      handle.release();
    });

  // Sequential operations
  bench
    .add('Semaphore(1) sequential (100x)', async () => {
      const semaphore = createSemaphore(1);
      for (let i = 0; i < 100; i++) {
        const handle = await semaphore.acquire();
        handle.release();
      }
    })
    .add('Semaphore(5) sequential (100x)', async () => {
      const semaphore = createSemaphore(5);
      for (let i = 0; i < 100; i++) {
        const handle = await semaphore.acquire();
        handle.release();
      }
    });

  // Concurrent operations
  bench
    .add('Semaphore(1) concurrent (10x)', async () => {
      const semaphore = createSemaphore(1);
      const promises = Array.from({ length: 10 }, async () => {
        const handle = await semaphore.acquire();
        handle.release();
      });
      await Promise.all(promises);
    })
    .add('Semaphore(2) concurrent (10x)', async () => {
      const semaphore = createSemaphore(2);
      const promises = Array.from({ length: 10 }, async () => {
        const handle = await semaphore.acquire();
        handle.release();
      });
      await Promise.all(promises);
    })
    .add('Semaphore(5) concurrent (10x)', async () => {
      const semaphore = createSemaphore(5);
      const promises = Array.from({ length: 10 }, async () => {
        const handle = await semaphore.acquire();
        handle.release();
      });
      await Promise.all(promises);
    });

  // High contention scenario
  bench
    .add('Semaphore(2) high contention (20x)', async () => {
      const semaphore = createSemaphore(2);
      const promises = Array.from({ length: 20 }, async () => {
        const handle = await semaphore.acquire();
        // Simulate some work
        await Promise.resolve();
        handle.release();
      });
      await Promise.all(promises);
    })
    .add('Semaphore(5) high contention (50x)', async () => {
      const semaphore = createSemaphore(5);
      const promises = Array.from({ length: 50 }, async () => {
        const handle = await semaphore.acquire();
        // Simulate some work
        await Promise.resolve();
        handle.release();
      });
      await Promise.all(promises);
    });

  // Different maxConsecutiveCalls values
  bench
    .add('Semaphore(5) maxCalls=10 sequential (100x)', async () => {
      const semaphore = createSemaphore(5, 10);
      for (let i = 0; i < 100; i++) {
        const handle = await semaphore.acquire();
        handle.release();
      }
    })
    .add('Semaphore(5) maxCalls=50 sequential (100x)', async () => {
      const semaphore = createSemaphore(5, 50);
      for (let i = 0; i < 100; i++) {
        const handle = await semaphore.acquire();
        handle.release();
      }
    })
    .add('Semaphore(5) maxCalls=100 sequential (100x)', async () => {
      const semaphore = createSemaphore(5, 100);
      for (let i = 0; i < 100; i++) {
        const handle = await semaphore.acquire();
        handle.release();
      }
    });
}