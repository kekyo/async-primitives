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
  thisArg?: any,
  ...args: T
) => {
  const previousLogicalContext = currentLogicalContext;
  currentLogicalContext = adjustment.contextToUse;
  try {
    return callback.call(thisArg, ...args);
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
          trampoline(adjustment, handler, undefined, ...args);
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
          trampoline(adjustment, handler, undefined, ...args);
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
        trampoline(adjustment, callback, undefined);
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
        trampoline(adjustment, callback, undefined, ...callbackArgs);
      }, ...args);
    }) as typeof globalThis.setImmediate;
  }

  ///////////////////////////////////////////////////////////////

  // Replace the global process.nextTick with a version that captures the current logical context (Node.js only)
  if (typeof process !== 'undefined' && process.nextTick) {
    const __nextTick = process.nextTick;
    process.nextTick = (callback: (...args: any[]) => void, ...args: any[]) => {
      const capturedLogicalContext = currentLogicalContext;
      return __nextTick(() => {
        const adjustment = { contextToUse: capturedLogicalContext } as LogicalContextAdjustment;
        trampoline(adjustment, callback, undefined, ...args);
      });
    };
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
          return trampoline(adjustment, onFulfilled, undefined, value);
        } : undefined,
        onRejected ? reason => {
          // Execute the continuation handler in the captured logical context (ConfigureAwait(true) behavior)
          const adjustment = { contextToUse: capturedLogicalContext } as LogicalContextAdjustment;
          return trampoline(adjustment, onRejected, undefined, reason);
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
          return trampoline(adjustment, onRejected, undefined, reason);
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
          return trampoline(adjustment, onFinally, undefined);
        } : undefined);

      return resultPromise;
    };
  }

  ///////////////////////////////////////////////////////////////

  // Replace EventTarget.prototype.addEventListener with captures the current logical context
  if (typeof EventTarget !== 'undefined' && EventTarget.prototype && EventTarget.prototype.addEventListener) {
    const __eventTargetAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(
      this: EventTarget,
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions
    ) {
      if (listener === null || listener === undefined) {
        return (__eventTargetAddEventListener as any).call(this, type, listener, options);
      }
      
      if (typeof listener === 'function') {
        const capturedLogicalContext = currentLogicalContext;
        const wrappedListener = (event: Event) => {
          const adjustment = { contextToUse: capturedLogicalContext } as LogicalContextAdjustment;
          return trampoline(adjustment, listener, event.currentTarget, event);
        };
        return __eventTargetAddEventListener.call(this, type, wrappedListener, options);
      } else if (typeof listener === 'object' && 'handleEvent' in listener) {
        const capturedLogicalContext = currentLogicalContext;
        const wrappedListener = {
          handleEvent: (event: Event) => {
            const adjustment = { contextToUse: capturedLogicalContext } as LogicalContextAdjustment;
            return trampoline(adjustment, () => listener.handleEvent(event));
          }
        };
        return __eventTargetAddEventListener.call(this, type, wrappedListener, options);
      }
      
      return (__eventTargetAddEventListener as any).call(this, type, listener, options);
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
          return trampoline(adjustment, listener, event.currentTarget, event);
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
        return trampoline(adjustment, callback, undefined, time);
      });
    };
  }

  ///////////////////////////////////////////////////////////////

  // Replace XMLHttpRequest with a version that captures the current logical context
  if (typeof globalThis.XMLHttpRequest !== 'undefined') {
    const __XMLHttpRequest = globalThis.XMLHttpRequest;
    
    globalThis.XMLHttpRequest = class extends __XMLHttpRequest {
      private _userHandlers: Map<string, ((event: any) => void) | null> = new Map();
      
      constructor() {
        super();
        
        // Hook all event handler properties
        const eventHandlerProperties = [
          'onreadystatechange', 'onloadstart', 'onprogress', 'onabort', 
          'onerror', 'onload', 'ontimeout', 'onloadend'
        ];
        
        eventHandlerProperties.forEach(prop => {
          Object.defineProperty(this, prop, {
            get: () => this._userHandlers.get(prop) || null,
            set: (newHandler: ((event: any) => void) | null) => {
              this._userHandlers.set(prop, newHandler);
              
              if (newHandler && typeof newHandler === 'function') {
                const capturedLogicalContext = currentLogicalContext;
                
                // Set the wrapped handler using the parent's property descriptor
                const wrappedHandler = function(this: any, event: any) {
                  const adjustment = { contextToUse: capturedLogicalContext } as LogicalContextAdjustment;
                  return trampoline(adjustment, newHandler, this, event);
                };
                
                // Call the parent setter
                const parentProto = Object.getPrototypeOf(Object.getPrototypeOf(this));
                const descriptor = Object.getOwnPropertyDescriptor(parentProto, prop);
                if (descriptor && descriptor.set) {
                  descriptor.set.call(this, wrappedHandler);
                } else {
                  // Fallback for older browsers or non-standard implementations
                  (this as any)[`_${prop}`] = wrappedHandler;
                }
              } else {
                // Clear handler
                const parentProto = Object.getPrototypeOf(Object.getPrototypeOf(this));
                const descriptor = Object.getOwnPropertyDescriptor(parentProto, prop);
                if (descriptor && descriptor.set) {
                  descriptor.set.call(this, null);
                } else {
                  (this as any)[`_${prop}`] = null;
                }
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
            return trampoline(adjustment, listener, event.currentTarget, event);
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

  ///////////////////////////////////////////////////////////////

  // Replace WebSocket with a version that captures the current logical context
  if (typeof globalThis.WebSocket !== 'undefined') {
    const __WebSocket = globalThis.WebSocket;
    
    globalThis.WebSocket = class extends __WebSocket {
      private _userHandlers: Map<string, ((event: any) => void) | null> = new Map();
      
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        
        // Hook all event handler properties
        const eventHandlerProperties = [
          'onopen', 'onmessage', 'onerror', 'onclose'
        ];
        
        eventHandlerProperties.forEach(prop => {
          Object.defineProperty(this, prop, {
            get: () => this._userHandlers.get(prop) || null,
            set: (newHandler: ((event: any) => void) | null) => {
              this._userHandlers.set(prop, newHandler);
              
              if (newHandler && typeof newHandler === 'function') {
                const capturedLogicalContext = currentLogicalContext;
                
                // Set the wrapped handler using the parent's property descriptor
                const wrappedHandler = function(this: any, event: any) {
                  const adjustment = { contextToUse: capturedLogicalContext } as LogicalContextAdjustment;
                  return trampoline(adjustment, newHandler, this, event);
                };
                
                // Call the parent setter
                const parentProto = Object.getPrototypeOf(Object.getPrototypeOf(this));
                const descriptor = Object.getOwnPropertyDescriptor(parentProto, prop);
                if (descriptor && descriptor.set) {
                  descriptor.set.call(this, wrappedHandler);
                } else {
                  // Fallback for older browsers or non-standard implementations
                  (this as any)[`_${prop}`] = wrappedHandler;
                }
              } else {
                // Clear handler
                const parentProto = Object.getPrototypeOf(Object.getPrototypeOf(this));
                const descriptor = Object.getOwnPropertyDescriptor(parentProto, prop);
                if (descriptor && descriptor.set) {
                  descriptor.set.call(this, null);
                } else {
                  (this as any)[`_${prop}`] = null;
                }
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
            return trampoline(adjustment, listener, event.currentTarget, event);
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

  ///////////////////////////////////////////////////////////////

  // Replace MutationObserver with a version that captures the current logical context
  if (typeof globalThis.MutationObserver !== 'undefined') {
    const __MutationObserver = globalThis.MutationObserver;
    
    globalThis.MutationObserver = class extends __MutationObserver {
      constructor(callback: MutationCallback) {
        const capturedLogicalContext = currentLogicalContext;
        const wrappedCallback: MutationCallback = (mutations: MutationRecord[], observer: MutationObserver) => {
          const adjustment = { contextToUse: capturedLogicalContext } as LogicalContextAdjustment;
          return trampoline(adjustment, callback, undefined, mutations, observer);
        };
        super(wrappedCallback);
      }
    };
  }

  ///////////////////////////////////////////////////////////////

  // Replace ResizeObserver with a version that captures the current logical context
  if (typeof globalThis.ResizeObserver !== 'undefined') {
    const __ResizeObserver = globalThis.ResizeObserver;
    
    globalThis.ResizeObserver = class extends __ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        const capturedLogicalContext = currentLogicalContext;
        const wrappedCallback: ResizeObserverCallback = (entries: ResizeObserverEntry[], observer: ResizeObserver) => {
          const adjustment = { contextToUse: capturedLogicalContext } as LogicalContextAdjustment;
          return trampoline(adjustment, callback, undefined, entries, observer);
        };
        super(wrappedCallback);
      }
    };
  }

  ///////////////////////////////////////////////////////////////

  // Replace IntersectionObserver with a version that captures the current logical context
  if (typeof globalThis.IntersectionObserver !== 'undefined') {
    const __IntersectionObserver = globalThis.IntersectionObserver;
    
    globalThis.IntersectionObserver = class extends __IntersectionObserver {
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        const capturedLogicalContext = currentLogicalContext;
        const wrappedCallback: IntersectionObserverCallback = (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => {
          const adjustment = { contextToUse: capturedLogicalContext } as LogicalContextAdjustment;
          return trampoline(adjustment, callback, undefined, entries, observer);
        };
        super(wrappedCallback, options);
      }
    };
  }

  ///////////////////////////////////////////////////////////////

  // Replace Worker with a version that captures the current logical context
  if (typeof globalThis.Worker !== 'undefined') {
    const __Worker = globalThis.Worker;
    
    globalThis.Worker = class extends __Worker {
      private _userHandlers: Map<string, ((event: any) => void) | null> = new Map();
      
      constructor(scriptURL: string | URL, options?: WorkerOptions) {
        super(scriptURL, options);
        
        // Hook all event handler properties
        const eventHandlerProperties = [
          'onmessage', 'onmessageerror', 'onerror'
        ];
        
        eventHandlerProperties.forEach(prop => {
          Object.defineProperty(this, prop, {
            get: () => this._userHandlers.get(prop) || null,
            set: (newHandler: ((event: any) => void) | null) => {
              this._userHandlers.set(prop, newHandler);
              
              if (newHandler && typeof newHandler === 'function') {
                const capturedLogicalContext = currentLogicalContext;
                
                // Set the wrapped handler using the parent's property descriptor
                const wrappedHandler = function(this: any, event: any) {
                  const adjustment = { contextToUse: capturedLogicalContext } as LogicalContextAdjustment;
                  return trampoline(adjustment, newHandler, this, event);
                };
                
                // Call the parent setter
                const parentProto = Object.getPrototypeOf(Object.getPrototypeOf(this));
                const descriptor = Object.getOwnPropertyDescriptor(parentProto, prop);
                if (descriptor && descriptor.set) {
                  descriptor.set.call(this, wrappedHandler);
                } else {
                  // Fallback for older browsers or non-standard implementations
                  (this as any)[`_${prop}`] = wrappedHandler;
                }
              } else {
                // Clear handler
                const parentProto = Object.getPrototypeOf(Object.getPrototypeOf(this));
                const descriptor = Object.getOwnPropertyDescriptor(parentProto, prop);
                if (descriptor && descriptor.set) {
                  descriptor.set.call(this, null);
                } else {
                  (this as any)[`_${prop}`] = null;
                }
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
            return trampoline(adjustment, listener, event.currentTarget, event);
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

  ///////////////////////////////////////////////////////////////

  // Replace MessagePort with a version that captures the current logical context
  if (typeof globalThis.MessagePort !== 'undefined') {
    const __MessagePort = globalThis.MessagePort;
    
    // Create a wrapper class for MessagePort
    const createMessagePortWrapper = (originalPort: MessagePort) => {
      const _userHandlers = new Map<string, ((event: any) => void) | null>();
      
      // Hook all event handler properties
      const eventHandlerProperties = ['onmessage', 'onmessageerror'];
      
      eventHandlerProperties.forEach(prop => {
        Object.defineProperty(originalPort, prop, {
          get: () => _userHandlers.get(prop) || null,
          set: (newHandler: ((event: any) => void) | null) => {
            _userHandlers.set(prop, newHandler);
            
            if (newHandler && typeof newHandler === 'function') {
              const capturedLogicalContext = currentLogicalContext;
              
              // Set the wrapped handler
              const wrappedHandler = function(this: any, event: any) {
                const adjustment = { contextToUse: capturedLogicalContext } as LogicalContextAdjustment;
                return trampoline(adjustment, newHandler, this, event);
              };
              
              // Set on the original MessagePort
              const descriptor = Object.getOwnPropertyDescriptor(__MessagePort.prototype, prop);
              if (descriptor && descriptor.set) {
                descriptor.set.call(originalPort, wrappedHandler);
              }
            } else {
              // Clear handler
              const descriptor = Object.getOwnPropertyDescriptor(__MessagePort.prototype, prop);
              if (descriptor && descriptor.set) {
                descriptor.set.call(originalPort, null);
              }
            }
          },
          configurable: true,
          enumerable: true
        });
      });
      
      // Hook addEventListener
      const originalAddEventListener = originalPort.addEventListener;
      originalPort.addEventListener = function(
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions
      ) {
        const capturedLogicalContext = currentLogicalContext;
        
        if (!listener) {
          return originalAddEventListener.call(this, type, listener as any, options);
        }
        
        if (typeof listener === 'function') {
          const wrappedListener = (event: Event) => {
            const adjustment = { contextToUse: capturedLogicalContext } as LogicalContextAdjustment;
            return trampoline(adjustment, listener, event.currentTarget, event);
          };
          return originalAddEventListener.call(this, type, wrappedListener, options);
        } else if (typeof listener === 'object' && 'handleEvent' in listener) {
          const wrappedListener = {
            handleEvent: (event: Event) => {
              const adjustment = { contextToUse: capturedLogicalContext } as LogicalContextAdjustment;
              return trampoline(adjustment, () => listener.handleEvent(event));
            }
          };
          return originalAddEventListener.call(this, type, wrappedListener, options);
        }
        
        return originalAddEventListener.call(this, type, listener, options);
      };
      
      return originalPort;
    };
    
    // Hook MessageChannel constructor to wrap the ports
    if (typeof globalThis.MessageChannel !== 'undefined') {
      const __MessageChannel = globalThis.MessageChannel;
      
      globalThis.MessageChannel = class extends __MessageChannel {
        constructor() {
          super();
          // Wrap both ports
          createMessagePortWrapper(this.port1);
          createMessagePortWrapper(this.port2);
        }
      };
    }
  }
}
