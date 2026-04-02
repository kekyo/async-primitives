// async-primitives - A collection of primitive functions for asynchronous operations in TypeScript/JavaScript.
// Copyright (c) Kouji Matsui. (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/async-primitives

/**
 * Defer execution of a callback to the next tick.
 * @param fn - The function to execute.
 */
type RuntimeSetImmediate = ((callback: () => void) => unknown) | undefined;

type RuntimeGlobal = typeof globalThis & {
  setImmediate?: RuntimeSetImmediate;
};

const runtimeGlobal = globalThis as RuntimeGlobal;

export const defer = (fn: () => void): void => {
  const setImmediateHandler = runtimeGlobal.setImmediate;
  if (typeof setImmediateHandler === 'function') {
    setImmediateHandler(fn);
    return;
  }

  globalThis.setTimeout(fn, 0);
};
