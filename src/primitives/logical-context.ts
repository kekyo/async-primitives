// async-primitives - A collection of primitive functions for asynchronous operations in TypeScript/JavaScript.
// Copyright (c) Kouji Matsui. (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/async-primitives

import {
  createLogicalContext,
  currentLogicalContext,
  prepare,
  setCurrentLogicalContext,
} from './internal/logical-context';

/**
 * Set a value in the current logical context
 * @param key The symbol key for the value
 * @param value The value to store
 */
export const setLogicalContextValue = <T>(
  key: symbol,
  value: T | undefined
) => {
  prepare();
  if (value !== undefined) {
    currentLogicalContext.data.set(key, value);
  } else {
    currentLogicalContext.data.delete(key);
  }
};

/**
 * Get a value from the current logical context
 * @param key The symbol key for the value
 * @returns The stored value or undefined if not found
 */
export const getLogicalContextValue = <T>(key: symbol) => {
  prepare();
  return currentLogicalContext.data.get(key) as T | undefined;
};

/**
 * Run a handler on a new logical context
 * @param prefix The prefix for the new logical context
 * @param handler The handler to run
 * @returns The result of the handler
 */
export const runOnNewLogicalContext = <T>(prefix: string, handler: () => T) => {
  const previousLogicalContext = currentLogicalContext;
  setCurrentLogicalContext(
    createLogicalContext(Symbol(`${prefix}-${crypto.randomUUID()}`))
  );
  try {
    return handler();
  } finally {
    setCurrentLogicalContext(previousLogicalContext);
  }
};

/**
 * Create a new logical context and switch to it (similar to LogicalContext.SetLogicalContext)
 * @param idPrefix The prefix for the new logical context id
 */
export const switchToNewLogicalContext = (idPrefix: string): void => {
  setCurrentLogicalContext(
    createLogicalContext(Symbol(`${idPrefix}-${crypto.randomUUID()}`))
  );
};

/**
 * Get the current logical context id
 * @returns The current logical context id
 */
export const getCurrentLogicalContextId = () => {
  prepare();
  return currentLogicalContext.id;
};
