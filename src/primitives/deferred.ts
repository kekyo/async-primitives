/**
 * Deferred implementation for promise-based result handling
 */

import { Deferred, DeferredGenerator } from "../types";
import { onAbort } from "./abort-hook";
import { createManualSignal } from "./signal";

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

interface QueuedValue<T> {
  readonly kind: 'value';
  readonly value: T;
}

interface QueuedCompletion {
  readonly kind: 'completed';
}

interface QueuedError {
  readonly kind: 'error';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly error: any;
}

type QueuedItem<T> = QueuedValue<T> | QueuedCompletion | QueuedError;

/**
 * Creates a new deferred generator object
 * @param T - The type of the yielded values
 * @param signal - Optional AbortSignal for cancelling the wait
 * @returns A deferred generator object with an async generator and control methods
 */
export const createDeferredGenerator = <T>(signal?: AbortSignal): DeferredGenerator<T> => {
  const queue: QueuedItem<T>[] = [];
  const arrived = createManualSignal();

  // Allocate the async generator
  const generator = (async function* () {
    // Generator iteration loop
    while (true) {
      // Process remaining items in the queue
      while (true) {
        // Get the next item from the queue
        const item = queue.shift();
        if (!item) {
          // No more items, break the loop
          break;
        }
        // Process the item
        switch (item.kind) {
          // Yield return a value
          case 'value':
            yield item.value;
            break;
          // Completed, exit the generator
          case 'completed':
            return;
          // Error, throw an error
          case 'error':
            throw item.error;
        }
        // When the signal is aborted, throw an error
        if (signal?.aborted) {
          throw new Error("Deferred generator aborted");
        }
      }
      // Drop the signal because the queue is empty
      arrived.drop();
      // Wait for the signal to be raised, or the signal is aborted
      try {
        await arrived.wait(signal);
      } catch (error: unknown) {
        // If the signal is aborted, throw a more descriptive error
        if (error instanceof Error && error.message === "Signal aborted") {
          error.message = "Deferred generator aborted";
        }
        // Rethrow the error
        throw error;
      }
      // When the signal is raised, maybe next item is available
    }
  })();

  return {
    // The async generator that yields values
    generator,
    // Yield a value to the generator
    yield: (value: T) => {
      if (queue.push({ kind: 'value', value }) === 1) {
        // Raise the signal to release the waiter when the queue is empty
        arrived.raise();
      }
    },
    // Complete the generator (equivalent to return)
    return: () => {
      if (queue.push({ kind: 'completed' }) === 1) {
        // Raise the signal to release the waiter when the queue is empty
        arrived.raise();
      }
    },
    // Throw an error to the generator
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    throw: (error: any) => {
      if (queue.push({ kind: 'error', error }) === 1) {
        // Raise the signal to release the waiter when the queue is empty
        arrived.raise();
      }
    },
  };
};
