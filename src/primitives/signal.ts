import { Deferred, ManualSignal } from "../types";
import { onAbort } from "./abort-hook";
import { createDeferred } from "./deferred";

/**
 * Creates a signal that can be manually set and reset
 * @returns A signal that can be manually set and reset
 */
export const createManualSignal = (): ManualSignal => {
  const waiters: Deferred<void>[] = [];
  let isSet = false;
  return {
    set: () => {
      isSet = true;
      for (const waiter of waiters) {
        waiter.resolve();
      }
      waiters.length = 0;
    },
    reset: () => {
      isSet = false;
    },
    wait: async (signal?: AbortSignal) => {
      if (isSet) {
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
