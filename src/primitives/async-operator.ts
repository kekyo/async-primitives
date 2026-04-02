// async-primitives - A collection of primitive functions for asynchronous operations in TypeScript/JavaScript.
// Copyright (c) Kouji Matsui. (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/async-primitives

import { AsyncOperator, AsyncOperatorSource, Awaitable } from '../types';

type SyncIterableFactory<T> = () => Iterable<Awaitable<T>>;
type AsyncIterableFactory<T> = () => AsyncIterable<T>;
type IteratorFactories<T> = {
  readonly syncFactory: SyncIterableFactory<T> | undefined;
  readonly asyncFactory: AsyncIterableFactory<T>;
};

const __NO_INITIAL_VALUE = Symbol('no-initial-value');

const createAsyncIterable = <T>(
  iteratorFactory: () => AsyncGenerator<T, void, unknown>
): AsyncIterable<T> => ({
  [Symbol.asyncIterator]: iteratorFactory,
});

const createSyncIterable = <T>(
  iteratorFactory: () => Iterator<Awaitable<T>, void, unknown>
): Iterable<Awaitable<T>> => ({
  [Symbol.iterator]: iteratorFactory,
});

const createIteratorFactories = <T>(
  source: AsyncOperatorSource<T>
): IteratorFactories<T> =>
  isAsyncIterable(source)
    ? {
        syncFactory: undefined,
        asyncFactory: () => toAsyncIterable(source),
      }
    : {
        syncFactory: () => source,
        asyncFactory: () => toAsyncIterable(source),
      };

const createAsyncOnlyFactories = <T>(
  asyncFactory: AsyncIterableFactory<T>
): IteratorFactories<T> => ({
  syncFactory: undefined,
  asyncFactory,
});

const normalizeIteratorFactories = <T>(
  iteratorFactoriesOrAsyncFactory:
    | IteratorFactories<T>
    | AsyncIterableFactory<T>
): IteratorFactories<T> =>
  typeof iteratorFactoriesOrAsyncFactory === 'function'
    ? createAsyncOnlyFactories(iteratorFactoriesOrAsyncFactory)
    : iteratorFactoriesOrAsyncFactory;

const identity = <T>(value: T): T => value;

const sameValueZero = <T>(left: T, right: T): boolean =>
  left === right || (left !== left && right !== right);

const isArraySource = <T>(
  source: AsyncOperatorSource<T>
): source is readonly Awaitable<T>[] => Array.isArray(source);

const isPromiseLike = <T>(value: Awaitable<T>): value is PromiseLike<T> =>
  ((typeof value === 'object' && value !== null) ||
    typeof value === 'function') &&
  typeof (value as PromiseLike<T>).then === 'function';

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
        yield (isPromiseLike(value) ? await value : value) as T;
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
  const { syncFactory, asyncFactory } = createIteratorFactories(source);
  let index = 0;
  const keys = new Set<TKey>();

  if (syncFactory !== undefined) {
    for (const value of syncFactory()) {
      const resolvedValue = isPromiseLike(value) ? await value : value;
      const key = selector(resolvedValue as T, index);
      keys.add(isPromiseLike(key) ? await key : key);
      index++;
    }
  } else {
    for await (const value of asyncFactory()) {
      const key = selector(value, index);
      keys.add(isPromiseLike(key) ? await key : key);
      index++;
    }
  }

  return keys;
};

const collectValuesFromSource = async <T>(
  source: AsyncOperatorSource<T>
): Promise<Set<T>> => {
  const { syncFactory, asyncFactory } = createIteratorFactories(source);
  const values = new Set<T>();

  if (syncFactory !== undefined) {
    for (const value of syncFactory()) {
      values.add((isPromiseLike(value) ? await value : value) as T);
    }
  } else {
    for await (const value of asyncFactory()) {
      values.add(value);
    }
  }

  return values;
};

const materializeValues = async <T>(
  iteratorFactories: IteratorFactories<T>
): Promise<T[]> => {
  const { syncFactory, asyncFactory } = iteratorFactories;
  const values: T[] = [];

  if (syncFactory !== undefined) {
    for (const value of syncFactory()) {
      values.push((isPromiseLike(value) ? await value : value) as T);
    }
  } else {
    for await (const value of asyncFactory()) {
      values.push(value);
    }
  }

  return values;
};

