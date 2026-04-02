// async-primitives - A collection of primitive functions for asynchronous operations in TypeScript/JavaScript.
// Copyright (c) Kouji Matsui. (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/async-primitives

import { AsyncOperator, AsyncOperatorSource, Awaitable } from '../types';

type AsyncIterableFactory<T> = () => AsyncIterable<T>;

const __NO_INITIAL_VALUE = Symbol('no-initial-value');

const createAsyncIterable = <T>(
  iteratorFactory: () => AsyncGenerator<T, void, unknown>
): AsyncIterable<T> => ({
  [Symbol.asyncIterator]: iteratorFactory,
});

const identity = <T>(value: T): T => value;

const sameValueZero = <T>(left: T, right: T): boolean =>
  left === right || (left !== left && right !== right);

const isAsyncIterable = <T>(
  source: AsyncOperatorSource<T>
): source is AsyncIterable<Awaitable<T>> =>
  typeof (source as AsyncIterable<Awaitable<T>>)[Symbol.asyncIterator] ===
  'function';

const toAsyncIterable = <T>(source: AsyncOperatorSource<T>): AsyncIterable<T> =>
  createAsyncIterable(async function* () {
    if (isAsyncIterable(source)) {
      for await (const value of source) {
        yield value as T;
      }
    } else {
      for (const value of source) {
        yield (await Promise.resolve(value)) as T;
      }
    }
  });

const toIntegerOrInfinity = (value: number): number => {
  if (Number.isNaN(value) || value === 0) {
    return 0;
  }
  if (!Number.isFinite(value)) {
    return value;
  }
  return Math.trunc(value);
};

const normalizeCount = (count: number): number => {
  if (Number.isNaN(count) || count <= 0) {
    return 0;
  }
  return Math.trunc(count);
};

const normalizeRequiredCount = (count: number, name: string): number => {
  if (!Number.isFinite(count) || count <= 0) {
    throw new RangeError(`${name} must be greater than 0`);
  }
  return Math.trunc(count);
};

const isNonNullish = <T>(
  value: T | null | undefined
): value is NonNullable<T> => value !== null && value !== undefined;

const compareValues = <T>(left: T, right: T): number => {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
};

const collectKeysFromSource = async <T, TKey>(
  source: AsyncOperatorSource<T>,
  selector: (value: T, index: number) => Awaitable<TKey>
): Promise<Set<TKey>> => {
  let index = 0;
  const keys = new Set<TKey>();

  for await (const value of toAsyncIterable(source)) {
    keys.add(await Promise.resolve(selector(value, index)));
    index++;
  }

  return keys;
};

const materializeValues = async <T>(
  iterableFactory: AsyncIterableFactory<T>
): Promise<T[]> => {
  const values: T[] = [];
  for await (const value of iterableFactory()) {
    values.push(value);
  }
  return values;
};

const findExtremeBy = async <T, TKey>(
  iterableFactory: AsyncIterableFactory<T>,
  selector: (value: T, index: number) => Awaitable<TKey>,
  direction: 'min' | 'max'
): Promise<T | undefined> => {
  let index = 0;
  let hasBestValue = false;
  let bestValue: T | undefined;
  let bestKey: TKey | undefined;

  for await (const value of iterableFactory()) {
    const key = await Promise.resolve(selector(value, index));
    if (
      !hasBestValue ||
      (direction === 'min'
        ? compareValues(key, bestKey as TKey) < 0
        : compareValues(key, bestKey as TKey) > 0)
    ) {
      hasBestValue = true;
      bestValue = value;
      bestKey = key;
    }
    index++;
  }

  return bestValue;
};

