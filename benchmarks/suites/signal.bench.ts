import { Bench } from 'tinybench';
import { createSignal, createManuallySignal } from '../../src/index.js';

export function createSignalBenchmarks(bench: Bench) {
  // Signal (automatic) benchmarks
  bench
    .add('Signal trigger/wait', async () => {
      const signal = createSignal();
      const waitPromise = signal.wait();
      signal.trigger();
      await waitPromise;
    })
    .add('Signal trigger reaction time', async () => {
      const signal = createSignal();
      const startTime = performance.now();
      const waitPromise = signal.wait().then(() => {
        return performance.now() - startTime;
      });
      signal.trigger();
      await waitPromise;
    })
    .add('Signal multiple waiters with trigger', async () => {
      const signal = createSignal();
      const waiters = Array.from({ length: 10 }, () => signal.wait());
      
      // Trigger for each waiter
      for (let i = 0; i < 10; i++) {
        signal.trigger();
      }
      
      await Promise.all(waiters);
    });

  // ManualSignal benchmarks
  bench
    .add('ManualSignal raise/wait', async () => {
      const signal = createManuallySignal();
      const waitPromise = signal.wait();
      signal.raise();
      await waitPromise;
      signal.drop();
    })
    .add('ManualSignal raise reaction time', async () => {
      const signal = createManuallySignal();
      const startTime = performance.now();
      const waitPromise = signal.wait().then(() => {
        return performance.now() - startTime;
      });
      signal.raise();
      await waitPromise;
      signal.drop();
    })
    .add('ManualSignal trigger/wait', async () => {
      const signal = createManuallySignal();
      const waitPromise = signal.wait();
      signal.trigger();
      await waitPromise;
    })
    .add('ManualSignal trigger reaction time', async () => {
      const signal = createManuallySignal();
      const startTime = performance.now();
      const waitPromise = signal.wait().then(() => {
        return performance.now() - startTime;
      });
      signal.trigger();
      await waitPromise;
    })
    .add('ManualSignal multiple waiters with raise', async () => {
      const signal = createManuallySignal();
      const waiters = Array.from({ length: 10 }, () => signal.wait());
      
      signal.raise(); // All waiters resolve at once
      await Promise.all(waiters);
      signal.drop();
    })
    .add('ManualSignal multiple waiters with trigger', async () => {
      const signal = createManuallySignal();
      const waiters = Array.from({ length: 10 }, () => signal.wait());
      
      // Trigger for each waiter
      for (let i = 0; i < 10; i++) {
        signal.trigger();
      }
      
      await Promise.all(waiters);
    });

  // Comparison benchmarks
  bench
    .add('Signal vs ManualSignal - single waiter (Signal)', async () => {
      const signal = createSignal();
      const waitPromise = signal.wait();
      signal.trigger();
      await waitPromise;
    })
    .add('Signal vs ManualSignal - single waiter (ManualSignal)', async () => {
      const signal = createManuallySignal();
      const waitPromise = signal.wait();
      signal.trigger();
      await waitPromise;
    })
    .add('Signal vs ManualSignal - batch waiters (Signal)', async () => {
      const signal = createSignal();
      const waiters = Array.from({ length: 5 }, () => signal.wait());
      
      for (let i = 0; i < 5; i++) {
        signal.trigger();
      }
      
      await Promise.all(waiters);
    })
    .add('Signal vs ManualSignal - batch waiters (ManualSignal)', async () => {
      const signal = createManuallySignal();
      const waiters = Array.from({ length: 5 }, () => signal.wait());
      
      signal.raise(); // All resolve at once
      await Promise.all(waiters);
      signal.drop();
    });
}
