/**
 * Common types used across async-primitives
 */

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
  readonly reject: (error: Error) => void;
}
