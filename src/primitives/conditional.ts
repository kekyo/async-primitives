// async-primitives - A collection of primitive functions for asynchronous operations in TypeScript/JavaScript.
// Copyright (c) Kouji Matsui. (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/async-primitives

import {
  Deferred,
  ManuallyConditional,
  Conditional,
  LockHandle,
  PrepareWaitResult,
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

  // Internal method for atomic operations
  const prepareWait = (
    signal?: AbortSignal
  ): { execute: () => Promise<LockHandle>; cleanup: () => void } | null => {
    // Check if already aborted
    if (signal?.aborted) {
      return null;
    }

    // Pre-create Deferred and add to queue
    const waiter = createDeferred<void>();
    waiters.push(waiter);

    // Pre-register abort handler
    const disposer = onAbort(signal, () => {
      waiters.splice(waiters.indexOf(waiter), 1);
      waiter.reject(new Error('Conditional aborted'));
    });

    // Execute phase: return the prepared Promise
    const execute = () =>
      waiter.promise
        .then(() => __NOOP_DUMMY_HANDLE)
        .finally(() => disposer.release());

    // Cleanup: cancel the preparation
    const cleanup = () => {
      const index = waiters.indexOf(waiter);
      if (index !== -1) {
        waiters.splice(index, 1);
      }
      disposer.release();
    };

    return { execute, cleanup };
  };

  const triggerAndWait = async (
    waiter: Waiter,
    signal?: AbortSignal
  ): Promise<LockHandle> => {
    // Check if the operation was aborted before starting
    if (signal?.aborted) {
      throw new Error('triggerAndWait aborted');
    }

    // Phase 1: Prepare trigger - identify waiter but don't resolve yet
    const waiterToResolve = waiters.shift();

    // Phase 2: Prepare the target wait
    const targetPrepare = waiter.prepareWait(signal);

    // Phase 3: Error handling
    if (!targetPrepare) {
      // prepareWait not supported or error occurred
      // Restore the waiter
      if (waiterToResolve) {
        waiters.unshift(waiterToResolve);
      }

      // Fallback: non-atomic sequential execution
      // Log warning that atomicity is not guaranteed
      if (waiterToResolve) {
        waiterToResolve.resolve();
      }
      return waiter.wait(signal);
    }

    try {
      // Phase 4: Atomic execution - commit both state changes
      if (waiterToResolve) {
        waiterToResolve.resolve();
      }

      // Phase 5: Execute the prepared wait
      return await targetPrepare.execute();
    } catch (error) {
      // Cleanup on error
      targetPrepare.cleanup();
      throw error;
    }
  };

  const result: Conditional = {
    trigger,
    wait: wait as any,
    triggerAndWait,
    waiter: {
      wait,
      prepareWait,
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

  // Internal method for atomic operations
  const prepareWait = (
    signal?: AbortSignal
  ): { execute: () => Promise<LockHandle>; cleanup: () => void } | null => {
    // If already raised, prepare immediate resolution
    if (raised) {
      return {
        execute: () => Promise.resolve(__NOOP_DUMMY_HANDLE),
        cleanup: () => {}, // Nothing to cleanup
      };
    }

    // Check if already aborted
    if (signal?.aborted) {
      return null;
    }

    // Same as regular Conditional from here
    const waiter = createDeferred<void>();
    waiters.push(waiter);

    const disposer = onAbort(signal, () => {
      waiters.splice(waiters.indexOf(waiter), 1);
      waiter.reject(new Error('Conditional aborted'));
    });

    const execute = () =>
      waiter.promise
        .then(() => __NOOP_DUMMY_HANDLE)
        .finally(() => disposer.release());

    const cleanup = () => {
      const index = waiters.indexOf(waiter);
      if (index !== -1) {
        waiters.splice(index, 1);
      }
      disposer.release();
    };

    return { execute, cleanup };
  };

  const triggerAndWait = async (
    waiter: Waiter,
    signal?: AbortSignal
  ): Promise<LockHandle> => {
    // Check if the operation was aborted before starting
    if (signal?.aborted) {
      throw new Error('triggerAndWait aborted');
    }

    // Phase 1: Prepare trigger - identify waiter but don't resolve yet
    // For ManuallyConditional, trigger sets raised to false and resolves one waiter
    const waiterToResolve = waiters.shift();
    const wasRaised = raised;

    // Phase 2: Prepare the target wait
    const targetPrepare = waiter.prepareWait(signal);

    // Phase 3: Error handling
    if (!targetPrepare) {
      // prepareWait not supported or error occurred
      // Restore the waiter
      if (waiterToResolve) {
        waiters.unshift(waiterToResolve);
      }

      // Fallback: non-atomic sequential execution
      if (waiterToResolve) {
        waiterToResolve.resolve();
        raised = false;
      }
      return waiter.wait(signal);
    }

    try {
      // Phase 4: Atomic execution - commit both state changes
      if (waiterToResolve) {
        waiterToResolve.resolve();
        raised = false;
      } else if (wasRaised) {
        // If was raised but no waiters, just clear the raised flag
        raised = false;
      }

      // Phase 5: Execute the prepared wait
      return await targetPrepare.execute();
    } catch (error) {
      // Cleanup on error
      targetPrepare.cleanup();
      // Restore state if needed
      if (waiterToResolve) {
        waiters.unshift(waiterToResolve);
      }
      throw error;
    }
  };

  const result: ManuallyConditional = {
    trigger,
    raise,
    drop,
    wait: wait as any,
    triggerAndWait,
    waiter: {
      wait,
      prepareWait,
    },
  };

  return result;
};
