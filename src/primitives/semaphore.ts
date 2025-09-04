// async-primitives - A collection of primitive functions for asynchronous operations in TypeScript/JavaScript.
// Copyright (c) Kouji Matsui. (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/async-primitives

import { LockHandle, Semaphore } from '../types';
import { onAbort } from './abort-hook';
import { defer } from './defer';

/**
 * Internal queue item for semaphore acquisition requests
 */
interface QueueItem {
  /** Promise resolver for the semaphore acquisition */
  resolve: (handle: LockHandle) => void;
  /** Promise rejecter for the semaphore acquisition */
  reject: (error: Error) => void;
  /** Optional AbortSignal for cancelling the request */
  signal?: AbortSignal | undefined;
}

const ABORTED_ERROR = () => new Error('Semaphore acquisition was aborted');
const INVALID_COUNT_ERROR = () =>
  new Error('Semaphore count must be greater than 0');

/**
 * Creates a new SemaphoreHandle instance
 * @param releaseCallback Callback function to release the semaphore resource
 * @returns A SemaphoreHandle object with release and dispose functionality
 */
const createSemaphoreHandle = (releaseCallback: () => void): LockHandle => {
  let isActive = true;

  const release = (): void => {
    if (!isActive) {
      return;
    }
    isActive = false;
    releaseCallback();
  };

  return {
    get isActive() {
      return isActive;
    },
    release,
    [Symbol.dispose]: release,
  };
};

/**
 * Creates a new Semaphore instance for managing limited concurrent access
 * @param count The maximum number of concurrent acquisitions allowed (must be greater than 0)
 * @param maxConsecutiveCalls The maximum number of consecutive calls before yielding control
 * @returns A new Semaphore for managing concurrent resource access
 */
export const createSemaphore = (
  count: number,
  maxConsecutiveCalls: number = 20
): Semaphore => {
  if (count < 1) {
    throw INVALID_COUNT_ERROR();
  }

  let availableCount = count;
  const queue: QueueItem[] = [];
  let consecutiveCallCount = 0;

  const processQueue = (): void => {
    while (availableCount > 0 && queue.length > 0) {
      const item = queue.shift()!;

      // Check if the request was aborted
      if (item.signal?.aborted) {
        item.reject(ABORTED_ERROR());
        // Continue processing next item
        continue;
      }

      // Acquire a resource
      availableCount--;

      // Continue to awaiter with semaphoreHandle
      const semaphoreHandle = createSemaphoreHandle(releaseSemaphore);
      item.resolve(semaphoreHandle);
    }
  };

  const scheduleNextProcess = (): void => {
    consecutiveCallCount++;

    // Yield control with defer delay every maxConsecutiveCalls consecutive executions
    if (consecutiveCallCount >= maxConsecutiveCalls) {
      consecutiveCallCount = 0;
      defer(processQueue);
    } else {
      // Direct call is sufficient since it's controlled by counter
      processQueue();
    }
  };

  const releaseSemaphore = (): void => {
    availableCount++;
    // Process next item in queue with batching control
    scheduleNextProcess();
  };

  const removeFromQueue = (item: QueueItem): void => {
    const index = queue.indexOf(item);
    if (index !== -1) {
      queue.splice(index, 1);
    }
  };

  const acquire = async (signal?: AbortSignal): Promise<LockHandle> => {
    if (signal) {
      // Check if already aborted
      if (signal.aborted) {
        throw ABORTED_ERROR();
      }

      // If resource is available immediately and not aborted
      if (availableCount > 0) {
        availableCount--;
        return createSemaphoreHandle(releaseSemaphore);
      }

      return new Promise<LockHandle>((resolve, reject) => {
        // Handle case with AbortSignal
        const queueItem: QueueItem = {
          resolve: undefined!,
          reject: undefined!,
          signal,
        };

        const abortHandle = onAbort(signal, () => {
          removeFromQueue(queueItem);
          reject(ABORTED_ERROR());
        });

        // Wrap to clean up
        queueItem.resolve = (handle: LockHandle) => {
          abortHandle.release();
          resolve(handle);
        };
        queueItem.reject = (error: Error) => {
          abortHandle.release();
          reject(error);
        };

        queue.push(queueItem);
        processQueue();
      });
    } else {
      // If resource is available immediately
      if (availableCount > 0) {
        availableCount--;
        return createSemaphoreHandle(releaseSemaphore);
      }

      return new Promise<LockHandle>((resolve, reject) => {
        // Handle case without AbortSignal
        queue.push({
          resolve,
          reject,
        });
        processQueue();
      });
    }
  };

  const result: Semaphore = {
    acquire,
    waiter: {
      wait: acquire,
    },
    get availableCount() {
      return availableCount;
    },
    get pendingCount() {
      return queue.length;
    },
  };

  return result;
};
