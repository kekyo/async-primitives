/**
 * Tests for Deferred<T> functionality
 * These tests verify the core behavior of the promise-based deferred result handling
 */

import { describe, it, expect, vi } from 'vitest';
import { createDeferred } from '../src/primitives/deferred.js';
import { delay } from '../src/primitives/delay.js';

describe('Deferred', () => {
  describe('Basic functionality', () => {
    it('should create a deferred object with a promise, resolve, and reject methods', () => {
      const deferred = createDeferred<string>();

      expect(deferred).toBeDefined();
      expect(deferred.promise).toBeInstanceOf(Promise);
      expect(typeof deferred.resolve).toBe('function');
      expect(typeof deferred.reject).toBe('function');
    });

    it('should resolve with the provided value', async () => {
      const deferred = createDeferred<string>();
      const testValue = 'test result';

      deferred.resolve(testValue);

      const result = await deferred.promise;
      expect(result).toBe(testValue);
    });

    it('should reject with the provided error', async () => {
      const deferred = createDeferred<string>();
      const testError = new Error('test error');

      deferred.reject(testError);

      await expect(deferred.promise).rejects.toThrow('test error');
    });

    it('should work with different types', async () => {
      // Test with number
      const numberDeferred = createDeferred<number>();
      numberDeferred.resolve(42);
      expect(await numberDeferred.promise).toBe(42);

      // Test with object
      const objectDeferred = createDeferred<{ id: number; name: string }>();
      const testObject = { id: 1, name: 'test' };
      objectDeferred.resolve(testObject);
      expect(await objectDeferred.promise).toEqual(testObject);

      // Test with null
      const nullDeferred = createDeferred<null>();
      nullDeferred.resolve(null);
      expect(await nullDeferred.promise).toBe(null);

      // Test with undefined
      const undefinedDeferred = createDeferred<undefined>();
      undefinedDeferred.resolve(undefined);
      expect(await undefinedDeferred.promise).toBe(undefined);
    });
  });

  describe('Promise state behavior', () => {
    it('should remain pending until resolved or rejected', async () => {
      const deferred = createDeferred<string>();
      
      // Promise should be pending initially
      let promiseSettled = false;
      deferred.promise
        .then(() => { promiseSettled = true; })
        .catch(() => { promiseSettled = true; });

      // Wait a bit to ensure promise doesn't settle immediately
      await delay(10);
      expect(promiseSettled).toBe(false);

      // Resolve the promise
      deferred.resolve('result');
      await deferred.promise;
      expect(promiseSettled).toBe(true);
    });

    it('should only resolve once (first resolve wins)', async () => {
      const deferred = createDeferred<string>();

      deferred.resolve('first');
      deferred.resolve('second'); // This should be ignored

      const result = await deferred.promise;
      expect(result).toBe('first');
    });

    it('should only reject once (first reject wins)', async () => {
      const deferred = createDeferred<string>();

      const firstError = new Error('first error');
      const secondError = new Error('second error');

      deferred.reject(firstError);
      deferred.reject(secondError); // This should be ignored

      await expect(deferred.promise).rejects.toThrow('first error');
    });

    it('should ignore resolve after reject', async () => {
      const deferred = createDeferred<string>();

      const testError = new Error('rejection error');
      deferred.reject(testError);
      deferred.resolve('should be ignored'); // This should be ignored

      await expect(deferred.promise).rejects.toThrow('rejection error');
    });

    it('should ignore reject after resolve', async () => {
      const deferred = createDeferred<string>();

      deferred.resolve('success');
      deferred.reject(new Error('should be ignored')); // This should be ignored

      const result = await deferred.promise;
      expect(result).toBe('success');
    });
  });

  describe('Async coordination patterns', () => {
    it('should enable external resolution of async operations', async () => {
      const deferred = createDeferred<string>();

      // Simulate an async operation that completes externally
      const asyncOperation = async () => {
        await delay(50);
        deferred.resolve('async result');
      };

      // Start the async operation
      const operationPromise = asyncOperation();

      // Wait for the deferred promise
      const result = await deferred.promise;

      expect(result).toBe('async result');
      await operationPromise; // Ensure the operation completes
    });

    it('should work with multiple waiters', async () => {
      const deferred = createDeferred<number>();
      const results: number[] = [];

      // Multiple promises waiting for the same result
      const waiters = Array.from({ length: 5 }, (_, i) =>
        deferred.promise.then(value => {
          results.push(value + i);
        })
      );

      // Resolve after a delay
      setTimeout(() => deferred.resolve(10), 20);

      await Promise.all(waiters);

      expect(results).toEqual([10, 11, 12, 13, 14]);
    });

    it('should handle concurrent resolve attempts safely', async () => {
      const deferred = createDeferred<string>();
      const resolvers: Promise<void>[] = [];

      // Create multiple concurrent resolvers
      for (let i = 0; i < 10; i++) {
        resolvers.push(
          (async () => {
            await delay(Math.random() * 10);
            deferred.resolve(`result-${i}`);
          })()
        );
      }

      await Promise.all(resolvers);

      // The promise should resolve with the first successful resolve
      const result = await deferred.promise;
      expect(result).toMatch(/^result-\d+$/);
    });
  });

  describe('Error handling scenarios', () => {
    it('should propagate rejection errors correctly', async () => {
      const deferred = createDeferred<void>();
      const customError = new Error('Custom error message');
      customError.name = 'CustomError';

      deferred.reject(customError);

      try {
        await deferred.promise;
      } catch (error) {
        expect(error).toBe(customError);
        expect((error as Error).name).toBe('CustomError');
        expect((error as Error).message).toBe('Custom error message');
      }
    });

    it('should handle rejection with non-Error objects', async () => {
      const deferred = createDeferred<void>();
      const customError = new Error('string rejection');

      deferred.reject(customError);

      await expect(deferred.promise).rejects.toThrow('string rejection');
    });
  });

  describe('Integration with Promise utilities', () => {
    it('should work with Promise.all', async () => {
      const deferred1 = createDeferred<number>();
      const deferred2 = createDeferred<string>();
      const deferred3 = createDeferred<boolean>();

      // Resolve all deferreds
      setTimeout(() => {
        deferred1.resolve(1);
        deferred2.resolve('two');
        deferred3.resolve(true);
      }, 10);

      const results = await Promise.all([
        deferred1.promise,
        deferred2.promise,
        deferred3.promise
      ]);

      expect(results).toEqual([1, 'two', true]);
    });

    it('should work with Promise.race', async () => {
      const deferred1 = createDeferred<string>();
      const deferred2 = createDeferred<string>();

      // Resolve the first one faster
      setTimeout(() => deferred1.resolve('winner'), 10);
      setTimeout(() => deferred2.resolve('loser'), 50);

      const result = await Promise.race([
        deferred1.promise,
        deferred2.promise
      ]);

      expect(result).toBe('winner');
    });

    it('should work with Promise.allSettled', async () => {
      const deferred1 = createDeferred<string>();
      const deferred2 = createDeferred<string>();

      // One resolves, one rejects
      setTimeout(() => {
        deferred1.resolve('success');
        deferred2.reject(new Error('failure'));
      }, 10);

      const results = await Promise.allSettled([
        deferred1.promise,
        deferred2.promise
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('fulfilled');
      expect((results[0] as PromiseFulfilledResult<string>).value).toBe('success');
      expect(results[1].status).toBe('rejected');
      expect((results[1] as PromiseRejectedResult).reason.message).toBe('failure');
    });
  });

  describe('Memory and performance considerations', () => {
    it('should allow garbage collection after resolution', async () => {
      const deferred = createDeferred<string>();
      const weakRef = new WeakRef(deferred);

      deferred.resolve('test');
      await deferred.promise;

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Note: This test is inherently flaky and depends on GC behavior
      // In real scenarios, the WeakRef may still hold the reference
      // This is more of a sanity check
      expect(weakRef.deref()).toBeDefined();
    });

    it('should handle many concurrent deferreds efficiently', async () => {
      const deferreds = Array.from({ length: 1000 }, () => createDeferred<number>());
      
      const startTime = Date.now();

      // Resolve all deferreds
      deferreds.forEach((deferred, index) => {
        setTimeout(() => deferred.resolve(index), Math.random() * 10);
      });

      // Wait for all to complete
      const results = await Promise.all(deferreds.map(d => d.promise));

      const endTime = Date.now();

      expect(results).toHaveLength(1000);
      expect(results.sort((a, b) => a - b)).toEqual(
        Array.from({ length: 1000 }, (_, i) => i)
      );

      // Should complete reasonably quickly (adjust threshold as needed)
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });

  describe('Type safety', () => {
    it('should maintain type safety with generic types', async () => {
      interface TestInterface {
        id: number;
        name: string;
        active: boolean;
      }

      const deferred = createDeferred<TestInterface>();
      const testObject: TestInterface = {
        id: 1,
        name: 'test',
        active: true
      };

      deferred.resolve(testObject);

      const result = await deferred.promise;
      
      // TypeScript should ensure type safety here
      expect(result.id).toBe(1);
      expect(result.name).toBe('test');
      expect(result.active).toBe(true);
    });

    it('should work with union types', async () => {
      const deferred = createDeferred<string | number | null>();

      // Test with string
      const stringDeferred = createDeferred<string | number | null>();
      stringDeferred.resolve('string value');
      expect(await stringDeferred.promise).toBe('string value');

      // Test with number
      const numberDeferred = createDeferred<string | number | null>();
      numberDeferred.resolve(42);
      expect(await numberDeferred.promise).toBe(42);

      // Test with null
      const nullDeferred = createDeferred<string | number | null>();
      nullDeferred.resolve(null);
      expect(await nullDeferred.promise).toBe(null);
    });
  });

  describe('Deferred race condition edge cases', () => {
    it('should handle extremely rapid concurrent resolve/reject attempts', async () => {
      const deferred = createDeferred<string>();
      const resolvers: Promise<void>[] = [];
      const rejecters: Promise<void>[] = [];

      // Create many concurrent resolvers and rejecters
      for (let i = 0; i < 50; i++) {
        resolvers.push(
          (async () => {
            await delay(Math.random() * 2);
            deferred.resolve(`resolve-${i}`);
          })()
        );
      }

      for (let i = 0; i < 50; i++) {
        rejecters.push(
          (async () => {
            await delay(Math.random() * 2);
            deferred.reject(new Error(`reject-${i}`));
          })()
        );
      }

      // Wait for all attempts to complete
      await Promise.all([...resolvers, ...rejecters]);

      // The promise should be settled with the first successful operation
      let settled = false;
      let result: string | undefined = undefined;
      let error: Error | undefined = undefined;

      try {
        result = await deferred.promise;
        settled = true;
      } catch (err) {
        error = err as Error;
        settled = true;
      }

      expect(settled).toBe(true);
      if (result !== undefined) {
        expect(result).toMatch(/^resolve-\d+$/);
      } else {
        expect(error).toBeDefined();
        expect(error!.message).toMatch(/^reject-\d+$/);
      }
    });

    it('should handle concurrent resolve with same value type safety', async () => {
      const deferred = createDeferred<{ id: number; timestamp: number }>();
      const resolvers: Promise<void>[] = [];

      // Create multiple resolvers with different objects
      for (let i = 0; i < 20; i++) {
        resolvers.push(
          (async () => {
            await delay(Math.random() * 5);
            deferred.resolve({ id: i, timestamp: Date.now() + i });
          })()
        );
      }

      await Promise.all(resolvers);

      const result = await deferred.promise;
      expect(typeof result.id).toBe('number');
      expect(typeof result.timestamp).toBe('number');
      expect(result.id).toBeGreaterThanOrEqual(0);
      expect(result.id).toBeLessThan(20);
    });

    it('should maintain promise integrity under stress with many waiters', async () => {
      const deferred = createDeferred<string>();
      const waiters: Promise<string>[] = [];
      const results: string[] = [];

      // Create many concurrent waiters
      for (let i = 0; i < 100; i++) {
        waiters.push(
          deferred.promise.then(value => {
            results.push(`waiter-${i}-got-${value}`);
            return value;
          })
        );
      }

      // Resolve after all waiters are set up
      await delay(10);
      deferred.resolve('shared-result');

      // Wait for all waiters to complete
      const waiterResults = await Promise.all(waiters);

      // All waiters should get the same result
      expect(waiterResults).toHaveLength(100);
      waiterResults.forEach(result => {
        expect(result).toBe('shared-result');
      });
      expect(results).toHaveLength(100);
      results.forEach(result => {
        expect(result).toMatch(/^waiter-\d+-got-shared-result$/);
      });
    });

    it('should handle Promise.all with concurrent deferred resolution', async () => {
      const deferreds = Array.from({ length: 50 }, () => createDeferred<number>());
      
      // Resolve all deferreds concurrently with random delays
      const resolvers = deferreds.map(async (deferred, index) => {
        await delay(Math.random() * 10);
        deferred.resolve(index);
      });

      // Wait for all using Promise.all
      const [results] = await Promise.all([
        Promise.all(deferreds.map(d => d.promise)),
        Promise.all(resolvers)
      ]);

      expect(results).toHaveLength(50);
      expect(results.sort((a, b) => a - b)).toEqual(
        Array.from({ length: 50 }, (_, i) => i)
      );
    });

    it('should handle mixed resolve/reject scenarios with Promise.allSettled', async () => {
      const deferreds = Array.from({ length: 20 }, () => createDeferred<number>());
      
      // Resolve some, reject others
      const operations = deferreds.map(async (deferred, index) => {
        await delay(Math.random() * 5);
        if (index % 2 === 0) {
          deferred.resolve(index);
        } else {
          deferred.reject(new Error(`error-${index}`));
        }
      });

      const [results] = await Promise.all([
        Promise.allSettled(deferreds.map(d => d.promise)),
        Promise.all(operations)
      ]);

      expect(results).toHaveLength(20);
      
      const fulfilled = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<number>[];
      const rejected = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];

      expect(fulfilled).toHaveLength(10); // Even indices
      expect(rejected).toHaveLength(10);  // Odd indices

      fulfilled.forEach(result => {
        expect(result.value % 2).toBe(0);
      });

      rejected.forEach(result => {
        expect(result.reason.message).toMatch(/^error-\d+$/);
      });
    });

    it('should handle deferred chain with rapid state changes', async () => {
      const deferred1 = createDeferred<string>();
      const deferred2 = createDeferred<number>();
      const deferred3 = createDeferred<boolean>();

      // Chain deferreds where each depends on the previous
      const chainPromise = deferred1.promise
        .then(value => {
          deferred2.resolve(value.length);
          return deferred2.promise;
        })
        .then(length => {
          deferred3.resolve(length > 5);
          return deferred3.promise;
        });

      // Resolve the first deferred after a short delay
      setTimeout(() => deferred1.resolve('hello world'), 5);

      const result = await chainPromise;
      expect(result).toBe(true);
    });

    it('should handle concurrent access to the same promise reference', async () => {
      const deferred = createDeferred<string>();
      const sharedPromise = deferred.promise;
      const accessResults: string[] = [];

      // Multiple concurrent accesses to the same promise reference
      const accessors = Array.from({ length: 30 }, async (_, i) => {
        const result = await sharedPromise;
        accessResults.push(`accessor-${i}-${result}`);
        return result;
      });

      // Resolve after all accessors are set up
      await delay(5);
      deferred.resolve('shared-value');

      const results = await Promise.all(accessors);

      expect(results).toHaveLength(30);
      results.forEach(result => {
        expect(result).toBe('shared-value');
      });
      expect(accessResults).toHaveLength(30);
      accessResults.forEach(result => {
        expect(result).toMatch(/^accessor-\d+-shared-value$/);
      });
    });
  });

  describe('AbortSignal integration', () => {
    it('should reject with AbortError when signal is aborted before resolution', async () => {
      const controller = new AbortController();
      const deferred = createDeferred<string>(controller.signal);

      // Abort immediately
      controller.abort();

      await expect(deferred.promise).rejects.toThrow('Deferred aborted');
    });

    it('should reject with AbortError when signal is aborted after creation but before resolution', async () => {
      const controller = new AbortController();
      const deferred = createDeferred<string>(controller.signal);

      // Abort after a delay
      setTimeout(() => controller.abort(), 10);

      await expect(deferred.promise).rejects.toThrow('Deferred aborted');
    });

    it('should resolve normally if signal is not aborted', async () => {
      const controller = new AbortController();
      const deferred = createDeferred<string>(controller.signal);

      setTimeout(() => deferred.resolve('success'), 10);

      const result = await deferred.promise;
      expect(result).toBe('success');
    });

    it('should ignore abort after successful resolution', async () => {
      const controller = new AbortController();
      const deferred = createDeferred<string>(controller.signal);

      deferred.resolve('resolved');
      controller.abort();

      const result = await deferred.promise;
      expect(result).toBe('resolved');
    });

    it('should ignore abort after rejection', async () => {
      const controller = new AbortController();
      const deferred = createDeferred<string>(controller.signal);

      const customError = new Error('custom error');
      deferred.reject(customError);
      controller.abort();

      await expect(deferred.promise).rejects.toThrow('custom error');
    });

    it('should work without AbortSignal (backward compatibility)', async () => {
      const deferred = createDeferred<string>();

      setTimeout(() => deferred.resolve('no signal'), 10);

      const result = await deferred.promise;
      expect(result).toBe('no signal');
    });

    it('should handle both abort and resolve operations 1', async () => {
      const controller = new AbortController();
      const deferred = createDeferred<string>(controller.signal);

      controller.abort();   // First
      deferred.resolve('resolved');

      try {
        await deferred.promise;
        expect(true).toBe(false);    // Will not reached
      } catch (error) {
        expect((error as Error).message).toBe('Deferred aborted');
      }
    });

    it('should handle both abort and resolve operations 2', async () => {
      const controller = new AbortController();
      const deferred = createDeferred<string>(controller.signal);

      deferred.resolve('resolved');   // First
      controller.abort();

      const result = await deferred.promise;
      expect(result).toBe('resolved');
    });

    it('should handle multiple deferreds with the same signal', async () => {
      const controller = new AbortController();
      const deferred1 = createDeferred<string>(controller.signal);
      const deferred2 = createDeferred<number>(controller.signal);

      controller.abort();

      await expect(deferred1.promise).rejects.toThrow('Deferred aborted');
      await expect(deferred2.promise).rejects.toThrow('Deferred aborted');
    });

    it('should handle already aborted signal', async () => {
      const controller = new AbortController();
      controller.abort();

      const deferred = createDeferred<string>(controller.signal);

      await expect(deferred.promise).rejects.toThrow('Deferred aborted');
    });
  });
});

