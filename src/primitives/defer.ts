/**
 * Defer function for asynchronous execution.
 */

/**
 * Defer execution of a callback to the next tick.
 * @param fn - The function to execute.
 */
export const defer = (fn: () => void): void => {
  if (typeof setImmediate === 'function') {
    setImmediate(fn);
  } else {
    setTimeout(fn, 0);
  }
};
