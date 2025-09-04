// async-primitives - A collection of primitive functions for asynchronous operations in TypeScript/JavaScript.
// Copyright (c) Kouji Matsui. (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/async-primitives

import { Mutex, LockHandle } from '../types';
import { onAbort } from './abort-hook';
import { defer } from './defer';

/**
 * Internal queue item for lock requests
 */
interface QueueItem {
  /** Promise resolver for the lock acquisition */
  // eslint-disable-next-line no-unused-vars
  resolve: (handle: LockHandle) => void;
  /** Promise rejecter for the lock acquisition */
  // eslint-disable-next-line no-unused-vars
  reject: (error: Error) => void;
  /** Optional AbortSignal for cancelling the request */
  signal?: AbortSignal | undefined;
}

const ABORTED_ERROR = () => new Error('Lock acquisition was aborted');

/**
 * Creates a new LockHandle instance
 * @param releaseCallback Callback function to release the lock
 * @returns A LockHandle object with release and dispose functionality
 */
const createLockHandle = (releaseCallback: () => void): LockHandle => {
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
 * Creates a new Mutex instance
 * @param maxConsecutiveCalls - The maximum number of consecutive calls to the lockAsync method before yielding control to the next item in the queue
 * @returns A new Mutex for promise-based mutex operations
 */
export const createMutex = (maxConsecutiveCalls: number = 20): Mutex => {
  let isLocked = false;
  const queue: QueueItem[] = [];
  let count = 0; // Consecutive execution counter

  const processQueue = (): void => {
    if (isLocked || queue.length === 0) {
      return;
    }

    const item = queue.shift()!;

    // Check if the request was aborted
    if (item.signal?.aborted) {
      item.reject(ABORTED_ERROR());
      // Process next item in queue with counting
      scheduleNextProcess();
      return;
    }

    isLocked = true;

    // Continue to locked awaiter with lockHandle
    const lockHandle = createLockHandle(releaseLock);
    item.resolve(lockHandle);
  };

  const scheduleNextProcess = (): void => {
    count++;

    // Yield control with defer delay every maxConsecutiveCalls consecutive executions
    if (count >= maxConsecutiveCalls) {
      count = 0;
      defer(processQueue);
    } else {
      // Direct call is sufficient since it's controlled by counter
      processQueue();
    }
  };

  const releaseLock = (): void => {
    if (!isLocked) {
      return;
    }

    isLocked = false;
    // Process next item in queue with batching control
    scheduleNextProcess();
  };

  const removeFromQueue = (item: QueueItem): void => {
    const index = queue.indexOf(item);
    if (index !== -1) {
      queue.splice(index, 1);
    }
  };

  const lock = async (signal?: AbortSignal): Promise<LockHandle> => {
    if (signal) {
      // Check if already aborted
      if (signal.aborted) {
        throw ABORTED_ERROR();
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

  const result: Mutex = {
    lock,
    waiter: {
      wait: lock,
    },
    get isLocked() {
      return isLocked;
    },
    get pendingCount() {
      return queue.length;
    },
  };

  return result;
};
