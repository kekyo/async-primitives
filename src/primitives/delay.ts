// async-primitives - A collection of primitive functions for asynchronous operations in TypeScript/JavaScript.
// Copyright (c) Kouji Matsui. (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/async-primitives

import { onAbort } from "./abort-hook";

/**
 * Helper function to create a delay
 * @param msec - The number of milliseconds to delay
 * @param signal - Optional AbortSignal to cancel the delay
 * @returns A promise that resolves after the delay or rejects if aborted
 */
export const delay = (msec: number, signal?: AbortSignal): Promise<void> => {
  if (signal) {
    // Check if already aborted
    if (signal.aborted) {
      throw new Error('Delay was aborted');
    }

    // Require aborting handler
    return new Promise<void>((resolve, reject) => {
      const abortHandle = onAbort(signal, () => {
        clearTimeout(timeoutId);
        reject(new Error('Delay was aborted'));
      });

      const timeoutId = setTimeout(() => {
        abortHandle.release();
        resolve();
      }, msec);
    });
  } else {
    // Without aborting handler
    return new Promise<void>(resolve => {
      setTimeout(resolve, msec);
    });
  }
};
