import { Bench } from 'tinybench';
import { createDelayBenchmarks } from './delay.bench.js';
import { createMutexBenchmarks } from './mutex.bench.js';
import { createSemaphoreBenchmarks } from './semaphore.bench.js';
import { createReaderWriterLockBenchmarks } from './reader-writer-lock.bench.js';
import { createDeferredBenchmarks } from './deferred.bench.js';
import { createDeferBenchmarks } from './defer.bench.js';
import { createAbortHookBenchmarks } from './abort-hook.bench.js';
import { createMaxConsecutiveCallsBenchmarks } from './max-consecutive-calls.bench.js';
import { createConditionalBenchmarks } from './conditional.bench.js';
import { createComparisonBenchmarks } from './comparison.bench.js';
import { createAsyncOperatorBenchmarks } from './async-operator.bench.js';

export interface BenchmarkSuite {
  name: string;
  register: (bench: Bench) => void;
}

export const benchmarkSuites: readonly BenchmarkSuite[] = [
  { name: 'delay', register: createDelayBenchmarks },
  { name: 'mutex', register: createMutexBenchmarks },
  { name: 'semaphore', register: createSemaphoreBenchmarks },
  { name: 'reader-writer-lock', register: createReaderWriterLockBenchmarks },
  { name: 'deferred', register: createDeferredBenchmarks },
  { name: 'defer', register: createDeferBenchmarks },
  { name: 'abort-hook', register: createAbortHookBenchmarks },
  {
    name: 'max-consecutive-calls',
    register: createMaxConsecutiveCallsBenchmarks,
  },
  { name: 'conditional', register: createConditionalBenchmarks },
  { name: 'comparison', register: createComparisonBenchmarks },
  { name: 'async-operator', register: createAsyncOperatorBenchmarks },
];

export const selectBenchmarkSuites = (
  suiteFilters: readonly string[]
): readonly BenchmarkSuite[] => {
  if (suiteFilters.length === 0) {
    return benchmarkSuites;
  }

  const normalizedFilters = suiteFilters.map((suiteFilter) =>
    suiteFilter.toLowerCase()
  );
  const exactMatchFilters = new Set(
    normalizedFilters.filter((suiteFilter) =>
      benchmarkSuites.some((suite) => suite.name.toLowerCase() === suiteFilter)
    )
  );

  return benchmarkSuites.filter((suite) =>
    normalizedFilters.some((suiteFilter) => {
      const normalizedName = suite.name.toLowerCase();
      return exactMatchFilters.has(suiteFilter)
        ? normalizedName === suiteFilter
        : normalizedName.includes(suiteFilter);
    })
  );
};
