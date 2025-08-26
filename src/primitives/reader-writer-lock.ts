// async-primitives - A collection of primitive functions for asynchronous operations in TypeScript/JavaScript.
// Copyright (c) Kouji Matsui. (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/async-primitives

import { ReaderWriterLock, ReadLockHandle, WriteLockHandle } from "../types";
import { onAbort } from "./abort-hook";
import { defer } from "./defer";

/**
 * Internal queue item for read lock requests
 */
interface ReadQueueItem {
  /** Promise resolver for the read lock acquisition */
  // eslint-disable-next-line no-unused-vars
  resolve: (handle: ReadLockHandle) => void;
  /** Promise rejecter for the read lock acquisition */
  // eslint-disable-next-line no-unused-vars
  reject: (error: Error) => void;
  /** Optional AbortSignal for cancelling the request */
  signal?: AbortSignal | undefined;
}

/**
 * Internal queue item for write lock requests
 */
interface WriteQueueItem {
  /** Promise resolver for the write lock acquisition */
  // eslint-disable-next-line no-unused-vars
  resolve: (handle: WriteLockHandle) => void;
  /** Promise rejecter for the write lock acquisition */
  // eslint-disable-next-line no-unused-vars
  reject: (error: Error) => void;
  /** Optional AbortSignal for cancelling the request */
  signal?: AbortSignal | undefined;
}

const ABORTED_ERROR = () => new Error('Lock acquisition was aborted');

/**
 * Creates a new ReadLockHandle instance
 * @param releaseCallback Callback function to release the read lock
 * @returns A ReadLockHandle object with release and dispose functionality
 */
const createReadLockHandle = (releaseCallback: () => void): ReadLockHandle => {
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
    [Symbol.dispose]: release
  };
};

/**
 * Creates a new WriteLockHandle instance
 * @param releaseCallback Callback function to release the write lock
 * @returns A WriteLockHandle object with release and dispose functionality
 */
const createWriteLockHandle = (releaseCallback: () => void): WriteLockHandle => {
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
    [Symbol.dispose]: release
  };
};

/**
 * Creates a new ReaderWriterLock instance for managing concurrent read and exclusive write access
 * @param maxConsecutiveCalls The maximum number of consecutive calls before yielding control
 * @returns A new ReaderWriterLock with write-preferring policy
 */
