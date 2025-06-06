import { Bench } from 'tinybench';
import { createAsyncLock } from '../../src/index.js';

export function createAsyncLockBenchmarks(bench: Bench) {
  bench
    .add('AsyncLock acquire/release', async () => {
      const locker = createAsyncLock();
      const handler = await locker.lock();
      handler.release();
    });
} 