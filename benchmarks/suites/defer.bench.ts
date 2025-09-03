import { Bench } from 'tinybench';
import { defer } from '../../src/index.js';

export function createDeferBenchmarks(bench: Bench) {
  bench
    .add('defer callback', async () => {
      return new Promise<void>((resolve) => {
        defer(() => {
          resolve();
        });
      });
    })
    .add('defer [setTimeout(0)]', async () => {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, 0);
      });
    });
}
