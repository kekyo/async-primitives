import { Bench } from 'tinybench';
import { createMutex } from '../../src/index.js';

export function createMaxConsecutiveCallsBenchmarks(bench: Bench) {
  // Test various maxConsecutiveCalls values
  const testValues = [1, 5, 10, 20, 50, 100, 1000];

  // Sequential lock (1000x)
  testValues.forEach((maxCalls) => {
    bench.add(`Mutex Sequential (1000x) - maxCalls: ${maxCalls}`, async () => {
      const locker = createMutex(maxCalls);
      for (let i = 0; i < 1000; i++) {
        const handler = await locker.lock();
        handler.release();
      }
    });
  });

  // High-frequency lock (500x)
  testValues.forEach((maxCalls) => {
    bench.add(`Mutex High-freq (500x) - maxCalls: ${maxCalls}`, async () => {
      const locker = createMutex(maxCalls);
      for (let i = 0; i < 500; i++) {
        const handler = await locker.lock();
        handler.release();
      }
    });
  });

  // Moderate concurrency (20x)
  testValues.forEach((maxCalls) => {
    bench.add(`Mutex Concurrent (20x) - maxCalls: ${maxCalls}`, async () => {
      const locker = createMutex(maxCalls);
      const promises = Array.from({ length: 20 }, async () => {
        const handler = await locker.lock();
        handler.release();
      });
      await Promise.all(promises);
    });
  });

  // Ultra-high-frequency lock (2000x)
  testValues.forEach((maxCalls) => {
    bench.add(
      `Mutex Ultra-high-freq (2000x) - maxCalls: ${maxCalls}`,
      async () => {
        const locker = createMutex(maxCalls);
        for (let i = 0; i < 2000; i++) {
          const handler = await locker.lock();
          handler.release();
        }
      }
    );
  });
}
