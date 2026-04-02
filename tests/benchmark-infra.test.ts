import { describe, expect, it } from 'vitest';
import { createAsyncOperatorBenchmarks } from '../benchmarks/suites/async-operator.bench.js';
import {
  benchmarkSuites,
  selectBenchmarkSuites,
} from '../benchmarks/suites/index.js';
import { formatResults } from '../benchmarks/utils/formatter.js';
import { parseBenchmarkOptions } from '../benchmarks/utils/options.js';

type BenchmarkTask = {
  readonly name: string;
  readonly fn: () => Promise<unknown> | unknown;
};

const createBenchStub = () => {
  const tasks: BenchmarkTask[] = [];
  const bench = {
    add: (name: string, fn: BenchmarkTask['fn']) => {
      tasks.push({ name, fn });
      return bench;
    },
  };

  return { bench, tasks };
};

describe('Benchmark infrastructure', () => {
  it('should parse benchmark options', () => {
    const options = parseBenchmarkOptions([
      '--output=json',
      '--suite=async-operator',
      '--suite',
      'mutex',
    ]);

    expect(options).toEqual({
      outputFormat: 'json',
      suiteFilters: ['async-operator', 'mutex'],
    });
  });

  it('should expose and filter benchmark suites', () => {
    expect(benchmarkSuites.map((suite) => suite.name)).toContain(
      'async-operator'
    );
    expect(
      selectBenchmarkSuites(['async-operator']).map((suite) => suite.name)
    ).toEqual(['async-operator']);
    expect(
      selectBenchmarkSuites(['operator', 'mutex']).map((suite) => suite.name)
    ).toEqual(['mutex', 'async-operator']);
  });

  it('should register and execute all AsyncOperator benchmark tasks', async () => {
    const { bench, tasks } = createBenchStub();

    createAsyncOperatorBenchmarks(bench as any);

    expect(tasks).toHaveLength(57);
    expect(tasks.map((task) => task.name)).toEqual([
      '[AsyncOperator] toArray()',
      '[AsyncOperator] toArray() on AsyncIterable',
      '[AsyncOperator] map() -> toArray()',
      '[AsyncOperator] map() -> toArray() on AsyncIterable',
      '[AsyncOperator] map(async) -> toArray()',
      '[AsyncOperator] flatMap() -> toArray()',
      '[AsyncOperator] flatMap(async) -> toArray()',
      '[AsyncOperator] filter() -> toArray()',
      '[AsyncOperator] filter() -> toArray() on AsyncIterable',
      '[AsyncOperator] filter(async) -> toArray()',
      '[AsyncOperator] concat() -> toArray()',
      '[AsyncOperator] choose() -> toArray()',
      '[AsyncOperator] slice() -> toArray()',
      '[AsyncOperator] distinct() -> toArray()',
      '[AsyncOperator] distinctBy() -> toArray()',
      '[AsyncOperator] skip() -> toArray()',
      '[AsyncOperator] skipWhile() -> toArray()',
      '[AsyncOperator] take() -> toArray()',
      '[AsyncOperator] takeWhile() -> toArray()',
      '[AsyncOperator] pairwise() -> toArray()',
      '[AsyncOperator] zip() -> toArray()',
      '[AsyncOperator] scan() -> toArray()',
      '[AsyncOperator] union() -> toArray()',
      '[AsyncOperator] unionBy() -> toArray()',
      '[AsyncOperator] intersect() -> toArray()',
      '[AsyncOperator] intersectBy() -> toArray()',
      '[AsyncOperator] except() -> toArray()',
      '[AsyncOperator] exceptBy() -> toArray()',
      '[AsyncOperator] chunkBySize() -> toArray()',
      '[AsyncOperator] windowed() -> toArray()',
      '[AsyncOperator] flat() -> toArray()',
      '[AsyncOperator] reverse() -> toArray()',
      '[AsyncOperator] toReversed() -> toArray()',
      '[AsyncOperator] sort() -> toArray()',
      '[AsyncOperator] toSorted() -> toArray()',
      '[AsyncOperator] forEach()',
      '[AsyncOperator] reduce()',
      '[AsyncOperator] reduceRight()',
      '[AsyncOperator] some()',
      '[AsyncOperator] every()',
      '[AsyncOperator] find()',
      '[AsyncOperator] findIndex()',
      '[AsyncOperator] at()',
      '[AsyncOperator] includes()',
      '[AsyncOperator] indexOf()',
      '[AsyncOperator] lastIndexOf()',
      '[AsyncOperator] findLast()',
      '[AsyncOperator] findLastIndex()',
      '[AsyncOperator] min()',
      '[AsyncOperator] minBy()',
      '[AsyncOperator] max()',
      '[AsyncOperator] maxBy()',
      '[AsyncOperator] groupBy()',
      '[AsyncOperator] countBy()',
      '[AsyncOperator] join()',
      '[AsyncOperator] linear chain(depth=5) -> toArray()',
      '[AsyncOperator] linear chain(depth=5, async callbacks) -> toArray()',
    ]);

    for (const task of tasks) {
      await task.fn();
    }
  });

  it('should format tinybench time metrics as milliseconds', () => {
    const output = formatResults(
      [
        {
          name: 'example',
          result: {
            hz: 1234.4,
            mean: 1.23456,
            latency: { p50: 1.12549 },
            sd: 0.04567,
            totalTime: 2500.444,
          },
        } as any,
      ],
      {
        nodeVersion: 'v0.0.0',
        platform: 'test',
        cpu: 'cpu',
        memory: '1GB',
        timestamp: '2026-04-02T00:00:00.000Z',
      },
      'json'
    );

    expect(JSON.parse(output).results).toEqual([
      {
        name: 'example',
        opsPerSec: 1234,
        avgTime: 1.235,
        medianTime: 1.125,
        totalTime: 2500.44,
        stdDev: 0.046,
      },
    ]);
  });
});
