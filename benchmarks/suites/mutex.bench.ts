import { Bench } from 'tinybench';
import { createMutex } from '../../src/index.js';

export function createMutexBenchmarks(bench: Bench) {
  bench.add('Mutex acquire/release', async () => {
    const locker = createMutex();
    const handler = await locker.lock();
    handler.release();
  });
}
