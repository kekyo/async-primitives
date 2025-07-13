/**
 * Abort hooking function
 */

import { Releasable } from "../types.js";
import { __NOOP_RELEASABLE } from "./internal/utils.js";

/**
 * Hooks up an abort handler to an AbortSignal and returns a handle for early cleanup
 * @param signal - The AbortSignal to hook up to
 * @param callback - The callback to call when the signal is aborted
 * @returns A Releasable handle that can be used to remove the abort listener early
 */
export const onAbort = (signal: AbortSignal | undefined, callback: () => void): Releasable => {
  if (!signal) {
    return __NOOP_RELEASABLE;
  }

  if (signal.aborted) {
    try {
      callback();
    } catch (error: unknown) {
      console.warn('AbortHook callback error: ', error);
    }
    return __NOOP_RELEASABLE;
  }

  let abortHandler: (() => void) | undefined;
  abortHandler = () => {
    if (abortHandler) {
      signal.removeEventListener('abort', abortHandler);
      abortHandler = undefined;

      try {
        callback();
      } catch (error: unknown) {
        console.warn('AbortHook callback error: ', error);
      }
    }
  };
 
  const release = (): void => {
    if (abortHandler) {
      signal.removeEventListener('abort', abortHandler);
      abortHandler = undefined;
    }
  };

  signal.addEventListener('abort', abortHandler, { once: true });

  // Create the releasable handle
  const handle: Releasable = {
    release,
    [Symbol.dispose]: release
  };
 return handle;
};
