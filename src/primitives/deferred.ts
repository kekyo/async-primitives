/**
 * Deferred implementation for promise-based result handling
 */

import { Deferred } from "../types";

/**
 * Creates a new deferred object
 * @param T - The type of the result
 * @returns A deferred object with a promise, resolve, and reject methods
 */
export const createDeferred = <T>(): Deferred<T> => {
  // eslint-disable-next-line no-unused-vars
  let resolve: (value: T) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-unused-vars
  let reject: (error: any) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  };
}
