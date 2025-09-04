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

These results do not introduce hooks by `LogicalContext`. See [benchmark/suites/](benchmark/suites/).

| Benchmark                                                                | Operations/sec | Avg Time (ms) | Median Time (ms) | Std Dev (ms) | Total Time (ms) |
| ------------------------------------------------------------------------ | -------------- | ------------- | ---------------- | ------------ | --------------- |
| delay(0)                                                                 | 934            | 1079.586      | 1070.068         | 126.534      | 1000.78         |
| delay(1)                                                                 | 934            | 1071.761      | 1068.625         | 49.364       | 1001.03         |
| Mutex acquire/release                                                    | 274,303        | 4.474         | 3.576            | 38.848       | 1000            |
| Semaphore(1) acquire/release                                             | 290,067        | 4.331         | 3.357            | 41.765       | 1000            |
| Semaphore(2) acquire/release                                             | 288,334        | 4.435         | 3.396            | 43.934       | 1000            |
| Semaphore(5) acquire/release                                             | 290,287        | 4.419         | 3.366            | 44.587       | 1000            |
| Semaphore(10) acquire/release                                            | 292,229        | 4.342         | 3.356            | 43.939       | 1000            |
| Semaphore(1) sequential (100x)                                           | 10,024         | 111.958       | 97.473           | 142.563      | 1000.01         |
| Semaphore(5) sequential (100x)                                           | 10,024         | 113.495       | 96.992           | 155.519      | 1000            |
| Semaphore(1) concurrent (10x)                                            | 63,539         | 18.449        | 15.229           | 59.406       | 1000.01         |
| Semaphore(2) concurrent (10x)                                            | 64,914         | 17.86         | 15.108           | 59.934       | 1000.01         |
| Semaphore(5) concurrent (10x)                                            | 66,078         | 17.944        | 14.677           | 66.436       | 1000.01         |
| Semaphore(2) high contention (20x)                                       | 34,480         | 33.178        | 28.453           | 73.498       | 1000.01         |
| Semaphore(5) high contention (50x)                                       | 14,610         | 80.79         | 66.414           | 259.057      | 1000.02         |
| Semaphore(5) maxCalls=10 sequential (100x)                               | 9,970          | 114.741       | 97.973           | 164.314      | 1000.08         |
| Semaphore(5) maxCalls=50 sequential (100x)                               | 10,013         | 113.082       | 97.503           | 150.644      | 1000.1          |
| Semaphore(5) maxCalls=100 sequential (100x)                              | 9,722          | 126.805       | 98.725           | 602.04       | 1000.24         |
| ReaderWriterLock readLock acquire/release (write-preferring)             | 208,591        | 6.592         | 4.699            | 78.696       | 1000            |
| ReaderWriterLock writeLock acquire/release (write-preferring)            | 207,769        | 7             | 4.669            | 207.649      | 1000            |
| ReaderWriterLock readLock acquire/release (read-preferring)              | 210,419        | 7.163         | 4.659            | 220.061      | 1014.02         |
| ReaderWriterLock writeLock acquire/release (read-preferring)             | 211,489        | 6.471         | 4.659            | 74.975       | 1000            |
| ReaderWriterLock sequential reads (100x, write-preferring)               | 9,826          | 118.356       | 99.567           | 196.413      | 1000.94         |
| ReaderWriterLock sequential writes (100x, write-preferring)              | 9,761          | 132.774       | 99.136           | 991.938      | 1000.05         |
| ReaderWriterLock sequential reads (100x, read-preferring)                | 9,902          | 117.885       | 99.066           | 200.593      | 1001.19         |
| ReaderWriterLock sequential writes (100x, read-preferring)               | 9,807          | 117.465       | 99.937           | 184.883      | 1000.1          |
| ReaderWriterLock concurrent readers (10x, write-preferring)              | 61,960         | 19.46         | 15.849           | 79.852       | 1000.42         |
| ReaderWriterLock concurrent readers (20x, write-preferring)              | 36,276         | 32.669        | 26.88            | 105.354      | 1000.02         |
| ReaderWriterLock concurrent readers (10x, read-preferring)               | 59,870         | 22.843        | 15.769           | 335.036      | 1000.01         |
| ReaderWriterLock concurrent readers (20x, read-preferring)               | 36,144         | 32.936        | 27.081           | 100.923      | 1001.41         |
| ReaderWriterLock read-heavy (100 ops, write-preferring)                  | 7,975          | 144.183       | 121.207          | 158.526      | 1000.05         |
| ReaderWriterLock read-heavy (100 ops, read-preferring)                   | 8,057          | 141.475       | 120.446          | 150.893      | 1000.09         |
| ReaderWriterLock write-heavy (100 ops, write-preferring)                 | 7,065          | 174.014       | 136.876          | 814.345      | 1000.06         |
| ReaderWriterLock write-heavy (100 ops, read-preferring)                  | 7,050          | 163.203       | 136.747          | 168.259      | 1000.11         |
| ReaderWriterLock balanced (100 ops, write-preferring)                    | 7,449          | 155.188       | 129.793          | 168.603      | 1000.03         |
| ReaderWriterLock balanced (100 ops, read-preferring)                     | 7,554          | 158.157       | 127.669          | 207.97       | 1000.03         |
| ReaderWriterLock maxCalls=10 mixed (100 ops, write-preferring)           | 7,572          | 158.004       | 127.098          | 208.476      | 1000.16         |
| ReaderWriterLock maxCalls=50 mixed (100 ops, write-preferring)           | 8,199          | 139.732       | 117.791          | 177.521      | 1000.62         |
| ReaderWriterLock maxCalls=10 mixed (100 ops, read-preferring)            | 7,814          | 142.376       | 123.602          | 119.782      | 1000.05         |
| ReaderWriterLock maxCalls=50 mixed (100 ops, read-preferring)            | 8,270          | 134.827       | 117.15           | 126.091      | 1000.01         |
| ReaderWriterLock write-preference test (50 ops)                          | 15,298         | 73.611        | 63.599           | 89.2         | 1000            |
| ReaderWriterLock read-preference test (50 ops)                           | 14,740         | 76.531        | 65.864           | 88.866       | 1000.03         |
| Deferred resolve                                                         | 967,076        | 1.079         | 1.022            | 2.304        | 1000            |
| Deferred reject/catch                                                    | 161,211        | 6.457         | 6.131            | 36.68        | 1000            |
| defer callback                                                           | 634,484        | 1.651         | 1.553            | 8.61         | 1000            |
| defer [setTimeout(0)]                                                    | 942            | 1099.454      | 1067.532         | 190.464      | 1001.6          |
| onAbort setup/cleanup                                                    | 734,009        | 1.42          | 1.353            | 12.645       | 1000            |
| Mutex Sequential (1000x) - maxCalls: 1                                   | 773            | 1439.014      | 1186.095         | 650.3        | 1000.11         |
| Mutex Sequential (1000x) - maxCalls: 5                                   | 798            | 1342.9        | 1167.278         | 474.905      | 1000.46         |
| Mutex Sequential (1000x) - maxCalls: 10                                  | 786            | 1398.933      | 1165.956         | 616.517      | 1000.24         |
| Mutex Sequential (1000x) - maxCalls: 20                                  | 806            | 1316.3        | 1162.615         | 420.848      | 1000.39         |
| Mutex Sequential (1000x) - maxCalls: 50                                  | 803            | 1330.459      | 1162.12          | 455.191      | 1000.51         |
| Mutex Sequential (1000x) - maxCalls: 100                                 | 804            | 1328.995      | 1161.147         | 452.855      | 1000.73         |
| Mutex Sequential (1000x) - maxCalls: 1000                                | 806            | 1323.39       | 1160.656         | 449.744      | 1000.48         |
| Mutex High-freq (500x) - maxCalls: 1                                     | 1,561          | 796.818       | 599.555          | 700.583      | 1000.01         |
| Mutex High-freq (500x) - maxCalls: 5                                     | 1,609          | 726.243       | 589.465          | 529.868      | 1000.04         |
| Mutex High-freq (500x) - maxCalls: 10                                    | 1,631          | 696.869       | 586.359          | 447.914      | 1000.01         |
| Mutex High-freq (500x) - maxCalls: 20                                    | 1,636          | 689.876       | 585.081          | 428.906      | 1000.32         |
| Mutex High-freq (500x) - maxCalls: 50                                    | 1,637          | 681.668       | 584.35           | 391.355      | 1001.37         |
| Mutex High-freq (500x) - maxCalls: 100                                   | 1,637          | 678.442       | 584.475          | 379.747      | 1000.02         |
| Mutex High-freq (500x) - maxCalls: 1000                                  | 1,625          | 719.7         | 584.675          | 537.45       | 1000.38         |
| Mutex Concurrent (20x) - maxCalls: 1                                     | 17,365         | 73.686        | 56.175           | 829.884      | 1000.06         |
| Mutex Concurrent (20x) - maxCalls: 5                                     | 29,719         | 39.954        | 33.052           | 106.234      | 1000.02         |
| Mutex Concurrent (20x) - maxCalls: 10                                    | 33,241         | 36.628        | 29.485           | 110.818      | 1000.02         |
| Mutex Concurrent (20x) - maxCalls: 20                                    | 36,190         | 33.319        | 26.981           | 113.952      | 1000.01         |
| Mutex Concurrent (20x) - maxCalls: 50                                    | 36,541         | 31.079        | 26.92            | 69.48        | 1000            |
| Mutex Concurrent (20x) - maxCalls: 100                                   | 36,529         | 31.222        | 26.921           | 73.062       | 1000.01         |
| Mutex Concurrent (20x) - maxCalls: 1000                                  | 35,973         | 32.576        | 26.961           | 83.952       | 1000.03         |
| Mutex Ultra-high-freq (2000x) - maxCalls: 1                              | 370            | 2900.41       | 2380.239         | 884.207      | 1000.64         |
| Mutex Ultra-high-freq (2000x) - maxCalls: 5                              | 388            | 2692.99       | 2342.889         | 631.597      | 1001.79         |
| Mutex Ultra-high-freq (2000x) - maxCalls: 10                             | 390            | 2672.744      | 2335.075         | 607.606      | 1002.28         |
| Mutex Ultra-high-freq (2000x) - maxCalls: 20                             | 379            | 2907.13       | 2336.011         | 1715.718     | 1000.05         |
| Mutex Ultra-high-freq (2000x) - maxCalls: 50                             | 391            | 2674.667      | 2329.264         | 633.959      | 1000.33         |
| Mutex Ultra-high-freq (2000x) - maxCalls: 100                            | 393            | 2640.003      | 2327.25          | 572.272      | 1003.2          |
| Mutex Ultra-high-freq (2000x) - maxCalls: 1000                           | 391            | 2669.926      | 2326.478         | 625.909      | 1001.22         |
| Conditional trigger/wait                                                 | 508,413        | 2.119         | 1.944            | 8.544        | 1000.1          |
| Conditional trigger reaction time                                        | 452,111        | 2.37          | 2.193            | 8.231        | 1000            |
| Conditional multiple waiters with trigger                                | 84,426         | 12.058        | 11.692           | 10.464       | 1000.01         |
| ManuallyConditional raise/wait                                           | 369,773        | 2.864         | 2.685            | 9.754        | 1000            |
| ManuallyConditional raise reaction time                                  | 338,972        | 3.226         | 2.925            | 14.948       | 1000            |
| ManuallyConditional trigger/wait                                         | 371,705        | 2.831         | 2.665            | 8.58         | 1000            |
| ManuallyConditional trigger reaction time                                | 338,929        | 3.123         | 2.926            | 8.218        | 1000.08         |
| ManuallyConditional multiple waiters with raise                          | 80,330         | 13.079        | 12.294           | 17.541       | 1000.01         |
| ManuallyConditional multiple waiters with trigger                        | 79,769         | 13.118        | 12.384           | 14.868       | 1000.01         |
| Conditional vs ManuallyConditional - single waiter (Conditional)         | 510,197        | 2.093         | 1.944            | 6.925        | 1000            |
| Conditional vs ManuallyConditional - single waiter (ManuallyConditional) | 367,391        | 2.889         | 2.695            | 9.852        | 1000            |
| Conditional vs ManuallyConditional - batch waiters (Conditional)         | 145,223        | 7.532         | 6.803            | 23.79        | 1000.01         |
| Conditional vs ManuallyConditional - batch waiters (ManuallyConditional) | 133,227        | 8.217         | 7.414            | 24.952       | 1000.01         |
| [Comparison] Mutex single acquire/release                                | 268,954        | 5.33          | 3.586            | 94.867       | 1000            |
| [Comparison] Semaphore(1) single acquire/release                         | 292,941        | 4.69          | 3.356            | 63.966       | 1000            |
| [Comparison] Mutex sequential (50x)                                      | 16,375         | 71.832        | 59.912           | 139.937      | 1000.05         |
| [Comparison] Semaphore(1) sequential (50x)                               | 19,336         | 62.213        | 50.855           | 160.662      | 1000.01         |
| [Comparison] RWLock write-only sequential (50x)                          | 18,838         | 65.947        | 52.048           | 203.229      | 1000.02         |
| [Comparison] Mutex concurrent (20x)                                      | 32,657         | 41.34         | 28.324           | 172.457      | 1002.09         |
| [Comparison] Semaphore(1) concurrent (20x)                               | 34,374         | 35.436        | 28.413           | 110.662      | 1000.01         |
| [Comparison] RWLock write-only concurrent (20x)                          | 32,800         | 37.984        | 29.816           | 133.543      | 1000.54         |
| [Comparison] Semaphore(5) for pool (20 requests)                         | 35,386         | 34.342        | 27.762           | 111.709      | 1000.02         |
| [Comparison] 5 Mutexes round-robin (20 requests)                         | 25,174         | 49.959        | 38.913           | 156.849      | 1000.03         |
| [Comparison] RWLock read-mostly (90% read)                               | 16,215         | 75.794        | 59.922           | 166.724      | 1000.03         |
| [Comparison] Mutex for read-mostly (simulated)                           | 14,888         | 90.556        | 65.052           | 899.732      | 1000.01         |
| [Scenario] Connection Pool - Semaphore(3)                                | 67,270         | 19.833        | 14.527           | 116.812      | 1000.01         |
| [Scenario] Cache - RWLock (70% read, 30% write)                          | 24,514         | 53.69         | 39.358           | 186.92       | 1000.03         |
| [Scenario] Critical Section - Mutex                                      | 46,239         | 28.861        | 20.989           | 139.625      | 1000.01         |
| [HighContention] Mutex (50 concurrent)                                   | 14,348         | 88.91         | 67.156           | 220.185      | 1000.06         |
| [HighContention] Semaphore(1) (50 concurrent)                            | 14,429         | 80.106        | 67.125           | 151.764      | 1000.04         |
| [HighContention] Semaphore(10) (50 concurrent)                           | 15,763         | 71.495        | 62.006           | 102.435      | 1000.01         |
| [HighContention] RWLock writes (50 concurrent)                           | 14,082         | 81.354        | 69.059           | 118.924      | 1000.01         |
| [HighContention] RWLock reads (50 concurrent)                            | 17,010         | 67.396        | 57.608           | 121.204      | 1000.02         |

**Test Environment:** Node.js v22.19.0, linux x64  
**CPU:** AMD EPYC 7763 64-Core Processor  
**Memory:** 16GB  
**Last Updated:** 2025-09-04

---

## License

Under MIT.
