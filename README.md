# async-primitives

A collection of primitive functions for asynchronous operations in TypeScript/JavaScript.

[![npm version](https://img.shields.io/npm/v/async-primitives.svg)](https://www.npmjs.com/package/async-primitives)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/kekyo/async-primitives/actions/workflows/ci.yml/badge.svg)](https://github.com/kekyo/async-primitives/actions/workflows/ci.yml)

## Features

- 🚀 **Universal**: Works in both browser and Node.js environments
- 📖 **Zero dependencies**: No external dependencies

## Installation

```bash
npm install async-primitives
```

## Usage

```typescript
import { delay } from 'async-primitives';

// Use delay
await delay(1000) // Wait for 1 second

// With AbortSignal
const c = new AbortController();
await delay(1000, c.signal) // Wait for 1 second
```

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

```typescript
import { createDeferred } from 'async-primitives';

// Use Deferred
const deferred = createDeferred<number>();

deferred.resolve(123);         // (Result producer)
deferred.reject(new Error());  // (Error producer)

// (Consumer)
const value = await deferred.promise;
```

```typescript
import { onAbort } from 'async-primitives';

// Use onAbort (Abort signal hooking)
const controller = new AbortController();

const releaseHandle = onAbort(controller.signal, () => {
  console.log('Operation was aborted!');
});

// Cleanup early if needed
releaseHandle.release();
```

```typescript
import { defer } from 'async-primitives';

// Use defer (Schedule callback for next event loop)
defer(() => {
  console.log('Executes asynchronously');
});
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
    console.log('Cleanup on abort or scope exit');
  });

  // (Auto release when exit the scope.)
}

```

## License

Under MIT.
