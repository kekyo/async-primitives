// async-primitives - A collection of primitive functions for asynchronous operations in TypeScript/JavaScript.
// Copyright (c) Kouji Matsui. (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/async-primitives

/**
 * Releasable interface for resources that can be released explicitly
 */
export interface Releasable extends Disposable {
  /**
   * Release the resource explicitly
   */
  readonly release: () => void;
}

/**
 * Lock handle for managing acquired locks
 */
export interface LockHandle extends Releasable {
  /**
   * Indicates if the lock is still active
   */
  readonly isActive: boolean;
}

/**
 * AsyncLock interface for promise-based mutex operations
 */
export interface AsyncLock {
  /**
   * Acquires the lock asynchronously
   * @param signal Optional AbortSignal for cancelling the lock acquisition
   * @returns Promise that resolves to a disposable lock handle
   */
  readonly lock: (signal?: AbortSignal) => Promise<LockHandle>;

  /**
   * Indicates if the lock is currently acquired
   */
  readonly isLocked: boolean;

  /**
   * Number of pending lock requests
   */
  readonly pendingCount: number;
}

/**
 * Deferred interface for promise-based result handling
 */
export interface Deferred<T> {
  /**
   * Promise that resolves to the result
   */
  readonly promise: Promise<T>;

  /**
   * Resolve the promise with a result
   * @param value The result to resolve the promise with
   */
  readonly resolve: (value: T) => void;

  /**
   * Reject the promise with an error
   * @param error The error to reject the promise with
   */
  readonly reject: (error: any) => void;
}

/**
 * Options for creating a deferred generator
 */
export interface DeferredGeneratorOptions {
  /**
   * Optional maximum number of items to reserve in the queue (Default: unlimited)
   */
  maxItemReserved?: number;
  /**
   * Optional AbortSignal for cancelling the consumer (async iterator) wait
   */
  signal?: AbortSignal;
}

/**
 * Deferred generator interface for async-generator-based streaming result handling
 */
export interface DeferredGenerator<T> {
  /**
   * AsyncGenerator that yields values of type T
   */
  readonly generator: AsyncGenerator<T, void, unknown>;

  /**
   * Yield a value to the generator
   * @param value The value to yield
   * @param signal Optional AbortSignal for cancelling the yield
   */
  readonly yield: (value: T, signal?: AbortSignal) => Promise<void>;

  /**
   * Complete the generator (equivalent to return)
   * @param signal Optional AbortSignal for cancelling the return
   */
  readonly return: (signal?: AbortSignal) => Promise<void>;

  /**
   * Throw an error to the generator
   * @param error The error to throw
   * @param signal Optional AbortSignal for cancelling the throw
   */
  readonly throw: (error: any, signal?: AbortSignal) => Promise<void>;
}

/**
 * Signal interface that can be automatically triggered
 */
export interface Signal {
  /**
   * Trigger the signal
   * @remarks This will resolve only one waiter
   */
  readonly trigger: () => void;

  /**
   * Wait to be signaled
   * @param signal Optional AbortSignal for cancelling the wait
   * @returns Promise that resolves when signaled
   */
  readonly wait: (signal?: AbortSignal) => Promise<void>;
}

/**
 * Signal interface that can be manually raise and drop
 */
export interface ManuallySignal extends Signal {
  /**
   * Raise the signal
   * @remarks This will resolve all waiters
   */
  readonly raise: () => void;

  /**
   * Drop the signal
   * @remarks This will drop the signal, all waiters will be blocked until the signal is raised again
   */
  readonly drop: () => void;
}

/**
 * Semaphore handle for managing acquired semaphore resources
 */
export interface SemaphoreHandle extends Releasable {
  /**
   * Indicates if the handle is still active
   */
  readonly isActive: boolean;
}

/**
 * Semaphore interface for managing limited concurrent access
 */
export interface Semaphore {
  /**
   * Acquires a semaphore resource asynchronously
   * @param signal Optional AbortSignal for cancelling the acquisition
   * @returns Promise that resolves to a disposable semaphore handle
   */
  readonly acquire: (signal?: AbortSignal) => Promise<SemaphoreHandle>;

  /**
   * Number of currently available resources
   */
  readonly availableCount: number;

  /**
   * Number of pending acquisition requests
   */
  readonly pendingCount: number;
}

/**
 * Read lock handle for managing acquired read locks
 */
export interface ReadLockHandle extends Releasable {
  /**
   * Indicates if the handle is still active
   */
  readonly isActive: boolean;
}

/**
 * Write lock handle for managing acquired write locks
 */
export interface WriteLockHandle extends Releasable {
  /**
   * Indicates if the handle is still active
   */
  readonly isActive: boolean;
}

/**
 * Reader-Writer lock interface for managing concurrent read and exclusive write access
 */
export interface ReaderWriterLock {
  /**
   * Acquires a read lock asynchronously
   * @param signal Optional AbortSignal for cancelling the lock acquisition
   * @returns Promise that resolves to a disposable read lock handle
   */
  readonly readLock: (signal?: AbortSignal) => Promise<ReadLockHandle>;

  /**
   * Acquires a write lock asynchronously
   * @param signal Optional AbortSignal for cancelling the lock acquisition
   * @returns Promise that resolves to a disposable write lock handle
   */
  readonly writeLock: (signal?: AbortSignal) => Promise<WriteLockHandle>;

  /**
   * Number of currently active readers
   */
  readonly currentReaders: number;

  /**
   * Indicates if a writer currently holds the lock
   */
  readonly hasWriter: boolean;

  /**
   * Number of pending read lock requests
   */
  readonly pendingReadersCount: number;

  /**
   * Number of pending write lock requests
   */
  readonly pendingWritersCount: number;
}
