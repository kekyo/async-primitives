// async-primitives - A collection of primitive functions for asynchronous operations in TypeScript/JavaScript.
// Copyright (c) Kouji Matsui. (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/async-primitives

import { Deferred } from "../types";
import { onAbort } from "./abort-hook";

/**
 * Creates a new deferred object
 * @param T - The type of the result
 * @param signal - Optional AbortSignal for cancelling the wait
 * @returns A deferred object with a promise, resolve, and reject methods
 */
export const createDeferred = <T>(signal?: AbortSignal): Deferred<T> => {
  // eslint-disable-next-line no-unused-vars
  let resolve: ((value: T) => void) | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-unused-vars
  let reject: ((error: any) => void) | undefined;

  // Allocate the promise
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  // Register the abort hook
  const disposer = onAbort(signal, () => {
    // Release the resolve and reject functions
    const _reject = reject;
    if (_reject) {
      resolve = undefined;
      reject = undefined;

      // Reject the promise with an error
      _reject(new Error("Deferred aborted"));
    }
  });

  // Return the deferred object
  return {
    // The promise that resolves to the result
    promise,
    // Resolve the promise with a result
    resolve: (value: T) => {
      const _resolve = resolve;
      if (_resolve) {
        // Release the resolve and reject functions
        resolve = undefined;
        reject = undefined;

        // Release the abort hook
        disposer.release();

        // Resolve the promise with a result
        _resolve(value);
      }
    },
    // Reject the promise with an error
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reject: (error: any) => {
      const _reject = reject;
      if (_reject) {
        // Release the resolve and reject functions
        resolve = undefined;
        reject = undefined;

        // Release the abort hook
        disposer.release();

        // Reject the promise with an error
        _reject(error);
      }
    }
  };
};
