#!/usr/bin/env tsx

import { formatResults } from './utils/formatter.js';
import { selectBenchmarkSuites } from './suites/index.js';
import { parseBenchmarkOptions } from './utils/options.js';
import { runBenchmarkSuites } from './run-benchmark-suites.js';

const main = async (): Promise<void> => {
  const { outputFormat, suiteFilters } = parseBenchmarkOptions(
    process.argv.slice(2)
  );
  const selectedSuites = selectBenchmarkSuites(suiteFilters);

  if (selectedSuites.length === 0) {
    throw new Error(`No benchmark suites matched: ${suiteFilters.join(', ')}`);
  }

  const logProgress =
    outputFormat === 'markdown'
      ? (message: string): void => console.log(message)
      : (message: string): void => console.error(message);

  logProgress('🚀 Starting async-primitives benchmarks...\n');
  if (suiteFilters.length > 0) {
    logProgress(
      `Selected suites: ${selectedSuites.map((suite) => suite.name).join(', ')}\n`
    );
  }

  logProgress('Running benchmarks...');
  const { tasks, systemInfo } = await runBenchmarkSuites(selectedSuites);
  logProgress('\n✅ Benchmarks completed!\n');

  const results = formatResults(tasks, systemInfo, outputFormat);
  console.log(results);
};

main().catch(console.error);
