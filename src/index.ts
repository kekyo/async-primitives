/**
 * async-primitives
 * A collection of primitive functions for asynchronous operations
 */

// Export all types
export * from './types'

// defer function export.
export { defer } from './primitives/defer.js';

// delay function export.
export { delay } from "./primitives/delay.js";

// Abort hooking function export.
export { onAbort } from './primitives/abort-hook.js';

// AsyncLock exports - only the create function, not the interface
export { createAsyncLock } from './primitives/async-lock.js';

// Deferred exports - only the create function, not the interface
export { createDeferred } from './primitives/deferred.js';

// Logical context exports
export { setLogicalContextValue, getLogicalContextValue, getCurrentLogicalContextId, runOnNewLogicalContext } from './primitives/logical-context.js';

// AsyncLocal exports
export { createAsyncLocal } from './primitives/async-local.js';

// Signal exports
export { createSignal, createManualSignal } from './primitives/signal.js';
