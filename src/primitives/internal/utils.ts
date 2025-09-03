// async-primitives - A collection of primitive functions for asynchronous operations in TypeScript/JavaScript.
// Copyright (c) Kouji Matsui. (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/async-primitives

import { Releasable } from "../../types";

/**
 * A no-op Releasable object that does nothing when released or disposed
 */
export const __NOOP_HANDLER = () => {};
export const __NOOP_RELEASABLE: Releasable = {
  release: __NOOP_HANDLER,
  [Symbol.dispose]: __NOOP_HANDLER
} as const;
