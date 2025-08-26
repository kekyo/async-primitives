# async-primitives

A collection of primitive functions for asynchronous operations in TypeScript/JavaScript.

[![Project Status: Active – The project has reached a stable, usable state and is being actively developed.](https://www.repostatus.org/badges/latest/active.svg)](https://www.repostatus.org/#active)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/async-primitives.svg)](https://www.npmjs.com/package/async-primitives)

----

## What is this?

If you are interested in performing additional calculations on `Promise<T>`, you may find this small library useful.
Mutex, producer-consumer separation (side-effect operation), signaling (flag control), logical context and more.

* Works in both browser and Node.js environments (16 or later, tested only 22).
* No external dependencies.

| Function | Description |
|:---------|:------------|
| `delay()` | Promise-based delay function |
| `defer()` | Schedule callback for next event loop |
| `onAbort()` | Register safer abort signal hooks with cleanup |
| `createMutex()` | Promise-based mutex lock for critical sections |
| `createSemaphore()` | Promise-based semaphore for limiting concurrent access |
| `createReaderWriterLock()` | Read-write lock for multiple readers/single writer |
| `createDeferred()` | External control of Promise resolution/rejection |
| `createDeferredGenerator()` | External control of async generator with queue management |
| `createConditional()` | Automatic conditional trigger (one-waiter per trigger) |
| `createManuallyConditional()` | Manual conditional control (raise/drop state) |

Advanced features:

| Function | Description |
|:---------|:------------|
| `createAsyncLocal()` | Asynchronous context storage |
| `LogicalContext` | Low-level async execution context management |

* The implementations previously known symbol as `AsyncLock` and `Signal` have been changed to `Mutex` and `Conditional`.
  Although these symbol names can still be used, please note that they are marked as deprecated.
  They may be removed in future versions.

## Installation

```bash
npm install async-primitives
```

----

## Usage

Each functions are independent and does not require knowledge of each other's assumptions.

### delay()

Provides a delay that can be awaited with `Promise<void>`, with support for cancellation via `AbortSignal.`

```typescript
import { delay } from 'async-primitives';

// Use delay
await delay(1000);   // Wait for 1 second
```

```typescript
// With AbortSignal
const c = new AbortController();
await delay(1000, c.signal);   // Wait for 1 second
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

const releaseHandle = onAbort(controller.signal, () => {
  console.log('Operation was aborted!');
  // (Will automatically cleanup when exit)
});

// Cleanup early if needed
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

deferred.resolve(123);         // (Produce result value)
deferred.reject(new Error());  // (Produce an error)

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
const urls = ['url1', 'url2', /* ... many more ... */];
const promises = urls.map(url => rateLimitedFetch(url));
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
Uses a write-preferring policy: when a writer is waiting, new readers must wait until the writer completes.

```typescript
import { createReaderWriterLock } from 'async-primitives';

// Create a reader-writer lock
const rwLock = createReaderWriterLock();

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
}

// Value is maintained in Promise chains
Promise.resolve().
  then(() => {
    asyncLocal.setValue('in promise');
    return asyncLocal.getValue();
  }).
  then((value) => {
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
  getCurrentLogicalContextId 
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

| Target | Purpose |
|:----|:----|
| `setTimeout` | Maintains context across timer callbacks |
| `setInterval` | Maintains context across interval callbacks |
| `queueMicrotask` | Preserves context in microtask queue |
| `setImmediate` | Preserves context in immediate queue (Node.js only) |
| `process.nextTick` | Preserves context in next tick queue (Node.js only) |
| `Promise` | Captures context for `then()`, `catch()` and `finally()` chains |
| `EventTarget.addEventListener` | Maintains context in all EventTarget event handlers |
| `Element.addEventListener` | Maintains context in DOM event handlers |
| `requestAnimationFrame` | Preserves context in animation callbacks |
| `XMLHttpRequest` | Maintains context in XHR event handlers and callbacks |
| `WebSocket` | Maintains context in WebSocket event handlers and callbacks |
| `MutationObserver` | Preserves context in DOM mutation observer callbacks |
| `ResizeObserver` | Preserves context in element resize observer callbacks |
| `IntersectionObserver` | Preserves context in intersection observer callbacks |
| `Worker` | Maintains context in Web Worker event handlers |
| `MessagePort` | Maintains context in MessagePort communication handlers |

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

----

## Benchmark results

These results do not introduce hooks by `LogicalContext`. See [benchmark/suites/](benchmark/suites/).

| Benchmark | Operations/sec | Avg Time (ms) | Median Time (ms) | Std Dev (ms) | Total Time (ms) |
|-----------|----------------|---------------|------------------|--------------|-----------------|
| delay(0) | 931 | 1078.542 | 1069.133 | 92.286 | 1000.89 |
| delay(1) | 932 | 1077.451 | 1067.705 | 92.411 | 1000.95 |
| Mutex acquire/release | 273,564 | 4.834 | 3.587 | 53.087 | 1000 |
| Semaphore(1) acquire/release | 291,792 | 4.36 | 3.357 | 41.805 | 1000 |
| Semaphore(2) acquire/release | 291,608 | 4.351 | 3.357 | 41.693 | 1000 |
| Semaphore(5) acquire/release | 292,161 | 4.361 | 3.356 | 42.633 | 1000 |
| Semaphore(10) acquire/release | 291,035 | 4.367 | 3.376 | 43.117 | 1002.05 |
| Semaphore(1) sequential (100x) | 9,994 | 112.61 | 97.943 | 149.24 | 1000.09 |
| Semaphore(5) sequential (100x) | 9,990 | 113.73 | 97.191 | 153.556 | 1000.03 |
| Semaphore(1) concurrent (10x) | 64,219 | 18.304 | 15.069 | 58.654 | 1000.01 |
| Semaphore(2) concurrent (10x) | 64,817 | 17.739 | 15.059 | 55.343 | 1001.13 |
| Semaphore(5) concurrent (10x) | 66,705 | 17.572 | 14.607 | 60.795 | 1000.01 |
| Semaphore(2) high contention (20x) | 34,638 | 33.201 | 28.253 | 74.085 | 1000 |
| Semaphore(5) high contention (50x) | 14,747 | 76.792 | 66.083 | 107.342 | 1000.06 |
| Semaphore(5) maxCalls=10 sequential (100x) | 10,009 | 114.149 | 97.712 | 161.721 | 1000.06 |
| Semaphore(5) maxCalls=50 sequential (100x) | 9,934 | 114.202 | 98.584 | 155.062 | 1000.07 |
| Semaphore(5) maxCalls=100 sequential (100x) | 9,579 | 124.289 | 98.674 | 185.104 | 1000.03 |
| ReaderWriterLock readLock acquire/release | 207,783 | 6.443 | 4.719 | 72.057 | 1000 |
| ReaderWriterLock writeLock acquire/release | 205,294 | 7.216 | 4.729 | 203.761 | 1000 |
| ReaderWriterLock sequential reads (100x) | 9,768 | 119.362 | 100.206 | 227.687 | 1000.01 |
| ReaderWriterLock sequential writes (100x) | 9,806 | 119.135 | 99.927 | 202.788 | 1000.02 |
| ReaderWriterLock concurrent readers (10x) | 61,817 | 22.721 | 15.629 | 452.624 | 1000.01 |
| ReaderWriterLock concurrent readers (20x) | 36,769 | 32.31 | 26.68 | 97.082 | 1000.01 |
| ReaderWriterLock read-heavy (100 ops) | 7,973 | 149.426 | 121.618 | 207.635 | 1000.11 |
| ReaderWriterLock write-heavy (100 ops) | 7,117 | 166.553 | 135.584 | 579.167 | 1000.15 |
| ReaderWriterLock balanced (100 ops) | 7,456 | 154.91 | 129.623 | 166.465 | 1000.1 |
| ReaderWriterLock maxCalls=10 mixed (100 ops) | 7,751 | 150.359 | 124.523 | 176.534 | 1000.04 |
| ReaderWriterLock maxCalls=50 mixed (100 ops) | 8,069 | 148.446 | 120.024 | 219.79 | 1000.08 |
| ReaderWriterLock write-preference test (50 ops) | 15,326 | 75.345 | 63.348 | 116.592 | 1000.8 |
| Deferred resolve | 953,940 | 1.108 | 1.042 | 3.615 | 1000 |
| Deferred reject/catch | 161,968 | 6.309 | 6.111 | 5.603 | 1000 |
| defer callback | 644,806 | 1.594 | 1.533 | 2.269 | 1000 |
| defer [setTimeout(0)] | 936 | 1069.769 | 1065.973 | 54.114 | 1000.23 |
| onAbort setup/cleanup | 713,226 | 1.44 | 1.393 | 1.862 | 1000 |
| Mutex Sequential (1000x) - maxCalls: 1 | 781 | 1413.415 | 1173.743 | 606.338 | 1000.7 |
| Mutex Sequential (1000x) - maxCalls: 5 | 807 | 1322.711 | 1153.355 | 443.829 | 1001.29 |
| Mutex Sequential (1000x) - maxCalls: 10 | 795 | 1366.651 | 1157.824 | 547.501 | 1000.39 |
| Mutex Sequential (1000x) - maxCalls: 20 | 812 | 1309.284 | 1147.32 | 429.081 | 1000.29 |
| Mutex Sequential (1000x) - maxCalls: 50 | 814 | 1300.651 | 1150.36 | 402.944 | 1000.2 |
| Mutex Sequential (1000x) - maxCalls: 100 | 817 | 1294.504 | 1145.952 | 399.962 | 1000.65 |
| Mutex Sequential (1000x) - maxCalls: 1000 | 816 | 1300.874 | 1145.941 | 416.999 | 1001.67 |
| Mutex High-freq (500x) - maxCalls: 1 | 1,575 | 803.453 | 592.096 | 1906.558 | 1000.3 |
| Mutex High-freq (500x) - maxCalls: 5 | 1,640 | 677.799 | 582.247 | 377.246 | 1000.43 |
| Mutex High-freq (500x) - maxCalls: 10 | 1,649 | 665.156 | 579.778 | 337.74 | 1000.4 |
| Mutex High-freq (500x) - maxCalls: 20 | 1,651 | 660.603 | 578.726 | 318.103 | 1000.15 |
| Mutex High-freq (500x) - maxCalls: 50 | 1,655 | 657.104 | 578.646 | 311.876 | 1000.11 |
| Mutex High-freq (500x) - maxCalls: 100 | 1,645 | 664.515 | 578.511 | 323.039 | 1000.09 |
| Mutex High-freq (500x) - maxCalls: 1000 | 1,650 | 660.998 | 578.532 | 321.481 | 1000.09 |
| Mutex Concurrent (20x) - maxCalls: 1 | 18,016 | 67.76 | 54.331 | 782.928 | 1000 |
| Mutex Concurrent (20x) - maxCalls: 5 | 30,072 | 39.245 | 32.291 | 98.65 | 1000.03 |
| Mutex Concurrent (20x) - maxCalls: 10 | 33,624 | 34.613 | 29.075 | 87.785 | 1000.03 |
| Mutex Concurrent (20x) - maxCalls: 20 | 36,580 | 30.995 | 26.93 | 68.354 | 1000.02 |
| Mutex Concurrent (20x) - maxCalls: 50 | 36,155 | 32.085 | 26.87 | 74.871 | 1000.02 |
| Mutex Concurrent (20x) - maxCalls: 100 | 36,566 | 30.968 | 26.87 | 67.652 | 1000.38 |
| Mutex Concurrent (20x) - maxCalls: 1000 | 36,643 | 31.082 | 26.86 | 71.674 | 1000.02 |
| Mutex Ultra-high-freq (2000x) - maxCalls: 1 | 364 | 3015.488 | 2395.728 | 1122.959 | 1001.14 |
| Mutex Ultra-high-freq (2000x) - maxCalls: 5 | 393 | 2643.45 | 2351.204 | 572.597 | 1001.87 |
| Mutex Ultra-high-freq (2000x) - maxCalls: 10 | 394 | 2633.414 | 2343.554 | 560.213 | 1000.7 |
| Mutex Ultra-high-freq (2000x) - maxCalls: 20 | 397 | 2611.117 | 2336.106 | 553.932 | 1000.06 |
| Mutex Ultra-high-freq (2000x) - maxCalls: 50 | 394 | 2639.04 | 2335.735 | 592.337 | 1002.84 |
| Mutex Ultra-high-freq (2000x) - maxCalls: 100 | 394 | 2643.072 | 2337.038 | 609.354 | 1001.72 |
| Mutex Ultra-high-freq (2000x) - maxCalls: 1000 | 385 | 2913.31 | 2342.037 | 2937.826 | 1002.18 |
| Conditional trigger/wait | 509,157 | 1.992 | 1.954 | 2.503 | 1000 |
| Conditional trigger reaction time | 448,446 | 2.377 | 2.214 | 7.626 | 1000 |
| Conditional multiple waiters with trigger | 86,216 | 12.224 | 11.462 | 16.909 | 1000 |
| ManuallyConditional raise/wait | 365,849 | 2.789 | 2.705 | 3.427 | 1000 |
| ManuallyConditional raise reaction time | 332,856 | 3.187 | 2.976 | 9.243 | 1000 |
| ManuallyConditional trigger/wait | 373,001 | 2.726 | 2.665 | 4.193 | 1000 |
| ManuallyConditional trigger reaction time | 333,907 | 3.265 | 2.975 | 18.277 | 1000 |
| ManuallyConditional multiple waiters with raise | 81,037 | 13.234 | 12.193 | 25.252 | 1000.01 |
| ManuallyConditional multiple waiters with trigger | 80,967 | 12.885 | 12.192 | 16.101 | 1000.01 |
| Conditional vs ManuallyConditional - single waiter (Conditional) | 509,094 | 1.991 | 1.954 | 1.739 | 1000 |
| Conditional vs ManuallyConditional - single waiter (ManuallyConditional) | 368,327 | 2.762 | 2.695 | 4.285 | 1000 |
| Conditional vs ManuallyConditional - batch waiters (Conditional) | 149,144 | 6.832 | 6.643 | 19.496 | 1000.01 |
| Conditional vs ManuallyConditional - batch waiters (ManuallyConditional) | 134,256 | 7.834 | 7.364 | 14.249 | 1000.01 |
| [Comparison] Mutex single acquire/release | 274,934 | 5.67 | 3.577 | 321.489 | 1013.59 |
| [Comparison] Semaphore(1) single acquire/release | 293,156 | 4.643 | 3.357 | 59.492 | 1000.29 |
| [Comparison] Mutex sequential (50x) | 16,540 | 69.95 | 59.26 | 122.351 | 1000.21 |
| [Comparison] Semaphore(1) sequential (50x) | 19,766 | 59.132 | 49.742 | 130.141 | 1000.03 |
| [Comparison] RWLock write-only sequential (50x) | 19,361 | 62.289 | 50.845 | 173.14 | 1000.05 |
| [Comparison] Mutex concurrent (20x) | 34,871 | 35.055 | 28.022 | 110.865 | 1000.01 |
| [Comparison] Semaphore(1) concurrent (20x) | 32,645 | 44.091 | 28.493 | 520.107 | 1000.02 |
| [Comparison] RWLock write-only concurrent (20x) | 32,927 | 38.435 | 29.756 | 140.481 | 1001.92 |
| [Comparison] Semaphore(5) for pool (20 requests) | 35,205 | 34.869 | 27.782 | 115.436 | 1000.01 |
| [Comparison] 5 Mutexes round-robin (20 requests) | 25,253 | 52.401 | 38.582 | 197.292 | 1000.02 |
| [Comparison] RWLock read-mostly (90% read) | 16,443 | 74.723 | 59.361 | 165.252 | 1000.02 |
| [Comparison] Mutex for read-mostly (simulated) | 15,148 | 92.16 | 64.29 | 927.109 | 1000.03 |
| [Scenario] Connection Pool - Semaphore(3) | 67,929 | 18.865 | 14.457 | 97.911 | 1000.28 |
| [Scenario] Cache - RWLock (70% read, 30% write) | 24,848 | 52.354 | 39.013 | 185.434 | 1000.01 |
| [Scenario] Critical Section - Mutex | 46,625 | 28.611 | 20.789 | 139.446 | 1000.25 |
| [HighContention] Mutex (50 concurrent) | 14,528 | 91.71 | 66.334 | 258.343 | 1000.01 |
| [HighContention] Semaphore(1) (50 concurrent) | 14,328 | 93.732 | 67.215 | 269.24 | 1002.84 |
| [HighContention] Semaphore(10) (50 concurrent) | 15,444 | 88.257 | 62.437 | 299.839 | 1000.04 |
| [HighContention] RWLock writes (50 concurrent) | 13,942 | 98.149 | 68.809 | 289.01 | 1000.04 |
| [HighContention] RWLock reads (50 concurrent) | 16,899 | 79.128 | 57.317 | 276.967 | 1000.02 |

**Test Environment:** Node.js v22.18.0, linux x64  
**CPU:** AMD EPYC 7763 64-Core Processor  
**Memory:** 16GB  
**Last Updated:** 2025-08-26

----

## License

Under MIT.
