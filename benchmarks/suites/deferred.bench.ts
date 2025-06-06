import { Bench } from 'tinybench';
import { createDeferred } from '../../src/index.js';

export function createDeferredBenchmarks(bench: Bench) {
  bench
    .add('Deferred resolve', async () => {
      const deferred = createDeferred<number>();
      deferred.resolve(123);
      await deferred.promise;
    })
    .add('Deferred reject/catch', async () => {
      const deferred = createDeferred<number>();
      deferred.reject(new Error('test'));
      try {
        await deferred.promise;
      } catch {
        // Expected error
      }
    });
} 