import { Bench } from 'tinybench';
import { delay } from '../../src/index.js';

export function createDelayBenchmarks(bench: Bench) {
  bench
    .add('delay(0)', async () => {
      await delay(0);
    })
    .add('delay(1)', async () => {
      await delay(1);
    });
}
