# async-primitives

A collection of primitive functions for asynchronous operations in TypeScript/JavaScript.

[![npm version](https://img.shields.io/npm/v/async-primitives.svg)](https://www.npmjs.com/package/async-primitives)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/kekyo/async-primitives/actions/workflows/ci.yml/badge.svg)](https://github.com/kekyo/async-primitives/actions/workflows/ci.yml)

## Features

- **Universal**: Works in both browser and Node.js environments
- **Zero dependencies**: No external dependencies

## Installation

```bash
npm install async-primitives
```

## Usage

### delay()

Provides a delay that can be awaited with Promise, with support for cancellation via `AbortSignal.`

```typescript
import { delay } from 'async-primitives';

// Use delay
await delay(1000) // Wait for 1 second

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

Provides Promise-based mutex lock functionality to implement critical sections that prevent race conditions in asynchronous operations.

```typescript
import { createAsyncLock } from 'async-primitives';

// Use AsyncLock (Mutex lock)
const locker = createAsyncLock();

const handler = await locker.lock();
try {
  // Critical section, avoid race condition.
} finally {
  handler.release();
}

// With AbortSignal
const handler = await locker.lock(c.signal);
```

### createDeferred()

Creates a Deferred object that allows external control of Promise resolution or rejection. Useful for separating producers and consumers in asynchronous processing.

```typescript
import { createDeferred } from 'async-primitives';

// Use Deferred
const deferred = createDeferred<number>();

deferred.resolve(123);         // (Result producer)
deferred.reject(new Error());  // (Error producer)

// (Consumer)
const value = await deferred.promise;
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

-----

## Benchmark results

These results do not introduce hooks by `LogicalContext`. See [benchmark/suites/](benchmark/suites/).

| Benchmark | Operations/sec | Avg Time (ms) | Median Time (ms) | Std Dev (ms) | Total Time (ms) |
|-----------|----------------|---------------|------------------|--------------|-----------------|
| delay(0) | 933 | 1122.527 | 1068.132 | 910.767 | 1000.17 |
| delay(1) | 936 | 1067.96 | 1066.679 | 7.778 | 1000.68 |
| AsyncLock acquire/release | 261,176 | 5.128 | 3.667 | 56.087 | 1001.13 |
| Deferred resolve | 5,415,127 | 0.192 | 0.18 | 0.887 | 1000 |
| Deferred reject/catch | 201,076 | 5.115 | 4.869 | 11.521 | 1000.02 |
| defer callback | 716,544 | 1.447 | 1.382 | 3.298 | 1000 |
| defer [setTimeout(0)] | 937 | 1081.429 | 1065.245 | 451.863 | 1000.32 |
| onAbort setup/cleanup | 173,463 | 6.54 | 5.48 | 48.185 | 1000 |
| AsyncLock Sequential (1000x) - maxCalls: 1 | 769 | 1472.277 | 1202.353 | 770.625 | 1001.15 |
| AsyncLock Sequential (1000x) - maxCalls: 5 | 781 | 1406.61 | 1199.978 | 624.061 | 1000.1 |
| AsyncLock Sequential (1000x) - maxCalls: 10 | 783 | 1457.013 | 1188.818 | 1614.736 | 1000.97 |
| AsyncLock Sequential (1000x) - maxCalls: 20 | 801 | 1330.997 | 1177.136 | 463.999 | 1000.91 |
| AsyncLock Sequential (1000x) - maxCalls: 50 | 797 | 1335.779 | 1181.464 | 458.668 | 1000.5 |
| AsyncLock Sequential (1000x) - maxCalls: 100 | 789 | 1365.519 | 1193.767 | 524.315 | 1002.29 |
| AsyncLock Sequential (1000x) - maxCalls: 1000 | 787 | 1386.522 | 1192.815 | 592.317 | 1001.07 |
| AsyncLock High-freq (500x) - maxCalls: 1 | 1,570 | 798.194 | 605.179 | 789.42 | 1003.33 |
| AsyncLock High-freq (500x) - maxCalls: 5 | 1,601 | 809.046 | 596.092 | 2416.705 | 1013.74 |
| AsyncLock High-freq (500x) - maxCalls: 10 | 1,607 | 726.733 | 588.202 | 540.105 | 1001.44 |
| AsyncLock High-freq (500x) - maxCalls: 20 | 1,644 | 700.609 | 585.477 | 516.439 | 1000.47 |
| AsyncLock High-freq (500x) - maxCalls: 50 | 1,648 | 693.525 | 584.721 | 489.994 | 1000.06 |
| AsyncLock High-freq (500x) - maxCalls: 100 | 1,649 | 692.826 | 584.285 | 486.84 | 1001.83 |
| AsyncLock High-freq (500x) - maxCalls: 1000 | 1,649 | 693.64 | 583.85 | 491.805 | 1000.23 |
| AsyncLock Concurrent (20x) - maxCalls: 1 | 17,904 | 69.539 | 54.732 | 655.749 | 1000.04 |
| AsyncLock Concurrent (20x) - maxCalls: 5 | 28,921 | 42.392 | 33.713 | 130.387 | 1000.02 |
| AsyncLock Concurrent (20x) - maxCalls: 10 | 31,609 | 39.827 | 30.647 | 137.484 | 1000.01 |
| AsyncLock Concurrent (20x) - maxCalls: 20 | 33,755 | 38.262 | 28.754 | 160.341 | 1002.57 |
| AsyncLock Concurrent (20x) - maxCalls: 50 | 33,852 | 38.221 | 28.693 | 163.356 | 1000.69 |
| AsyncLock Concurrent (20x) - maxCalls: 100 | 33,003 | 40.17 | 28.744 | 366.6 | 1000.03 |
| AsyncLock Concurrent (20x) - maxCalls: 1000 | 34,000 | 34.545 | 28.694 | 95.142 | 1001.77 |
| AsyncLock Ultra-high-freq (2000x) - maxCalls: 1 | 366 | 3060.63 | 2403.046 | 1256.162 | 1000.83 |
| AsyncLock Ultra-high-freq (2000x) - maxCalls: 5 | 377 | 2902.171 | 2366.216 | 1060.175 | 1001.25 |
| AsyncLock Ultra-high-freq (2000x) - maxCalls: 10 | 378 | 3131.075 | 2354.614 | 3947.974 | 1001.94 |
| AsyncLock Ultra-high-freq (2000x) - maxCalls: 20 | 391 | 2752.435 | 2315.647 | 896.412 | 1001.89 |
| AsyncLock Ultra-high-freq (2000x) - maxCalls: 50 | 393 | 2706.161 | 2309.741 | 805.667 | 1001.28 |
| AsyncLock Ultra-high-freq (2000x) - maxCalls: 100 | 393 | 2711.921 | 2309.912 | 829.601 | 1000.7 |
| AsyncLock Ultra-high-freq (2000x) - maxCalls: 1000 | 388 | 2766.76 | 2341.135 | 890.833 | 1001.57 |

**Test Environment:** Node.js v20.19.1, linux x64  
**CPU:** AMD EPYC 7763 64-Core Processor  
**Memory:** 16GB  
**Last Updated:** 2025-06-06

## License

Under MIT.
