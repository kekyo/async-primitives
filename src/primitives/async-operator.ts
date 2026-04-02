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

const toAsyncIterable = <T>(source: AsyncOperatorSource<T>): AsyncIterable<T> =>
  createAsyncIterable(async function* () {
    for (const value of source) {
      yield (await Promise.resolve(value)) as T;
    }
  });

const normalizeCount = (count: number): number => {
  if (Number.isNaN(count) || count <= 0) {
    return 0;
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
            for (const innerValue of innerSource) {
              yield (await Promise.resolve(innerValue)) as U;
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
          const otherIterator = source[Symbol.iterator]();

          for await (const value of iterableFactory()) {
            const otherResult = otherIterator.next();
            if (otherResult.done) {
              return;
            }

            yield [
              value as T,
              (await Promise.resolve(otherResult.value)) as U,
            ] as const;
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
    min: async (): Promise<T | undefined> =>
      findExtremeBy(iterableFactory, (value) => value, 'min'),
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
    toArray: async (): Promise<T[]> => {
      const values: T[] = [];
      for await (const value of iterableFactory()) {
        values.push(value);
      }
      return values;
    },
  };
};

/**
 * Creates a chainable async operator pipeline from an iterable of values or promise-like values
 * @param source - Source iterable to resolve
 * @returns A lazy async operator pipeline
 */
export const from = <T>(source: AsyncOperatorSource<T>): AsyncOperator<T> =>
  createAsyncOperator(() => toAsyncIterable(source));