const findExtremeBy = async <T, TKey>(
  iteratorFactories: IteratorFactories<T>,
  selector: (value: T, index: number) => Awaitable<TKey>,
  direction: 'min' | 'max'
): Promise<T | undefined> => {
  const { syncFactory, asyncFactory } = iteratorFactories;
  let index = 0;
  let hasBestValue = false;
  let bestValue: T | undefined;
  let bestKey: TKey | undefined;

  if (syncFactory !== undefined) {
    for (const value of syncFactory()) {
      const resolvedValue = (isPromiseLike(value) ? await value : value) as T;
      const selectedKey = selector(resolvedValue, index);
      const key = isPromiseLike(selectedKey) ? await selectedKey : selectedKey;

      if (
        !hasBestValue ||
        (direction === 'min'
          ? compareValues(key, bestKey as TKey) < 0
          : compareValues(key, bestKey as TKey) > 0)
      ) {
        hasBestValue = true;
        bestValue = resolvedValue;
        bestKey = key;
      }
      index++;
    }
  } else {
    for await (const value of asyncFactory()) {
      const selectedKey = selector(value, index);
      const key = isPromiseLike(selectedKey) ? await selectedKey : selectedKey;

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
  }

  return bestValue;
};

const createAsyncOperator = <T>(
  iteratorFactoriesOrAsyncFactory:
    | IteratorFactories<T>
    | AsyncIterableFactory<T>
): AsyncOperator<T> => {
  const iteratorFactories = normalizeIteratorFactories(
    iteratorFactoriesOrAsyncFactory
  );
  const { syncFactory, asyncFactory } = iteratorFactories;
  const iterableFactory = asyncFactory;
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

    if (syncFactory !== undefined) {
      for (const value of syncFactory()) {
        const resolvedValue = (isPromiseLike(value) ? await value : value) as T;
        if (accumulator === __NO_INITIAL_VALUE) {
          accumulator = resolvedValue;
        } else {
          const reduced = (
            reducer as (
              previousValue: T | U,
              currentValue: T,
              index: number
            ) => Awaitable<T | U>
          )(accumulator, resolvedValue, index);
          accumulator = isPromiseLike(reduced) ? await reduced : reduced;
        }
        index++;
      }
    } else {
      for await (const value of asyncFactory()) {
        if (accumulator === __NO_INITIAL_VALUE) {
          accumulator = value;
        } else {
          const reduced = (
            reducer as (
              previousValue: T | U,
              currentValue: T,
              index: number
            ) => Awaitable<T | U>
          )(accumulator, value, index);
          accumulator = isPromiseLike(reduced) ? await reduced : reduced;
        }
        index++;
      }
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
    const values = await materializeValues(iteratorFactories);
    let accumulator: T | U | typeof __NO_INITIAL_VALUE = hasInitialValue
      ? args[1]
      : __NO_INITIAL_VALUE;

    for (let index = values.length - 1; index >= 0; index--) {
      const value = values[index] as T;
      if (accumulator === __NO_INITIAL_VALUE) {
        accumulator = value;
      } else {
        const reduced = (
          reducer as (
            previousValue: T | U,
            currentValue: T,
            index: number
          ) => Awaitable<T | U>
        )(accumulator, value, index);
        accumulator = isPromiseLike(reduced) ? await reduced : reduced;
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
    createAsyncOperator(
      createAsyncOnlyFactories(() =>
        createAsyncIterable(async function* () {
          const values = await materializeValues(iteratorFactories);
          for (const value of values.flat(depth)) {
            yield value;
          }
        })
      )
    )) as AsyncOperator<T>['flat'];

  return {
    [Symbol.asyncIterator]: () => asyncFactory()[Symbol.asyncIterator](),
    map: <U>(selector: (value: T, index: number) => Awaitable<U>) => {
      const mappedSyncFactory =
        syncFactory === undefined
          ? undefined
          : () =>
              createSyncIterable(function* () {
                let index = 0;

                for (const value of syncFactory()) {
                  const currentIndex = index;
                  if (isPromiseLike(value)) {
                    yield value.then((resolvedValue) =>
                      selector(resolvedValue as T, currentIndex)
                    ) as Awaitable<U>;
                  } else {
                    yield selector(value as T, currentIndex);
                  }
                  index++;
                }
              });

      if (mappedSyncFactory !== undefined) {
        return createAsyncOperator<U>({
          syncFactory: mappedSyncFactory,
          asyncFactory: () => toAsyncIterable(mappedSyncFactory()),
        }) as AsyncOperator<U>;
      }

      return createAsyncOperator<U>(
        createAsyncOnlyFactories(() =>
          createAsyncIterable(async function* () {
            let index = 0;
            for await (const value of iterableFactory()) {
              const selected = selector(value, index);
              yield (isPromiseLike(selected) ? await selected : selected) as U;
              index++;
            }
          })
        )
      ) as AsyncOperator<U>;
    },
    flatMap: <U>(
      selector: (value: T, index: number) => Awaitable<AsyncOperatorSource<U>>
    ) =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          let index = 0;
          if (syncFactory !== undefined) {
            const source = syncFactory();
            if (Array.isArray(source)) {
              for (
                let outerIndex = 0;
                outerIndex < source.length;
                outerIndex++
              ) {
                const value = source[outerIndex] as Awaitable<T>;
                const resolvedValue = (
                  isPromiseLike(value) ? await value : value
                ) as T;
                const selected = selector(resolvedValue, index);
                const innerSource = isPromiseLike(selected)
                  ? await selected
                  : selected;

                if (isArraySource(innerSource)) {
                  for (
                    let innerIndex = 0;
                    innerIndex < innerSource.length;
                    innerIndex++
                  ) {
                    const innerValue = innerSource[innerIndex] as Awaitable<U>;
                    yield (
                      isPromiseLike(innerValue) ? await innerValue : innerValue
                    ) as U;
                  }
                } else if (isAsyncIterable(innerSource)) {
                  for await (const innerValue of innerSource) {
                    yield innerValue as U;
                  }
                } else {
                  for (const innerValue of innerSource) {
                    yield (
                      isPromiseLike(innerValue) ? await innerValue : innerValue
                    ) as U;
                  }
                }
                index++;
              }
            } else {
              for (const value of source) {
                const resolvedValue = (
                  isPromiseLike(value) ? await value : value
                ) as T;
                const selected = selector(resolvedValue, index);
                const innerSource = isPromiseLike(selected)
                  ? await selected
                  : selected;

                if (isArraySource(innerSource)) {
                  for (
                    let innerIndex = 0;
                    innerIndex < innerSource.length;
                    innerIndex++
                  ) {
                    const innerValue = innerSource[innerIndex] as Awaitable<U>;
                    yield (
                      isPromiseLike(innerValue) ? await innerValue : innerValue
                    ) as U;
                  }
                } else if (isAsyncIterable(innerSource)) {
                  for await (const innerValue of innerSource) {
                    yield innerValue as U;
                  }
                } else {
                  for (const innerValue of innerSource) {
                    yield (
                      isPromiseLike(innerValue) ? await innerValue : innerValue
                    ) as U;
                  }
                }
                index++;
              }
            }
          } else {
            for await (const value of iterableFactory()) {
              const selected = selector(value, index);
              const innerSource = isPromiseLike(selected)
                ? await selected
                : selected;

              if (isArraySource(innerSource)) {
                for (
                  let innerIndex = 0;
                  innerIndex < innerSource.length;
                  innerIndex++
                ) {
                  const innerValue = innerSource[innerIndex] as Awaitable<U>;
                  yield (
                    isPromiseLike(innerValue) ? await innerValue : innerValue
                  ) as U;
                }
              } else if (isAsyncIterable(innerSource)) {
                for await (const innerValue of innerSource) {
                  yield innerValue as U;
                }
              } else {
                for (const innerValue of innerSource) {
                  yield (
                    isPromiseLike(innerValue) ? await innerValue : innerValue
                  ) as U;
                }
              }
              index++;
            }
          }
        })
      ) as AsyncOperator<U>,
    filter: (predicate: (value: T, index: number) => Awaitable<boolean>) =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          let index = 0;
          if (syncFactory !== undefined) {
            for (const value of syncFactory()) {
              const resolvedValue = (
                isPromiseLike(value) ? await value : value
              ) as T;
              const result = predicate(resolvedValue, index);
              if (isPromiseLike(result) ? await result : result) {
                yield resolvedValue as T;
              }
              index++;
            }
          } else {
            for await (const value of iterableFactory()) {
              const result = predicate(value, index);
              if (isPromiseLike(result) ? await result : result) {
                yield value as T;
              }
              index++;
            }
          }
        })
      ) as AsyncOperator<T>,
    concat: (...sources: AsyncOperatorSource<T>[]) => {
      const concatenatedSyncFactory =
        syncFactory !== undefined &&
        sources.every((source) => !isAsyncIterable(source))
          ? () =>
              createSyncIterable(function* () {
                for (const value of syncFactory()) {
                  yield value;
                }

                for (const source of sources as Iterable<Awaitable<T>>[]) {
                  for (const value of source) {
                    yield value;
                  }
                }
              })
          : undefined;

      if (concatenatedSyncFactory !== undefined) {
        return createAsyncOperator<T>({
          syncFactory: concatenatedSyncFactory,
          asyncFactory: () => toAsyncIterable(concatenatedSyncFactory()),
        }) as AsyncOperator<T>;
      }

      return createAsyncOperator<T>(
        createAsyncOnlyFactories(() =>
          createAsyncIterable(async function* () {
            if (syncFactory !== undefined) {
              for (const value of syncFactory()) {
                yield (isPromiseLike(value) ? await value : value) as T;
              }
            } else {
              for await (const value of iterableFactory()) {
                yield value as T;
              }
            }

            for (const source of sources) {
              if (isAsyncIterable(source)) {
                for await (const value of source) {
                  yield value as T;
                }
              } else {
                for (const value of source) {
                  yield (isPromiseLike(value) ? await value : value) as T;
                }
              }
            }
          })
        )
      ) as AsyncOperator<T>;
    },
    choose: <U>(
      selector: (value: T, index: number) => Awaitable<U | null | undefined>
    ) =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          let index = 0;
          if (syncFactory !== undefined) {
            for (const value of syncFactory()) {
              const resolvedValue = (
                isPromiseLike(value) ? await value : value
              ) as T;
              const result = selector(resolvedValue, index);
              const selected = isPromiseLike(result) ? await result : result;
              if (isNonNullish(selected)) {
                yield selected as NonNullable<U>;
              }
              index++;
            }
          } else {
            for await (const value of iterableFactory()) {
              const result = selector(value, index);
              const selected = isPromiseLike(result) ? await result : result;
              if (isNonNullish(selected)) {
                yield selected as NonNullable<U>;
              }
              index++;
            }
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
            const values = await materializeValues(iteratorFactories);
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

          if (syncFactory !== undefined) {
            const iterator = syncFactory()[Symbol.iterator]();

            while (true) {
              if (
                endIndex !== undefined &&
                endIndex !== Infinity &&
                index >= endIndex
              ) {
                return;
              }

              const result = iterator.next();
              if (result.done) {
                return;
              }

              const value = result.value;
              const resolvedValue = (
                isPromiseLike(value) ? await value : value
              ) as T;
              if (index >= startIndex) {
                yield resolvedValue as T;
              }
              index++;
            }
          } else {
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
          }
        })
      ) as AsyncOperator<T>,
    distinct: () =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          const seenValues = new Set<T>();
          if (syncFactory !== undefined) {
            for (const value of syncFactory()) {
              const resolvedValue = (
                isPromiseLike(value) ? await value : value
              ) as T;
              if (!seenValues.has(resolvedValue)) {
                seenValues.add(resolvedValue);
                yield resolvedValue as T;
              }
            }
          } else {
            for await (const value of iterableFactory()) {
              if (!seenValues.has(value)) {
                seenValues.add(value);
                yield value as T;
              }
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
          if (syncFactory !== undefined) {
            for (const value of syncFactory()) {
              const resolvedValue = (
                isPromiseLike(value) ? await value : value
              ) as T;
              const selectedKey = selector(resolvedValue, index);
              const key = isPromiseLike(selectedKey)
                ? await selectedKey
                : selectedKey;
              if (!seenKeys.has(key)) {
                seenKeys.add(key);
                yield resolvedValue as T;
              }
              index++;
            }
          } else {
            for await (const value of iterableFactory()) {
              const selectedKey = selector(value, index);
              const key = isPromiseLike(selectedKey)
                ? await selectedKey
                : selectedKey;
              if (!seenKeys.has(key)) {
                seenKeys.add(key);
                yield value as T;
              }
              index++;
            }
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
          if (syncFactory !== undefined) {
            for (const value of syncFactory()) {
              const resolvedValue = (
                isPromiseLike(value) ? await value : value
              ) as T;
              const result = predicate(resolvedValue, index);
              if (skipping && (isPromiseLike(result) ? await result : result)) {
                index++;
                continue;
              }

              skipping = false;
              yield resolvedValue as T;
              index++;
            }
          } else {
            for await (const value of iterableFactory()) {
              const result = predicate(value, index);
              if (skipping && (isPromiseLike(result) ? await result : result)) {
                index++;
                continue;
              }

              skipping = false;
              yield value as T;
              index++;
            }
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
          if (syncFactory !== undefined) {
            for (const value of syncFactory()) {
              yield (isPromiseLike(value) ? await value : value) as T;
              takenCount++;
              if (takenCount >= normalizedCount) {
                return;
              }
            }
          } else {
            for await (const value of iterableFactory()) {
              yield value as T;
              takenCount++;
              if (takenCount >= normalizedCount) {
                return;
              }
            }
          }
        })
      ) as AsyncOperator<T>,
    takeWhile: (predicate: (value: T, index: number) => Awaitable<boolean>) =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          let index = 0;
          if (syncFactory !== undefined) {
            for (const value of syncFactory()) {
              const resolvedValue = (
                isPromiseLike(value) ? await value : value
              ) as T;
              const result = predicate(resolvedValue, index);
              if (!(isPromiseLike(result) ? await result : result)) {
                return;
              }
              yield resolvedValue as T;
              index++;
            }
          } else {
            for await (const value of iterableFactory()) {
              const result = predicate(value, index);
              if (!(isPromiseLike(result) ? await result : result)) {
                return;
              }
              yield value as T;
              index++;
            }
          }
        })
      ) as AsyncOperator<T>,
    pairwise: () =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          let hasPreviousValue = false;
          let previousValue: T | undefined;

          if (syncFactory !== undefined) {
            for (const value of syncFactory()) {
              const resolvedValue = (
                isPromiseLike(value) ? await value : value
              ) as T;
              if (hasPreviousValue) {
                yield [previousValue as T, resolvedValue] as const;
              }
              previousValue = resolvedValue;
              hasPreviousValue = true;
            }
          } else {
            for await (const value of iterableFactory()) {
              if (hasPreviousValue) {
                yield [previousValue as T, value as T] as const;
              }
              previousValue = value;
              hasPreviousValue = true;
            }
          }
        })
      ) as AsyncOperator<readonly [T, T]>,
    zip: <U>(source: AsyncOperatorSource<U>) =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          if (isAsyncIterable(source)) {
            const otherIterator = source[Symbol.asyncIterator]();

            if (syncFactory !== undefined) {
              for (const value of syncFactory()) {
                const otherResult = await otherIterator.next();
                if (otherResult.done) {
                  return;
                }

                yield [
                  (isPromiseLike(value) ? await value : value) as T,
                  otherResult.value as U,
                ] as const;
              }
            } else {
              for await (const value of iterableFactory()) {
                const otherResult = await otherIterator.next();
                if (otherResult.done) {
                  return;
                }

                yield [value as T, otherResult.value as U] as const;
              }
            }
          } else {
            const otherIterator = source[Symbol.iterator]();

            if (syncFactory !== undefined) {
              for (const value of syncFactory()) {
                const otherResult = otherIterator.next();
                if (otherResult.done) {
                  return;
                }

                yield [
                  (isPromiseLike(value) ? await value : value) as T,
                  (isPromiseLike(otherResult.value)
                    ? await otherResult.value
                    : otherResult.value) as U,
                ] as const;
              }
            } else {
              for await (const value of iterableFactory()) {
                const otherResult = otherIterator.next();
                if (otherResult.done) {
                  return;
                }

                yield [
                  value as T,
                  (isPromiseLike(otherResult.value)
                    ? await otherResult.value
                    : otherResult.value) as U,
                ] as const;
              }
            }
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

          if (syncFactory !== undefined) {
            for (const value of syncFactory()) {
              const resolvedValue = (
                isPromiseLike(value) ? await value : value
              ) as T;
              const reduced = reducer(accumulator, resolvedValue, index);
              accumulator = (
                isPromiseLike(reduced) ? await reduced : reduced
              ) as U;
              yield accumulator as U;
              index++;
            }
          } else {
            for await (const value of iterableFactory()) {
              const reduced = reducer(accumulator, value, index);
              accumulator = (
                isPromiseLike(reduced) ? await reduced : reduced
              ) as U;
              yield accumulator as U;
              index++;
            }
          }
        })
      ) as AsyncOperator<U>,
    union: (source: AsyncOperatorSource<T>) =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          const seenValues = new Set<T>();

          if (syncFactory !== undefined) {
            for (const value of syncFactory()) {
              const resolvedValue = (
                isPromiseLike(value) ? await value : value
              ) as T;
              if (!seenValues.has(resolvedValue)) {
                seenValues.add(resolvedValue);
                yield resolvedValue as T;
              }
            }
          } else {
            for await (const value of iterableFactory()) {
              if (!seenValues.has(value)) {
                seenValues.add(value);
                yield value as T;
              }
            }
          }

          if (isAsyncIterable(source)) {
            for await (const value of source) {
              if (!seenValues.has(value)) {
                seenValues.add(value);
                yield value as T;
              }
            }
          } else {
            for (const value of source) {
              const resolvedValue = (
                isPromiseLike(value) ? await value : value
              ) as T;
              if (!seenValues.has(resolvedValue)) {
                seenValues.add(resolvedValue);
                yield resolvedValue as T;
              }
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

          if (syncFactory !== undefined) {
            for (const value of syncFactory()) {
              const resolvedValue = (
                isPromiseLike(value) ? await value : value
              ) as T;
              const selectedKey = selector(resolvedValue, index);
              const key = isPromiseLike(selectedKey)
                ? await selectedKey
                : selectedKey;
              if (!seenKeys.has(key)) {
                seenKeys.add(key);
                yield resolvedValue as T;
              }
              index++;
            }
          } else {
            for await (const value of iterableFactory()) {
              const selectedKey = selector(value, index);
              const key = isPromiseLike(selectedKey)
                ? await selectedKey
                : selectedKey;
              if (!seenKeys.has(key)) {
                seenKeys.add(key);
                yield value as T;
              }
              index++;
            }
          }

          index = 0;
          if (isAsyncIterable(source)) {
            for await (const value of source) {
              const selectedKey = selector(value, index);
              const key = isPromiseLike(selectedKey)
                ? await selectedKey
                : selectedKey;
              if (!seenKeys.has(key)) {
                seenKeys.add(key);
                yield value as T;
              }
              index++;
            }
          } else {
            for (const value of source) {
              const resolvedValue = (
                isPromiseLike(value) ? await value : value
              ) as T;
              const selectedKey = selector(resolvedValue, index);
              const key = isPromiseLike(selectedKey)
                ? await selectedKey
                : selectedKey;
              if (!seenKeys.has(key)) {
                seenKeys.add(key);
                yield resolvedValue as T;
              }
              index++;
            }
          }
        })
      ) as AsyncOperator<T>,
    intersect: (source: AsyncOperatorSource<T>) =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          const rightValues = await collectValuesFromSource(source);
          const yieldedValues = new Set<T>();

          if (syncFactory !== undefined) {
            for (const value of syncFactory()) {
              const resolvedValue = (
                isPromiseLike(value) ? await value : value
              ) as T;
              if (
                rightValues.has(resolvedValue) &&
                !yieldedValues.has(resolvedValue)
              ) {
                yieldedValues.add(resolvedValue);
                yield resolvedValue as T;
              }
            }
          } else {
            for await (const value of iterableFactory()) {
              if (rightValues.has(value) && !yieldedValues.has(value)) {
                yieldedValues.add(value);
                yield value as T;
              }
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

          if (syncFactory !== undefined) {
            for (const value of syncFactory()) {
              const resolvedValue = (
                isPromiseLike(value) ? await value : value
              ) as T;
              const selectedKey = selector(resolvedValue, index);
              const key = isPromiseLike(selectedKey)
                ? await selectedKey
                : selectedKey;
              if (rightKeys.has(key) && !yieldedKeys.has(key)) {
                yieldedKeys.add(key);
                yield resolvedValue as T;
              }
              index++;
            }
          } else {
            for await (const value of iterableFactory()) {
              const selectedKey = selector(value, index);
              const key = isPromiseLike(selectedKey)
                ? await selectedKey
                : selectedKey;
              if (rightKeys.has(key) && !yieldedKeys.has(key)) {
                yieldedKeys.add(key);
                yield value as T;
              }
              index++;
            }
          }
        })
      ) as AsyncOperator<T>,
    except: (source: AsyncOperatorSource<T>) =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          const excludedValues = await collectValuesFromSource(source);
          const yieldedValues = new Set<T>();

          if (syncFactory !== undefined) {
            for (const value of syncFactory()) {
              const resolvedValue = (
                isPromiseLike(value) ? await value : value
              ) as T;
              if (
                !excludedValues.has(resolvedValue) &&
                !yieldedValues.has(resolvedValue)
              ) {
                yieldedValues.add(resolvedValue);
                yield resolvedValue as T;
              }
            }
          } else {
            for await (const value of iterableFactory()) {
              if (!excludedValues.has(value) && !yieldedValues.has(value)) {
                yieldedValues.add(value);
                yield value as T;
              }
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

          if (syncFactory !== undefined) {
            for (const value of syncFactory()) {
              const resolvedValue = (
                isPromiseLike(value) ? await value : value
              ) as T;
              const selectedKey = selector(resolvedValue, index);
              const key = isPromiseLike(selectedKey)
                ? await selectedKey
                : selectedKey;
              if (!excludedKeys.has(key) && !yieldedKeys.has(key)) {
                yieldedKeys.add(key);
                yield resolvedValue as T;
              }
              index++;
            }
          } else {
            for await (const value of iterableFactory()) {
              const selectedKey = selector(value, index);
              const key = isPromiseLike(selectedKey)
                ? await selectedKey
                : selectedKey;
              if (!excludedKeys.has(key) && !yieldedKeys.has(key)) {
                yieldedKeys.add(key);
                yield value as T;
              }
              index++;
            }
          }
        })
      ) as AsyncOperator<T>,
    chunkBySize: (size: number) =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          const normalizedSize = normalizeRequiredCount(size, 'Chunk size');
          let chunk: T[] = [];

          if (syncFactory !== undefined) {
            for (const value of syncFactory()) {
              chunk.push((isPromiseLike(value) ? await value : value) as T);
              if (chunk.length >= normalizedSize) {
                yield chunk;
                chunk = [];
              }
            }
          } else {
            for await (const value of iterableFactory()) {
              chunk.push(value);
              if (chunk.length >= normalizedSize) {
                yield chunk;
                chunk = [];
              }
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
          const buffer = new Array<T>(normalizedSize);
          let count = 0;
          let nextIndex = 0;

          if (syncFactory !== undefined) {
            for (const value of syncFactory()) {
              buffer[nextIndex] = (
                isPromiseLike(value) ? await value : value
              ) as T;
              nextIndex = (nextIndex + 1) % normalizedSize;
              count = Math.min(count + 1, normalizedSize);

              if (count < normalizedSize) {
                continue;
              }

              const window = new Array<T>(normalizedSize);
              for (let index = 0; index < normalizedSize; index++) {
                window[index] = buffer[
                  (nextIndex + index) % normalizedSize
                ] as T;
              }
              yield window;
            }
          } else {
            for await (const value of iterableFactory()) {
              buffer[nextIndex] = value;
              nextIndex = (nextIndex + 1) % normalizedSize;
              count = Math.min(count + 1, normalizedSize);

              if (count < normalizedSize) {
                continue;
              }

              const window = new Array<T>(normalizedSize);
              for (let index = 0; index < normalizedSize; index++) {
                window[index] = buffer[
                  (nextIndex + index) % normalizedSize
                ] as T;
              }
              yield window;
            }
          }
        })
      ) as AsyncOperator<T[]>,
    flat,
    reverse: () =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          const values = await materializeValues(iteratorFactories);
          values.reverse();

          for (const value of values) {
            yield value;
          }
        })
      ) as AsyncOperator<T>,
    toReversed: () =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          const values = await materializeValues(iteratorFactories);

          for (const value of [...values].reverse()) {
            yield value;
          }
        })
      ) as AsyncOperator<T>,
    sort: (compareFn?: (left: T, right: T) => number) =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          const values = await materializeValues(iteratorFactories);
          compareFn === undefined ? values.sort() : values.sort(compareFn);

          for (const value of values) {
            yield value;
          }
        })
      ) as AsyncOperator<T>,
    toSorted: (compareFn?: (left: T, right: T) => number) =>
      createAsyncOperator(() =>
        createAsyncIterable(async function* () {
          const values = await materializeValues(iteratorFactories);
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

      if (syncFactory !== undefined) {
        for (const value of syncFactory()) {
          const resolvedValue = (
            isPromiseLike(value) ? await value : value
          ) as T;
          const result = action(resolvedValue, index);
          if (isPromiseLike(result)) {
            await result;
          }
          index++;
        }
      } else {
        for await (const value of iterableFactory()) {
          const result = action(value, index);
          if (isPromiseLike(result)) {
            await result;
          }
          index++;
        }
      }
    },
    reduce,
    reduceRight,
    some: async (
      predicate: (value: T, index: number) => Awaitable<boolean>
    ): Promise<boolean> => {
      let index = 0;

      if (syncFactory !== undefined) {
        for (const value of syncFactory()) {
          const resolvedValue = (
            isPromiseLike(value) ? await value : value
          ) as T;
          const result = predicate(resolvedValue, index);
          if (isPromiseLike(result) ? await result : result) {
            return true;
          }
          index++;
        }
      } else {
        for await (const value of iterableFactory()) {
          const result = predicate(value, index);
          if (isPromiseLike(result) ? await result : result) {
            return true;
          }
          index++;
        }
      }
      return false;
    },
    every: async (
      predicate: (value: T, index: number) => Awaitable<boolean>
    ): Promise<boolean> => {
      let index = 0;

      if (syncFactory !== undefined) {
        for (const value of syncFactory()) {
          const resolvedValue = (
            isPromiseLike(value) ? await value : value
          ) as T;
          const result = predicate(resolvedValue, index);
          if (!(isPromiseLike(result) ? await result : result)) {
            return false;
          }
          index++;
        }
      } else {
        for await (const value of iterableFactory()) {
          const result = predicate(value, index);
          if (!(isPromiseLike(result) ? await result : result)) {
            return false;
          }
          index++;
        }
      }
      return true;
    },
    find: async (
      predicate: (value: T, index: number) => Awaitable<boolean>
    ): Promise<T | undefined> => {
      let index = 0;

      if (syncFactory !== undefined) {
        for (const value of syncFactory()) {
          const resolvedValue = (
            isPromiseLike(value) ? await value : value
          ) as T;
          const result = predicate(resolvedValue, index);
          if (isPromiseLike(result) ? await result : result) {
            return resolvedValue;
          }
          index++;
        }
      } else {
        for await (const value of iterableFactory()) {
          const result = predicate(value, index);
          if (isPromiseLike(result) ? await result : result) {
            return value;
          }
          index++;
        }
      }
      return undefined;
    },
    findIndex: async (
      predicate: (value: T, index: number) => Awaitable<boolean>
    ): Promise<number> => {
      let index = 0;

      if (syncFactory !== undefined) {
        for (const value of syncFactory()) {
          const resolvedValue = (
            isPromiseLike(value) ? await value : value
          ) as T;
          const result = predicate(resolvedValue, index);
          if (isPromiseLike(result) ? await result : result) {
            return index;
          }
          index++;
        }
      } else {
        for await (const value of iterableFactory()) {
          const result = predicate(value, index);
          if (isPromiseLike(result) ? await result : result) {
            return index;
          }
          index++;
        }
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

        if (syncFactory !== undefined) {
          for (const value of syncFactory()) {
            const resolvedValue = (
              isPromiseLike(value) ? await value : value
            ) as T;
            if (currentIndex === normalizedIndex) {
              return resolvedValue;
            }
            currentIndex++;
          }
        } else {
          for await (const value of iterableFactory()) {
            if (currentIndex === normalizedIndex) {
              return value;
            }
            currentIndex++;
          }
        }
        return undefined;
      }

      if (normalizedIndex === -Infinity) {
        return undefined;
      }

      const lookback = Math.abs(normalizedIndex);
      const buffer = new Array<T>(lookback);
      let count = 0;
      let nextIndex = 0;

      if (syncFactory !== undefined) {
        for (const value of syncFactory()) {
          buffer[nextIndex] = (isPromiseLike(value) ? await value : value) as T;
          nextIndex = (nextIndex + 1) % lookback;
          count = Math.min(count + 1, lookback);
        }
      } else {
        for await (const value of iterableFactory()) {
          buffer[nextIndex] = value;
          nextIndex = (nextIndex + 1) % lookback;
          count = Math.min(count + 1, lookback);
        }
      }

      return count === lookback ? buffer[nextIndex] : undefined;
    },
    includes: async (
      searchElement: T,
      fromIndex?: number
    ): Promise<boolean> => {
      const normalizedFromIndex = toIntegerOrInfinity(fromIndex ?? 0);

      if (normalizedFromIndex < 0) {
        const values = await materializeValues(iteratorFactories);
        return values.includes(searchElement, normalizedFromIndex);
      }

      if (normalizedFromIndex === Infinity) {
        return false;
      }

      let index = 0;

      if (syncFactory !== undefined) {
        for (const value of syncFactory()) {
          const resolvedValue = (
            isPromiseLike(value) ? await value : value
          ) as T;
          if (
            index >= normalizedFromIndex &&
            sameValueZero(resolvedValue, searchElement)
          ) {
            return true;
          }
          index++;
        }
      } else {
        for await (const value of iterableFactory()) {
          if (
            index >= normalizedFromIndex &&
            sameValueZero(value, searchElement)
          ) {
            return true;
          }
          index++;
        }
      }
      return false;
    },
    indexOf: async (searchElement: T, fromIndex?: number): Promise<number> => {
      const normalizedFromIndex = toIntegerOrInfinity(fromIndex ?? 0);

      if (normalizedFromIndex < 0) {
        const values = await materializeValues(iteratorFactories);
        return values.indexOf(searchElement, normalizedFromIndex);
      }

      if (normalizedFromIndex === Infinity) {
        return -1;
      }

      let index = 0;

      if (syncFactory !== undefined) {
        for (const value of syncFactory()) {
          const resolvedValue = (
            isPromiseLike(value) ? await value : value
          ) as T;
          if (index >= normalizedFromIndex && resolvedValue === searchElement) {
            return index;
          }
          index++;
        }
      } else {
        for await (const value of iterableFactory()) {
          if (index >= normalizedFromIndex && value === searchElement) {
            return index;
          }
          index++;
        }
      }
      return -1;
    },
    lastIndexOf: async (
      searchElement: T,
      fromIndex?: number
    ): Promise<number> => {
      const values = await materializeValues(iteratorFactories);
      return fromIndex === undefined
        ? values.lastIndexOf(searchElement)
        : values.lastIndexOf(searchElement, fromIndex);
    },
    findLast: async (
      predicate: (value: T, index: number) => Awaitable<boolean>
    ): Promise<T | undefined> => {
      let index = 0;
      let foundValue: T | undefined;

      if (syncFactory !== undefined) {
        for (const value of syncFactory()) {
          const resolvedValue = (
            isPromiseLike(value) ? await value : value
          ) as T;
          const result = predicate(resolvedValue, index);
          if (isPromiseLike(result) ? await result : result) {
            foundValue = resolvedValue;
          }
          index++;
        }
      } else {
        for await (const value of iterableFactory()) {
          const result = predicate(value, index);
          if (isPromiseLike(result) ? await result : result) {
            foundValue = value;
          }
          index++;
        }
      }

      return foundValue;
    },
    findLastIndex: async (
      predicate: (value: T, index: number) => Awaitable<boolean>
    ): Promise<number> => {
      let index = 0;
      let foundIndex = -1;

      if (syncFactory !== undefined) {
        for (const value of syncFactory()) {
          const resolvedValue = (
            isPromiseLike(value) ? await value : value
          ) as T;
          const result = predicate(resolvedValue, index);
          if (isPromiseLike(result) ? await result : result) {
            foundIndex = index;
          }
          index++;
        }
      } else {
        for await (const value of iterableFactory()) {
          const result = predicate(value, index);
          if (isPromiseLike(result) ? await result : result) {
            foundIndex = index;
          }
          index++;
        }
      }

      return foundIndex;
    },
    min: async (): Promise<T | undefined> =>
      findExtremeBy(iteratorFactories, identity, 'min'),
    minBy: async <TKey>(
      selector: (value: T, index: number) => Awaitable<TKey>
    ): Promise<T | undefined> =>
      findExtremeBy(iteratorFactories, selector, 'min'),
    max: async (): Promise<T | undefined> =>
      findExtremeBy(iteratorFactories, (value) => value, 'max'),
    maxBy: async <TKey>(
      selector: (value: T, index: number) => Awaitable<TKey>
    ): Promise<T | undefined> =>
      findExtremeBy(iteratorFactories, selector, 'max'),
    groupBy: async <TKey>(
      selector: (value: T, index: number) => Awaitable<TKey>
    ): Promise<Map<TKey, T[]>> => {
      let index = 0;
      const groupedValues = new Map<TKey, T[]>();

      if (syncFactory !== undefined) {
        for (const value of syncFactory()) {
          const resolvedValue = (
            isPromiseLike(value) ? await value : value
          ) as T;
          const selectedKey = selector(resolvedValue, index);
          const key = isPromiseLike(selectedKey)
            ? await selectedKey
            : selectedKey;
          const existingGroup = groupedValues.get(key);
          if (existingGroup) {
            existingGroup.push(resolvedValue);
          } else {
            groupedValues.set(key, [resolvedValue]);
          }
          index++;
        }
      } else {
        for await (const value of iterableFactory()) {
          const selectedKey = selector(value, index);
          const key = isPromiseLike(selectedKey)
            ? await selectedKey
            : selectedKey;
          const existingGroup = groupedValues.get(key);
          if (existingGroup) {
            existingGroup.push(value);
          } else {
            groupedValues.set(key, [value]);
          }
          index++;
        }
      }

      return groupedValues;
    },
    countBy: async <TKey>(
      selector: (value: T, index: number) => Awaitable<TKey>
    ): Promise<Map<TKey, number>> => {
      let index = 0;
      const counts = new Map<TKey, number>();

      if (syncFactory !== undefined) {
        for (const value of syncFactory()) {
          const resolvedValue = (
            isPromiseLike(value) ? await value : value
          ) as T;
          const selectedKey = selector(resolvedValue, index);
          const key = isPromiseLike(selectedKey)
            ? await selectedKey
            : selectedKey;
          counts.set(key, (counts.get(key) ?? 0) + 1);
          index++;
        }
      } else {
        for await (const value of iterableFactory()) {
          const selectedKey = selector(value, index);
          const key = isPromiseLike(selectedKey)
            ? await selectedKey
            : selectedKey;
          counts.set(key, (counts.get(key) ?? 0) + 1);
          index++;
        }
      }

      return counts;
    },
    join: async (separator?: string): Promise<string> => {
      const normalizedSeparator = separator ?? ',';
      let isFirst = true;
      let result = '';

      if (syncFactory !== undefined) {
        for (const value of syncFactory()) {
          const resolvedValue = (
            isPromiseLike(value) ? await value : value
          ) as T;
          if (!isFirst) {
            result += normalizedSeparator;
          }
          result += resolvedValue == null ? '' : String(resolvedValue);
          isFirst = false;
        }
      } else {
        for await (const value of iterableFactory()) {
          if (!isFirst) {
            result += normalizedSeparator;
          }
          result += value == null ? '' : String(value);
          isFirst = false;
        }
      }

      return result;
    },
    toArray: async (): Promise<T[]> => materializeValues(iteratorFactories),
  };
};

/**
 * Creates a chainable async operator pipeline from an iterable of values or promise-like values
 * @param source - Source iterable to resolve
 * @returns A lazy async operator pipeline
 */
export const from = <T>(source: AsyncOperatorSource<T>): AsyncOperator<T> =>
  createAsyncOperator(createIteratorFactories(source));
