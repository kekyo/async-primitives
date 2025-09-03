import { describe, it, expect, beforeEach } from 'vitest';
import { createAsyncLocal, runOnNewLogicalContext } from '../src';

describe('LogicalContext Additional Hooks', () => {
  describe('Observer hooks', () => {
    beforeEach(() => {
      // Mock MutationObserver
      if (typeof globalThis.MutationObserver === 'undefined') {
        class MockMutationObserver {
          constructor(
            public callback: (mutations: any[], observer: any) => void
          ) {}
          observe() {}
          disconnect() {}
          takeRecords() {
            return [];
          }

          _triggerCallback() {
            this.callback([], this);
          }
        }
        (globalThis as any).MutationObserver = MockMutationObserver;
      }

      // Mock ResizeObserver
      if (typeof globalThis.ResizeObserver === 'undefined') {
        class MockResizeObserver {
          constructor(
            public callback: (entries: any[], observer: any) => void
          ) {}
          observe() {}
          unobserve() {}
          disconnect() {}

          _triggerCallback() {
            this.callback([], this);
          }
        }
        (globalThis as any).ResizeObserver = MockResizeObserver;
      }

      // Mock IntersectionObserver
      if (typeof globalThis.IntersectionObserver === 'undefined') {
        class MockIntersectionObserver {
          constructor(
            public callback: (entries: any[], observer: any) => void,
            public options?: any
          ) {}
          observe() {}
          unobserve() {}
          disconnect() {}
          takeRecords() {
            return [];
          }

          _triggerCallback() {
            this.callback([], this);
          }
        }
        (globalThis as any).IntersectionObserver = MockIntersectionObserver;
      }

      // Mock Worker
      if (typeof globalThis.Worker === 'undefined') {
        class MockWorker {
          public onmessage: ((event: any) => void) | null = null;
          public onerror: ((event: any) => void) | null = null;

          constructor(
            public scriptURL: string | URL,
            public options?: any
          ) {}

          postMessage() {}
          terminate() {}
          addEventListener() {}

          _triggerMessage(data: any) {
            if (this.onmessage) {
              this.onmessage({ type: 'message', data, currentTarget: this });
            }
          }
        }
        (globalThis as any).Worker = MockWorker;
      }

      // Mock MessageChannel
      if (typeof globalThis.MessageChannel === 'undefined') {
        class MockMessagePort {
          public onmessage: ((event: any) => void) | null = null;
          public otherPort: any = null;

          postMessage(data: any) {
            if (this.otherPort && this.otherPort.onmessage) {
              setTimeout(() => {
                this.otherPort.onmessage({
                  type: 'message',
                  data,
                  currentTarget: this.otherPort,
                });
              }, 1);
            }
          }

          addEventListener() {}
          start() {}
          close() {}
        }

        class MockMessageChannel {
          public port1: MockMessagePort;
          public port2: MockMessagePort;

          constructor() {
            this.port1 = new MockMessagePort();
            this.port2 = new MockMessagePort();
            this.port1.otherPort = this.port2;
            this.port2.otherPort = this.port1;
          }
        }

        (globalThis as any).MessagePort = MockMessagePort;
        (globalThis as any).MessageChannel = MockMessageChannel;
      }
    });

    it('should maintain context in MutationObserver callback', () => {
      return new Promise<void>((resolve) => {
        const asyncLocal = createAsyncLocal<string>();
        asyncLocal.setValue('mutation-context');

        const observer = new (globalThis as any).MutationObserver(() => {
          expect(asyncLocal.getValue()).toBe('mutation-context');
          resolve();
        });

        // Trigger the callback
        observer._triggerCallback();
      });
    });

    it('should maintain context in ResizeObserver callback', () => {
      return new Promise<void>((resolve) => {
        const asyncLocal = createAsyncLocal<string>();
        asyncLocal.setValue('resize-context');

        const observer = new (globalThis as any).ResizeObserver(() => {
          expect(asyncLocal.getValue()).toBe('resize-context');
          resolve();
        });

        // Trigger the callback
        observer._triggerCallback();
      });
    });

    it('should maintain context in IntersectionObserver callback', () => {
      return new Promise<void>((resolve) => {
        const asyncLocal = createAsyncLocal<string>();
        asyncLocal.setValue('intersection-context');

        const observer = new (globalThis as any).IntersectionObserver(
          () => {
            expect(asyncLocal.getValue()).toBe('intersection-context');
            resolve();
          },
          { threshold: 0.5 }
        );

        // Trigger the callback
        observer._triggerCallback();
      });
    });

    it('should isolate context across different observers', () => {
      return new Promise<void>((resolve) => {
        const asyncLocal = createAsyncLocal<string>();
        let completedCount = 0;

        const checkComplete = () => {
          completedCount++;
          if (completedCount === 2) resolve();
        };

        runOnNewLogicalContext('observer1-test', () => {
          asyncLocal.setValue('observer1-context');
          const observer1 = new (globalThis as any).MutationObserver(() => {
            expect(asyncLocal.getValue()).toBe('observer1-context');
            checkComplete();
          });
          observer1._triggerCallback();
        });

        runOnNewLogicalContext('observer2-test', () => {
          asyncLocal.setValue('observer2-context');
          const observer2 = new (globalThis as any).MutationObserver(() => {
            expect(asyncLocal.getValue()).toBe('observer2-context');
            checkComplete();
          });
          observer2._triggerCallback();
        });
      });
    });
  });

  describe('Worker hooks', () => {
    it('should maintain context in onmessage handler', () => {
      return new Promise<void>((resolve) => {
        const asyncLocal = createAsyncLocal<string>();
        asyncLocal.setValue('worker-message-context');

        const worker = new (globalThis as any).Worker('worker.js');
        worker.onmessage = (event: any) => {
          expect(asyncLocal.getValue()).toBe('worker-message-context');
          expect(event.data).toBe('worker-response');
          resolve();
        };

        // Trigger the event
        worker._triggerMessage('worker-response');
      });
    });
  });

  describe('MessagePort hooks', () => {
    it('should maintain context in onmessage handler', () => {
      return new Promise<void>((resolve) => {
        const asyncLocal = createAsyncLocal<string>();
        asyncLocal.setValue('port-message-context');

        const channel = new (globalThis as any).MessageChannel();
        channel.port1.onmessage = (event: any) => {
          expect(asyncLocal.getValue()).toBe('port-message-context');
          expect(event.data).toBe('test-message');
          resolve();
        };

        // Send message from port2 to port1
        channel.port2.postMessage('test-message');
      });
    });

    it('should isolate context between different message channels', () => {
      return new Promise<void>((resolve) => {
        const asyncLocal = createAsyncLocal<string>();
        let completedCount = 0;

        const checkComplete = () => {
          completedCount++;
          if (completedCount === 2) resolve();
        };

        runOnNewLogicalContext('channel1-test', () => {
          asyncLocal.setValue('channel1-context');
          const channel1 = new (globalThis as any).MessageChannel();
          channel1.port1.onmessage = () => {
            expect(asyncLocal.getValue()).toBe('channel1-context');
            checkComplete();
          };
          channel1.port2.postMessage('msg1');
        });

        runOnNewLogicalContext('channel2-test', () => {
          asyncLocal.setValue('channel2-context');
          const channel2 = new (globalThis as any).MessageChannel();
          channel2.port1.onmessage = () => {
            expect(asyncLocal.getValue()).toBe('channel2-context');
            checkComplete();
          };
          channel2.port2.postMessage('msg2');
        });
      });
    });
  });

  describe('Integration tests with existing hooks', () => {
    it('should work with Promise and Observer together', async () => {
      const asyncLocal = createAsyncLocal<string>();
      asyncLocal.setValue('promise-observer-context');

      const observerPromise = new Promise<void>((resolve) => {
        const observer = new (globalThis as any).IntersectionObserver(() => {
          expect(asyncLocal.getValue()).toBe('promise-observer-context');
          resolve();
        });

        observer._triggerCallback();
      });

      await observerPromise;
      expect(asyncLocal.getValue()).toBe('promise-observer-context');
    });

    it('should work with setTimeout and MutationObserver together', () => {
      return new Promise<void>((resolve) => {
        const asyncLocal = createAsyncLocal<string>();
        asyncLocal.setValue('combined-context');

        const observer = new (globalThis as any).MutationObserver(() => {
          expect(asyncLocal.getValue()).toBe('combined-context');

          setTimeout(() => {
            expect(asyncLocal.getValue()).toBe('combined-context');
            resolve();
          }, 10);
        });

        observer._triggerCallback();
      });
    });
  });
});
