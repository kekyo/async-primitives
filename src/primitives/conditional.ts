// async-primitives - A collection of primitive functions for asynchronous operations in TypeScript/JavaScript.
// Copyright (c) Kouji Matsui. (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/async-primitives

import {
  Deferred,
  ManuallyConditional,
  Conditional,
  LockHandle,
  Waiter,
} from '../types';
import { onAbort } from './abort-hook';
import { createDeferred } from './deferred';
import { __NOOP_HANDLER } from './internal/utils';

const __NOOP_DUMMY_HANDLE: LockHandle = {
  get isActive() {
    return false;
  },
  release: __NOOP_HANDLER,
  [Symbol.dispose]: __NOOP_HANDLER,
} as const;

/**
 * Creates a conditional that can be automatically triggered
 * @returns A conditional that can be automatically triggered
 */
export const createConditional = (): Conditional => {
  const waiters: Deferred<void>[] = [];

  const trigger = () => {
    if (waiters.length >= 1) {
      waiters.shift()!.resolve();
    }
  };

  const wait = async (signal?: AbortSignal) => {
    if (signal?.aborted) {
      throw new Error('Conditional aborted');
    }
    const waiter = createDeferred<void>();
    waiters.push(waiter);
    const disposer = onAbort(signal, () => {
      waiters.splice(waiters.indexOf(waiter), 1);
      waiter.reject(new Error('Conditional aborted'));
    });
    try {
      await waiter.promise;
    } finally {
      disposer.release();
    }
    return __NOOP_DUMMY_HANDLE;
  };

  const result: Conditional = {
    trigger,
    wait,
    waiter: {
      wait,
    },
  };

  return result;
};

/**
 * Creates a conditional that can be manually set and reset
 * @param initialState - Optional initial state of the conditional (Default: false, dropped)
 * @returns A conditional that can be manually set and reset
 */
export const createManuallyConditional = (
  initialState?: boolean
): ManuallyConditional => {
  const waiters: Deferred<void>[] = [];
  let raised = initialState ?? false;

  const trigger = () => {
    raised = false;
    const waiter = waiters.shift();
    if (waiter) {
      waiter.resolve();
      raised = false;
    }
  };

  const raise = () => {
    while (waiters.length >= 1) {
      raised = true;
      waiters.shift()!.resolve();
    }
    raised = true;
  };

  const drop = () => {
    raised = false;
  };

  const wait = async (signal?: AbortSignal) => {
    if (raised) {
      return __NOOP_DUMMY_HANDLE;
    }
    if (signal?.aborted) {
      throw new Error('Conditional aborted');
    }
    const waiter = createDeferred<void>();
    waiters.push(waiter);
    const disposer = onAbort(signal, () => {
      waiters.splice(waiters.indexOf(waiter), 1);
      waiter.reject(new Error('Conditional aborted'));
    });
    try {
      await waiter.promise;
    } finally {
      disposer.release();
    }
    return __NOOP_DUMMY_HANDLE;
  };

  const result: ManuallyConditional = {
    trigger,
    raise,
    drop,
    wait,
    waiter: {
      wait,
    },
  };

  return result;
};
