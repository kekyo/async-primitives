/**
 * Defer function for asynchronous execution.
 */

/**
 * Defer execution of a callback to the next tick.
 * @param callback - The function to execute.
 */
export const defer = (callback: () => void): void => {
  if (typeof setImmediate === 'function') {
    // Node.js environment
    setImmediate(callback);
  } else {
    // Others
    setTimeout(callback, 0);
  }
}
