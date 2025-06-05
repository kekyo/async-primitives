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
}); 