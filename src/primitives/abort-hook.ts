/**
 * Abort hooking function
 */

import { Releasable } from "../types.js";

/**
 * A no-op Releasable object that does nothing when released or disposed
 */
const NOOP_HANDLER = () => {};
const NOOP_RELEASABLE: Releasable = {
  release: NOOP_HANDLER,
  [Symbol.dispose]: NOOP_HANDLER
} as const;

/**
 * Hooks up an abort handler to an AbortSignal and returns a handle for early cleanup
 * @param signal - The AbortSignal to hook up to
 * @param callback - The callback to call when the signal is aborted
 * @returns A Releasable handle that can be used to remove the abort listener early
 */
export const onAbort = (signal: AbortSignal | undefined, callback: () => void): Releasable => {
  if (!signal) {
    return NOOP_RELEASABLE;
  }

  let isReleased = false;
  let abortHandler: (() => void) | null = null;

  const release = (): void => {
    if (isReleased || !signal || !abortHandler) {
      return;
    }
    isReleased = true;
    signal.removeEventListener('abort', abortHandler);
    abortHandler = null;
  };

  // Create the releasable handle
  const handle: Releasable = {
    release,
    [Symbol.dispose]: release
  };

  if (signal.aborted) {
    try {
      callback();
    } catch (error: unknown) {
      // Prevent unhandled exceptions that would crash the process
      // Log the error since we're suppressing it to maintain process stability
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('AbortHook callback error:', error);
      }
    }
    return handle;
  }

  abortHandler = () => {
    if (isReleased) {
      return;
    }
    isReleased = true;
    signal.removeEventListener('abort', abortHandler!);
    try {
      callback();
    } catch (error: unknown) {
      // Prevent unhandled exceptions that would crash the process
      // Log the error since we're suppressing it to maintain process stability
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('AbortHook callback error:', error);
      }
    }
    abortHandler = null;
  };

  signal.addEventListener('abort', abortHandler, { once: true });
  return handle;
};
