// async-primitives - A collection of primitive functions for asynchronous operations in TypeScript/JavaScript.
// Copyright (c) Kouji Matsui. (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/async-primitives

import { Releasable } from '../types';
import { __NOOP_RELEASABLE } from './internal/utils';

const toAbortError = (reason: unknown): Error => {
  if (reason instanceof Error) {
    return reason;
  }
  if (typeof reason === 'string') {
    return new Error(reason);
  }
  return new Error('Operation aborted');
};

/**
 * Hooks up an abort handler to an AbortSignal and returns a handle for early cleanup
 * @param signal - The AbortSignal to hook up to
 * @param callback - The callback to call when the signal is aborted
 * @returns A Releasable handle that can be used to remove the abort listener early
 */
export const onAbort = (
  signal: AbortSignal | undefined,
  callback: (error: Error) => void
): Releasable => {
  if (!signal) {
    return __NOOP_RELEASABLE;
  }

  if (signal.aborted) {
    try {
      callback(toAbortError(signal.reason));
    } catch (error: unknown) {
      console.warn('AbortHook callback error: ', error);
    }
    return __NOOP_RELEASABLE;
  }

  let abortHandler: (() => void) | undefined;
  abortHandler = () => {
    if (abortHandler) {
      const reason = signal.reason;
      signal.removeEventListener('abort', abortHandler);
      abortHandler = undefined;

      try {
        callback(toAbortError(reason));
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
    [Symbol.dispose]: release,
  };
  return handle;
};
