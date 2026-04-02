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
 * Waiter object
 */
export interface Waiter {
  /**
   * Wait to be triggered
   * @param signal Optional AbortSignal for cancelling the wait
   * @returns Promise that resolves when triggered, returns lock handle
   */
  readonly wait: (signal?: AbortSignal) => Promise<LockHandle>;
}

/**
 * Waitable object
 */
export interface Waitable {
  /**
   * Get waiter object
   * @returns Waiter object
   */
  readonly waiter: Waiter;
}

/**
 * Mutex interface for promise-based mutex operations
 */
export interface Mutex extends Waitable {
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
 * Conditional interface that can be automatically triggered
 */
export interface Conditional extends Waitable {
  /**
   * Trigger the conditional
   * @remarks This will resolve only one waiter
   */
  readonly trigger: () => void;

  /**
   * Wait to be triggered
   * @param signal Optional AbortSignal for cancelling the wait
   * @returns Promise that resolves when triggered, returns dummy lock handle
   */
  readonly wait: (signal?: AbortSignal) => Promise<void>;
}

/**
 * Conditional interface that can be manually raise and drop
 */
export interface ManuallyConditional extends Conditional {
  /**
   * Raise the conditional
   * @remarks This will resolve all waiters
   */
  readonly raise: () => void;

  /**
   * Drop the conditional
   * @remarks This will drop the conditional, all waiters will be blocked until the conditional is raised again
   */
  readonly drop: () => void;
}

/**
 * Semaphore interface for managing limited concurrent access
 */
export interface Semaphore extends Waitable {
  /**
   * Acquires a semaphore resource asynchronously
   * @param signal Optional AbortSignal for cancelling the acquisition
   * @returns Promise that resolves to a disposable semaphore handle
   */
  readonly acquire: (signal?: AbortSignal) => Promise<LockHandle>;

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
 * Lock policy for ReaderWriterLock
 */
export type ReaderWriterLockPolicy = 'read-preferring' | 'write-preferring';

/**
 * Options for creating a ReaderWriterLock
 */
export interface ReaderWriterLockOptions {
  /**
   * Lock policy (default: 'write-preferring'
   */
  policy?: ReaderWriterLockPolicy;
  /**
   * Maximum consecutive calls before yielding control (default: 20)
   */
  maxConsecutiveCalls?: number;
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
  readonly readLock: (signal?: AbortSignal) => Promise<LockHandle>;

  /**
   * Acquires a write lock asynchronously
   * @param signal Optional AbortSignal for cancelling the lock acquisition
   * @returns Promise that resolves to a disposable write lock handle
   */
  readonly writeLock: (signal?: AbortSignal) => Promise<LockHandle>;

  /**
   * Waiter object for reader
   */
  readonly readWaiter: Waiter;

  /**
   * Waiter object for writer
   */
  readonly writeWaiter: Waiter;

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

/////////////////////////////////////////////////////////////

/**
 * Value or promise-like value
 */
export type Awaitable<T> = T | PromiseLike<T>;

/**
 * Source sequence handled by `AsyncOperator`
 */
export type AsyncOperatorSource<T> = Iterable<Awaitable<T>>;

/**
 * Chainable operators for asynchronously resolved collections
 * @remarks
 * The sequence is evaluated lazily and sequentially, and can be consumed either by terminal operators
 * such as `toArray()` or directly via `for await`.
 */
export interface AsyncOperator<T> extends AsyncIterable<T> {
  /**
   * Projects each resolved value into a new value
   * @param selector Selector function for each resolved value
   * @returns A new async operator whose values are the projected results
   */
  readonly map: <U>(
    selector: (value: T, index: number) => Awaitable<U>
  ) => AsyncOperator<U>;

  /**
   * Projects each resolved value into a sequence and flattens the result by one level
   * @param selector Selector function that returns a sequence for each resolved value
   * @returns A new async operator whose values are the flattened results
   */
  readonly flatMap: <U>(
    selector: (value: T, index: number) => Awaitable<AsyncOperatorSource<U>>
  ) => AsyncOperator<U>;

  /**
   * Filters resolved values by predicate
   * @param predicate Predicate function for each resolved value
   * @returns A new async operator whose values satisfy the predicate
   */
  readonly filter: (
    predicate: (value: T, index: number) => Awaitable<boolean>
  ) => AsyncOperator<T>;

  /**
   * Projects each resolved value into another value and omits nullish results
   * @param selector Selector function for each resolved value
   * @returns A new async operator whose values are the non-nullish projected results
   */
  readonly choose: <U>(
    selector: (value: T, index: number) => Awaitable<U | null | undefined>
  ) => AsyncOperator<NonNullable<U>>;

  /**
   * Removes duplicate values
   * @returns A new async operator whose values are distinct
   */
  readonly distinct: () => AsyncOperator<T>;

  /**
   * Removes duplicate values by projected key
   * @param selector Selector function that produces the distinct key
   * @returns A new async operator whose values are distinct by key
   */
  readonly distinctBy: <TKey>(
    selector: (value: T, index: number) => Awaitable<TKey>
  ) => AsyncOperator<T>;

  /**
   * Skips the specified number of values
   * @param count Number of values to skip
   * @returns A new async operator that skips the specified number of values
   */
  readonly skip: (count: number) => AsyncOperator<T>;

  /**
   * Skips values while the predicate returns true
   * @param predicate Predicate function for each resolved value
   * @returns A new async operator that skips values while the predicate matches
   */
  readonly skipWhile: (
    predicate: (value: T, index: number) => Awaitable<boolean>
  ) => AsyncOperator<T>;

  /**
   * Takes the specified number of values
   * @param count Number of values to take
   * @returns A new async operator that takes the specified number of values
   */
  readonly take: (count: number) => AsyncOperator<T>;

