#!/usr/bin/env tsx

import { Bench } from 'tinybench';
import { getSystemInfo } from './utils/system-info.js';
import { formatResults } from './utils/formatter.js';
import { selectBenchmarkSuites } from './suites/index.js';
import { parseBenchmarkOptions } from './utils/options.js';

async function main() {
  const { outputFormat, suiteFilters } = parseBenchmarkOptions(
    process.argv.slice(2)
  );
  const selectedSuites = selectBenchmarkSuites(suiteFilters);

  if (selectedSuites.length === 0) {
    throw new Error(`No benchmark suites matched: ${suiteFilters.join(', ')}`);
  }

  console.log('🚀 Starting async-primitives benchmarks...\n');
  if (suiteFilters.length > 0) {
    console.log(
      `Selected suites: ${selectedSuites.map((suite) => suite.name).join(', ')}\n`
    );
  }

  const bench = new Bench({ time: 1000, iterations: 10 });

  // Add selected benchmark suites
  for (const suite of selectedSuites) {
    suite.register(bench);
  }

  console.log('Running benchmarks...');
  await bench.run();

  console.log('\n✅ Benchmarks completed!\n');

  const systemInfo = getSystemInfo();
  const results = formatResults(bench.tasks, systemInfo, outputFormat);

  console.log(results);
}

main().catch(console.error);
