// async-primitives - A collection of primitive functions for asynchronous operations in TypeScript/JavaScript.
// Copyright (c) Kouji Matsui. (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/async-primitives

import { DeferredGenerator, DeferredGeneratorOptions } from '../types';
import { createManuallyConditional } from './conditional';

interface QueuedValue<T> {
  readonly kind: 'value';
  readonly value: T;
}

interface QueuedCompletion {
  readonly kind: 'completed';
}

interface QueuedError {
  readonly kind: 'error';
  readonly error: any;
}

type QueuedItem<T> = QueuedValue<T> | QueuedCompletion | QueuedError;

/**
 * Creates a new deferred generator object
 * @param T - The type of the yielded values
 * @param options - Optional options for the deferred generator
 * @returns A deferred generator object with an async generator and control functions
 */
export const createDeferredGenerator = <T>(
  options?: DeferredGeneratorOptions
): DeferredGenerator<T> => {
  const maxItemReserved = options?.maxItemReserved;
  const signal = options?.signal;
  const queue: QueuedItem<T>[] = [];
  const arrived = createManuallyConditional();
  const canReserve = maxItemReserved
    ? createManuallyConditional(true)
    : undefined;

  // Allocate the async generator
  const generator = (async function* () {
    // Generator iteration loop
    while (true) {
      // Process remaining items in the queue
      while (true) {
        // Get the next item from the queue
        const item = queue.shift();
        // If the queue is not full, raise the signal to release the suspending operator
        if (maxItemReserved && queue.length === maxItemReserved - 1) {
          canReserve!.raise();
        }
        // No more items, break the loop
        if (!item) {
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
          throw new Error('Deferred generator aborted');
        }
      }
      // Drop the signal because the queue is empty
      arrived.drop();
      // Wait for the signal to be raised, or the signal is aborted
      try {
        await arrived.wait(signal);
      } catch (error: unknown) {
        // If the signal is aborted, throw a more descriptive error
        if (error instanceof Error && error.message === 'Conditional aborted') {
          error.message = 'Deferred generator aborted';
        }
        // Rethrow the error
        throw error;
      }
      // When the signal is raised, maybe next item is available
    }
  })();

  // Enqueue an item to the queue
  const enqueue = async (
    item: QueuedItem<T>,
    signal: AbortSignal | undefined
  ) => {
    while (true) {
      if (!maxItemReserved || queue.length < maxItemReserved) {
        const remains = queue.push(item);
        if (remains === 1) {
          // Raise the signal to release the consumer
          arrived.raise();
        }
        if (remains === maxItemReserved) {
          // Drop the signal because the queue is full
          canReserve!.drop();
        }
        break;
      }
      // Wait for the signal to be raised, or the signal is aborted
      try {
        await canReserve!.wait(signal);
      } catch (error: unknown) {
        // If the signal is aborted, throw a more descriptive error
        if (error instanceof Error && error.message === 'Conditional aborted') {
          error.message = 'Deferred generator aborted';
        }
        // Rethrow the error
        throw error;
      }
    }
  };

  return {
    // The async generator that yields values
    generator,
    // Yield a value to the generator
    yield: (value: T, signal?: AbortSignal) =>
      enqueue({ kind: 'value', value }, signal),
    // Complete the generator (equivalent to return)
    return: (signal?: AbortSignal) => enqueue({ kind: 'completed' }, signal),
    // Throw an error to the generator
    throw: (error: any, signal?: AbortSignal) =>
      enqueue({ kind: 'error', error }, signal),
  };
};
