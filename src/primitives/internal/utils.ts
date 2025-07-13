import { Releasable } from "../../types";

/**
 * A no-op Releasable object that does nothing when released or disposed
 */
const __NOOP_HANDLER = () => {};
export const __NOOP_RELEASABLE: Releasable = {
  release: __NOOP_HANDLER,
  [Symbol.dispose]: __NOOP_HANDLER
} as const;
