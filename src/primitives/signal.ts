import { Deferred, ManualSignal, Signal } from "../types";
import { onAbort } from "./abort-hook";
import { createDeferred } from "./deferred";

/**
 * Creates a signal that can be automatically triggered
 */
export const createSignal = (): Signal => {
  const waiters: Deferred<void>[] = [];
  return {
    trigger: () => {
      if (waiters.length >= 1) {
        waiters.shift()!.resolve();
      }
    },
    wait: async (signal?: AbortSignal) => {
      if (signal?.aborted) {
        throw new Error("Signal aborted");
      }
      const waiter = createDeferred<void>();
      waiters.push(waiter);
      const disposer = onAbort(signal, () => {
        waiters.splice(waiters.indexOf(waiter), 1);
        waiter.reject(new Error("Signal aborted"));
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
 * Creates a signal that can be manually set and reset
 * @returns A signal that can be manually set and reset
 */
export const createManualSignal = (): ManualSignal => {
  const waiters: Deferred<void>[] = [];
  let raised = false;
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
        throw new Error("Signal aborted");
      }
      const waiter = createDeferred<void>();
      waiters.push(waiter);
      const disposer = onAbort(signal, () => {
        waiters.splice(waiters.indexOf(waiter), 1);
        waiter.reject(new Error("Signal aborted"));
      });
      try {
        await waiter.promise;
      } finally {
        disposer.release();
      }
    },
  };
};
