// async-primitives - A collection of primitive functions for asynchronous operations in TypeScript/JavaScript.
// Copyright (c) Kouji Matsui. (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/async-primitives

// Export all types
export * from './types'

// delay function export.
export { delay } from "./primitives/delay";

// defer function export.
export { defer } from './primitives/defer';

// Abort hooking function export.
export { onAbort } from './primitives/abort-hook';

// AsyncLock exports - only the create function, not the interface
export { createAsyncLock } from './primitives/async-lock';

// Deferred exports - only the create function, not the interface
export { createDeferred } from './primitives/deferred';

// Deferred generator exports - only the create function, not the interface
export { createDeferredGenerator } from './primitives/deferred-generator';

// Signal exports
export { createSignal, createManuallySignal } from './primitives/signal';

// Logical context exports
export { setLogicalContextValue, getLogicalContextValue, getCurrentLogicalContextId, runOnNewLogicalContext } from './primitives/logical-context';

// AsyncLocal exports
export { createAsyncLocal } from './primitives/async-local';

// Semaphore exports - only the create function, not the interface
export { createSemaphore } from './primitives/semaphore';

// ReaderWriterLock exports - only the create function, not the interface
export { createReaderWriterLock } from './primitives/reader-writer-lock';
