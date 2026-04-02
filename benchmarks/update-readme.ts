#!/usr/bin/env tsx

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { selectBenchmarkSuites } from './suites/index.js';
import { formatResults } from './utils/formatter.js';
import { parseBenchmarkOptions } from './utils/options.js';
import { replaceBenchmarkResultsSection } from './utils/readme.js';
import { runBenchmarkSuites } from './run-benchmark-suites.js';

const readmePath = resolve(process.cwd(), 'README.md');

const main = async (): Promise<void> => {
  const { suiteFilters } = parseBenchmarkOptions(process.argv.slice(2));
  const selectedSuites = selectBenchmarkSuites(suiteFilters);

  if (selectedSuites.length === 0) {
    throw new Error(`No benchmark suites matched: ${suiteFilters.join(', ')}`);
  }

  console.log('Updating README benchmark results...\n');
  if (suiteFilters.length > 0) {
    console.log(
      `Selected suites: ${selectedSuites.map((suite) => suite.name).join(', ')}\n`
    );
  }

  console.log('Running benchmarks...');
  const { tasks, systemInfo } = await runBenchmarkSuites(selectedSuites);
  const formattedResults = formatResults(tasks, systemInfo, 'markdown');

  console.log('Writing README.md...');
  const currentReadme = await readFile(readmePath, 'utf8');
  const updatedReadme = replaceBenchmarkResultsSection(
    currentReadme,
    formattedResults
  );
  await writeFile(readmePath, updatedReadme, 'utf8');

  console.log('\nREADME benchmark results updated.');
};

main().catch(console.error);
