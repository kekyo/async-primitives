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

// Mutex exports - only the create function, not the interface
export { createMutex } from './primitives/mutex';

// Deferred exports - only the create function, not the interface
export { createDeferred } from './primitives/deferred';

// Deferred generator exports - only the create function, not the interface
export { createDeferredGenerator } from './primitives/deferred-generator';

// Conditional exports
export { createConditional, createManuallyConditional } from './primitives/conditional';

// Logical context exports
export { setLogicalContextValue, getLogicalContextValue, getCurrentLogicalContextId, runOnNewLogicalContext } from './primitives/logical-context';

// AsyncLocal exports
export { createAsyncLocal } from './primitives/async-local';

// Semaphore exports - only the create function, not the interface
export { createSemaphore } from './primitives/semaphore';

// ReaderWriterLock exports - only the create function, not the interface
export { createReaderWriterLock } from './primitives/reader-writer-lock';

/////////////////////////////////////////////////////////////

// Deprecated aliases for backward compatibility

export { 
  /** @deprecated Use `createMutex` instead */
  createMutex as createAsyncLock 
} from './primitives/mutex';

export { 
  /** @deprecated Use `createConditional` instead */
  createConditional as createSignal,
  /** @deprecated Use `createManuallyConditional` instead */
  createManuallyConditional as createManuallySignal
} from './primitives/conditional';
