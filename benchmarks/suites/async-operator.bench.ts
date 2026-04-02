import { Bench } from 'tinybench';
import { from } from '../../src/index.js';

const SEQUENCE_LENGTH = 256;
const WINDOW_SIZE = 8;
const CHUNK_SIZE = 16;

const numericValues = Array.from(
  { length: SEQUENCE_LENGTH },
  (_, index) => index
);
const duplicateValues = Array.from(
  { length: SEQUENCE_LENGTH },
  (_, index) => index % 64
);
const objectValues = Array.from({ length: SEQUENCE_LENGTH }, (_, index) => ({
  id: index % 64,
  value: index,
}));
const leftUnionValues = Array.from(
  { length: SEQUENCE_LENGTH },
  (_, index) => index % 192
);
const rightUnionValues = Array.from(
  { length: SEQUENCE_LENGTH },
  (_, index) => 64 + (index % 192)
);
const leftUnionObjects = Array.from(
  { length: SEQUENCE_LENGTH },
  (_, index) => ({
    id: index % 192,
    value: index,
  })
);
const rightUnionObjects = Array.from(
  { length: SEQUENCE_LENGTH },
  (_, index) => ({
    id: 64 + (index % 192),
    value: index,
  })
);
const nestedValues = Array.from({ length: SEQUENCE_LENGTH / 2 }, (_, index) => [
  index,
  index + 1,
]);
const unsortedValues = Array.from(
  { length: SEQUENCE_LENGTH },
  (_, index) => (index * 73) % SEQUENCE_LENGTH
);
const lexicalSortValues = unsortedValues.map(
  (value) => `value-${value.toString().padStart(3, '0')}`
);

const registerTerminalArrayBenchmark = (
  bench: Bench,
  name: string,
  task: () => Promise<unknown>
) => {
  bench.add(name, async () => {
    await task();
  });
};

