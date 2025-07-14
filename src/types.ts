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
   */
  readonly yield: (value: T) => void;

  /**
   * Complete the generator (equivalent to return)
   */
  readonly return: () => void;

  /**
   * Throw an error to the generator
   * @param error The error to throw
   */
  readonly throw: (error: any) => void;
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
