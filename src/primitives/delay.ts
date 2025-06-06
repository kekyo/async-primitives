/**
 * Helper function to create a delay
 * @param ms - The number of milliseconds to delay
 * @param signal - Optional AbortSignal to cancel the delay
 * @returns A promise that resolves after the delay or rejects if aborted
 */

import { onAbort } from "./abort-hook";

const ABORTED_ERROR = () => new Error('Delay was aborted');

export const delay = (msec: number, signal?: AbortSignal): Promise<void> => {
  if (signal) {
    // Check if already aborted
    if (signal.aborted) {
      throw ABORTED_ERROR();
    }

    // Require aborting handler
    return new Promise<void>((resolve, reject) => {
      let timeoutId: NodeJS.Timeout;

      const abortHandle = onAbort(signal, () => {
        clearTimeout(timeoutId);
        reject(ABORTED_ERROR());
      });

      timeoutId = setTimeout(() => {
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
