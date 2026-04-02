// async-primitives - A collection of primitive functions for asynchronous operations in TypeScript/JavaScript.
// Copyright (c) Kouji Matsui. (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/async-primitives

import { AsyncOperator, AsyncOperatorSource, Awaitable } from '../types';

type AsyncIterableFactory<T> = () => AsyncIterable<T>;

const toAsyncIterable = <T>(source: AsyncOperatorSource<T>): AsyncIterable<T> =>
  ({
    [Symbol.asyncIterator]: async function* () {
      for (const value of source) {
        yield await Promise.resolve(value);
      }
    },
  }) as AsyncIterable<T>;

const createAsyncOperator = <T>(
  iterableFactory: AsyncIterableFactory<T>
): AsyncOperator<T> => ({
  map: <U>(selector: (value: T, index: number) => Awaitable<U>) =>
    createAsyncOperator(() => ({
      [Symbol.asyncIterator]: async function* () {
        let index = 0;
        for await (const value of iterableFactory()) {
          yield await Promise.resolve(selector(value, index));
          index++;
        }
      },
    })),
  flatMap: <U>(
    selector: (value: T, index: number) => Awaitable<AsyncOperatorSource<U>>
  ) =>
    createAsyncOperator(() => ({
      [Symbol.asyncIterator]: async function* () {
        let index = 0;
        for await (const value of iterableFactory()) {
          const innerSource = await Promise.resolve(selector(value, index));
          for (const innerValue of innerSource) {
            yield await Promise.resolve(innerValue);
          }
          index++;
        }
      },
    })),
  filter: (predicate: (value: T, index: number) => Awaitable<boolean>) =>
    createAsyncOperator(() => ({
      [Symbol.asyncIterator]: async function* () {
        let index = 0;
        for await (const value of iterableFactory()) {
          if (await Promise.resolve(predicate(value, index))) {
            yield value;
          }
          index++;
        }
      },
    })),
  toArray: async () => {
    const values: T[] = [];
    for await (const value of iterableFactory()) {
      values.push(value);
    }
    return values;
  },
});

/**
 * Creates a chainable async operator pipeline from an iterable of values or promise-like values
 * @param source - Source iterable to resolve
 * @returns A lazy async operator pipeline
 */
export const from = <T>(source: AsyncOperatorSource<T>): AsyncOperator<T> =>
  createAsyncOperator(() => toAsyncIterable(source));
