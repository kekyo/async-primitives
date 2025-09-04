import { Bench } from 'tinybench';
import {
  createConditional,
  createManuallyConditional,
} from '../../src/index.js';

export function createConditionalBenchmarks(bench: Bench) {
  // Conditional (automatic) benchmarks
  bench
    .add('Conditional trigger/wait', async () => {
      const signal = createConditional();
      const waitPromise = signal.wait();
      signal.trigger();
      await waitPromise;
    })
    .add('Conditional trigger reaction time', async () => {
      const signal = createConditional();
      const startTime = performance.now();
      const waitPromise = signal.wait().then(() => {
        return performance.now() - startTime;
      });
      signal.trigger();
      await waitPromise;
    })
    .add('Conditional multiple waiters with trigger', async () => {
      const signal = createConditional();
      const waiters = Array.from({ length: 10 }, () => signal.wait());

      // Trigger for each waiter
      for (let i = 0; i < 10; i++) {
        signal.trigger();
      }

      await Promise.all(waiters);
    });

  // ManuallyConditional benchmarks
  bench
    .add('ManuallyConditional raise/wait', async () => {
      const signal = createManuallyConditional();
      const waitPromise = signal.wait();
      signal.raise();
      await waitPromise;
      signal.drop();
    })
    .add('ManuallyConditional raise reaction time', async () => {
      const signal = createManuallyConditional();
      const startTime = performance.now();
      const waitPromise = signal.wait().then(() => {
        return performance.now() - startTime;
      });
      signal.raise();
      await waitPromise;
      signal.drop();
    })
    .add('ManuallyConditional trigger/wait', async () => {
      const signal = createManuallyConditional();
      const waitPromise = signal.wait();
      signal.trigger();
      await waitPromise;
    })
    .add('ManuallyConditional trigger reaction time', async () => {
      const signal = createManuallyConditional();
      const startTime = performance.now();
      const waitPromise = signal.wait().then(() => {
        return performance.now() - startTime;
      });
      signal.trigger();
      await waitPromise;
    })
    .add('ManuallyConditional multiple waiters with raise', async () => {
      const signal = createManuallyConditional();
      const waiters = Array.from({ length: 10 }, () => signal.wait());

      signal.raise(); // All waiters resolve at once
      await Promise.all(waiters);
      signal.drop();
    })
    .add('ManuallyConditional multiple waiters with trigger', async () => {
      const signal = createManuallyConditional();
      const waiters = Array.from({ length: 10 }, () => signal.wait());

      // Trigger for each waiter
      for (let i = 0; i < 10; i++) {
        signal.trigger();
      }

      await Promise.all(waiters);
    });

  // Comparison benchmarks
  bench
    .add(
      'Conditional vs ManuallyConditional - single waiter (Conditional)',
      async () => {
        const signal = createConditional();
        const waitPromise = signal.wait();
        signal.trigger();
        await waitPromise;
      }
    )
    .add(
      'Conditional vs ManuallyConditional - single waiter (ManuallyConditional)',
      async () => {
        const signal = createManuallyConditional();
        const waitPromise = signal.wait();
        signal.trigger();
        await waitPromise;
      }
    )
    .add(
      'Conditional vs ManuallyConditional - batch waiters (Conditional)',
      async () => {
        const signal = createConditional();
        const waiters = Array.from({ length: 5 }, () => signal.wait());

        for (let i = 0; i < 5; i++) {
          signal.trigger();
        }

        await Promise.all(waiters);
      }
    )
    .add(
      'Conditional vs ManuallyConditional - batch waiters (ManuallyConditional)',
      async () => {
        const signal = createManuallyConditional();
        const waiters = Array.from({ length: 5 }, () => signal.wait());

        signal.raise(); // All resolve at once
        await Promise.all(waiters);
        signal.drop();
      }
    );
}
