import { Bench, Task } from 'tinybench';
import { BenchmarkSuite } from './suites/index.js';
import { SystemInfo, getSystemInfo } from './utils/system-info.js';

/**
 * Benchmark execution result.
 *
 * @remarks
 * The returned tasks include the measured `tinybench` task objects after execution.
 */
export interface BenchmarkExecutionResult {
  readonly tasks: readonly Task[];
  readonly systemInfo: SystemInfo;
}

/**
 * Runs the selected benchmark suites and returns the measured tasks and system information.
 *
 * @param selectedSuites Benchmark suites to execute.
 * @returns Executed tasks and environment metadata.
 */
export const runBenchmarkSuites = async (
  selectedSuites: readonly BenchmarkSuite[]
): Promise<BenchmarkExecutionResult> => {
  if (selectedSuites.length === 0) {
    throw new Error('No benchmark suites matched the provided filters.');
  }

  const bench = new Bench({ time: 1000, iterations: 10 });

  for (const suite of selectedSuites) {
    suite.register(bench);
  }

  await bench.run();

  return {
    tasks: [...bench.tasks],
    systemInfo: getSystemInfo(),
  };
};