const createAsyncOperator = <T>(
  iterableFactory: AsyncIterableFactory<T>
): AsyncOperator<T> => {
  const reduce = (async <U>(
    ...args:
      | [(previousValue: T, currentValue: T, index: number) => Awaitable<T>]
      | [(previousValue: U, currentValue: T, index: number) => Awaitable<U>, U]
  ): Promise<T | U> => {
    const [reducer] = args;
    const hasInitialValue = args.length === 2;
    let accumulator: T | U | typeof __NO_INITIAL_VALUE = hasInitialValue
      ? args[1]
      : __NO_INITIAL_VALUE;
    let index = 0;

    for await (const value of iterableFactory()) {
      if (accumulator === __NO_INITIAL_VALUE) {
        accumulator = value;
      } else {
        accumulator = await Promise.resolve(
          (
            reducer as (
              previousValue: T | U,
              currentValue: T,
              index: number
            ) => Awaitable<T | U>
          )(accumulator, value, index)
        );
      }
      index++;
    }

    if (accumulator === __NO_INITIAL_VALUE) {
      throw new TypeError(
        'Reduce of empty AsyncOperator with no initial value'
      );
    }

    return accumulator;
  }) as AsyncOperator<T>['reduce'];

  const reduceRight = (async <U>(
    ...args:
      | [(previousValue: T, currentValue: T, index: number) => Awaitable<T>]
      | [(previousValue: U, currentValue: T, index: number) => Awaitable<U>, U]
  ): Promise<T | U> => {
    const [reducer] = args;
    const hasInitialValue = args.length === 2;
    const values = await materializeValues(iterableFactory);
    let accumulator: T | U | typeof __NO_INITIAL_VALUE = hasInitialValue
      ? args[1]
      : __NO_INITIAL_VALUE;

    for (let index = values.length - 1; index >= 0; index--) {
      const value = values[index] as T;
      if (accumulator === __NO_INITIAL_VALUE) {
        accumulator = value;
      } else {
        accumulator = await Promise.resolve(
          (
            reducer as (
              previousValue: T | U,
              currentValue: T,
              index: number
            ) => Awaitable<T | U>
          )(accumulator, value, index)
        );
      }
    }

    if (accumulator === __NO_INITIAL_VALUE) {
      throw new TypeError(
        'ReduceRight of empty AsyncOperator with no initial value'
      );
    }

    return accumulator;
  }) as AsyncOperator<T>['reduceRight'];

  const flat = ((depth?: number) =>
    createAsyncOperator(() =>
      createAsyncIterable(async function* () {
        const values = await materializeValues(iterableFactory);
        for (const value of values.flat(depth)) {
          yield value;
        }
      })
    )) as AsyncOperator<T>['flat'];

  return {
    [Symbol.asyncIterator]: () => iterableFactory()[Symbol.asyncIterator](),
    map: <U>(selector: (value: T, index: number) => Awaitable<U>) =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          let index = 0;
          for await (const value of iterableFactory()) {
            yield (await Promise.resolve(selector(value, index))) as U;
            index++;
          }
        })
      ) as AsyncOperator<U>,
    flatMap: <U>(
      selector: (value: T, index: number) => Awaitable<AsyncOperatorSource<U>>
    ) =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          let index = 0;
          for await (const value of iterableFactory()) {
            const innerSource = await Promise.resolve(selector(value, index));
            for await (const innerValue of toAsyncIterable(innerSource)) {
              yield innerValue as U;
            }
            index++;
          }
        })
      ) as AsyncOperator<U>,
    filter: (predicate: (value: T, index: number) => Awaitable<boolean>) =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          let index = 0;
          for await (const value of iterableFactory()) {
            if (await Promise.resolve(predicate(value, index))) {
              yield value as T;
            }
            index++;
          }
        })
      ) as AsyncOperator<T>,
    concat: (...sources: AsyncOperatorSource<T>[]) =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          for await (const value of iterableFactory()) {
            yield value as T;
          }

          for (const source of sources) {
            for await (const value of toAsyncIterable(source)) {
              yield value as T;
            }
          }
        })
      ) as AsyncOperator<T>,
    choose: <U>(
      selector: (value: T, index: number) => Awaitable<U | null | undefined>
    ) =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          let index = 0;
          for await (const value of iterableFactory()) {
            const selected = await Promise.resolve(selector(value, index));
            if (isNonNullish(selected)) {
              yield selected as NonNullable<U>;
            }
            index++;
          }
        })
      ) as AsyncOperator<NonNullable<U>>,
    slice: (start: number, end?: number) =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          const normalizedStart = toIntegerOrInfinity(start);
          const normalizedEnd =
            end === undefined ? undefined : toIntegerOrInfinity(end);

          if (
            normalizedStart < 0 ||
            (normalizedEnd !== undefined && normalizedEnd < 0)
          ) {
            const values = await materializeValues(iterableFactory);
            for (const value of values.slice(start, end)) {
              yield value;
            }
            return;
          }

          const startIndex = Math.max(normalizedStart, 0);
          if (startIndex === Infinity) {
            return;
          }

          const endIndex =
            normalizedEnd === undefined
              ? undefined
              : Math.max(normalizedEnd, 0);
          if (
            endIndex !== undefined &&
            endIndex !== Infinity &&
            endIndex <= startIndex
          ) {
            return;
          }

          let index = 0;
          const iterator = iterableFactory()[Symbol.asyncIterator]();

          while (true) {
            if (
              endIndex !== undefined &&
              endIndex !== Infinity &&
              index >= endIndex
            ) {
              return;
            }

            const result = await iterator.next();
            if (result.done) {
              return;
            }

            const value = result.value;
            if (index >= startIndex) {
              yield value as T;
            }
            index++;
          }
        })
      ) as AsyncOperator<T>,
    distinct: () =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          const seenValues = new Set<T>();
          for await (const value of iterableFactory()) {
            if (!seenValues.has(value)) {
              seenValues.add(value);
              yield value as T;
            }
          }
        })
      ) as AsyncOperator<T>,
    distinctBy: <TKey>(
      selector: (value: T, index: number) => Awaitable<TKey>
    ) =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          let index = 0;
          const seenKeys = new Set<TKey>();
          for await (const value of iterableFactory()) {
            const key = await Promise.resolve(selector(value, index));
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              yield value as T;
            }
            index++;
          }
        })
      ) as AsyncOperator<T>,
    skip: (count: number) =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          const normalizedCount = normalizeCount(count);
          let skippedCount = 0;
          for await (const value of iterableFactory()) {
            if (skippedCount < normalizedCount) {
              skippedCount++;
              continue;
            }
            yield value as T;
          }
        })
      ) as AsyncOperator<T>,
    skipWhile: (predicate: (value: T, index: number) => Awaitable<boolean>) =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          let index = 0;
          let skipping = true;
          for await (const value of iterableFactory()) {
            if (skipping && (await Promise.resolve(predicate(value, index)))) {
              index++;
              continue;
            }

            skipping = false;
            yield value as T;
            index++;
          }
        })
      ) as AsyncOperator<T>,
    take: (count: number) =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          const normalizedCount = normalizeCount(count);
          if (normalizedCount === 0) {
            return;
          }

          let takenCount = 0;
          for await (const value of iterableFactory()) {
            yield value as T;
            takenCount++;
            if (takenCount >= normalizedCount) {
              return;
            }
          }
        })
      ) as AsyncOperator<T>,
    takeWhile: (predicate: (value: T, index: number) => Awaitable<boolean>) =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          let index = 0;
          for await (const value of iterableFactory()) {
            if (!(await Promise.resolve(predicate(value, index)))) {
              return;
            }
            yield value as T;
            index++;
          }
        })
      ) as AsyncOperator<T>,
    pairwise: () =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          let hasPreviousValue = false;
          let previousValue: T | undefined;

          for await (const value of iterableFactory()) {
            if (hasPreviousValue) {
              yield [previousValue as T, value as T] as const;
            }
            previousValue = value;
            hasPreviousValue = true;
          }
        })
      ) as AsyncOperator<readonly [T, T]>,
    zip: <U>(source: AsyncOperatorSource<U>) =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          const otherIterator = toAsyncIterable(source)[Symbol.asyncIterator]();

          for await (const value of iterableFactory()) {
            const otherResult = await otherIterator.next();
            if (otherResult.done) {
              return;
            }

            yield [value as T, otherResult.value as U] as const;
          }
        })
      ) as AsyncOperator<readonly [T, U]>,
    scan: <U>(
      reducer: (
        previousValue: U,
        currentValue: T,
        index: number
      ) => Awaitable<U>,
      initialValue: U
    ) =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          let accumulator = initialValue;
          let index = 0;

          yield accumulator as U;

          for await (const value of iterableFactory()) {
            accumulator = (await Promise.resolve(
              reducer(accumulator, value, index)
            )) as U;
            yield accumulator as U;
            index++;
          }
        })
      ) as AsyncOperator<U>,
    union: (source: AsyncOperatorSource<T>) =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          const seenValues = new Set<T>();

          for await (const value of iterableFactory()) {
            if (!seenValues.has(value)) {
              seenValues.add(value);
              yield value as T;
            }
          }

          for await (const value of toAsyncIterable(source)) {
            if (!seenValues.has(value)) {
              seenValues.add(value);
              yield value as T;
            }
          }
        })
      ) as AsyncOperator<T>,
    unionBy: <TKey>(
      source: AsyncOperatorSource<T>,
      selector: (value: T, index: number) => Awaitable<TKey>
    ) =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          const seenKeys = new Set<TKey>();
          let index = 0;

          for await (const value of iterableFactory()) {
            const key = await Promise.resolve(selector(value, index));
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              yield value as T;
            }
            index++;
          }

          index = 0;
          for await (const value of toAsyncIterable(source)) {
            const key = await Promise.resolve(selector(value, index));
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              yield value as T;
            }
            index++;
          }
        })
      ) as AsyncOperator<T>,
    intersect: (source: AsyncOperatorSource<T>) =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          const rightValues = await collectKeysFromSource(
            source,
            (value) => value
          );
          const yieldedValues = new Set<T>();

          for await (const value of iterableFactory()) {
            if (rightValues.has(value) && !yieldedValues.has(value)) {
              yieldedValues.add(value);
              yield value as T;
            }
          }
        })
      ) as AsyncOperator<T>,
    intersectBy: <TKey>(
      source: AsyncOperatorSource<T>,
      selector: (value: T, index: number) => Awaitable<TKey>
    ) =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          const rightKeys = await collectKeysFromSource(source, selector);
          const yieldedKeys = new Set<TKey>();
          let index = 0;

          for await (const value of iterableFactory()) {
            const key = await Promise.resolve(selector(value, index));
            if (rightKeys.has(key) && !yieldedKeys.has(key)) {
              yieldedKeys.add(key);
              yield value as T;
            }
            index++;
          }
        })
      ) as AsyncOperator<T>,
    except: (source: AsyncOperatorSource<T>) =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          const excludedValues = await collectKeysFromSource(
            source,
            (value) => value
          );
          const yieldedValues = new Set<T>();

          for await (const value of iterableFactory()) {
            if (!excludedValues.has(value) && !yieldedValues.has(value)) {
              yieldedValues.add(value);
              yield value as T;
            }
          }
        })
      ) as AsyncOperator<T>,
    exceptBy: <TKey>(
      source: AsyncOperatorSource<T>,
      selector: (value: T, index: number) => Awaitable<TKey>
    ) =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          const excludedKeys = await collectKeysFromSource(source, selector);
          const yieldedKeys = new Set<TKey>();
          let index = 0;

          for await (const value of iterableFactory()) {
            const key = await Promise.resolve(selector(value, index));
            if (!excludedKeys.has(key) && !yieldedKeys.has(key)) {
              yieldedKeys.add(key);
              yield value as T;
            }
            index++;
          }
        })
      ) as AsyncOperator<T>,
    chunkBySize: (size: number) =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          const normalizedSize = normalizeRequiredCount(size, 'Chunk size');
          let chunk: T[] = [];

          for await (const value of iterableFactory()) {
            chunk.push(value);
            if (chunk.length >= normalizedSize) {
              yield chunk;
              chunk = [];
            }
          }

          if (chunk.length > 0) {
            yield chunk;
          }
        })
      ) as AsyncOperator<T[]>,
    windowed: (size: number) =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          const normalizedSize = normalizeRequiredCount(size, 'Window size');
          const window: T[] = [];

          for await (const value of iterableFactory()) {
            window.push(value);
            if (window.length < normalizedSize) {
              continue;
            }

            yield [...window];
            window.shift();
          }
        })
      ) as AsyncOperator<T[]>,
    flat,
    reverse: () =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          const values = await materializeValues(iterableFactory);
          values.reverse();

          for (const value of values) {
            yield value;
          }
        })
      ) as AsyncOperator<T>,
    toReversed: () =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          const values = await materializeValues(iterableFactory);

          for (const value of [...values].reverse()) {
            yield value;
          }
        })
      ) as AsyncOperator<T>,
    sort: (compareFn?: (left: T, right: T) => number) =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          const values = await materializeValues(iterableFactory);
          compareFn === undefined ? values.sort() : values.sort(compareFn);

          for (const value of values) {
            yield value;
          }
        })
      ) as AsyncOperator<T>,
    toSorted: (compareFn?: (left: T, right: T) => number) =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          const values = await materializeValues(iterableFactory);
          const sortedValues = [...values];
          compareFn === undefined
            ? sortedValues.sort()
            : sortedValues.sort(compareFn);

          for (const value of sortedValues) {
            yield value;
          }
        })
      ) as AsyncOperator<T>,
    forEach: async (
      action: (value: T, index: number) => Awaitable<void>
    ): Promise<void> => {
      let index = 0;
      for await (const value of iterableFactory()) {
        await Promise.resolve(action(value, index));
        index++;
      }
    },
    reduce,
    reduceRight,
    some: async (
      predicate: (value: T, index: number) => Awaitable<boolean>
    ): Promise<boolean> => {
      let index = 0;
      for await (const value of iterableFactory()) {
        if (await Promise.resolve(predicate(value, index))) {
          return true;
        }
        index++;
      }
      return false;
    },
    every: async (
      predicate: (value: T, index: number) => Awaitable<boolean>
    ): Promise<boolean> => {
      let index = 0;
      for await (const value of iterableFactory()) {
        if (!(await Promise.resolve(predicate(value, index)))) {
          return false;
        }
        index++;
      }
      return true;
    },
    find: async (
      predicate: (value: T, index: number) => Awaitable<boolean>
    ): Promise<T | undefined> => {
      let index = 0;
      for await (const value of iterableFactory()) {
        if (await Promise.resolve(predicate(value, index))) {
          return value;
        }
        index++;
      }
      return undefined;
    },
    findIndex: async (
      predicate: (value: T, index: number) => Awaitable<boolean>
    ): Promise<number> => {
      let index = 0;
      for await (const value of iterableFactory()) {
        if (await Promise.resolve(predicate(value, index))) {
          return index;
        }
        index++;
      }
      return -1;
    },
    at: async (index: number): Promise<T | undefined> => {
      const normalizedIndex = toIntegerOrInfinity(index);

      if (normalizedIndex >= 0) {
        if (normalizedIndex === Infinity) {
          return undefined;
        }

        let currentIndex = 0;
        for await (const value of iterableFactory()) {
          if (currentIndex === normalizedIndex) {
            return value;
          }
          currentIndex++;
        }
        return undefined;
      }

      if (normalizedIndex === -Infinity) {
        return undefined;
      }

      const lookback = Math.abs(normalizedIndex);
      const buffer: T[] = [];

      for await (const value of iterableFactory()) {
        buffer.push(value);
        if (buffer.length > lookback) {
          buffer.shift();
        }
      }

      return buffer.length === lookback ? buffer[0] : undefined;
    },
    includes: async (
      searchElement: T,
      fromIndex?: number
    ): Promise<boolean> => {
      const normalizedFromIndex = toIntegerOrInfinity(fromIndex ?? 0);

      if (normalizedFromIndex < 0) {
        const values = await materializeValues(iterableFactory);
        return values.includes(searchElement, normalizedFromIndex);
      }

      if (normalizedFromIndex === Infinity) {
        return false;
      }

      let index = 0;
      for await (const value of iterableFactory()) {
        if (
          index >= normalizedFromIndex &&
          sameValueZero(value, searchElement)
        ) {
          return true;
        }
        index++;
      }
      return false;
    },
    indexOf: async (searchElement: T, fromIndex?: number): Promise<number> => {
      const normalizedFromIndex = toIntegerOrInfinity(fromIndex ?? 0);

      if (normalizedFromIndex < 0) {
        const values = await materializeValues(iterableFactory);
        return values.indexOf(searchElement, normalizedFromIndex);
      }

      if (normalizedFromIndex === Infinity) {
        return -1;
      }

      let index = 0;
      for await (const value of iterableFactory()) {
        if (index >= normalizedFromIndex && value === searchElement) {
          return index;
        }
        index++;
      }
      return -1;
    },
    lastIndexOf: async (
      searchElement: T,
      fromIndex?: number
    ): Promise<number> => {
      const values = await materializeValues(iterableFactory);
      return fromIndex === undefined
        ? values.lastIndexOf(searchElement)
        : values.lastIndexOf(searchElement, fromIndex);
    },
    findLast: async (
      predicate: (value: T, index: number) => Awaitable<boolean>
    ): Promise<T | undefined> => {
      let index = 0;
      let foundValue: T | undefined;

      for await (const value of iterableFactory()) {
        if (await Promise.resolve(predicate(value, index))) {
          foundValue = value;
        }
        index++;
      }

      return foundValue;
    },
    findLastIndex: async (
      predicate: (value: T, index: number) => Awaitable<boolean>
    ): Promise<number> => {
      let index = 0;
      let foundIndex = -1;

      for await (const value of iterableFactory()) {
        if (await Promise.resolve(predicate(value, index))) {
          foundIndex = index;
        }
        index++;
      }

      return foundIndex;
    },
    min: async (): Promise<T | undefined> =>
      findExtremeBy(iterableFactory, identity, 'min'),
    minBy: async <TKey>(
      selector: (value: T, index: number) => Awaitable<TKey>
    ): Promise<T | undefined> =>
      findExtremeBy(iterableFactory, selector, 'min'),
    max: async (): Promise<T | undefined> =>
      findExtremeBy(iterableFactory, (value) => value, 'max'),
    maxBy: async <TKey>(
      selector: (value: T, index: number) => Awaitable<TKey>
    ): Promise<T | undefined> =>
      findExtremeBy(iterableFactory, selector, 'max'),
    groupBy: async <TKey>(
      selector: (value: T, index: number) => Awaitable<TKey>
    ): Promise<Map<TKey, T[]>> => {
      let index = 0;
      const groupedValues = new Map<TKey, T[]>();

      for await (const value of iterableFactory()) {
        const key = await Promise.resolve(selector(value, index));
        const existingGroup = groupedValues.get(key);
        if (existingGroup) {
          existingGroup.push(value);
        } else {
          groupedValues.set(key, [value]);
        }
        index++;
      }

      return groupedValues;
    },
    countBy: async <TKey>(
      selector: (value: T, index: number) => Awaitable<TKey>
    ): Promise<Map<TKey, number>> => {
      let index = 0;
      const counts = new Map<TKey, number>();

      for await (const value of iterableFactory()) {
        const key = await Promise.resolve(selector(value, index));
        counts.set(key, (counts.get(key) ?? 0) + 1);
        index++;
      }

      return counts;
    },
    join: async (separator?: string): Promise<string> => {
      const normalizedSeparator = separator ?? ',';
      let isFirst = true;
      let result = '';

      for await (const value of iterableFactory()) {
        if (!isFirst) {
          result += normalizedSeparator;
        }
        result += value == null ? '' : String(value);
        isFirst = false;
      }

      return result;
    },
    toArray: async (): Promise<T[]> => materializeValues(iterableFactory),
  };
};

/**
 * Creates a chainable async operator pipeline from an iterable of values or promise-like values
 * @param source - Source iterable to resolve
 * @returns A lazy async operator pipeline
 */
export const from = <T>(source: AsyncOperatorSource<T>): AsyncOperator<T> =>
  createAsyncOperator(() => toAsyncIterable(source));