  /**
   * Takes values while the predicate returns true
   * @param predicate Predicate function for each resolved value
   * @returns A new async operator that takes values while the predicate matches
   */
  readonly takeWhile: (
    predicate: (value: T, index: number) => Awaitable<boolean>
  ) => AsyncOperator<T>;

  /**
   * Produces adjacent pairs from the sequence
   * @returns A new async operator whose values are adjacent pairs
   */
  readonly pairwise: () => AsyncOperator<readonly [T, T]>;

  /**
   * Combines the sequence with another sequence element by element
   * @param source Source sequence to zip with
   * @returns A new async operator whose values are pairs from both sequences
   */
  readonly zip: <U>(
    source: AsyncOperatorSource<U>
  ) => AsyncOperator<readonly [T, U]>;

  /**
   * Produces intermediate accumulator states, including the initial value
   * @param reducer Reducer function for each resolved value
   * @param initialValue Initial accumulator value
   * @returns A new async operator whose values are intermediate accumulator states
   */
  readonly scan: <U>(
    reducer: (previousValue: U, currentValue: T, index: number) => Awaitable<U>,
    initialValue: U
  ) => AsyncOperator<U>;

  /**
   * Executes an action for each resolved value
   * @param action Action function for each resolved value
   * @returns A promise that resolves when all values have been processed
   */
  readonly forEach: (
    action: (value: T, index: number) => Awaitable<void>
  ) => Promise<void>;

  /**
   * Reduces the sequence to a single value
   */
  readonly reduce: {
    /**
     * Reduces the sequence without an explicit initial value
     * @param reducer Reducer function for each resolved value
     * @returns A promise that resolves to the reduced value
     */
    (
      reducer: (
        previousValue: T,
        currentValue: T,
        index: number
      ) => Awaitable<T>
    ): Promise<T>;

    /**
     * Reduces the sequence with an explicit initial value
     * @param reducer Reducer function for each resolved value
     * @param initialValue Initial accumulator value
     * @returns A promise that resolves to the reduced value
     */
    <U>(
      reducer: (
        previousValue: U,
        currentValue: T,
        index: number
      ) => Awaitable<U>,
      initialValue: U
    ): Promise<U>;
  };

  /**
   * Determines whether any value satisfies the predicate
   * @param predicate Predicate function for each resolved value
   * @returns A promise that resolves to true when any value satisfies the predicate
   */
  readonly some: (
    predicate: (value: T, index: number) => Awaitable<boolean>
  ) => Promise<boolean>;

  /**
   * Determines whether all values satisfy the predicate
   * @param predicate Predicate function for each resolved value
   * @returns A promise that resolves to true when all values satisfy the predicate
   */
  readonly every: (
    predicate: (value: T, index: number) => Awaitable<boolean>
  ) => Promise<boolean>;

  /**
   * Finds the first value that satisfies the predicate
   * @param predicate Predicate function for each resolved value
   * @returns A promise that resolves to the found value or undefined
   */
  readonly find: (
    predicate: (value: T, index: number) => Awaitable<boolean>
  ) => Promise<T | undefined>;

  /**
   * Finds the index of the first value that satisfies the predicate
   * @param predicate Predicate function for each resolved value
   * @returns A promise that resolves to the found index or -1
   */
  readonly findIndex: (
    predicate: (value: T, index: number) => Awaitable<boolean>
  ) => Promise<number>;

  /**
   * Finds the minimum value in the sequence
   * @returns A promise that resolves to the minimum value or undefined
   */
  readonly min: () => Promise<T | undefined>;

  /**
   * Finds the value with the minimum projected key
   * @param selector Selector function that produces the comparison key
   * @returns A promise that resolves to the value with the minimum key or undefined
   */
  readonly minBy: <TKey>(
    selector: (value: T, index: number) => Awaitable<TKey>
  ) => Promise<T | undefined>;

  /**
   * Finds the maximum value in the sequence
   * @returns A promise that resolves to the maximum value or undefined
   */
  readonly max: () => Promise<T | undefined>;

  /**
   * Finds the value with the maximum projected key
   * @param selector Selector function that produces the comparison key
   * @returns A promise that resolves to the value with the maximum key or undefined
   */
  readonly maxBy: <TKey>(
    selector: (value: T, index: number) => Awaitable<TKey>
  ) => Promise<T | undefined>;

  /**
   * Groups values by projected key
   * @param selector Selector function that produces the grouping key
   * @returns A promise that resolves to grouped values
   */
  readonly groupBy: <TKey>(
    selector: (value: T, index: number) => Awaitable<TKey>
  ) => Promise<Map<TKey, T[]>>;

  /**
   * Counts values by projected key
   * @param selector Selector function that produces the counting key
   * @returns A promise that resolves to counts grouped by key
   */
  readonly countBy: <TKey>(
    selector: (value: T, index: number) => Awaitable<TKey>
  ) => Promise<Map<TKey, number>>;

  /**
   * Resolves the sequence into an array
   * @returns A promise that resolves to an array of values in input order
   */
  readonly toArray: () => Promise<T[]>;
}

/////////////////////////////////////////////////////////////

// Deprecated type aliases for backward compatibility

/** @deprecated Use `Mutex` instead */
export type AsyncLock = Mutex;

/** @deprecated Use `Conditional` instead */
export type Signal = Conditional;

/** @deprecated Use `ManuallyConditional` instead */
export type ManuallySignal = ManuallyConditional;

/** @deprecated Use `LockHandle` instead */
export type SemaphoreHandle = LockHandle;

/** @deprecated Use `LockHandle` instead */
export type ReadLockHandle = LockHandle;

/** @deprecated Use `LockHandle` instead */
export type WriteLockHandle = LockHandle;
