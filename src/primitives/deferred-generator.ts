// async-primitives - A collection of primitive functions for asynchronous operations in TypeScript/JavaScript.
// Copyright (c) Kouji Matsui. (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/async-primitives

import { DeferredGenerator } from "../types";
import { createManuallySignal } from "./signal";

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
 * @returns A deferred generator object with an async generator and control functions
 */
export const createDeferredGenerator = <T>(signal?: AbortSignal): DeferredGenerator<T> => {
  const queue: QueuedItem<T>[] = [];
  const arrived = createManuallySignal();

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
