# async-primitives

A collection of primitive functions for asynchronous operations in TypeScript/JavaScript.

[![Project Status: Active – The project has reached a stable, usable state and is being actively developed.](https://www.repostatus.org/badges/latest/active.svg)](https://www.repostatus.org/#active)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/async-primitives.svg)](https://www.npmjs.com/package/async-primitives)

---

## What is this?

If you are interested in performing additional calculations on `Promise<T>`, you may find this small library useful.
Mutex, producer-consumer separation (side-effect operation), signaling (flag control), logical context and more.

- Works in both browser and Node.js environments (16 or later, tested only 22).
- No external dependencies.

| Function                      | Description                                               |
| :---------------------------- | :-------------------------------------------------------- |
| `delay()`                     | Promise-based delay function                              |
| `defer()`                     | Schedule callback for next event loop                     |
| `onAbort()`                   | Register safer abort signal hooks with cleanup            |
| `createMutex()`               | Promise-based mutex lock for critical sections            |
| `createSemaphore()`           | Promise-based semaphore for limiting concurrent access    |
| `createReaderWriterLock()`    | Read-write lock for multiple readers/single writer        |
| `createDeferred()`            | External control of Promise resolution/rejection          |
| `createDeferredGenerator()`   | External control of async generator with queue management |
| `createConditional()`         | Automatic conditional trigger (one-waiter per trigger)    |
| `createManuallyConditional()` | Manual conditional control (raise/drop state)             |

Iterator operations:

| Function | Description                                   |
| :------- | :-------------------------------------------- |
| `from()` | Chainable operators for iterable async values |

Advanced features:

| Function             | Description                                  |
| :------------------- | :------------------------------------------- |
| `createAsyncLocal()` | Asynchronous context storage                 |
| `LogicalContext`     | Low-level async execution context management |

- The implementations previously known symbol as `AsyncLock` and `Signal` have been changed to `Mutex` and `Conditional`.
  Although these symbol names can still be used, please note that they are marked as deprecated.
  They may be removed in future versions.

## Installation

```bash
npm install async-primitives
```

---

## Usage

Each functions are independent and does not require knowledge of each other's assumptions.

### delay()

Provides a delay that can be awaited with `Promise<void>`, with support for cancellation via `AbortSignal.`

```typescript
import { delay } from 'async-primitives';

// Use delay
await delay(1000); // Wait for 1 second
```

```typescript
// With AbortSignal
const c = new AbortController();
await delay(1000, c.signal); // Wait for 1 second
```

### defer()

Schedules a callback to be executed asynchronously on the next event loop iteration.

```typescript
import { defer } from 'async-primitives';

// Use defer (Schedule callback for next event loop)
defer(() => {
  console.log('Executes asynchronously');
});
```

### onAbort()

Registers a hook function to `AbortSignal` abort events, enabling cleanup processing. Also supports early release.

```typescript
import { onAbort } from 'async-primitives';

// Use onAbort (Abort signal hooking)
const controller = new AbortController();

const releaseHandle = onAbort(controller.signal, (error: Error) => {
  console.log('Operation was aborted!');
  // (Will automatically cleanup when exit)
});

// (Cleanup early if needed)
releaseHandle.release();
```

### createMutex()

Provides `Promise` based mutex functionality to implement critical sections that prevent race conditions in asynchronous operations.

```typescript
import { createMutex } from 'async-primitives';

// Use Mutex
const locker = createMutex();

// Lock Mutex
const handler = await locker.lock();
try {
  // Critical section, avoid race condition.
} finally {
  // Release Mutex
  handler.release();
}
```

```typescript
// With AbortSignal
const handler = await locker.lock(c.signal);
```

### createDeferred()

Creates a `Deferred<T>` object that allows external control of `Promise<T>` resolution or rejection.
Useful for separating producers and consumers in asynchronous processing.

```typescript
import { createDeferred } from 'async-primitives';

// Use Deferred
const deferred = createDeferred<number>();

deferred.resolve(123); // (Produce result value)
deferred.reject(new Error()); // (Produce an error)

// (Consumer)
const value = await deferred.promise;
```

```typescript
// With AbortSignal support
const controller = new AbortController();
const abortableDeferred = createDeferred<number>(controller.signal);
```

### createDeferredGenerator()

Creates a `DeferredGenerator<T>` object that allows external control of async generator `AsyncGenerator<T, ...>` yielding, returning and throwing operations.
Useful for separating producers and consumers in streaming data patterns.

```typescript
import { createDeferredGenerator } from 'async-primitives';

// Basic usage - streaming data
const deferredGen = createDeferredGenerator<string>();

// Consumer - iterate over values as they arrive
const consumer = async () => {
  for await (const value of deferredGen.generator) {
    console.log('Received:', value);
  }
  console.log('Stream completed');
};

// Start consuming
consumer();

// Producer - send values externally (now returns Promise<void>)
await deferredGen.yield('First value');
await deferredGen.yield('Second value');
await deferredGen.yield('Third value');
await deferredGen.return(); // Complete the stream
```

Can insert an error when yielding:

```typescript
// With error handling
const errorGen = createDeferredGenerator<number>();

const errorConsumer = async () => {
  try {
    for await (const value of errorGen.generator) {
      console.log('Number:', value);
    }
  } catch (error) {
    console.log('Error occurred:', error.message);
  }
};

errorConsumer();
await errorGen.yield(1);
await errorGen.yield(2);
await errorGen.throw(new Error('Something went wrong'));
```

#### Queue Size Management

Control the maximum number of items that can be queued using the `maxItemReserved` option:

```typescript
// Limit queue to 3 items maximum
const limitedGen = createDeferredGenerator<string>({ maxItemReserved: 3 });

// When queue is full, yield operations will wait for space
await limitedGen.yield('item1');
await limitedGen.yield('item2');
await limitedGen.yield('item3'); // Queue is now full

// This will wait until consumer processes some items
await limitedGen.yield('item4'); // Waits for queue space
```

### createConditional()

Creates an automatically or manually controlled signal that can be raise and drop.
Multiple waiters can await for the same signal, and all will be resolved when the signal is raise.

The `Conditional` (automatic conditional) is "trigger" automatically raise-and-drop to release only one-waiter:

```typescript
import { createConditional } from 'async-primitives';

// Create an automatic conditional
const signal = createConditional();

// Start multiple waiters
const waiter1 = signal.wait();
const waiter2 = signal.wait();

// Trigger the signal - only one waiter will resolve per trigger
signal.trigger(); // waiter1 resolves

await waiter1;
console.log('First waiter resolved');

// Second waiter is still waiting
signal.trigger(); // waiter2 resolves

await waiter2;
console.log('Second waiter resolved');
```

```typescript
// Wait with AbortSignal support
const controller = new AbortController();
try {
  const waitPromise = signal.wait(controller.signal);
  // Abort the wait operation
  controller.abort();
  await waitPromise;
} catch (error) {
  console.log('Wait was aborted');
}
```

### createManuallyConditional()

The `ManuallyConditional` is manually controlled raise and drop state, and trigger action is optional.

```typescript
import { createManuallyConditional } from 'async-primitives';

// Create a manually conditional
const signal = createManuallyConditional();

// Start multiple waiters
const waiter1 = signal.wait();
const waiter2 = signal.wait();

// Raise the signal - all waiters will resolve
signal.raise();

// Or, you can release only one-waiter
//signal.trigger();　　// waiter1 resolves

await Promise.all([waiter1, waiter2]);
console.log('All waiters resolved');

// Drop the signal
signal.drop();
```

```typescript
// Wait with AbortSignal support
const controller = new AbortController();
try {
  await signal.wait(controller.signal);
} catch (error) {
  console.log('Wait was aborted');
}
```

### createSemaphore()

Creates a `Semaphore` that limits the number of concurrent operations to a specified count.
Useful for rate limiting, resource pooling, and controlling concurrent access to limited resources.

```typescript
import { createSemaphore } from 'async-primitives';

// Create a semaphore with max 3 concurrent operations
const semaphore = createSemaphore(3);

// Acquire a resource
const handle = await semaphore.acquire();
try {
  // Critical section - only 3 operations can run concurrently
  await performExpensiveOperation();
} finally {
  // Release the resource
  handle.release();
}

// Check available resources
console.log(`Available: ${semaphore.availableCount}`);
console.log(`Waiting: ${semaphore.pendingCount}`);
```

Rate limiting example for API calls:

```typescript
// Limit to 5 concurrent API calls
const apiSemaphore = createSemaphore(5);

const rateLimitedFetch = async (url: string) => {
  const handle = await apiSemaphore.acquire();
  try {
    return await fetch(url);
  } finally {
    handle.release();
  }
};

// Process many URLs with controlled concurrency
const urls = ['url1', 'url2' /* ... many more ... */];
const promises = urls.map((url) => rateLimitedFetch(url));
const results = await Promise.all(promises);
// Only 5 requests will be in-flight at any time
```

```typescript
// With AbortSignal support
const controller = new AbortController();
try {
  const handle = await semaphore.acquire(controller.signal);

  // Use the resource
  handle.release();
} catch (error) {
  console.log('Semaphore acquisition was aborted');
}
```

### createReaderWriterLock()

Creates a `ReaderWriterLock` that allows multiple concurrent readers but only one exclusive writer.

Lock policies:

- `write-preferring` (default): When a writer is waiting, new readers must wait until the writer completes
- `read-preferring`: New readers can acquire the lock even when writers are waiting

```typescript
import { createReaderWriterLock } from 'async-primitives';

// Create a reader-writer lock (default: write-preferring)
const rwLock = createReaderWriterLock();

// With specific policy
const readPreferringLock = createReaderWriterLock({
  policy: 'read-preferring',
});

// Backward compatible with legacy API
const rwLockLegacy = createReaderWriterLock(10); // maxConsecutiveCalls

// Multiple readers can access concurrently
const readData = async () => {
  const handle = await rwLock.readLock();
  try {
    // Multiple threads can read simultaneously
    const data = await readFromSharedResource();
    return data;
  } finally {
    handle.release();
  }
};

// Writers have exclusive access
const writeData = async (newData: any) => {
  const handle = await rwLock.writeLock();
  try {
    // Exclusive access - no readers or other writers
    await writeToSharedResource(newData);
  } finally {
    handle.release();
  }
};

// Check lock state
console.log(`Current readers: ${rwLock.currentReaders}`);
console.log(`Has writer: ${rwLock.hasWriter}`);
console.log(`Pending readers: ${rwLock.pendingReadersCount}`);
console.log(`Pending writers: ${rwLock.pendingWritersCount}`);
```

Cache implementation example:

```typescript
const cacheLock = createReaderWriterLock();
const cache = new Map();

// Read from cache (multiple concurrent reads allowed)
const getCached = async (key: string) => {
  const handle = await cacheLock.readLock();
  try {
    return cache.get(key);
  } finally {
    handle.release();
  }
};

// Update cache (exclusive write access)
const updateCache = async (key: string, value: any) => {
  const handle = await cacheLock.writeLock();
  try {
    cache.set(key, value);
  } finally {
    handle.release();
  }
};

// Clear cache (exclusive write access)
const clearCache = async () => {
  const handle = await cacheLock.writeLock();
  try {
    cache.clear();
  } finally {
    handle.release();
  }
};
```

```typescript
// With AbortSignal support
const controller = new AbortController();
try {
  const readHandle = await rwLock.readLock(controller.signal);

  // Read operations...
  readHandle.release();
} catch (error) {
  console.log('Lock acquisition was aborted');
}
```

### from()

Creates an `AsyncOperator<T>` from an `Iterable` or `AsyncIterable` of values or promises, allowing lazy and sequential operator chaining.

```typescript
import { from } from 'async-primitives';

const values = await from([Promise.resolve(1), 2, Promise.resolve(3)])
  .map(async (value) => value * 2)
  .filter((value) => value > 2)
  .flatMap((value) => [value, value + 100])
  .toArray();

console.log(values); // [4, 104, 6, 106]
```

`AsyncOperator<T>` is also an `AsyncIterable<T>`, so it can be consumed directly with `for await`.

```typescript
// Consume directly as AsyncIterable<T>
for await (const value of from(iterable).map((value) => value * 2)) {
  console.log(value);
}
```

```typescript
// AsyncIterable<T> sources are also supported
const values = await from(asyncIterable).toArray();
```

Some sources are one-shot, such as async generator instances.
If the same source cannot be enumerated again, calling multiple terminal operations on the same `AsyncOperator`
may produce different results on the second and later enumerations.

Intermediate operators:

| Operator        | Description                                                                |
| :-------------- | :------------------------------------------------------------------------- |
| `map()`         | Projects each resolved value into another value                            |
| `flatMap()`     | Projects each resolved value into an iterable and flattens it by one level |
| `filter()`      | Keeps only values whose predicate result is truthy                         |
| `concat()`      | Appends values from additional iterables or async iterables                |
| `choose()`      | Projects each resolved value and omits `null` and `undefined` results      |
| `slice()`       | Returns a subrange using `Array.prototype.slice()` semantics               |
| `distinct()`    | Removes duplicate values                                                   |
| `distinctBy()`  | Removes duplicate values by projected key                                  |
| `skip()`        | Skips the specified number of values                                       |
| `skipWhile()`   | Skips values while the predicate returns true                              |
| `take()`        | Takes the specified number of values                                       |
| `takeWhile()`   | Takes values while the predicate returns true                              |
| `pairwise()`    | Produces adjacent pairs                                                    |
| `zip()`         | Combines values with another iterable element by element                   |
| `scan()`        | Produces intermediate accumulator states, including the initial value      |
| `union()`       | Produces distinct values from this sequence followed by another sequence   |
| `unionBy()`     | Produces distinct values by projected key across two sequences             |
| `intersect()`   | Produces distinct values that appear in both sequences                     |
| `intersectBy()` | Produces distinct values by projected key that appear in both sequences    |
| `except()`      | Produces distinct values that do not appear in another sequence            |
| `exceptBy()`    | Produces distinct values by projected key not found in another sequence    |
| `chunkBySize()` | Groups values into arrays of a fixed maximum size                          |
| `windowed()`    | Produces sliding windows of a fixed size                                   |
| `flat()`        | Flattens nested arrays using `Array.prototype.flat()` semantics            |
| `reverse()`     | Returns the sequence in reverse order                                      |
| `toReversed()`  | Returns a reversed copy of the sequence                                    |
| `sort()`        | Returns the sequence sorted with `Array.prototype.sort()` semantics        |
| `toSorted()`    | Returns a sorted copy with `Array.prototype.toSorted()` semantics          |

Terminal operators:

| Operator          | Description                                                                            |
| :---------------- | :------------------------------------------------------------------------------------- |
| `forEach()`       | Executes an action for each value                                                      |
| `reduce()`        | Reduces the sequence to a single value                                                 |
| `reduceRight()`   | Reduces the sequence from right to left                                                |
| `some()`          | Returns true when any value satisfies the predicate                                    |
| `every()`         | Returns true when all values satisfy the predicate                                     |
| `find()`          | Returns the first value that satisfies the predicate                                   |
| `findIndex()`     | Returns the index of the first value that satisfies the predicate                      |
| `at()`            | Returns the value at the specified index, matching `Array.prototype.at()`              |
| `includes()`      | Returns true when the value is present, matching `Array.prototype.includes()`          |
| `indexOf()`       | Returns the first matching index, matching `Array.prototype.indexOf()`                 |
| `lastIndexOf()`   | Returns the last matching index, matching `Array.prototype.lastIndexOf()`              |
| `findLast()`      | Returns the last value that satisfies the predicate                                    |
| `findLastIndex()` | Returns the index of the last value that satisfies the predicate                       |
| `min()`           | Returns the minimum value, or `undefined` for an empty sequence                        |
| `minBy()`         | Returns the value with the minimum projected key, or `undefined` for an empty sequence |
| `max()`           | Returns the maximum value, or `undefined` for an empty sequence                        |
| `maxBy()`         | Returns the value with the maximum projected key, or `undefined` for an empty sequence |
| `groupBy()`       | Collects values into a `Map` grouped by projected key                                  |
| `countBy()`       | Counts values into a `Map` grouped by projected key                                    |
| `join()`          | Concatenates the values into a string, matching `Array.prototype.join()`               |
| `toArray()`       | Materializes the resulting values into an array                                        |

Index-based operators such as `slice()`, `at()`, `includes()`, `indexOf()`, and `lastIndexOf()`
follow the corresponding `Array` semantics.
Negative indexes or negative `fromIndex` values may require consuming the source before the result is known.

Materializing operators such as `flat()`, `reverse()`, `toReversed()`, `sort()`, `toSorted()`, and
`reduceRight()` consume the entire source before they can produce results.

### ES2022+ using statement

Use with using statement (requires ES2022+ or equivalent polyfill)

```typescript
const locker = createMutex();

{
  using handler = await locker.lock();

  // (Auto release when exit the scope.)
}

{
  using handle = onAbort(controller.signal, () => {
    console.log('Cleanup on aborts');
  });

  // (Auto release when exit the scope.)
}

// Semaphore with using statement
const semaphore = createSemaphore(3);

{
  using handle = await semaphore.acquire();

  // Perform rate-limited operation
  await performOperation();

  // (Auto release when exit the scope.)
}

// ReaderWriterLock with using statement
const rwLock = createReaderWriterLock();

{
  // Reader scope
  using readHandle = await rwLock.readLock();

  const data = await readSharedData();

  // (Auto release when exit the scope.)
}

{
  // Writer scope
  using writeHandle = await rwLock.writeLock();

  await writeSharedData(newData);

  // (Auto release when exit the scope.)
}
```

## Advanced Topic

### createAsyncLocal()

Provides asynchronous context storage similar to thread-local storage, but separated by asynchronous context instead of threads.
Values are maintained across asynchronous boundaries like `setTimeout`, `await`, and `Promise` chains within the same logical context.

```typescript
import { createAsyncLocal } from 'async-primitives';

// Create an AsyncLocal instance
const asyncLocal = createAsyncLocal<string>();

// Set a value in the current context
asyncLocal.setValue('context value');

// Value is maintained across setTimeout
setTimeout(() => {
  console.log(asyncLocal.getValue()); // 'context value'
}, 100);

// Value is maintained across await boundaries
const example = async () => {
  asyncLocal.setValue('before await');

  await delay(100);

  console.log(asyncLocal.getValue()); // 'before await'
};

// Value is maintained in Promise chains
Promise.resolve()
  .then(() => {
    asyncLocal.setValue('in promise');
    return asyncLocal.getValue();
  })
  .then((value) => {
    console.log(value); // 'in promise'
  });
```

NOTE: The above example is no different than using a variable in the global scope.
In fact, to isolate the "asynchronous context" and observe different results, you must use `LogicalContext` below section.

### LogicalContext Operations

`LogicalContext` provides low-level APIs for managing asynchronous execution contexts.
These are automatically used by `createAsyncLocal()` but can also be used directly for advanced scenarios.

```typescript
import {
  setLogicalContextValue,
  getLogicalContextValue,
  runOnNewLogicalContext,
  getCurrentLogicalContextId,
} from 'async-primitives';

// Direct context value manipulation
const key = Symbol('my-context-key');
setLogicalContextValue(key, 'some value');
const value = getLogicalContextValue<string>(key); // 'some value'

// Get current context ID
const contextId = getCurrentLogicalContextId();
console.log(`Current context: ${contextId.toString()}`);

// Execute code in a new isolated context
const result = runOnNewLogicalContext('my-operation', () => {
  // This runs in a completely new context
  const isolatedValue = getLogicalContextValue<string>(key); // undefined

  setLogicalContextValue(key, 'isolated value');
  return getLogicalContextValue<string>(key); // 'isolated value'
});

// Back to original context
const originalValue = getLogicalContextValue<string>(key); // 'some value'
```

When using `LogicalContext` for the first time, hooks are inserted into various runtime functions and definitions in JavaScript to maintain the context correctly. Note that these create some overhead.

| Target                         | Purpose                                                         |
| :----------------------------- | :-------------------------------------------------------------- |
| `setTimeout`                   | Maintains context across timer callbacks                        |
| `setInterval`                  | Maintains context across interval callbacks                     |
| `queueMicrotask`               | Preserves context in microtask queue                            |
| `setImmediate`                 | Preserves context in immediate queue (Node.js only)             |
| `process.nextTick`             | Preserves context in next tick queue (Node.js only)             |
| `Promise`                      | Captures context for `then()`, `catch()` and `finally()` chains |
| `EventTarget.addEventListener` | Maintains context in all EventTarget event handlers             |
| `Element.addEventListener`     | Maintains context in DOM event handlers                         |
| `requestAnimationFrame`        | Preserves context in animation callbacks                        |
| `XMLHttpRequest`               | Maintains context in XHR event handlers and callbacks           |
| `WebSocket`                    | Maintains context in WebSocket event handlers and callbacks     |
| `MutationObserver`             | Preserves context in DOM mutation observer callbacks            |
| `ResizeObserver`               | Preserves context in element resize observer callbacks          |
| `IntersectionObserver`         | Preserves context in intersection observer callbacks            |
| `Worker`                       | Maintains context in Web Worker event handlers                  |
| `MessagePort`                  | Maintains context in MessagePort communication handlers         |

NOTE: `LogicalContext` values are isolated between different contexts but maintained across asynchronous boundaries within the same context.
This enables proper context isolation in complex asynchronous applications.

### createMutex() Parameter Details

In `createMutex(maxConsecutiveCalls?: number)`, you can specify the `maxConsecutiveCalls` parameter (default value: 20).

This value sets the limit for consecutive executions when processing the lock's waiting queue:

- **Small values (e.g., 1-5)**
  - Returns control to the event loop more frequently
  - Minimizes impact on other asynchronous operations
  - May slightly reduce lock processing throughput

- **Large values (e.g., 50-100)**
  - Executes more lock processes consecutively
  - Improves lock processing throughput
  - May block other asynchronous operations for longer periods

- **Recommended settings**
  - Default value (20) is suitable for most use cases
  - For UI responsiveness priority: lower values (3-7)
  - For high throughput needs like batch processing: higher values (20-100)

```typescript
// Prioritize UI responsiveness
const uiLocker = createMutex(5);

// High throughput processing
const batchLocker = createMutex(50);
```

---

## Benchmark results

These results do not introduce hooks by `LogicalContext`. See [benchmarks/suites/](benchmarks/suites/).

You can run all benchmark suites with:

```bash
npm run benchmark
```

You can also run only the `AsyncOperator` benchmarks:

```bash
npm run benchmark -- --suite=async-operator
```

For machine-readable output:

```bash
npm run --silent benchmark:json -- --suite=async-operator
```

The benchmark table below is generated by `./run_benchmark.sh`. Values depend on the machine and runtime environment.

<!-- benchmark-results:start -->

| Benchmark                                                                | Operations/sec | Avg Time (ms) | Median Time (ms) | Std Dev (ms) | Total Time (ms) |
| ------------------------------------------------------------------------ | -------------- | ------------- | ---------------- | ------------ | --------------- |
| delay(0)                                                                 | 1,074          | 1.083         | 1.078            | 0.076        | 1000.76         |
| delay(1)                                                                 | 1,082          | 1.086         | 1.079            | 0.091        | 1000.59         |
| Mutex acquire/release                                                    | 259,111        | 0.005         | 0.003            | 0.076        | 1000.87         |
| Semaphore(1) acquire/release                                             | 295,582        | 0.004         | 0.003            | 0.069        | 1000            |
| Semaphore(2) acquire/release                                             | 287,243        | 0.005         | 0.003            | 0.081        | 1000            |
| Semaphore(5) acquire/release                                             | 292,272        | 0.004         | 0.003            | 0.08         | 1000            |
| Semaphore(10) acquire/release                                            | 285,535        | 0.005         | 0.003            | 0.074        | 1000            |
| Semaphore(1) sequential (100x)                                           | 11,351         | 0.102         | 0.084            | 0.287        | 1000.04         |
| Semaphore(5) sequential (100x)                                           | 11,316         | 0.103         | 0.084            | 0.297        | 1000.16         |
| Semaphore(1) concurrent (10x)                                            | 65,322         | 0.02          | 0.014            | 0.237        | 1000.02         |
| Semaphore(2) concurrent (10x)                                            | 60,323         | 0.021         | 0.014            | 0.101        | 1000.01         |
| Semaphore(5) concurrent (10x)                                            | 62,271         | 0.021         | 0.014            | 0.229        | 1000.6          |
| Semaphore(2) high contention (20x)                                       | 33,628         | 0.037         | 0.027            | 0.127        | 1000.02         |
| Semaphore(5) high contention (50x)                                       | 15,884         | 0.075         | 0.061            | 0.476        | 1000.01         |
| Semaphore(5) maxCalls=10 sequential (100x)                               | 11,353         | 0.1           | 0.087            | 0.268        | 1001.04         |
| Semaphore(5) maxCalls=50 sequential (100x)                               | 11,368         | 0.11          | 0.086            | 0.915        | 1036.13         |
| Semaphore(5) maxCalls=100 sequential (100x)                              | 11,465         | 0.098         | 0.085            | 0.254        | 1000.03         |
| ReaderWriterLock readLock acquire/release (write-preferring)             | 211,300        | 0.006         | 0.005            | 0.125        | 1003.45         |
| ReaderWriterLock writeLock acquire/release (write-preferring)            | 210,102        | 0.007         | 0.005            | 0.451        | 1000            |
| ReaderWriterLock readLock acquire/release (read-preferring)              | 202,592        | 0.007         | 0.005            | 0.234        | 1000            |
| ReaderWriterLock writeLock acquire/release (read-preferring)             | 206,635        | 0.006         | 0.005            | 0.109        | 1000            |
| ReaderWriterLock sequential reads (100x, write-preferring)               | 10,950         | 0.106         | 0.087            | 0.273        | 1000.09         |
| ReaderWriterLock sequential writes (100x, write-preferring)              | 10,040         | 0.143         | 0.09             | 1.523        | 1000.08         |
| ReaderWriterLock sequential reads (100x, read-preferring)                | 10,966         | 0.106         | 0.086            | 0.259        | 1000.07         |
| ReaderWriterLock sequential writes (100x, read-preferring)               | 11,171         | 0.102         | 0.086            | 0.265        | 1000.08         |
| ReaderWriterLock concurrent readers (10x, write-preferring)              | 64,896         | 0.018         | 0.015            | 0.109        | 1000.01         |
| ReaderWriterLock concurrent readers (20x, write-preferring)              | 38,968         | 0.03          | 0.025            | 0.146        | 1000.02         |
| ReaderWriterLock concurrent readers (10x, read-preferring)               | 65,577         | 0.021         | 0.015            | 0.655        | 1000            |
| ReaderWriterLock concurrent readers (20x, read-preferring)               | 39,536         | 0.029         | 0.025            | 0.14         | 1000.01         |
| ReaderWriterLock read-heavy (100 ops, write-preferring)                  | 7,753          | 0.158         | 0.115            | 0.228        | 1000.01         |
| ReaderWriterLock read-heavy (100 ops, read-preferring)                   | 8,052          | 0.147         | 0.117            | 0.218        | 1000.38         |
| ReaderWriterLock write-heavy (100 ops, write-preferring)                 | 7,698          | 0.152         | 0.126            | 0.764        | 1000.11         |
| ReaderWriterLock write-heavy (100 ops, read-preferring)                  | 7,582          | 0.15          | 0.129            | 0.236        | 1000.11         |
| ReaderWriterLock balanced (100 ops, write-preferring)                    | 7,237          | 0.17          | 0.126            | 0.265        | 1001.98         |
| ReaderWriterLock balanced (100 ops, read-preferring)                     | 8,158          | 0.145         | 0.116            | 0.266        | 1000.02         |
| ReaderWriterLock maxCalls=10 mixed (100 ops, write-preferring)           | 8,268          | 0.137         | 0.116            | 0.204        | 1000.09         |
| ReaderWriterLock maxCalls=50 mixed (100 ops, write-preferring)           | 8,911          | 0.125         | 0.109            | 0.209        | 1000.06         |
| ReaderWriterLock maxCalls=10 mixed (100 ops, read-preferring)            | 8,361          | 0.134         | 0.117            | 0.199        | 1000.07         |
| ReaderWriterLock maxCalls=50 mixed (100 ops, read-preferring)            | 8,953          | 0.124         | 0.108            | 0.207        | 1000.01         |
| ReaderWriterLock write-preference test (50 ops)                          | 15,933         | 0.074         | 0.06             | 0.155        | 1000.03         |
| ReaderWriterLock read-preference test (50 ops)                           | 15,473         | 0.074         | 0.061            | 0.144        | 1000.01         |
| Deferred resolve                                                         | 1,003,856      | 0.001         | 0.001            | 0.004        | 1000            |
| Deferred reject/catch                                                    | 133,475        | 0.008         | 0.007            | 0.051        | 1000            |
| defer callback                                                           | 609,937        | 0.002         | 0.002            | 0.002        | 1000            |
| defer [setTimeout(0)]                                                    | 1,182          | 1.081         | 1.077            | 0.182        | 1001.06         |
| onAbort setup/cleanup                                                    | 775,586        | 0.001         | 0.001            | 0.001        | 1000            |
| Mutex Sequential (1000x) - maxCalls: 1                                   | 828            | 1.581         | 1.092            | 2.062        | 1000.84         |
| Mutex Sequential (1000x) - maxCalls: 5                                   | 821            | 1.544         | 1.073            | 1.654        | 1000.65         |
| Mutex Sequential (1000x) - maxCalls: 10                                  | 866            | 1.329         | 1.067            | 0.902        | 1000.9          |
| Mutex Sequential (1000x) - maxCalls: 20                                  | 895            | 1.24          | 1.068            | 0.765        | 1000.68         |
| Mutex Sequential (1000x) - maxCalls: 50                                  | 846            | 1.403         | 1.055            | 0.941        | 1001.77         |
| Mutex Sequential (1000x) - maxCalls: 100                                 | 894            | 1.258         | 1.045            | 0.777        | 1000.46         |
| Mutex Sequential (1000x) - maxCalls: 1000                                | 920            | 1.267         | 1.044            | 2.515        | 1000.92         |
| Mutex High-freq (500x) - maxCalls: 1                                     | 1,716          | 0.719         | 0.552            | 1.152        | 1000.42         |
| Mutex High-freq (500x) - maxCalls: 5                                     | 1,712          | 0.691         | 0.539            | 0.696        | 1000.49         |
| Mutex High-freq (500x) - maxCalls: 10                                    | 1,780          | 0.637         | 0.538            | 0.578        | 1000.3          |
| Mutex High-freq (500x) - maxCalls: 20                                    | 1,815          | 0.679         | 0.537            | 2.953        | 1000.1          |
| Mutex High-freq (500x) - maxCalls: 50                                    | 1,819          | 0.603         | 0.537            | 0.515        | 1000.39         |
| Mutex High-freq (500x) - maxCalls: 100                                   | 1,813          | 0.602         | 0.536            | 0.491        | 1000.13         |
| Mutex High-freq (500x) - maxCalls: 1000                                  | 1,834          | 0.595         | 0.535            | 0.479        | 1000.35         |
| Mutex Concurrent (20x) - maxCalls: 1                                     | 16,719         | 0.071         | 0.058            | 0.831        | 1000.04         |
| Mutex Concurrent (20x) - maxCalls: 5                                     | 30,918         | 0.037         | 0.031            | 0.106        | 1000.02         |
| Mutex Concurrent (20x) - maxCalls: 10                                    | 35,457         | 0.032         | 0.028            | 0.112        | 1000            |
| Mutex Concurrent (20x) - maxCalls: 20                                    | 38,797         | 0.031         | 0.025            | 0.315        | 1000            |
| Mutex Concurrent (20x) - maxCalls: 50                                    | 39,698         | 0.028         | 0.025            | 0.107        | 1000.02         |
| Mutex Concurrent (20x) - maxCalls: 100                                   | 39,646         | 0.03          | 0.025            | 0.331        | 1000.01         |
| Mutex Concurrent (20x) - maxCalls: 1000                                  | 39,152         | 0.029         | 0.025            | 0.113        | 1000.02         |
| Mutex Ultra-high-freq (2000x) - maxCalls: 1                              | 429            | 2.988         | 2.155            | 4.031        | 1003.9          |
| Mutex Ultra-high-freq (2000x) - maxCalls: 5                              | 450            | 2.43          | 2.108            | 1.233        | 1000.97         |
| Mutex Ultra-high-freq (2000x) - maxCalls: 10                             | 455            | 2.376         | 2.105            | 1.093        | 1000.12         |
| Mutex Ultra-high-freq (2000x) - maxCalls: 20                             | 454            | 2.546         | 2.094            | 3.739        | 1000.65         |
| Mutex Ultra-high-freq (2000x) - maxCalls: 50                             | 458            | 2.333         | 2.095            | 0.956        | 1000.79         |
| Mutex Ultra-high-freq (2000x) - maxCalls: 100                            | 456            | 2.348         | 2.078            | 0.973        | 1000.44         |
| Mutex Ultra-high-freq (2000x) - maxCalls: 1000                           | 457            | 2.339         | 2.102            | 0.97         | 1000.91         |
| Conditional trigger/wait                                                 | 525,765        | 0.002         | 0.002            | 0.006        | 1000            |
| Conditional trigger reaction time                                        | 485,457        | 0.002         | 0.002            | 0.024        | 1000            |
| Conditional multiple waiters with trigger                                | 86,356         | 0.012         | 0.011            | 0.041        | 1000            |
| ManuallyConditional raise/wait                                           | 375,703        | 0.003         | 0.003            | 0.005        | 1000            |
| ManuallyConditional raise reaction time                                  | 366,014        | 0.003         | 0.003            | 0.014        | 1000            |
| ManuallyConditional trigger/wait                                         | 382,759        | 0.003         | 0.003            | 0.027        | 1000            |
| ManuallyConditional trigger reaction time                                | 355,576        | 0.003         | 0.003            | 0.01         | 1000            |
| ManuallyConditional multiple waiters with raise                          | 81,321         | 0.013         | 0.012            | 0.025        | 1000            |
| ManuallyConditional multiple waiters with trigger                        | 78,183         | 0.013         | 0.012            | 0.017        | 1000            |
| Conditional vs ManuallyConditional - single waiter (Conditional)         | 540,861        | 0.002         | 0.002            | 0.004        | 1000            |
| Conditional vs ManuallyConditional - single waiter (ManuallyConditional) | 372,273        | 0.003         | 0.003            | 0.006        | 1000            |
| Conditional vs ManuallyConditional - batch waiters (Conditional)         | 146,693        | 0.007         | 0.007            | 0.004        | 1000.01         |
| Conditional vs ManuallyConditional - batch waiters (ManuallyConditional) | 130,035        | 0.008         | 0.007            | 0.029        | 1000.01         |
| [Comparison] Mutex single acquire/release                                | 259,708        | 0.006         | 0.003            | 0.562        | 1000            |
| [Comparison] Semaphore(1) single acquire/release                         | 299,682        | 0.004         | 0.003            | 0.075        | 1000            |
| [Comparison] Mutex sequential (50x)                                      | 17,488         | 0.074         | 0.054            | 0.849        | 1000.06         |
| [Comparison] Semaphore(1) sequential (50x)                               | 21,430         | 0.056         | 0.044            | 0.197        | 1000.03         |
| [Comparison] RWLock write-only sequential (50x)                          | 19,596         | 0.063         | 0.047            | 0.205        | 1000.01         |
| [Comparison] Mutex concurrent (20x)                                      | 36,904         | 0.032         | 0.026            | 0.122        | 1003.5          |
| [Comparison] Semaphore(1) concurrent (20x)                               | 30,608         | 0.042         | 0.028            | 0.124        | 1000.06         |
| [Comparison] RWLock write-only concurrent (20x)                          | 32,133         | 0.04          | 0.028            | 0.126        | 1000            |
| [Comparison] Semaphore(5) for pool (20 requests)                         | 38,564         | 0.036         | 0.025            | 1.094        | 1000.01         |
| [Comparison] 5 Mutexes round-robin (20 requests)                         | 24,071         | 0.053         | 0.037            | 0.201        | 1000.01         |
| [Comparison] RWLock read-mostly (90% read)                               | 17,228         | 0.066         | 0.056            | 0.172        | 1000.05         |
| [Comparison] Mutex for read-mostly (simulated)                           | 16,288         | 0.076         | 0.06             | 0.825        | 1000.04         |
| [Scenario] Connection Pool - Semaphore(3)                                | 72,053         | 0.016         | 0.014            | 0.1          | 1000.01         |
| [Scenario] Cache - RWLock (70% read, 30% write)                          | 26,320         | 0.044         | 0.037            | 0.173        | 1000.02         |
| [Scenario] Critical Section - Mutex                                      | 49,951         | 0.024         | 0.02             | 0.132        | 1005.46         |
| [HighContention] Mutex (50 concurrent)                                   | 15,432         | 0.073         | 0.064            | 0.192        | 1000            |
| [HighContention] Semaphore(1) (50 concurrent)                            | 15,239         | 0.075         | 0.064            | 0.199        | 1000.05         |
| [HighContention] Semaphore(10) (50 concurrent)                           | 16,618         | 0.071         | 0.058            | 0.228        | 1000.02         |
| [HighContention] RWLock writes (50 concurrent)                           | 15,253         | 0.076         | 0.064            | 0.252        | 1001.12         |
| [HighContention] RWLock reads (50 concurrent)                            | 18,199         | 0.063         | 0.052            | 0.18         | 1000.04         |
| [AsyncOperator] toArray()                                                | 36,727         | 0.028         | 0.026            | 0.024        | 1000.02         |
| [AsyncOperator] toArray() on AsyncIterable                               | 9,192          | 0.112         | 0.106            | 0.045        | 1000.06         |
| [AsyncOperator] map() -> toArray()                                       | 17,498         | 0.06          | 0.055            | 0.047        | 1000            |
| [AsyncOperator] map() -> toArray() on AsyncIterable                      | 5,140          | 0.226         | 0.174            | 0.136        | 1000.44         |
| [AsyncOperator] map(async) -> toArray()                                  | 13,518         | 0.081         | 0.069            | 0.06         | 1000.01         |
| [AsyncOperator] flatMap() -> toArray()                                   | 7,272          | 0.157         | 0.125            | 0.129        | 1000.11         |
| [AsyncOperator] flatMap(async) -> toArray()                              | 6,951          | 0.148         | 0.14             | 0.058        | 1000.06         |
| [AsyncOperator] filter() -> toArray()                                    | 15,020         | 0.071         | 0.063            | 0.048        | 1000.07         |
| [AsyncOperator] filter() -> toArray() on AsyncIterable                   | 6,363          | 0.173         | 0.146            | 0.093        | 1000.11         |
| [AsyncOperator] filter(async) -> toArray()                               | 11,990         | 0.09          | 0.078            | 0.055        | 1000.12         |
| [AsyncOperator] concat() -> toArray()                                    | 18,289         | 0.058         | 0.053            | 0.069        | 1000.02         |
| [AsyncOperator] choose() -> toArray()                                    | 14,735         | 0.074         | 0.064            | 0.052        | 1000.88         |
| [AsyncOperator] slice() -> toArray()                                     | 15,938         | 0.066         | 0.061            | 0.045        | 1000.05         |
| [AsyncOperator] distinct() -> toArray()                                  | 16,856         | 0.063         | 0.056            | 0.047        | 1000.05         |
| [AsyncOperator] distinctBy() -> toArray()                                | 15,943         | 0.067         | 0.059            | 0.067        | 1000.01         |
| [AsyncOperator] skip() -> toArray()                                      | 7,711          | 0.144         | 0.12             | 0.086        | 1000.1          |
| [AsyncOperator] skipWhile() -> toArray()                                 | 14,753         | 0.074         | 0.064            | 0.054        | 1000.05         |
| [AsyncOperator] take() -> toArray()                                      | 15,713         | 0.068         | 0.06             | 0.048        | 1000.01         |
| [AsyncOperator] takeWhile() -> toArray()                                 | 15,307         | 0.072         | 0.06             | 0.053        | 1000.14         |
| [AsyncOperator] pairwise() -> toArray()                                  | 9,951          | 0.115         | 0.091            | 0.084        | 1000.01         |
| [AsyncOperator] zip() -> toArray()                                       | 10,099         | 0.105         | 0.095            | 0.056        | 1000.08         |
| [AsyncOperator] scan() -> toArray()                                      | 11,857         | 0.087         | 0.082            | 0.047        | 1000            |
| [AsyncOperator] union() -> toArray()                                     | 10,105         | 0.102         | 0.096            | 0.047        | 1000.04         |
| [AsyncOperator] unionBy() -> toArray()                                   | 8,533          | 0.132         | 0.107            | 0.079        | 1000.08         |
| [AsyncOperator] intersect() -> toArray()                                 | 12,073         | 0.085         | 0.08             | 0.043        | 1000.03         |
| [AsyncOperator] intersectBy() -> toArray()                               | 10,865         | 0.095         | 0.091            | 0.048        | 1000.05         |
| [AsyncOperator] except() -> toArray()                                    | 12,935         | 0.083         | 0.074            | 0.066        | 1000.01         |
| [AsyncOperator] exceptBy() -> toArray()                                  | 12,592         | 0.081         | 0.078            | 0.044        | 1000.07         |
| [AsyncOperator] chunkBySize() -> toArray()                               | 19,965         | 0.052         | 0.049            | 0.041        | 1000.01         |
| [AsyncOperator] windowed() -> toArray()                                  | 9,945          | 0.104         | 0.097            | 0.048        | 1000.09         |
| [AsyncOperator] flat() -> toArray()                                      | 10,781         | 0.097         | 0.089            | 0.051        | 1000.02         |
| [AsyncOperator] reverse() -> toArray()                                   | 11,057         | 0.094         | 0.089            | 0.048        | 1000.05         |
| [AsyncOperator] toReversed() -> toArray()                                | 11,107         | 0.094         | 0.088            | 0.078        | 1000.05         |
| [AsyncOperator] sort() -> toArray()                                      | 8,306          | 0.123         | 0.117            | 0.048        | 1000.11         |
| [AsyncOperator] toSorted() -> toArray()                                  | 8,700          | 0.12          | 0.11             | 0.055        | 1000.03         |
| [AsyncOperator] forEach()                                                | 41,074         | 0.025         | 0.024            | 0.009        | 1000.02         |
| [AsyncOperator] reduce()                                                 | 39,909         | 0.025         | 0.024            | 0.008        | 1000.02         |
| [AsyncOperator] reduceRight()                                            | 33,283         | 0.03          | 0.029            | 0.014        | 1000.02         |
| [AsyncOperator] some()                                                   | 40,059         | 0.025         | 0.024            | 0.008        | 1000.02         |
| [AsyncOperator] every()                                                  | 40,837         | 0.025         | 0.024            | 0.011        | 1000.02         |
| [AsyncOperator] find()                                                   | 40,632         | 0.025         | 0.024            | 0.008        | 1000.01         |
| [AsyncOperator] findIndex()                                              | 39,717         | 0.026         | 0.024            | 0.011        | 1000.01         |
| [AsyncOperator] at()                                                     | 46,189         | 0.022         | 0.021            | 0.009        | 1000            |
| [AsyncOperator] includes()                                               | 41,313         | 0.025         | 0.024            | 0.011        | 1000.01         |
| [AsyncOperator] indexOf()                                                | 41,459         | 0.024         | 0.024            | 0.008        | 1000.01         |
| [AsyncOperator] lastIndexOf()                                            | 37,385         | 0.027         | 0.026            | 0.009        | 1000.01         |
| [AsyncOperator] findLast()                                               | 40,993         | 0.025         | 0.024            | 0.008        | 1000.01         |
| [AsyncOperator] findLastIndex()                                          | 41,058         | 0.025         | 0.024            | 0.008        | 1000.02         |
| [AsyncOperator] min()                                                    | 38,433         | 0.026         | 0.025            | 0.008        | 1000.02         |
| [AsyncOperator] minBy()                                                  | 36,195         | 0.029         | 0.026            | 0.015        | 1000.02         |
| [AsyncOperator] max()                                                    | 35,691         | 0.031         | 0.026            | 0.019        | 1000.01         |
| [AsyncOperator] maxBy()                                                  | 34,688         | 0.031         | 0.027            | 0.017        | 1000.02         |
| [AsyncOperator] groupBy()                                                | 30,537         | 0.035         | 0.031            | 0.017        | 1000.03         |
| [AsyncOperator] countBy()                                                | 30,991         | 0.034         | 0.031            | 0.014        | 1000.02         |
| [AsyncOperator] join()                                                   | 35,589         | 0.029         | 0.027            | 0.01         | 1000            |
| [AsyncOperator] linear chain(depth=5) -> toArray()                       | 6,558          | 0.156         | 0.151            | 0.057        | 1000.07         |
| [AsyncOperator] linear chain(depth=5, async callbacks) -> toArray()      | 5,525          | 0.186         | 0.176            | 0.069        | 1000.13         |

**Test Environment:** Node.js v24.11.1, linux x64  
**CPU:** Intel(R) Core(TM) i9-9980XE CPU @ 3.00GHz  
**Memory:** 62GB  
**Last Updated:** 2026-04-02

<!-- benchmark-results:end -->

---

## License

Under MIT.