export const createReaderWriterLock = (maxConsecutiveCalls: number = 20): ReaderWriterLock => {
  let currentReaders = 0;
  let hasWriter = false;
  const readQueue: ReadQueueItem[] = [];
  const writeQueue: WriteQueueItem[] = [];
  let consecutiveCallCount = 0;

  const processQueues = (): void => {
    // Write-preferring policy: process writers first
    if (!hasWriter && currentReaders === 0 && writeQueue.length > 0) {
      const item = writeQueue.shift()!;

      // Check if the request was aborted
      if (item.signal?.aborted) {
        item.reject(ABORTED_ERROR());
        // Continue processing
        scheduleNextProcess();
        return;
      }

      // Acquire write lock
      hasWriter = true;

      // Continue to awaiter with writeLockHandle
      const writeLockHandle = createWriteLockHandle(releaseWriteLock);
      item.resolve(writeLockHandle);
    }
    // Process readers only if no writer is active and no writers are waiting
    else if (!hasWriter && writeQueue.length === 0 && readQueue.length > 0) {
      // Process all available readers at once
      const readersToProcess: ReadQueueItem[] = [];
      
      while (readQueue.length > 0) {
        const item = readQueue.shift()!;
        
        // Check if the request was aborted
        if (item.signal?.aborted) {
          item.reject(ABORTED_ERROR());
        } else {
          readersToProcess.push(item);
        }
      }

      // Grant read locks to all non-aborted readers
      for (const item of readersToProcess) {
        currentReaders++;
        const readLockHandle = createReadLockHandle(releaseReadLock);
        item.resolve(readLockHandle);
      }
    }
  };

  const scheduleNextProcess = (): void => {
    consecutiveCallCount++;
    
    // Yield control with defer delay every maxConsecutiveCalls consecutive executions
    if (consecutiveCallCount >= maxConsecutiveCalls) {
      consecutiveCallCount = 0;
      defer(processQueues);
    } else {
      // Direct call is sufficient since it's controlled by counter
      processQueues();
    }
  };

  const releaseReadLock = (): void => {
    if (currentReaders > 0) {
      currentReaders--;
      // If this was the last reader, process queues
      if (currentReaders === 0) {
        scheduleNextProcess();
      }
    }
  };

  const releaseWriteLock = (): void => {
    if (hasWriter) {
      hasWriter = false;
      scheduleNextProcess();
    }
  };

  const removeFromReadQueue = (item: ReadQueueItem): void => {
    const index = readQueue.indexOf(item);
    if (index !== -1) {
      readQueue.splice(index, 1);
    }
  };

  const removeFromWriteQueue = (item: WriteQueueItem): void => {
    const index = writeQueue.indexOf(item);
    if (index !== -1) {
      writeQueue.splice(index, 1);
    }
  };

  const readLock = async (signal?: AbortSignal): Promise<ReadLockHandle> => {
    if (signal) {
      // Check if already aborted
      if (signal.aborted) {
        throw ABORTED_ERROR();
      }

      // Can acquire immediately if no writer is active and no writers are waiting
      if (!hasWriter && writeQueue.length === 0) {
        currentReaders++;
        return createReadLockHandle(releaseReadLock);
      }

      return new Promise<ReadLockHandle>((resolve, reject) => {
        // Handle case with AbortSignal
        const queueItem: ReadQueueItem = {
          resolve: undefined!,
          reject: undefined!,
          signal
        };

        const abortHandle = onAbort(signal, () => {
          removeFromReadQueue(queueItem);
          reject(ABORTED_ERROR());
        });

        // Wrap to clean up
        queueItem.resolve = (handle: ReadLockHandle) => {
          abortHandle.release();
          resolve(handle);
        };
        queueItem.reject = (error: Error) => {
          abortHandle.release();
          reject(error);
        };

        readQueue.push(queueItem);
        processQueues();
      });
    } else {
      // Can acquire immediately if no writer is active and no writers are waiting
      if (!hasWriter && writeQueue.length === 0) {
        currentReaders++;
        return createReadLockHandle(releaseReadLock);
      }

      return new Promise<ReadLockHandle>((resolve, reject) => {
        // Handle case without AbortSignal
        readQueue.push({
          resolve,
          reject
        });
        processQueues();
      });
    }
  };

  const writeLock = async (signal?: AbortSignal): Promise<WriteLockHandle> => {
    if (signal) {
      // Check if already aborted
      if (signal.aborted) {
        throw ABORTED_ERROR();
      }

      // Can acquire immediately if no readers and no writer
      if (!hasWriter && currentReaders === 0) {
        hasWriter = true;
        return createWriteLockHandle(releaseWriteLock);
      }

      return new Promise<WriteLockHandle>((resolve, reject) => {
        // Handle case with AbortSignal
        const queueItem: WriteQueueItem = {
          resolve: undefined!,
          reject: undefined!,
          signal
        };

        const abortHandle = onAbort(signal, () => {
          removeFromWriteQueue(queueItem);
          reject(ABORTED_ERROR());
        });

        // Wrap to clean up
        queueItem.resolve = (handle: WriteLockHandle) => {
          abortHandle.release();
          resolve(handle);
        };
        queueItem.reject = (error: Error) => {
          abortHandle.release();
          reject(error);
        };

        writeQueue.push(queueItem);
        processQueues();
      });
    } else {
      // Can acquire immediately if no readers and no writer
      if (!hasWriter && currentReaders === 0) {
        hasWriter = true;
        return createWriteLockHandle(releaseWriteLock);
      }

      return new Promise<WriteLockHandle>((resolve, reject) => {
        // Handle case without AbortSignal
        writeQueue.push({
          resolve,
          reject
        });
        processQueues();
      });
    }
  };

  return ({
    readLock,
    writeLock,
    get currentReaders() {
      return currentReaders;
    },
    get hasWriter() {
      return hasWriter;
    },
    get pendingReadersCount() {
      return readQueue.length;
    },
    get pendingWritersCount() {
      return writeQueue.length;
    }
  });
}