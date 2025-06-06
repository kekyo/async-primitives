/**
 * Helper function to create a delay
 * @param ms - The number of milliseconds to delay
 * @param signal - Optional AbortSignal to cancel the delay
 * @returns A promise that resolves after the delay or rejects if aborted
 */

import { onAbort } from "./abort-hook";

export const delay = (ms: number, signal?: AbortSignal): Promise<void> => {
  // Check if already aborted
  if (signal?.aborted) {
    throw new Error('Delay was aborted');
  }

  return new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      // Clean up abort handle if it exists before resolving
      if (abortHandle) {
        abortHandle.release();
      }
      resolve();
    }, ms);

    // Set up abort handling using onAbort helper if signal is provided
    let abortHandle: ReturnType<typeof onAbort> | null = null;
    if (signal) {
      abortHandle = onAbort(signal, () => {
        clearTimeout(timeoutId);
        reject(new Error('Delay was aborted'));
      });
    }
  });
};
