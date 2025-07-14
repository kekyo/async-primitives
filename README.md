# async-primitives

A collection of primitive functions for asynchronous operations in TypeScript/JavaScript.

[![Project Status: WIP – Initial development is in progress, but there has not yet been a stable, usable release suitable for the public.](https://www.repostatus.org/badges/latest/wip.svg)](https://www.repostatus.org/#wip)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/async-primitives.svg)](https://www.npmjs.com/package/async-primitives)

----

## What is this?

If you are interested in performing additional calculations on `Promise<T>`, you may find this small library useful.
Mutex, producer-consumer separation (side-effect operation), signaling (flag control), logical context and more.

* Works in both browser and Node.js (16 or later) environments.
* No external dependencies.

| Function | Description |
|:---------|:------------|
| `delay()` | Promise-based delay function |
| `defer()` | Schedule callback for next event loop |
| `onAbort()` | Register safer abort signal hooks with cleanup |
| `createAsyncLock()` | Promise-based mutex lock for critical sections |
| `createDeferred()` | External control of Promise resolution/rejection |
| `createDeferredGenerator()` | External control of async generator with queue management |
| `createSignal()` | Automatic signal trigger (one-waiter per trigger) |
| `createManuallySignal()` | Manual signal control (raise/drop state) |

Advanced features:

| Function | Description |
|:---------|:------------|
| `createAsyncLocal()` | Asynchronous context storage |
| `LogicalContext` | Low-level async execution context management |

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
await delay(1000) // Wait for 1 second
```

```typescript
// With AbortSignal
const c = new AbortController();
await delay(1000, c.signal) // Wait for 1 second
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

### createAsyncLock()

Provides `Promise` based mutex lock functionality to implement critical sections that prevent race conditions in asynchronous operations.

```typescript
import { createAsyncLock } from 'async-primitives';

// Use AsyncLock (Mutex lock)
const locker = createAsyncLock();

// Lock AsyncLock
const handler = await locker.lock();
try {
  // Critical section, avoid race condition.
} finally {
  // Release AsyncLock
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

### createSignal()

Creates an automatically or manually controlled signal that can be raise and drop.
Multiple waiters can await for the same signal, and all will be resolved when the signal is raise.

The `Signal` (automatic signal) is "trigger" automatically raise-and-drop to release only one-waiter:

```typescript
import { createSignal } from 'async-primitives';

// Create an automatic signal
const signal = createSignal();

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

### createManuallySignal()

The `ManuallySignal` is manually controlled raise and drop state, and trigger action is optional.

```typescript
import { createManuallySignal } from 'async-primitives';

// Create a manually signal
const signal = createManuallySignal();

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

### ES2022+ using statement

Use with using statement (requires ES2022+ or equivalent polyfill)

```typescript
const locker = createAsyncLock();

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
async function example() {
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

### createAsyncLock() Parameter Details

In `createAsyncLock(maxConsecutiveCalls?: number)`, you can specify the `maxConsecutiveCalls` parameter (default value: 20).

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
const uiLocker = createAsyncLock(5);

// High throughput processing
const batchLocker = createAsyncLock(50);
```

----

## Benchmark results

These results do not introduce hooks by `LogicalContext`. See [benchmark/suites/](benchmark/suites/).

| Benchmark | Operations/sec | Avg Time (ms) | Median Time (ms) | Std Dev (ms) | Total Time (ms) |
|-----------|----------------|---------------|------------------|--------------|-----------------|
| delay(0) | 921 | 1114.393 | 1068.076 | 444.608 | 1000.72 |
| delay(1) | 925 | 1092.361 | 1066.823 | 157.435 | 1000.6 |
| AsyncLock acquire/release | 269,232 | 5 | 3.616 | 60.263 | 1000 |
| Deferred resolve | 908,770 | 1.149 | 1.073 | 1.538 | 1000 |
| Deferred reject/catch | 162,543 | 6.698 | 6.082 | 32.257 | 1000 |
| defer callback | 46,043 | 886152.052 | 103.447 | 2802011.308 | 8861.52 |
| defer [setTimeout(0)] | 924 | 1098.239 | 1065.852 | 193.495 | 1000.5 |
| onAbort setup/cleanup | 183,012 | 5.951 | 5.26 | 22.798 | 1000 |
| AsyncLock Sequential (1000x) - maxCalls: 1 | 799 | 1421.635 | 1146.637 | 725.98 | 1000.83 |
| AsyncLock Sequential (1000x) - maxCalls: 5 | 830 | 1296.576 | 1128.785 | 477.884 | 1000.96 |
| AsyncLock Sequential (1000x) - maxCalls: 10 | 832 | 1283.699 | 1125.293 | 445.244 | 1000 |
| AsyncLock Sequential (1000x) - maxCalls: 20 | 835 | 1312.434 | 1104.4 | 837.872 | 1000.07 |
| AsyncLock Sequential (1000x) - maxCalls: 50 | 851 | 1241.166 | 1109.304 | 382.762 | 1000.38 |
| AsyncLock Sequential (1000x) - maxCalls: 100 | 840 | 1267.654 | 1120.193 | 426.704 | 1000.18 |
| AsyncLock Sequential (1000x) - maxCalls: 1000 | 839 | 1270.938 | 1119.04 | 437.995 | 1000.23 |
| AsyncLock High-freq (500x) - maxCalls: 1 | 1,621 | 772.298 | 574.147 | 1104.841 | 1000.13 |
| AsyncLock High-freq (500x) - maxCalls: 5 | 1,719 | 641.477 | 559.791 | 345.389 | 1000.06 |
| AsyncLock High-freq (500x) - maxCalls: 10 | 1,724 | 633.467 | 557.396 | 318.059 | 1000.24 |
| AsyncLock High-freq (500x) - maxCalls: 20 | 1,704 | 648.408 | 562.886 | 356.101 | 1000.49 |
| AsyncLock High-freq (500x) - maxCalls: 50 | 1,706 | 645.671 | 563.032 | 347.684 | 1000.79 |
| AsyncLock High-freq (500x) - maxCalls: 100 | 1,703 | 753.441 | 563.307 | 3922.743 | 1073.65 |
| AsyncLock High-freq (500x) - maxCalls: 1000 | 1,722 | 639.682 | 555.908 | 377.501 | 1000.46 |
| AsyncLock Concurrent (20x) - maxCalls: 1 | 18,591 | 65.19 | 52.688 | 765.547 | 1000.01 |
| AsyncLock Concurrent (20x) - maxCalls: 5 | 30,371 | 37.507 | 32.35 | 77.11 | 1000.02 |
| AsyncLock Concurrent (20x) - maxCalls: 10 | 33,491 | 34.614 | 29.234 | 80.79 | 1000.01 |
| AsyncLock Concurrent (20x) - maxCalls: 20 | 35,786 | 33.292 | 27.171 | 98.581 | 1000.02 |
| AsyncLock Concurrent (20x) - maxCalls: 50 | 35,817 | 33.365 | 27.14 | 100.292 | 1001.08 |
| AsyncLock Concurrent (20x) - maxCalls: 100 | 35,862 | 33.531 | 27.121 | 104.608 | 1000 |
| AsyncLock Concurrent (20x) - maxCalls: 1000 | 35,390 | 35.203 | 27.151 | 211.557 | 1000 |
| AsyncLock Ultra-high-freq (2000x) - maxCalls: 1 | 384 | 2828.991 | 2305.131 | 963.976 | 1001.46 |
| AsyncLock Ultra-high-freq (2000x) - maxCalls: 5 | 395 | 2728.085 | 2255.894 | 949.591 | 1001.21 |
| AsyncLock Ultra-high-freq (2000x) - maxCalls: 10 | 417 | 2486.416 | 2207.634 | 534.142 | 1002.03 |
| AsyncLock Ultra-high-freq (2000x) - maxCalls: 20 | 409 | 2551.6 | 2245.396 | 594.723 | 1000.23 |
| AsyncLock Ultra-high-freq (2000x) - maxCalls: 50 | 410 | 2544.325 | 2241.012 | 592.091 | 1002.46 |
| AsyncLock Ultra-high-freq (2000x) - maxCalls: 100 | 409 | 2549.292 | 2239.885 | 604.259 | 1001.87 |
| AsyncLock Ultra-high-freq (2000x) - maxCalls: 1000 | 409 | 2554.267 | 2236.389 | 616.724 | 1001.27 |
| Signal trigger/wait | 515,193 | 2.216 | 1.913 | 80.86 | 1000 |
| Signal trigger reaction time | 452,595 | 2.341 | 2.194 | 15.065 | 1000 |
| Signal multiple waiters with trigger | 81,515 | 12.8 | 12.132 | 13.437 | 1000 |
| ManualSignal raise/wait | 367,107 | 2.841 | 2.705 | 5.504 | 1000 |
| ManualSignal raise reaction time | 331,717 | 3.195 | 2.986 | 15.903 | 1000 |
| ManualSignal trigger/wait | 369,066 | 2.846 | 2.675 | 6.187 | 1000 |
| ManualSignal trigger reaction time | 338,068 | 3.112 | 2.935 | 14.359 | 1000 |
| ManualSignal multiple waiters with raise | 77,615 | 13.455 | 12.724 | 14.231 | 1000 |
| ManualSignal multiple waiters with trigger | 77,737 | 13.421 | 12.713 | 13.587 | 1000.01 |
| Signal vs ManualSignal - single waiter (Signal) | 519,671 | 2.023 | 1.913 | 5.178 | 1000 |
| Signal vs ManualSignal - single waiter (ManualSignal) | 368,502 | 2.836 | 2.695 | 5.973 | 1000 |
| Signal vs ManualSignal - batch waiters (Signal) | 144,636 | 7.294 | 6.843 | 21.87 | 1000.34 |
| Signal vs ManualSignal - batch waiters (ManualSignal) | 128,812 | 8.141 | 7.685 | 13.078 | 1000.01 |

**Test Environment:** Node.js v21.7.3, linux x64  
**CPU:** AMD EPYC 7763 64-Core Processor  
**Memory:** 16GB  
**Last Updated:** 2025-07-14

----

## License

Under MIT.
