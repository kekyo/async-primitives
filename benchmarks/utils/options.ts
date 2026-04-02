export interface BenchmarkOptions {
  outputFormat: 'markdown' | 'json';
  suiteFilters: string[];
}

export const parseBenchmarkOptions = (
  argv: readonly string[]
): BenchmarkOptions => {
  const suiteFilters: string[] = [];
  let outputFormat: 'markdown' | 'json' = 'markdown';

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index]!;

    if (argument === '--output=json') {
      outputFormat = 'json';
      continue;
    }

    if (argument.startsWith('--suite=')) {
      const suiteFilter = argument.slice('--suite='.length).trim();
      if (suiteFilter.length > 0) {
        suiteFilters.push(suiteFilter);
      }
      continue;
    }

    if (argument === '--suite') {
      const suiteFilter = argv[index + 1]?.trim();
      if (suiteFilter !== undefined && suiteFilter.length > 0) {
        suiteFilters.push(suiteFilter);
        index++;
      }
    }
  }

  return { outputFormat, suiteFilters };
};
