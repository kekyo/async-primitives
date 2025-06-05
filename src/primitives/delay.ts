/**
 * Helper function to create a delay
 * @param ms - The number of milliseconds to delay
 * @param signal - Optional AbortSignal to cancel the delay
 * @returns A promise that resolves after the delay or rejects if aborted
 */
export const delay = (ms: number, signal?: AbortSignal): Promise<void> => {
  // Check if already aborted
  if (signal?.aborted) {
    throw new Error('Delay was aborted');
  }

  return new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      resolve();
    }, ms);

    // Add abort listener if signal is provided
    if (signal) {
      const abortHandler = () => {
        clearTimeout(timeoutId);
        reject(new Error('Delay was aborted'));
      };
      signal.addEventListener('abort', abortHandler, { once: true });
    }
  });
};
