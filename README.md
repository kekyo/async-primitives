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
| delay(0)                                                                 | 1,129          | 1.097         | 1.078            | 0.437        | 1000.07         |
| delay(1)                                                                 | 1,183          | 1.082         | 1.077            | 0.103        | 1000.79         |
| Mutex acquire/release                                                    | 281,523        | 0.004         | 0.003            | 0.075        | 1003.62         |
| Semaphore(1) acquire/release                                             | 308,253        | 0.004         | 0.003            | 0.068        | 1000            |
| Semaphore(2) acquire/release                                             | 301,319        | 0.004         | 0.003            | 0.072        | 1000            |
| Semaphore(5) acquire/release                                             | 291,528        | 0.005         | 0.003            | 0.076        | 1000            |
| Semaphore(10) acquire/release                                            | 283,545        | 0.005         | 0.003            | 0.072        | 1000            |
| Semaphore(1) sequential (100x)                                           | 11,135         | 0.106         | 0.084            | 0.257        | 1000.02         |
| Semaphore(5) sequential (100x)                                           | 10,544         | 0.114         | 0.087            | 0.279        | 1000.01         |
| Semaphore(1) concurrent (10x)                                            | 69,665         | 0.017         | 0.014            | 0.099        | 1000            |
| Semaphore(2) concurrent (10x)                                            | 69,318         | 0.017         | 0.014            | 0.229        | 1000            |
| Semaphore(5) concurrent (10x)                                            | 68,521         | 0.017         | 0.014            | 0.097        | 1000.01         |
| Semaphore(2) high contention (20x)                                       | 36,118         | 0.034         | 0.026            | 0.204        | 1000.02         |
| Semaphore(5) high contention (50x)                                       | 13,937         | 0.09          | 0.062            | 0.189        | 1000            |
| Semaphore(5) maxCalls=10 sequential (100x)                               | 10,856         | 0.117         | 0.085            | 0.816        | 1000.07         |
| Semaphore(5) maxCalls=50 sequential (100x)                               | 11,214         | 0.105         | 0.084            | 0.27         | 1000.04         |
| Semaphore(5) maxCalls=100 sequential (100x)                              | 11,063         | 0.104         | 0.084            | 0.244        | 1000.01         |
| ReaderWriterLock readLock acquire/release (write-preferring)             | 218,355        | 0.007         | 0.004            | 0.245        | 1004.07         |
| ReaderWriterLock writeLock acquire/release (write-preferring)            | 200,512        | 0.007         | 0.005            | 0.107        | 1000            |
| ReaderWriterLock readLock acquire/release (read-preferring)              | 190,682        | 0.008         | 0.005            | 0.263        | 1005.49         |
| ReaderWriterLock writeLock acquire/release (read-preferring)             | 206,833        | 0.006         | 0.004            | 0.108        | 1000            |
| ReaderWriterLock sequential reads (100x, write-preferring)               | 11,208         | 0.1           | 0.087            | 0.251        | 1000.05         |
| ReaderWriterLock sequential writes (100x, write-preferring)              | 11,045         | 0.114         | 0.087            | 0.971        | 1000.07         |
| ReaderWriterLock sequential reads (100x, read-preferring)                | 11,242         | 0.101         | 0.087            | 0.277        | 1000.08         |
| ReaderWriterLock sequential writes (100x, read-preferring)               | 11,015         | 0.104         | 0.086            | 0.282        | 1000.02         |
| ReaderWriterLock concurrent readers (10x, write-preferring)              | 67,583         | 0.017         | 0.015            | 0.108        | 1000.01         |
| ReaderWriterLock concurrent readers (20x, write-preferring)              | 39,038         | 0.03          | 0.025            | 0.158        | 1000.02         |
| ReaderWriterLock concurrent readers (10x, read-preferring)               | 65,140         | 0.025         | 0.015            | 1.237        | 1000            |
| ReaderWriterLock concurrent readers (20x, read-preferring)               | 37,899         | 0.031         | 0.025            | 0.135        | 1000.06         |
| ReaderWriterLock read-heavy (100 ops, write-preferring)                  | 8,404          | 0.134         | 0.114            | 0.227        | 1000.02         |
| ReaderWriterLock read-heavy (100 ops, read-preferring)                   | 8,321          | 0.137         | 0.113            | 0.205        | 1000.05         |
| ReaderWriterLock write-heavy (100 ops, write-preferring)                 | 6,726          | 0.203         | 0.131            | 1.255        | 1000.24         |
| ReaderWriterLock write-heavy (100 ops, read-preferring)                  | 7,588          | 0.149         | 0.126            | 0.207        | 1000.06         |
| ReaderWriterLock balanced (100 ops, write-preferring)                    | 8,157          | 0.137         | 0.119            | 0.207        | 1000.91         |
| ReaderWriterLock balanced (100 ops, read-preferring)                     | 8,453          | 0.134         | 0.116            | 0.246        | 1000.05         |
| ReaderWriterLock maxCalls=10 mixed (100 ops, write-preferring)           | 8,301          | 0.138         | 0.118            | 0.275        | 1003.4          |
| ReaderWriterLock maxCalls=50 mixed (100 ops, write-preferring)           | 8,906          | 0.124         | 0.109            | 0.199        | 1000.11         |
| ReaderWriterLock maxCalls=10 mixed (100 ops, read-preferring)            | 8,293          | 0.136         | 0.115            | 0.2          | 1000.01         |
| ReaderWriterLock maxCalls=50 mixed (100 ops, read-preferring)            | 8,899          | 0.127         | 0.108            | 0.211        | 1000.11         |
| ReaderWriterLock write-preference test (50 ops)                          | 16,662         | 0.068         | 0.058            | 0.147        | 1000.03         |
| ReaderWriterLock read-preference test (50 ops)                           | 15,323         | 0.076         | 0.062            | 0.149        | 1000.01         |
| Deferred resolve                                                         | 1,051,337      | 0.001         | 0.001            | 0.002        | 1000            |
| Deferred reject/catch                                                    | 142,576        | 0.008         | 0.007            | 0.006        | 1000            |
| defer callback                                                           | 580,250        | 0.002         | 0.002            | 0.015        | 1000            |
| defer [setTimeout(0)]                                                    | 1,078          | 1.081         | 1.077            | 0.084        | 1000.28         |
| onAbort setup/cleanup                                                    | 742,394        | 0.001         | 0.001            | 0.005        | 1000            |
| Mutex Sequential (1000x) - maxCalls: 1                                   | 785            | 1.633         | 1.137            | 1.695        | 1001.07         |
| Mutex Sequential (1000x) - maxCalls: 5                                   | 840            | 1.448         | 1.117            | 1.914        | 1000.33         |
| Mutex Sequential (1000x) - maxCalls: 10                                  | 889            | 1.239         | 1.079            | 0.823        | 1001.46         |
| Mutex Sequential (1000x) - maxCalls: 20                                  | 866            | 1.298         | 1.091            | 0.837        | 1003.54         |
| Mutex Sequential (1000x) - maxCalls: 50                                  | 843            | 1.359         | 1.084            | 0.872        | 1000.36         |
| Mutex Sequential (1000x) - maxCalls: 100                                 | 899            | 1.207         | 1.073            | 0.71         | 1000.39         |
| Mutex Sequential (1000x) - maxCalls: 1000                                | 892            | 1.358         | 1.074            | 3.802        | 1001.01         |
| Mutex High-freq (500x) - maxCalls: 1                                     | 1,762          | 0.703         | 0.544            | 1.173        | 1000.05         |
| Mutex High-freq (500x) - maxCalls: 5                                     | 1,763          | 0.673         | 0.527            | 0.688        | 1000.93         |
| Mutex High-freq (500x) - maxCalls: 10                                    | 1,762          | 0.655         | 0.525            | 0.589        | 1000.21         |
| Mutex High-freq (500x) - maxCalls: 20                                    | 1,816          | 0.617         | 0.527            | 0.537        | 1000.07         |
| Mutex High-freq (500x) - maxCalls: 50                                    | 1,846          | 0.604         | 0.522            | 0.512        | 1000.18         |
| Mutex High-freq (500x) - maxCalls: 100                                   | 1,833          | 0.692         | 0.523            | 3.195        | 1000.38         |
| Mutex High-freq (500x) - maxCalls: 1000                                  | 1,819          | 0.618         | 0.525            | 0.538        | 1000.26         |
| Mutex Concurrent (20x) - maxCalls: 1                                     | 16,212         | 0.074         | 0.06             | 0.862        | 1000.06         |
| Mutex Concurrent (20x) - maxCalls: 5                                     | 29,115         | 0.042         | 0.031            | 0.113        | 1000.03         |
| Mutex Concurrent (20x) - maxCalls: 10                                    | 35,276         | 0.033         | 0.027            | 0.113        | 1000.03         |
| Mutex Concurrent (20x) - maxCalls: 20                                    | 38,028         | 0.032         | 0.024            | 0.124        | 1001.68         |
| Mutex Concurrent (20x) - maxCalls: 50                                    | 39,007         | 0.03          | 0.024            | 0.121        | 1000.01         |
| Mutex Concurrent (20x) - maxCalls: 100                                   | 38,319         | 0.031         | 0.024            | 0.114        | 1000.02         |
| Mutex Concurrent (20x) - maxCalls: 1000                                  | 38,998         | 0.03          | 0.024            | 0.128        | 1000.02         |
| Mutex Ultra-high-freq (2000x) - maxCalls: 1                              | 422            | 3.034         | 2.191            | 3.103        | 1001.1          |
| Mutex Ultra-high-freq (2000x) - maxCalls: 5                              | 447            | 2.661         | 2.122            | 4.316        | 1000.55         |
| Mutex Ultra-high-freq (2000x) - maxCalls: 10                             | 457            | 2.351         | 2.103            | 1.025        | 1001.72         |
| Mutex Ultra-high-freq (2000x) - maxCalls: 20                             | 460            | 2.335         | 2.07             | 1.012        | 1001.67         |
| Mutex Ultra-high-freq (2000x) - maxCalls: 50                             | 462            | 2.315         | 2.071            | 0.964        | 1000            |
| Mutex Ultra-high-freq (2000x) - maxCalls: 100                            | 462            | 2.307         | 2.069            | 0.929        | 1001.27         |
| Mutex Ultra-high-freq (2000x) - maxCalls: 1000                           | 461            | 2.318         | 2.072            | 0.957        | 1001.52         |
| Conditional trigger/wait                                                 | 545,092        | 0.002         | 0.002            | 0.004        | 1000            |
| Conditional trigger reaction time                                        | 496,343        | 0.002         | 0.002            | 0.006        | 1000            |
| Conditional multiple waiters with trigger                                | 84,360         | 0.012         | 0.011            | 0.013        | 1000.01         |
| ManuallyConditional raise/wait                                           | 383,459        | 0.003         | 0.003            | 0.289        | 1000            |
| ManuallyConditional raise reaction time                                  | 337,461        | 0.003         | 0.003            | 0.035        | 1000            |
| ManuallyConditional trigger/wait                                         | 383,730        | 0.003         | 0.003            | 0.005        | 1000            |
| ManuallyConditional trigger reaction time                                | 370,442        | 0.003         | 0.003            | 0.014        | 1000            |
| ManuallyConditional multiple waiters with raise                          | 81,807         | 0.013         | 0.012            | 0.012        | 1000.01         |
| ManuallyConditional multiple waiters with trigger                        | 81,099         | 0.013         | 0.012            | 0.013        | 1000            |
| Conditional vs ManuallyConditional - single waiter (Conditional)         | 523,667        | 0.002         | 0.002            | 0.005        | 1000            |
| Conditional vs ManuallyConditional - single waiter (ManuallyConditional) | 387,943        | 0.003         | 0.003            | 0.014        | 1000            |
| Conditional vs ManuallyConditional - batch waiters (Conditional)         | 144,254        | 0.008         | 0.006            | 0.009        | 1000            |
| Conditional vs ManuallyConditional - batch waiters (ManuallyConditional) | 135,470        | 0.008         | 0.007            | 0.02         | 1000            |
| [Comparison] Mutex single acquire/release                                | 265,632        | 0.005         | 0.003            | 0.212        | 1000            |
| [Comparison] Semaphore(1) single acquire/release                         | 287,212        | 0.005         | 0.003            | 0.085        | 1006.08         |
| [Comparison] Mutex sequential (50x)                                      | 17,689         | 0.066         | 0.054            | 0.176        | 1000.02         |
| [Comparison] Semaphore(1) sequential (50x)                               | 22,212         | 0.053         | 0.043            | 0.195        | 1000.03         |
| [Comparison] RWLock write-only sequential (50x)                          | 21,037         | 0.055         | 0.047            | 0.193        | 1000.03         |
| [Comparison] Mutex concurrent (20x)                                      | 36,846         | 0.038         | 0.026            | 0.839        | 1000.01         |
| [Comparison] Semaphore(1) concurrent (20x)                               | 36,424         | 0.033         | 0.026            | 0.125        | 1000.01         |
| [Comparison] RWLock write-only concurrent (20x)                          | 35,303         | 0.032         | 0.027            | 0.134        | 1004.24         |
| [Comparison] Semaphore(5) for pool (20 requests)                         | 35,512         | 0.034         | 0.026            | 0.127        | 1000.01         |
| [Comparison] 5 Mutexes round-robin (20 requests)                         | 27,077         | 0.043         | 0.036            | 0.178        | 1000.01         |
| [Comparison] RWLock read-mostly (90% read)                               | 17,414         | 0.064         | 0.056            | 0.165        | 1000.01         |
| [Comparison] Mutex for read-mostly (simulated)                           | 16,235         | 0.076         | 0.06             | 0.861        | 1000.05         |
| [Scenario] Connection Pool - Semaphore(3)                                | 72,612         | 0.016         | 0.013            | 0.098        | 1000            |
| [Scenario] Cache - RWLock (70% read, 30% write)                          | 26,192         | 0.044         | 0.038            | 0.172        | 1000.03         |
| [Scenario] Critical Section - Mutex                                      | 48,895         | 0.024         | 0.02             | 0.13         | 1000.01         |
| [HighContention] Mutex (50 concurrent)                                   | 14,522         | 0.084         | 0.064            | 0.23         | 1000.01         |
| [HighContention] Semaphore(1) (50 concurrent)                            | 15,178         | 0.075         | 0.062            | 0.148        | 1000.06         |
| [HighContention] Semaphore(10) (50 concurrent)                           | 16,983         | 0.068         | 0.056            | 0.162        | 1000.18         |
| [HighContention] RWLock writes (50 concurrent)                           | 14,284         | 0.082         | 0.065            | 0.161        | 1000.02         |
| [HighContention] RWLock reads (50 concurrent)                            | 18,206         | 0.063         | 0.053            | 0.173        | 1000.05         |
| [AsyncOperator] toArray()                                                | 37,350         | 0.027         | 0.026            | 0.03         | 1000.01         |
| [AsyncOperator] toArray() on AsyncIterable                               | 8,935          | 0.127         | 0.102            | 0.089        | 1000.06         |
| [AsyncOperator] map() -> toArray()                                       | 17,729         | 0.059         | 0.055            | 0.061        | 1000.04         |
| [AsyncOperator] map() -> toArray() on AsyncIterable                      | 5,874          | 0.175         | 0.166            | 0.064        | 1000.16         |
| [AsyncOperator] map(async) -> toArray()                                  | 14,391         | 0.073         | 0.067            | 0.048        | 1000.03         |
| [AsyncOperator] flatMap() -> toArray()                                   | 7,337          | 0.151         | 0.124            | 0.083        | 1000.08         |
| [AsyncOperator] flatMap(async) -> toArray()                              | 6,397          | 0.176         | 0.14             | 0.098        | 1000.12         |
| [AsyncOperator] filter() -> toArray()                                    | 14,458         | 0.077         | 0.063            | 0.059        | 1000.06         |
| [AsyncOperator] filter() -> toArray() on AsyncIterable                   | 6,393          | 0.174         | 0.145            | 0.097        | 1000.15         |
| [AsyncOperator] filter(async) -> toArray()                               | 10,968         | 0.107         | 0.08             | 0.075        | 1000.05         |
| [AsyncOperator] concat() -> toArray()                                    | 18,520         | 0.056         | 0.053            | 0.064        | 1000.02         |
| [AsyncOperator] choose() -> toArray()                                    | 15,244         | 0.069         | 0.062            | 0.052        | 1000.03         |
| [AsyncOperator] slice() -> toArray()                                     | 16,157         | 0.065         | 0.059            | 0.048        | 1000.02         |
| [AsyncOperator] distinct() -> toArray()                                  | 16,192         | 0.069         | 0.057            | 0.055        | 1000.02         |
| [AsyncOperator] distinctBy() -> toArray()                                | 15,879         | 0.068         | 0.059            | 0.052        | 1000.04         |
| [AsyncOperator] skip() -> toArray()                                      | 8,227          | 0.126         | 0.118            | 0.059        | 1000.09         |
| [AsyncOperator] skipWhile() -> toArray()                                 | 15,701         | 0.066         | 0.062            | 0.047        | 1000            |
| [AsyncOperator] take() -> toArray()                                      | 16,226         | 0.065         | 0.059            | 0.053        | 1000            |
| [AsyncOperator] takeWhile() -> toArray()                                 | 16,334         | 0.064         | 0.06             | 0.05         | 1000.04         |
| [AsyncOperator] pairwise() -> toArray()                                  | 11,112         | 0.093         | 0.087            | 0.051        | 1000.08         |
| [AsyncOperator] zip() -> toArray()                                       | 10,325         | 0.1           | 0.093            | 0.055        | 1000.06         |
| [AsyncOperator] scan() -> toArray()                                      | 12,033         | 0.086         | 0.081            | 0.054        | 1000.07         |
| [AsyncOperator] union() -> toArray()                                     | 10,189         | 0.102         | 0.095            | 0.057        | 1000.06         |
| [AsyncOperator] unionBy() -> toArray()                                   | 8,883          | 0.122         | 0.104            | 0.08         | 1000.14         |
| [AsyncOperator] intersect() -> toArray()                                 | 11,820         | 0.09          | 0.08             | 0.059        | 1000.06         |
| [AsyncOperator] intersectBy() -> toArray()                               | 10,946         | 0.097         | 0.087            | 0.063        | 1000.06         |
| [AsyncOperator] except() -> toArray()                                    | 13,062         | 0.086         | 0.07             | 0.065        | 1000.02         |
| [AsyncOperator] exceptBy() -> toArray()                                  | 12,616         | 0.085         | 0.075            | 0.06         | 1000.01         |
| [AsyncOperator] chunkBySize() -> toArray()                               | 19,869         | 0.053         | 0.048            | 0.047        | 1000            |
| [AsyncOperator] windowed() -> toArray()                                  | 9,627          | 0.113         | 0.097            | 0.074        | 1000.05         |
| [AsyncOperator] flat() -> toArray()                                      | 10,419         | 0.106         | 0.088            | 0.071        | 1000.04         |
| [AsyncOperator] reverse() -> toArray()                                   | 11,326         | 0.092         | 0.086            | 0.056        | 1000.03         |
| [AsyncOperator] toReversed() -> toArray()                                | 11,282         | 0.092         | 0.086            | 0.048        | 1000.07         |
| [AsyncOperator] sort() -> toArray()                                      | 8,405          | 0.122         | 0.116            | 0.05         | 1000.73         |
| [AsyncOperator] toSorted() -> toArray()                                  | 8,890          | 0.116         | 0.109            | 0.049        | 1000.09         |
| [AsyncOperator] forEach()                                                | 40,916         | 0.025         | 0.024            | 0.011        | 1000            |
| [AsyncOperator] reduce()                                                 | 37,216         | 0.029         | 0.025            | 0.017        | 1000.02         |
| [AsyncOperator] reduceRight()                                            | 32,067         | 0.033         | 0.029            | 0.015        | 1000            |
| [AsyncOperator] some()                                                   | 38,119         | 0.028         | 0.024            | 0.015        | 1000            |
| [AsyncOperator] every()                                                  | 40,287         | 0.026         | 0.024            | 0.013        | 1000.01         |
| [AsyncOperator] find()                                                   | 40,737         | 0.025         | 0.024            | 0.01         | 1000.01         |
| [AsyncOperator] findIndex()                                              | 39,229         | 0.027         | 0.024            | 0.019        | 1000            |
| [AsyncOperator] at()                                                     | 43,447         | 0.025         | 0.021            | 0.018        | 1000            |
| [AsyncOperator] includes()                                               | 41,318         | 0.025         | 0.023            | 0.01         | 1000.02         |
| [AsyncOperator] indexOf()                                                | 40,832         | 0.025         | 0.023            | 0.011        | 1000            |
| [AsyncOperator] lastIndexOf()                                            | 37,086         | 0.028         | 0.026            | 0.016        | 1000.02         |
| [AsyncOperator] findLast()                                               | 41,246         | 0.025         | 0.024            | 0.01         | 1000.01         |
| [AsyncOperator] findLastIndex()                                          | 41,308         | 0.025         | 0.024            | 0.012        | 1000.01         |
| [AsyncOperator] min()                                                    | 38,366         | 0.026         | 0.025            | 0.013        | 1000.01         |
| [AsyncOperator] minBy()                                                  | 34,623         | 0.032         | 0.027            | 0.019        | 1000.01         |
| [AsyncOperator] max()                                                    | 38,280         | 0.026         | 0.026            | 0.01         | 1000.01         |
| [AsyncOperator] maxBy()                                                  | 36,919         | 0.027         | 0.026            | 0.011        | 1000.01         |
| [AsyncOperator] groupBy()                                                | 31,814         | 0.032         | 0.031            | 0.012        | 1000.02         |
| [AsyncOperator] countBy()                                                | 29,442         | 0.038         | 0.031            | 0.021        | 1000.01         |
| [AsyncOperator] join()                                                   | 35,721         | 0.028         | 0.027            | 0.012        | 1000.01         |
| [AsyncOperator] linear chain(depth=5) -> toArray()                       | 6,359          | 0.169         | 0.149            | 0.089        | 1000.39         |
| [AsyncOperator] linear chain(depth=5, async callbacks) -> toArray()      | 5,409          | 0.194         | 0.181            | 0.088        | 1000.15         |

**Test Environment:** Node.js v24.11.1, linux x64  
**CPU:** Intel(R) Core(TM) i9-9980XE CPU @ 3.00GHz  
**Memory:** 62GB  
**Last Updated:** 2026-04-02

<!-- benchmark-results:end -->

---

## License

Under MIT.
