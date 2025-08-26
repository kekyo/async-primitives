// async-primitives - A collection of primitive functions for asynchronous operations in TypeScript/JavaScript.
// Copyright (c) Kouji Matsui. (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/async-primitives

import { Deferred, ManuallyConditional, Conditional } from "../types";
import { onAbort } from "./abort-hook";
import { createDeferred } from "./deferred";

/**
 * Creates a conditional that can be automatically triggered
 * @returns A conditional that can be automatically triggered
 */
export const createConditional = (): Conditional => {
  const waiters: Deferred<void>[] = [];
  return {
    trigger: () => {
      if (waiters.length >= 1) {
        waiters.shift()!.resolve();
      }
    },
    wait: async (signal?: AbortSignal) => {
      if (signal?.aborted) {
        throw new Error("Conditional aborted");
      }
      const waiter = createDeferred<void>();
      waiters.push(waiter);
      const disposer = onAbort(signal, () => {
        waiters.splice(waiters.indexOf(waiter), 1);
        waiter.reject(new Error("Conditional aborted"));
      });
      try {
        await waiter.promise;
      } finally {
        disposer.release();
      }
    },
  };
};

/**
 * Creates a conditional that can be manually set and reset
 * @param initialState - Optional initial state of the conditional (Default: false, dropped)
 * @returns A conditional that can be manually set and reset
 */
export const createManuallyConditional = (initialState?: boolean): ManuallyConditional => {
  const waiters: Deferred<void>[] = [];
  let raised = initialState ?? false;
  return {
    trigger: () => {
      raised = false;
      const waiter = waiters.shift();
      if (waiter) {
        waiter.resolve();
        raised = false;
      }
    },
    raise: () => {
      while (waiters.length >= 1) {
        raised = true;
        waiters.shift()!.resolve();
      }
      raised = true;
    },
    drop: () => {
      raised = false;
    },
    wait: async (signal?: AbortSignal) => {
      if (raised) {
        return;
      }
      if (signal?.aborted) {
        throw new Error("Conditional aborted");
      }
      const waiter = createDeferred<void>();
      waiters.push(waiter);
      const disposer = onAbort(signal, () => {
        waiters.splice(waiters.indexOf(waiter), 1);
        waiter.reject(new Error("Conditional aborted"));
      });
      try {
        await waiter.promise;
      } finally {
        disposer.release();
      }
    },
  };
};
