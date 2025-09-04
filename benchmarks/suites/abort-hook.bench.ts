import { Bench } from 'tinybench';
import { onAbort } from '../../src/index.js';

export function createAbortHookBenchmarks(bench: Bench) {
  bench.add('onAbort setup/cleanup', () => {
    const controller = new AbortController();
    const handle = onAbort(controller.signal, () => {
      // noop callback
    });
    handle.release();
  });
}
