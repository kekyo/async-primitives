// async-primitives - A collection of primitive functions for asynchronous operations in TypeScript/JavaScript.
// Copyright (c) Kouji Matsui. (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/async-primitives

import { getLogicalContextValue, setLogicalContextValue } from './logical-context';

/**
 * AsyncLocal instance interface
 * @template T The type of the value to store in the async context
 */
export interface AsyncLocal<T> {
  /**
   * Sets the value in the current async context
   * @param value The value to set
   */
  // eslint-disable-next-line no-unused-vars
  setValue(value: T | undefined): void;

  /**
   * Gets the current value in the async context
   * @returns The current value or undefined if not set
   */
  getValue(): T | undefined;
}

/**
 * Creates a new AsyncLocal instance
 * @template T The type of the value to store in the async context
 * @returns A new AsyncLocal instance
 */
export const createAsyncLocal = <T>(): AsyncLocal<T> => {
  const key = Symbol(`async-local-${crypto.randomUUID()}`);
  return {
    setValue: (value: T | undefined) => {
      setLogicalContextValue(key, value);
    },
    getValue: () => {
      return getLogicalContextValue<T>(key);
    }
  };
};
