// Logical context
export interface LogicalContext {
  readonly id: symbol;
  readonly data: Map<symbol, unknown>;
}

// Create a new logical context
export const createLogicalContext = (id: symbol): LogicalContext => {
  return { id, data: new Map() };
};

// Current logical context (similar to LogicalContext.Current in .NET)
export let currentLogicalContext = createLogicalContext(Symbol("[root]"));

// Set the current logical context
export const setCurrentLogicalContext = (context: LogicalContext) => {
  currentLogicalContext = context;
};

// Logical context adjustment
export interface LogicalContextAdjustment {
  readonly contextToUse: LogicalContext,
  contextAfter: LogicalContext;
};

// Trampoline function to run a callback in a specific logical context
export const trampoline = <T extends any[]>(
  adjustment: LogicalContextAdjustment,
  callback: (...args: T) => any, 
  ...args: T
) => {
  const previousLogicalContext = currentLogicalContext;
  currentLogicalContext = adjustment.contextToUse;
  try {
    return callback(...args);
  } finally {
    adjustment.contextAfter = currentLogicalContext;
    currentLogicalContext = previousLogicalContext;
  }
};

// Whether the logical context system is prepared
let isPrepared = false;

// Prepare the logical context system
export const prepare = () => {
  if (isPrepared) {
    return;
  }
  isPrepared = true;

  ///////////////////////////////////////////////////////////////

  // Replace the global setTimeout with a version that captures the current logical context
  if (typeof globalThis.setTimeout !== 'undefined') {
    const __setTimeout = globalThis.setTimeout;
    globalThis.setTimeout = ((handler: (...args: any[]) => void, timeout?: number, ...args: any[]) => {
      const capturedLogicalContext = currentLogicalContext;
      return __setTimeout(
        (...args: any[]) => {
          const adjustment = { contextToUse: capturedLogicalContext } as LogicalContextAdjustment;
          trampoline(adjustment, handler, ...args);
        },
        timeout,
        ...args);
    }) as typeof globalThis.setTimeout;
  }

  ///////////////////////////////////////////////////////////////

  // Replace the global setInterval with a version that captures the current logical context
  if (typeof globalThis.setInterval !== 'undefined') {
    const __setInterval = globalThis.setInterval;
    globalThis.setInterval = ((handler: (...args: any[]) => void, timeout?: number, ...args: any[]) => {
      const capturedLogicalContext = currentLogicalContext;
      return __setInterval(
        (...args: any[]) => {
          const adjustment = { contextToUse: capturedLogicalContext } as LogicalContextAdjustment;
          trampoline(adjustment, handler, ...args);
        },
        timeout,
        ...args);
    }) as typeof globalThis.setInterval;
  }

  ///////////////////////////////////////////////////////////////

  // Replace the global queueMicrotask with a version that captures the current logical context
  if (typeof globalThis.queueMicrotask !== 'undefined') {
    const __queueMicrotask = globalThis.queueMicrotask;
    globalThis.queueMicrotask = (callback: () => void) => {
      const capturedLogicalContext = currentLogicalContext;
      return __queueMicrotask(() => {
        const adjustment = { contextToUse: capturedLogicalContext } as LogicalContextAdjustment;
        trampoline(adjustment, callback);
      });
    };
  }

  ///////////////////////////////////////////////////////////////

  // Replace the global setImmediate with a version that captures the current logical context (Node.js only)
  if (typeof globalThis.setImmediate !== 'undefined') {
    const __setImmediate = globalThis.setImmediate;
    globalThis.setImmediate = ((callback: (...args: any[]) => void, ...args: any[]) => {
      const capturedLogicalContext = currentLogicalContext;
      return __setImmediate((...callbackArgs: any[]) => {
        const adjustment = { contextToUse: capturedLogicalContext } as LogicalContextAdjustment;
        trampoline(adjustment, callback, ...callbackArgs);
      }, ...args);
    }) as typeof globalThis.setImmediate;
  }

  ///////////////////////////////////////////////////////////////

  // Replace the Promise functions with versions that capture the current logical context
  if (typeof Promise !== 'undefined') {
    const __then = Promise.prototype.then;
    const __catch = Promise.prototype.catch;
    const __finally = Promise.prototype.finally;

    // Promise.then()
    Promise.prototype.then = function<T, TResult1 = T, TResult2 = never>(
      onFulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
      onRejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
    ): Promise<TResult1 | TResult2> {
      const capturedLogicalContext = currentLogicalContext;
      const resultPromise = __then.call(
        this,
        onFulfilled ? value => {
          // Execute the continuation handler in the captured logical context (ConfigureAwait(true) behavior)
          const adjustment = { contextToUse: capturedLogicalContext } as LogicalContextAdjustment;
          return trampoline(adjustment, onFulfilled, value);
        } : undefined,
        onRejected ? reason => {
          // Execute the continuation handler in the captured logical context (ConfigureAwait(true) behavior)
          const adjustment = { contextToUse: capturedLogicalContext } as LogicalContextAdjustment;
          return trampoline(adjustment, onRejected, reason);
        } : undefined) as Promise<TResult1 | TResult2>;

      return resultPromise;
    };

    // Promise.catch()
    Promise.prototype.catch = function<T = never>(
      onRejected?: ((reason: any) => T | PromiseLike<T>) | undefined | null
    ): Promise<T> {
      const capturedLogicalContext = currentLogicalContext;
      const resultPromise = __catch.call(
        this,
        onRejected ? reason => {
          // Execute the continuation handler in the captured logical context
          const adjustment = { contextToUse: capturedLogicalContext } as LogicalContextAdjustment;
          return trampoline(adjustment, onRejected, reason);
        } : undefined) as Promise<T>;

      return resultPromise;
    };

    // Promise.finally()
    Promise.prototype.finally = function(
      onFinally?: (() => void) | undefined | null
    ): Promise<any> {
      const capturedLogicalContext = currentLogicalContext;
      const resultPromise = __finally.call(
        this,
        onFinally ? () => {
          // Execute the continuation handler in the captured logical context
          const adjustment = { contextToUse: capturedLogicalContext } as LogicalContextAdjustment;
          return trampoline(adjustment, onFinally);
        } : undefined);

      return resultPromise;
    };
  }

  ///////////////////////////////////////////////////////////////

  // Replace Element.prototype.addEventListener with a version that captures the current logical context
  if (typeof Element !== 'undefined' && Element.prototype && Element.prototype.addEventListener) {
    const __elementAddEventListener = Element.prototype.addEventListener;
    Element.prototype.addEventListener = function(
      this: Element,
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions
    ) {
      if (listener === null || listener === undefined) {
        return (__elementAddEventListener as any).call(this, type, listener, options);
      }
      
      if (typeof listener === 'function') {
        const capturedLogicalContext = currentLogicalContext;
        const wrappedListener = (event: Event) => {
          const adjustment = { contextToUse: capturedLogicalContext } as LogicalContextAdjustment;
          return trampoline(adjustment, listener, event);
        };
        return __elementAddEventListener.call(this, type, wrappedListener, options);
      } else if (typeof listener === 'object' && 'handleEvent' in listener) {
        const capturedLogicalContext = currentLogicalContext;
        const wrappedListener = {
          handleEvent: (event: Event) => {
            const adjustment = { contextToUse: capturedLogicalContext } as LogicalContextAdjustment;
            return trampoline(adjustment, () => listener.handleEvent(event));
          }
        };
        return __elementAddEventListener.call(this, type, wrappedListener, options);
      }
      
      return (__elementAddEventListener as any).call(this, type, listener, options);
    };
  }

  ///////////////////////////////////////////////////////////////

  // Replace requestAnimationFrame with a version that captures the current logical context
  if (typeof globalThis.requestAnimationFrame !== 'undefined') {
    const __requestAnimationFrame = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
      const capturedLogicalContext = currentLogicalContext;
      return __requestAnimationFrame((time: DOMHighResTimeStamp) => {
        const adjustment = { contextToUse: capturedLogicalContext } as LogicalContextAdjustment;
        return trampoline(adjustment, callback, time);
      });
    };
  }

  ///////////////////////////////////////////////////////////////

  // Replace XMLHttpRequest with a version that captures the current logical context
  if (typeof globalThis.XMLHttpRequest !== 'undefined') {
    const __XMLHttpRequest = globalThis.XMLHttpRequest;
    
    globalThis.XMLHttpRequest = class extends __XMLHttpRequest {
      constructor() {
        super();
        
        // Capture context when XMLHttpRequest is created
        const capturedLogicalContext = currentLogicalContext;
        
        // Hook all event handler properties
        const eventHandlerProperties = [
          'onreadystatechange', 'onloadstart', 'onprogress', 'onabort', 
          'onerror', 'onload', 'ontimeout', 'onloadend'
        ];
        
        eventHandlerProperties.forEach(prop => {
          let handler: ((event: any) => void) | null = null;
          Object.defineProperty(this, prop, {
            get: () => handler,
            set: (newHandler: ((event: any) => void) | null) => {
              if (newHandler && typeof newHandler === 'function') {
                handler = (event: any) => {
                  const adjustment = { contextToUse: capturedLogicalContext } as LogicalContextAdjustment;
                  return trampoline(adjustment, newHandler, event);
                };
              } else {
                handler = newHandler;
              }
            },
            configurable: true,
            enumerable: true
          });
        });
      }
      
      addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) {
        const capturedLogicalContext = currentLogicalContext;
        
        if (!listener) {
          return (super.addEventListener as any)(type, listener, options);
        }
        
        if (typeof listener === 'function') {
          const wrappedListener = (event: Event) => {
            const adjustment = { contextToUse: capturedLogicalContext } as LogicalContextAdjustment;
            return trampoline(adjustment, listener, event);
          };
          return super.addEventListener(type, wrappedListener, options);
        } else if (typeof listener === 'object' && 'handleEvent' in listener) {
          const wrappedListener = {
            handleEvent: (event: Event) => {
              const adjustment = { contextToUse: capturedLogicalContext } as LogicalContextAdjustment;
              return trampoline(adjustment, () => listener.handleEvent(event));
            }
          };
          return super.addEventListener(type, wrappedListener, options);
        }
        
        return super.addEventListener(type, listener, options);
      }
    };
  }
}
