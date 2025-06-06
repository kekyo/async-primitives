/**
 * Defer function for asynchronous execution.
 */

/**
 * Defer execution of a callback to the next tick.
 * @param callback - The function to execute.
 */
export const defer: (callback: () => void) => void =
  typeof setImmediate === 'function' ?
    setImmediate :
    callback => setTimeout(callback, 0);
