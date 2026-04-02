/**
 * Marker that begins the generated benchmark results block in README.md.
 */
export const benchmarkResultsStartMarker = '<!-- benchmark-results:start -->';

/**
 * Marker that ends the generated benchmark results block in README.md.
 */
export const benchmarkResultsEndMarker = '<!-- benchmark-results:end -->';

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Replaces the generated benchmark results block in README.md.
 *
 * @param readme Current README.md content.
 * @param benchmarkResults Markdown table and environment summary to insert.
 * @returns Updated README.md content.
 */
export const replaceBenchmarkResultsSection = (
  readme: string,
  benchmarkResults: string
): string => {
  const sectionPattern = new RegExp(
    `${escapeRegExp(benchmarkResultsStartMarker)}\\n[\\s\\S]*?\\n${escapeRegExp(benchmarkResultsEndMarker)}`
  );

  if (!sectionPattern.test(readme)) {
    throw new Error(
      `README benchmark markers were not found: ${benchmarkResultsStartMarker} ... ${benchmarkResultsEndMarker}`
    );
  }

  return readme.replace(
    sectionPattern,
    () =>
      `${benchmarkResultsStartMarker}\n${benchmarkResults}\n${benchmarkResultsEndMarker}`
  );
};