export const createAsyncOperatorBenchmarks = (bench: Bench) => {
  registerTerminalArrayBenchmark(bench, '[AsyncOperator] toArray()', async () =>
    from(numericValues).toArray()
  );
  registerTerminalArrayBenchmark(
    bench,
    '[AsyncOperator] map() -> toArray()',
    async () =>
      from(numericValues)
        .map((value) => value + 1)
        .toArray()
  );
  registerTerminalArrayBenchmark(
    bench,
    '[AsyncOperator] flatMap() -> toArray()',
    async () =>
      from(numericValues)
        .flatMap((value) => [value, value + 1])
        .toArray()
  );
  registerTerminalArrayBenchmark(
    bench,
    '[AsyncOperator] filter() -> toArray()',
    async () =>
      from(numericValues)
        .filter((value) => value % 2 === 0)
        .toArray()
  );
  registerTerminalArrayBenchmark(
    bench,
    '[AsyncOperator] concat() -> toArray()',
    async () =>
      from(numericValues.slice(0, SEQUENCE_LENGTH / 2))
        .concat(numericValues.slice(SEQUENCE_LENGTH / 2))
        .toArray()
  );
  registerTerminalArrayBenchmark(
    bench,
    '[AsyncOperator] choose() -> toArray()',
    async () =>
      from(numericValues)
        .choose((value) => (value % 2 === 0 ? value : undefined))
        .toArray()
  );
  registerTerminalArrayBenchmark(
    bench,
    '[AsyncOperator] slice() -> toArray()',
    async () => from(numericValues).slice(32, 160).toArray()
  );
  registerTerminalArrayBenchmark(
    bench,
    '[AsyncOperator] distinct() -> toArray()',
    async () => from(duplicateValues).distinct().toArray()
  );
  registerTerminalArrayBenchmark(
    bench,
    '[AsyncOperator] distinctBy() -> toArray()',
    async () =>
      from(objectValues)
        .distinctBy((value) => value.id)
        .toArray()
  );
  registerTerminalArrayBenchmark(
    bench,
    '[AsyncOperator] skip() -> toArray()',
    async () => from(numericValues).skip(32).toArray()
  );
  registerTerminalArrayBenchmark(
    bench,
    '[AsyncOperator] skipWhile() -> toArray()',
    async () =>
      from(numericValues)
        .skipWhile((value) => value < 128)
        .toArray()
  );
  registerTerminalArrayBenchmark(
    bench,
    '[AsyncOperator] take() -> toArray()',
    async () => from(numericValues).take(128).toArray()
  );
  registerTerminalArrayBenchmark(
    bench,
    '[AsyncOperator] takeWhile() -> toArray()',
    async () =>
      from(numericValues)
        .takeWhile((value) => value < 128)
        .toArray()
  );
  registerTerminalArrayBenchmark(
    bench,
    '[AsyncOperator] pairwise() -> toArray()',
    async () => from(numericValues).pairwise().toArray()
  );
  registerTerminalArrayBenchmark(
    bench,
    '[AsyncOperator] zip() -> toArray()',
    async () => from(numericValues).zip(numericValues).toArray()
  );
  registerTerminalArrayBenchmark(
    bench,
    '[AsyncOperator] scan() -> toArray()',
    async () =>
      from(numericValues)
        .scan((state, value) => state + value, 0)
        .toArray()
  );
  registerTerminalArrayBenchmark(
    bench,
    '[AsyncOperator] union() -> toArray()',
    async () => from(leftUnionValues).union(rightUnionValues).toArray()
  );
  registerTerminalArrayBenchmark(
    bench,
    '[AsyncOperator] unionBy() -> toArray()',
    async () =>
      from(leftUnionObjects)
        .unionBy(rightUnionObjects, (value) => value.id)
        .toArray()
  );
  registerTerminalArrayBenchmark(
    bench,
    '[AsyncOperator] intersect() -> toArray()',
    async () => from(leftUnionValues).intersect(rightUnionValues).toArray()
  );
  registerTerminalArrayBenchmark(
    bench,
    '[AsyncOperator] intersectBy() -> toArray()',
    async () =>
      from(leftUnionObjects)
        .intersectBy(rightUnionObjects, (value) => value.id)
        .toArray()
  );
  registerTerminalArrayBenchmark(
    bench,
    '[AsyncOperator] except() -> toArray()',
    async () => from(leftUnionValues).except(rightUnionValues).toArray()
  );
  registerTerminalArrayBenchmark(
    bench,
    '[AsyncOperator] exceptBy() -> toArray()',
    async () =>
      from(leftUnionObjects)
        .exceptBy(rightUnionObjects, (value) => value.id)
        .toArray()
  );
  registerTerminalArrayBenchmark(
    bench,
    '[AsyncOperator] chunkBySize() -> toArray()',
    async () => from(numericValues).chunkBySize(CHUNK_SIZE).toArray()
  );
  registerTerminalArrayBenchmark(
    bench,
    '[AsyncOperator] windowed() -> toArray()',
    async () => from(numericValues).windowed(WINDOW_SIZE).toArray()
  );
  registerTerminalArrayBenchmark(
    bench,
    '[AsyncOperator] flat() -> toArray()',
    async () => from(nestedValues).flat().toArray()
  );
  registerTerminalArrayBenchmark(
    bench,
    '[AsyncOperator] reverse() -> toArray()',
    async () => from(numericValues).reverse().toArray()
  );
  registerTerminalArrayBenchmark(
    bench,
    '[AsyncOperator] toReversed() -> toArray()',
    async () => from(numericValues).toReversed().toArray()
  );
  registerTerminalArrayBenchmark(
    bench,
    '[AsyncOperator] sort() -> toArray()',
    async () => from(lexicalSortValues).sort().toArray()
  );
  registerTerminalArrayBenchmark(
    bench,
    '[AsyncOperator] toSorted() -> toArray()',
    async () =>
      from(unsortedValues)
        .toSorted((left, right) => left - right)
        .toArray()
  );

  bench.add('[AsyncOperator] forEach()', async () => {
    let sum = 0;
    await from(numericValues).forEach((value) => {
      sum += value;
    });
    return sum;
  });
  bench.add('[AsyncOperator] reduce()', async () =>
    from(numericValues).reduce((state, value) => state + value, 0)
  );
  bench.add('[AsyncOperator] reduceRight()', async () =>
    from(numericValues).reduceRight((state, value) => state + value, 0)
  );
  bench.add('[AsyncOperator] some()', async () =>
    from(numericValues).some((value) => value === SEQUENCE_LENGTH - 1)
  );
  bench.add('[AsyncOperator] every()', async () =>
    from(numericValues).every((value) => value < SEQUENCE_LENGTH)
  );
  bench.add('[AsyncOperator] find()', async () =>
    from(numericValues).find((value) => value === SEQUENCE_LENGTH - 1)
  );
  bench.add('[AsyncOperator] findIndex()', async () =>
    from(numericValues).findIndex((value) => value === SEQUENCE_LENGTH - 1)
  );
  bench.add('[AsyncOperator] at()', async () =>
    from(numericValues).at(SEQUENCE_LENGTH / 2)
  );
  bench.add('[AsyncOperator] includes()', async () =>
    from(numericValues).includes(SEQUENCE_LENGTH - 1)
  );
  bench.add('[AsyncOperator] indexOf()', async () =>
    from(numericValues).indexOf(SEQUENCE_LENGTH - 1)
  );
  bench.add('[AsyncOperator] lastIndexOf()', async () =>
    from(duplicateValues).lastIndexOf(
      duplicateValues[duplicateValues.length - 1]!
    )
  );
  bench.add('[AsyncOperator] findLast()', async () =>
    from(numericValues).findLast((value) => value % 2 === 0)
  );
  bench.add('[AsyncOperator] findLastIndex()', async () =>
    from(numericValues).findLastIndex((value) => value % 2 === 0)
  );
  bench.add('[AsyncOperator] min()', async () => from(unsortedValues).min());
  bench.add('[AsyncOperator] minBy()', async () =>
    from(objectValues).minBy((value) => value.id)
  );
  bench.add('[AsyncOperator] max()', async () => from(unsortedValues).max());
  bench.add('[AsyncOperator] maxBy()', async () =>
    from(objectValues).maxBy((value) => value.id)
  );
  bench.add('[AsyncOperator] groupBy()', async () =>
    from(objectValues).groupBy((value) => value.id)
  );
  bench.add('[AsyncOperator] countBy()', async () =>
    from(objectValues).countBy((value) => value.id)
  );
  bench.add('[AsyncOperator] join()', async () =>
    from(duplicateValues).join(',')
  );
};
