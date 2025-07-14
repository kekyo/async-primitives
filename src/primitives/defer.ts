// async-primitives - A collection of primitive functions for asynchronous operations in TypeScript/JavaScript.
// Copyright (c) Kouji Matsui. (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/async-primitives

/**
 * Defer execution of a callback to the next tick.
 * @param fn - The function to execute.
 */
export const defer = (fn: () => void): void => {
  if (typeof setImmediate === 'function') {
    setImmediate(fn);
  } else {
    setTimeout(fn, 0);
  }
};
