/**
 * Tests for DeferredGenerator<T> functionality
 * These tests verify the core behavior of the async-generator-based streaming result handling
 */

import { describe, it, expect } from 'vitest';
import { createDeferredGenerator } from '../src/primitives/deferred.js';
import { delay } from '../src/primitives/delay.js';

describe('DeferredGenerator', () => {
  describe('Basic functionality', () => {
    it('should create a deferred generator with a generator, yield, return, and throw methods', () => {
      const deferredGen = createDeferredGenerator<string>();

      expect(deferredGen).toBeDefined();
      expect(deferredGen.generator).toBeDefined();
      expect(typeof deferredGen.yield).toBe('function');
      expect(typeof deferredGen.return).toBe('function');
      expect(typeof deferredGen.throw).toBe('function');
    });

    it('should enable async iteration with yielded values', async () => {
      const deferredGen = createDeferredGenerator<number>();
      const results: number[] = [];

      // Start async iteration
      const iterationPromise = (async () => {
        for await (const value of deferredGen.generator) {
          results.push(value);
        }
      })();

      // Yield some values
      await delay(10);
      deferredGen.yield(1);
      await delay(10);
      deferredGen.yield(2);
      await delay(10);
      deferredGen.yield(3);
      await delay(10);
      deferredGen.return();

      await iterationPromise;

      expect(results).toEqual([1, 2, 3]);
    });

    it('should work with different types', async () => {
      // Test with strings
      console.log('[Test] Creating string generator');
      const stringGen = createDeferredGenerator<string>();
      const stringResults: string[] = [];

      console.log('[Test] Starting iteration promise');
      const stringIteration = (async () => {
        console.log('[Test] Starting for-await loop');
        for await (const value of stringGen.generator) {
          console.log('[Test] Received value in loop:', value);
          stringResults.push(value);
        }
        console.log('[Test] for-await loop finished');
      })();

      console.log('[Test] Calling yield(hello)');
      stringGen.yield('hello');
      console.log('[Test] Calling yield(world)');
      stringGen.yield('world');
      console.log('[Test] Calling return()');
      stringGen.return();
      console.log('[Test] Awaiting iteration completion');
      await stringIteration;
      console.log('[Test] Iteration completed, results:', stringResults);

      expect(stringResults).toEqual(['hello', 'world']);

      // Test with objects
      interface TestObject {
        id: number;
        name: string;
      }

      const objectGen = createDeferredGenerator<TestObject>();
      const objectResults: TestObject[] = [];

      const objectIteration = (async () => {
        for await (const value of objectGen.generator) {
          objectResults.push(value);
        }
      })();

      objectGen.yield({ id: 1, name: 'test1' });
      objectGen.yield({ id: 2, name: 'test2' });
      objectGen.return();
      await objectIteration;

      expect(objectResults).toEqual([
        { id: 1, name: 'test1' },
        { id: 2, name: 'test2' }
      ]);
    });
  });

  describe('Empty iteration behavior', () => {
    it('should complete iteration without yielding any values', async () => {
      const deferredGen = createDeferredGenerator<string>();
      const results: string[] = [];

      const iterationPromise = (async () => {
        for await (const value of deferredGen.generator) {
          results.push(value);
        }
      })();

      // Complete without yielding any values
      await delay(10);
      deferredGen.return();

      await iterationPromise;

      expect(results).toEqual([]);
    });

    it('should handle immediate return without any async operations', async () => {
      const deferredGen = createDeferredGenerator<number>();
      const results: number[] = [];

      // Return immediately
      deferredGen.return();

      for await (const value of deferredGen.generator) {
        results.push(value);
      }

      expect(results).toEqual([]);
    });
  });

  describe('Early exception handling', () => {
    it('should handle exceptions thrown before any yield', async () => {
      const deferredGen = createDeferredGenerator<string>();
      const results: string[] = [];
      let caughtError: Error | null = null;

      const iterationPromise = (async () => {
        try {
          for await (const value of deferredGen.generator) {
            results.push(value);
          }
        } catch (error) {
          caughtError = error as Error;
        }
      })();

      // Throw error before any yield
      await delay(10);
      deferredGen.throw(new Error('early error'));

      await iterationPromise;

      expect(results).toEqual([]);
      expect(caughtError).toBeDefined();
      expect(caughtError!.message).toBe('early error');
    });

    it('should ignore operations after early exception', async () => {
      const deferredGen = createDeferredGenerator<string>();
      const results: string[] = [];
      let caughtError: Error | null = null;

      const iterationPromise = (async () => {
        try {
          for await (const value of deferredGen.generator) {
            results.push(value);
          }
        } catch (error) {
          caughtError = error as Error;
        }
      })();

      // Throw error and then try to yield
      deferredGen.throw(new Error('early error'));
      deferredGen.yield('should be ignored');
      deferredGen.return();

      await iterationPromise;

      expect(results).toEqual([]);
      expect(caughtError).toBeDefined();
      expect(caughtError!.message).toBe('early error');
    });
  });

  describe('Exception during iteration', () => {
    it('should handle exceptions thrown after some values have been yielded', async () => {
      const deferredGen = createDeferredGenerator<string>();
      const results: string[] = [];
      let caughtError: Error | null = null;

      const iterationPromise = (async () => {
        try {
          for await (const value of deferredGen.generator) {
            results.push(value);
          }
        } catch (error) {
          caughtError = error as Error;
        }
      })();

      // Yield some values, then throw
      await delay(10);
      deferredGen.yield('value1');
      await delay(10);
      deferredGen.yield('value2');
      await delay(10);
      deferredGen.throw(new Error('mid-iteration error'));

      await iterationPromise;

      expect(results).toEqual(['value1', 'value2']);
      expect(caughtError).toBeDefined();
      expect(caughtError!.message).toBe('mid-iteration error');
    });

    it('should ignore operations after mid-iteration exception', async () => {
      const deferredGen = createDeferredGenerator<number>();
      const results: number[] = [];
      let caughtError: Error | null = null;

      const iterationPromise = (async () => {
        try {
          for await (const value of deferredGen.generator) {
            results.push(value);
          }
        } catch (error) {
          caughtError = error as Error;
        }
      })();

      // Yield, throw, then try more operations
      deferredGen.yield(1);
      await delay(10);
      deferredGen.throw(new Error('mid error'));
      deferredGen.yield(2); // Should be ignored
      deferredGen.return(); // Should be ignored

      await iterationPromise;

      expect(results).toEqual([1]);
      expect(caughtError).toBeDefined();
      expect(caughtError!.message).toBe('mid error');
    });
  });

  describe('State management', () => {
    it('should ignore yield after return', async () => {
      const deferredGen = createDeferredGenerator<string>();
      const results: string[] = [];

      const iterationPromise = (async () => {
        for await (const value of deferredGen.generator) {
          results.push(value);
        }
      })();

      deferredGen.yield('value1');
      await delay(10);
      deferredGen.return();
      deferredGen.yield('should be ignored');

      await iterationPromise;

      expect(results).toEqual(['value1']);
    });

    it('should ignore return after throw', async () => {
      const deferredGen = createDeferredGenerator<string>();
      const results: string[] = [];
      let caughtError: Error | null = null;

      const iterationPromise = (async () => {
        try {
          for await (const value of deferredGen.generator) {
            results.push(value);
          }
        } catch (error) {
          caughtError = error as Error;
        }
      })();

      deferredGen.yield('value1');
      await delay(10);
      deferredGen.throw(new Error('test error'));
      deferredGen.return(); // Should be ignored

      await iterationPromise;

      expect(results).toEqual(['value1']);
      expect(caughtError).toBeDefined();
      expect(caughtError!.message).toBe('test error');
    });

    it('should handle multiple return calls safely', async () => {
      const deferredGen = createDeferredGenerator<string>();
      const results: string[] = [];

      const iterationPromise = (async () => {
        for await (const value of deferredGen.generator) {
          results.push(value);
        }
      })();

      deferredGen.yield('value1');
      await delay(10);
      deferredGen.return();
      deferredGen.return(); // Second return should be ignored

      await iterationPromise;

      expect(results).toEqual(['value1']);
    });

    it('should handle multiple throw calls safely', async () => {
      const deferredGen = createDeferredGenerator<string>();
      const results: string[] = [];
      let caughtError: Error | null = null;

      const iterationPromise = (async () => {
        try {
          for await (const value of deferredGen.generator) {
            results.push(value);
          }
        } catch (error) {
          caughtError = error as Error;
        }
      })();

      deferredGen.yield('value1');
      await delay(10);
      deferredGen.throw(new Error('first error'));
      deferredGen.throw(new Error('second error')); // Should be ignored

      await iterationPromise;

      expect(results).toEqual(['value1']);
      expect(caughtError).toBeDefined();
      expect(caughtError!.message).toBe('first error');
    });
  });

  describe('Concurrent operations', () => {
    it('should handle multiple concurrent yield operations', async () => {
      const deferredGen = createDeferredGenerator<number>();
      const results: number[] = [];

      const iterationPromise = (async () => {
        for await (const value of deferredGen.generator) {
          results.push(value);
        }
      })();

      // Yield values concurrently
      const yieldOperations = Array.from({ length: 5 }, async (_, i) => {
        await delay(Math.random() * 10);
        deferredGen.yield(i);
      });

      await Promise.all(yieldOperations);
      await delay(20);
      deferredGen.return();

      await iterationPromise;

      expect(results).toHaveLength(5);
      expect(results.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
    });

    it('should handle concurrent yield and return safely', async () => {
      const deferredGen = createDeferredGenerator<string>();
      const results: string[] = [];

      const iterationPromise = (async () => {
        for await (const value of deferredGen.generator) {
          results.push(value);
        }
      })();

      // Start concurrent operations
      const operations = [
        (async () => {
          await delay(5);
          deferredGen.yield('value1');
        })(),
        (async () => {
          await delay(10);
          deferredGen.yield('value2');
        })(),
        (async () => {
          await delay(15);
          deferredGen.return();
        })(),
        (async () => {
          await delay(20);
          deferredGen.yield('should be ignored');
        })()
      ];

      await Promise.all(operations);
      await iterationPromise;

      expect(results).toContain('value1');
      expect(results).toContain('value2');
      expect(results).not.toContain('should be ignored');
    });
  });

  describe('Integration patterns', () => {
    it('should work with multiple consumers of the same generator', async () => {
      const deferredGen = createDeferredGenerator<number>();
      const results1: number[] = [];
      const results2: number[] = [];

      // Note: AsyncGenerator can only be consumed once, so we test this pattern
      // where one consumer gets all values and others get nothing
      const consumer1 = (async () => {
        for await (const value of deferredGen.generator) {
          results1.push(value);
        }
      })();

      const consumer2 = (async () => {
        for await (const value of deferredGen.generator) {
          results2.push(value);
        }
      })();

      deferredGen.yield(1);
      deferredGen.yield(2);
      deferredGen.return();

      await Promise.all([consumer1, consumer2]);

      // Only one consumer should get the values (first one to start iteration)
      const totalValues = results1.length + results2.length;
      expect(totalValues).toBe(2);
    });

    it('should enable producer-consumer pattern with async coordination', async () => {
      const deferredGen = createDeferredGenerator<string>();
      const produced: string[] = [];
      const consumed: string[] = [];

      // Producer
      const producer = async () => {
        for (let i = 0; i < 5; i++) {
          await delay(10);
          const value = `item-${i}`;
          produced.push(value);
          deferredGen.yield(value);
        }
        deferredGen.return();
      };

      // Consumer
      const consumer = async () => {
        for await (const value of deferredGen.generator) {
          consumed.push(value);
          await delay(5); // Simulate processing time
        }
      };

      await Promise.all([producer(), consumer()]);

      expect(produced).toEqual(['item-0', 'item-1', 'item-2', 'item-3', 'item-4']);
      expect(consumed).toEqual(['item-0', 'item-1', 'item-2', 'item-3', 'item-4']);
    });
  });

  describe('Type safety', () => {
    it('should maintain type safety with complex types', async () => {
      interface ComplexType {
        id: number;
        data: {
          name: string;
          values: number[];
        };
        timestamp: Date;
      }

      const deferredGen = createDeferredGenerator<ComplexType>();
      const results: ComplexType[] = [];

      const iterationPromise = (async () => {
        for await (const value of deferredGen.generator) {
          results.push(value);
        }
      })();

      const testObject: ComplexType = {
        id: 1,
        data: {
          name: 'test',
          values: [1, 2, 3]
        },
        timestamp: new Date()
      };

      deferredGen.yield(testObject);
      deferredGen.return();

      await iterationPromise;

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(1);
      expect(results[0].data.name).toBe('test');
      expect(results[0].data.values).toEqual([1, 2, 3]);
      expect(results[0].timestamp).toBeInstanceOf(Date);
    });
  });

  describe('AbortSignal integration', () => {
    it('should abort iteration when signal is aborted before starting', async () => {
      const controller = new AbortController();
      controller.abort();

      const deferredGen = createDeferredGenerator<string>(controller.signal);
      const results: string[] = [];
      let caughtError: Error | null = null;

      try {
        for await (const value of deferredGen.generator) {
          results.push(value);
        }
      } catch (error) {
        caughtError = error as Error;
      }

      expect(results).toEqual([]);
      expect(caughtError).toBeDefined();
      expect(caughtError!.message).toBe('Deferred generator aborted');
    });

    it('should abort iteration when signal is aborted during iteration', async () => {
      const controller = new AbortController();
      const deferredGen = createDeferredGenerator<string>(controller.signal);
      const results: string[] = [];
      let caughtError: Error | null = null;

      const iterationPromise = (async () => {
        try {
          for await (const value of deferredGen.generator) {
            results.push(value);
          }
        } catch (error) {
          caughtError = error as Error;
        }
      })();

      await delay(10);
      deferredGen.yield('value1');
      await delay(10);
      deferredGen.yield('value2');
      await delay(10);
      
      // Abort while waiting for next value
      controller.abort();
      
      await iterationPromise;

      expect(results).toEqual(['value1', 'value2']);
      expect(caughtError).toBeDefined();
      expect(caughtError!.message).toBe('Deferred generator aborted');
    });

    it('should abort while waiting for values', async () => {
      const controller = new AbortController();
      const deferredGen = createDeferredGenerator<string>(controller.signal);
      const results: string[] = [];
      let caughtError: Error | null = null;

      const iterationPromise = (async () => {
        try {
          for await (const value of deferredGen.generator) {
            results.push(value);
          }
        } catch (error) {
          caughtError = error as Error;
        }
      })();

      // Abort while generator is waiting for first value
      await delay(10);
      controller.abort();
      
      await iterationPromise;

      expect(results).toEqual([]);
      expect(caughtError).toBeDefined();
      expect(caughtError!.message).toBe('Deferred generator aborted');
    });

    it('should work normally without AbortSignal', async () => {
      const deferredGen = createDeferredGenerator<string>();
      const results: string[] = [];

      const iterationPromise = (async () => {
        for await (const value of deferredGen.generator) {
          results.push(value);
        }
      })();

      await delay(10);
      deferredGen.yield('value1');
      await delay(10);
      deferredGen.yield('value2');
      await delay(10);
      deferredGen.return();

      await iterationPromise;

      expect(results).toEqual(['value1', 'value2']);
    });

    it('should abort multiple generators with the same signal', async () => {
      const controller = new AbortController();
      const gen1 = createDeferredGenerator<string>(controller.signal);
      const gen2 = createDeferredGenerator<number>(controller.signal);
      
      const results1: string[] = [];
      const results2: number[] = [];
      let error1: Error | null = null;
      let error2: Error | null = null;

      const iteration1 = (async () => {
        try {
          for await (const value of gen1.generator) {
            results1.push(value);
          }
        } catch (error) {
          error1 = error as Error;
        }
      })();

      const iteration2 = (async () => {
        try {
          for await (const value of gen2.generator) {
            results2.push(value);
          }
        } catch (error) {
          error2 = error as Error;
        }
      })();

      await delay(10);
      gen1.yield('string1');
      gen2.yield(1);
      await delay(10);
      
      controller.abort();

      await Promise.all([iteration1, iteration2]);

      expect(results1).toEqual(['string1']);
      expect(results2).toEqual([1]);
      expect(error1?.message).toBe('Deferred generator aborted');
      expect(error2?.message).toBe('Deferred generator aborted');
    });

    it('should handle abort during queue processing', async () => {
      const controller = new AbortController();
      const deferredGen = createDeferredGenerator<string>(controller.signal);
      const results: string[] = [];
      let caughtError: Error | null = null;

      const iterationPromise = (async () => {
        try {
          for await (const value of deferredGen.generator) {
            results.push(value);
            // Abort after processing first value
            if (results.length === 1) {
              controller.abort();
            }
          }
        } catch (error) {
          caughtError = error as Error;
        }
      })();

      // Add multiple values to queue
      deferredGen.yield('value1');
      deferredGen.yield('value2');
      deferredGen.yield('value3');

      await iterationPromise;

      expect(results).toEqual(['value1']);
      expect(caughtError).toBeDefined();
      // This case throws from the generator loop check, not from signal.wait()
      expect(caughtError!.message).toBe('Deferred generator aborted');
    });

    it('should ignore operations after abort', async () => {
      const controller = new AbortController();
      const deferredGen = createDeferredGenerator<string>(controller.signal);
      const results: string[] = [];
      let caughtError: Error | null = null;

      const iterationPromise = (async () => {
        try {
          for await (const value of deferredGen.generator) {
            results.push(value);
          }
        } catch (error) {
          caughtError = error as Error;
        }
      })();

      deferredGen.yield('value1');
      await delay(10);
      controller.abort();
      
      // These should be ignored
      deferredGen.yield('value2');
      deferredGen.return();

      await iterationPromise;

      expect(results).toEqual(['value1']);
      expect(caughtError?.message).toBe('Deferred generator aborted');
    });

    it('should handle concurrent abort and generator operations', async () => {
      const controller = new AbortController();
      const deferredGen = createDeferredGenerator<string>(controller.signal);
      const results: string[] = [];
      let caughtError: Error | null = null;

      const iterationPromise = (async () => {
        try {
          for await (const value of deferredGen.generator) {
            results.push(value);
          }
        } catch (error) {
          caughtError = error as Error;
        }
      })();

      // Concurrent operations
      const operations = [
        (async () => {
          await delay(5);
          deferredGen.yield('value1');
        })(),
        (async () => {
          await delay(10);
          controller.abort();
        })(),
        (async () => {
          await delay(15);
          deferredGen.yield('value2');
        })()
      ];

      await Promise.all(operations);
      await iterationPromise;

      // Should process value1, but abort before value2
      expect(results.length).toBeLessThanOrEqual(1);
      expect(caughtError?.message).toBe('Deferred generator aborted');
    });

    it('should handle abort with error handling in iteration', async () => {
      const controller = new AbortController();
      const deferredGen = createDeferredGenerator<string>(controller.signal);
      const results: string[] = [];
      let abortHandled = false;

      const iterationPromise = (async () => {
        try {
          for await (const value of deferredGen.generator) {
            results.push(value);
          }
        } catch (error) {
          if ((error as Error).message === 'Deferred generator aborted') {
            abortHandled = true;
          }
        }
      })();

      deferredGen.yield('value1');
      await delay(10);
      controller.abort();

      await iterationPromise;

      expect(results).toEqual(['value1']);
      expect(abortHandled).toBe(true);
    });
  });
});
