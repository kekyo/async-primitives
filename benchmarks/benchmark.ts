#!/usr/bin/env tsx

import { Bench } from 'tinybench';
import { getSystemInfo } from './utils/system-info.js';
import { formatResults } from './utils/formatter.js';
import { createDelayBenchmarks } from './suites/delay.bench.js';
import { createMutexBenchmarks } from './suites/mutex.bench.js';
import { createSemaphoreBenchmarks } from './suites/semaphore.bench.js';
import { createReaderWriterLockBenchmarks } from './suites/reader-writer-lock.bench.js';
import { createDeferredBenchmarks } from './suites/deferred.bench.js';
import { createDeferBenchmarks } from './suites/defer.bench.js';
import { createAbortHookBenchmarks } from './suites/abort-hook.bench.js';
import { createMaxConsecutiveCallsBenchmarks } from './suites/max-consecutive-calls.bench.js';
import { createConditionalBenchmarks } from './suites/conditional.bench.js';
import { createComparisonBenchmarks } from './suites/comparison.bench.js';

async function main() {
  const outputFormat = process.argv.includes('--output=json') ? 'json' : 'markdown';
  
  console.log('🚀 Starting async-primitives benchmarks...\n');

  const bench = new Bench({ time: 1000, iterations: 10 });

  // Add all benchmark suites
  createDelayBenchmarks(bench);
  createMutexBenchmarks(bench);
  createSemaphoreBenchmarks(bench);
  createReaderWriterLockBenchmarks(bench);
  createDeferredBenchmarks(bench);
  createDeferBenchmarks(bench);
  createAbortHookBenchmarks(bench);
  createMaxConsecutiveCallsBenchmarks(bench);
  createConditionalBenchmarks(bench);
  createComparisonBenchmarks(bench);

  console.log('Running benchmarks...');
  await bench.run();

  console.log('\n✅ Benchmarks completed!\n');

  const systemInfo = getSystemInfo();
  const results = formatResults(bench.tasks, systemInfo, outputFormat);
  
  console.log(results);
}

main().catch(console.error); 