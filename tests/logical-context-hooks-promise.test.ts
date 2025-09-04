/**
 * Tests for logical context hooks: Promise-related hooks
 * These tests verify that the logical context is properly maintained across
 * Promise boundaries (then, catch, finally) after prepare() is called.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  setLogicalContextValue,
  getLogicalContextValue,
  switchToNewLogicalContext,
  runOnNewLogicalContext,
} from '../src/primitives/logical-context';

describe('Logical Context Promise Hooks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Promise.then() hook', () => {
    it('should handle resolved promises and return to original context', async () => {
      const key = Symbol('test');
      const value = 'promise test value';

      setLogicalContextValue(key, value);

      let called = false;
      const p0 = Promise.resolve();
      p0.then(() => {
        // Should continue with original context (ConfigureAwait(true) behavior)
        expect(getLogicalContextValue(key)).toBe(value);
        called = true;
      });

      vi.advanceTimersByTime(10);
      await p0;

      expect(called).toBe(true);
      expect(getLogicalContextValue(key)).toBe(value);
    });

    it('should handle series of promises and maintain original context', async () => {
      const key = Symbol('test');
      const value = 'promise test value';

      setLogicalContextValue(key, value);

      let called = false;
      const p0 = Promise.resolve();
      const p1 = p0.then(() => {
        // Continue with original context (ConfigureAwait(true) behavior)
        expect(getLogicalContextValue(key)).toBe(value);
      });
      const p2 = p1.then(() => {
        // Continue with original context (ConfigureAwait(true) behavior)
        expect(getLogicalContextValue(key)).toBe(value);
      });
      const p3 = p2.then(() => {
        // Continue with original context (ConfigureAwait(true) behavior)
        expect(getLogicalContextValue(key)).toBe(value);
        called = true;
      });

      vi.advanceTimersByTime(10);
      await p3;

      expect(called).toBe(true);
      expect(getLogicalContextValue(key)).toBe(value);
    });

    it('should handle promise with context switch and return to original', async () => {
      const key = Symbol('test');

      setLogicalContextValue(key, 'value1');

      let called = false;
      const p0 = Promise.resolve();
      const p1 = p0.then(() => {
        // Continue with original context
        expect(getLogicalContextValue(key)).toBe('value1');
        // Change context (equivalent to LogicalContext.SetLogicalContext)
        switchToNewLogicalContext('ctx1');
        setLogicalContextValue(key, 'value2');
        called = true;
      });

      vi.advanceTimersByTime(10);
      await p1;

      expect(called).toBe(true);
      // Original context should be restored after promise completion
      expect(getLogicalContextValue(key)).toBe('value1');
    });

    it('should handle series of promises with context switching', async () => {
      const key = Symbol('test');

      setLogicalContextValue(key, 'value1');

      let step1Called = false;
      let step2Called = false;
      let step3Called = false;

      const p0 = Promise.resolve();
      const p1 = p0.then(() => {
        // Continue with original context
        expect(getLogicalContextValue(key)).toBe('value1');
        // Change context in promise 1
        switchToNewLogicalContext('ctx1');
        setLogicalContextValue(key, 'value2');
        step1Called = true;
      });
      const p2 = p1.then(() => {
        // Should continue with original context (not ctx1)
        expect(getLogicalContextValue(key)).toBe('value1');
        // Change context in promise 2
        switchToNewLogicalContext('ctx2');
        setLogicalContextValue(key, 'value3');
        step2Called = true;
      });
      const p3 = p2.then(() => {
        // Should continue with original context (not ctx2)
        expect(getLogicalContextValue(key)).toBe('value1');
        step3Called = true;
      });

      vi.advanceTimersByTime(10);
      await p3;

      expect(step1Called).toBe(true);
      expect(step2Called).toBe(true);
      expect(step3Called).toBe(true);
      // Original context should be maintained
      expect(getLogicalContextValue(key)).toBe('value1');
    });
  });

  describe('Promise.catch() hook', () => {
    it('should handle rejected promises and return to original context', async () => {
      const key = Symbol('test');
      const value = 'promise test value';

      setLogicalContextValue(key, value);

      let called = false;
      const p0 = Promise.reject();
      p0.catch(() => {
        // Should continue with original context (ConfigureAwait(true) behavior)
        expect(getLogicalContextValue(key)).toBe(value);
        called = true;
      });

      vi.advanceTimersByTime(10);

      try {
        await p0;
        expect.fail('Promise should have been rejected');
      } catch {}

      expect(called).toBe(true);
      expect(getLogicalContextValue(key)).toBe(value);
    });

    it('should handle nested error handling with original context maintained', async () => {
      const key = Symbol('test');

      setLogicalContextValue(key, 'error-root-value');

      let catchCalled = false;
      let nestedCatchCalled = false;

      try {
        await Promise.reject('error1')
          .catch((error) => {
            // Continue with original context
            expect(getLogicalContextValue(key)).toBe('error-root-value');
            expect(error).toBe('error1');
            // Switch context in first catch
            switchToNewLogicalContext('error-ctx1');
            setLogicalContextValue(key, 'first-catch-value');
            catchCalled = true;
            return Promise.reject('error2');
          })
          .catch((error) => {
            // Continue with original context
            expect(getLogicalContextValue(key)).toBe('error-root-value');
            expect(error).toBe('error2');
            // Switch context in second catch
            switchToNewLogicalContext('error-ctx2');
            setLogicalContextValue(key, 'second-catch-value');
            nestedCatchCalled = true;
            return 'recovered';
          });
      } catch (error) {
        expect.fail('Should not reach this catch block');
      }

      // After promise chain, should maintain original context
      expect(getLogicalContextValue(key)).toBe('error-root-value');
      expect(catchCalled).toBe(true);
      expect(nestedCatchCalled).toBe(true);
    });

    it('should handle catch followed by then continuation with original context maintained', async () => {
      const key = Symbol('test');

      setLogicalContextValue(key, 'catch-then-root-value');

      let catchCalled = false;
      let thenAfterCatchCalled = false;

      const result = await Promise.reject('initial error')
        .catch((error) => {
          // Continue with original context
          expect(getLogicalContextValue(key)).toBe('catch-then-root-value');
          expect(error).toBe('initial error');
          // Switch context in catch
          switchToNewLogicalContext('catch-ctx');
          setLogicalContextValue(key, 'catch-context-value');
          catchCalled = true;
          return 'recovered value';
        })
        .then((data) => {
          // Continue with original context
          expect(getLogicalContextValue(key)).toBe('catch-then-root-value');
          expect(data).toBe('recovered value');
          // Switch context in then
          switchToNewLogicalContext('then-ctx');
          setLogicalContextValue(key, 'then-context-value');
          thenAfterCatchCalled = true;
          return 'final result';
        });

      // After promise chain, should maintain original context
      expect(getLogicalContextValue(key)).toBe('catch-then-root-value');
      expect(catchCalled).toBe(true);
      expect(thenAfterCatchCalled).toBe(true);
      expect(result).toBe('final result');
    });
  });

  describe('Promise.finally() hook', () => {
    it('should handle promise finally block with original context maintained', async () => {
      const key = Symbol('test');

      setLogicalContextValue(key, 'finally-root-value');

      let finallyCalled = false;

      // Test with resolved promise
      const result1 = await Promise.resolve('success')
        .then((value) => {
          // Continue with original context
          expect(getLogicalContextValue(key)).toBe('finally-root-value');
          // Switch context in then
          switchToNewLogicalContext('finally-then-ctx');
          setLogicalContextValue(key, 'then-context-value');
          return value;
        })
        .finally(() => {
          // Continue with original context in finally
          expect(getLogicalContextValue(key)).toBe('finally-root-value');
          // Switch context in finally
          switchToNewLogicalContext('finally-ctx');
          setLogicalContextValue(key, 'finally-context-value');
          finallyCalled = true;
        });

      // After promise chain, should maintain original context
      expect(getLogicalContextValue(key)).toBe('finally-root-value');
      expect(finallyCalled).toBe(true);
      expect(result1).toBe('success');

      // Reset flag
      finallyCalled = false;

      // Test with rejected promise
      try {
        await Promise.reject('error')
          .catch((error) => {
            // Continue with original context
            expect(getLogicalContextValue(key)).toBe('finally-root-value');
            // Switch context in catch
            switchToNewLogicalContext('finally-catch-ctx');
            setLogicalContextValue(key, 'catch-context-value');
            throw error; // Re-throw to test finally with error
          })
          .finally(() => {
            // Continue with original context in finally
            expect(getLogicalContextValue(key)).toBe('finally-root-value');
            finallyCalled = true;
          });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBe('error');
      }

      // After promise chain, should maintain original context
      expect(getLogicalContextValue(key)).toBe('finally-root-value');
      expect(finallyCalled).toBe(true);
    });
  });

  describe('Promise utility methods', () => {
    it('should handle Promise.all with original context maintained', async () => {
      const key = Symbol('test');

      setLogicalContextValue(key, 'root-value');

      let promise1Called = false;
      let promise2Called = false;

      const p1 = Promise.resolve('result1').then((result) => {
        // Continue with original context
        expect(getLogicalContextValue(key)).toBe('root-value');
        // Switch context in promise 1
        switchToNewLogicalContext('ctx-p1');
        setLogicalContextValue(key, 'p1-value');
        promise1Called = true;
        return result;
      });

      const p2 = Promise.resolve('result2').then((result) => {
        // Continue with original context (independent from p1)
        expect(getLogicalContextValue(key)).toBe('root-value');
        // Switch context in promise 2
        switchToNewLogicalContext('ctx-p2');
        setLogicalContextValue(key, 'p2-value');
        promise2Called = true;
        return result;
      });

      const allResult = await Promise.all([p1, p2]);

      // After Promise.all, should maintain original context
      expect(getLogicalContextValue(key)).toBe('root-value');
      expect(promise1Called).toBe(true);
      expect(promise2Called).toBe(true);
      expect(allResult).toEqual(['result1', 'result2']);
    });

    it('should handle Promise.race with original context maintained', async () => {
      const key = Symbol('test');

      setLogicalContextValue(key, 'race-root-value');

      const p1 = new Promise((resolve) =>
        setTimeout(() => resolve('result1'), 10)
      )
        .then((result) => {
          // Continue with original context
          expect(getLogicalContextValue(key)).toBe('race-root-value');
          // Switch context in winner promise
          switchToNewLogicalContext('race-ctx1');
          setLogicalContextValue(key, 'race-winner-value');
          return result;
        })
        .then((result) => {
          // Continue with original context
          expect(getLogicalContextValue(key)).toBe('race-root-value');
          return result;
        });

      const p2 = new Promise((resolve) =>
        setTimeout(() => resolve('result2'), 20)
      )
        .then((result) => {
          // Continue with original context
          expect(getLogicalContextValue(key)).toBe('race-root-value');
          // This should not be reached since p1 wins
          switchToNewLogicalContext('race-ctx2');
          setLogicalContextValue(key, 'race-loser-value');
          return result;
        })
        .then((result) => {
          // Continue with original context
          expect(getLogicalContextValue(key)).toBe('race-root-value');
          return result;
        });

      const racePromise = Promise.race([p1, p2]).then((result) => {
        // Continue with original context
        expect(getLogicalContextValue(key)).toBe('race-root-value');
        return result;
      });

      // Advance fake timers to trigger the promises
      vi.advanceTimersByTime(15);

      const raceResult = await racePromise;

      // After race completion, should maintain original context
      expect(getLogicalContextValue(key)).toBe('race-root-value');
      expect(raceResult).toBe('result1');
    });

    it('should handle parallel Promise.all with independent contexts', async () => {
      const key = Symbol('parallel-test');

      setLogicalContextValue(key, 'main-value');

      const promises = Array.from({ length: 5 }, (_, i) =>
        Promise.resolve(i).then((index) => {
          // Each promise should start with the original context
          expect(getLogicalContextValue(key)).toBe('main-value');

          // Switch to a unique context in each promise
          switchToNewLogicalContext(`parallel-${index}`);
          setLogicalContextValue(key, `parallel-value-${index}`);

          return index;
        })
      );

      const results = await Promise.all(promises);

      // After Promise.all, should maintain original context
      expect(getLogicalContextValue(key)).toBe('main-value');
      expect(results).toEqual([0, 1, 2, 3, 4]);
    });

    it('should handle Promise.race with context switching in losers', async () => {
      const key = Symbol('race-losers-test');

      setLogicalContextValue(key, 'race-root-value');

      let winnerCalled = false;
      let loser1Called = false;
      let loser2Called = false;

      // Winner promise (fastest)
      const winner = new Promise((resolve) =>
        setTimeout(() => resolve('winner'), 5)
      ).then((result) => {
        expect(getLogicalContextValue(key)).toBe('race-root-value');
        switchToNewLogicalContext('winner-ctx');
        setLogicalContextValue(key, 'winner-value');
        winnerCalled = true;
        return result;
      });

      // Loser promises (slower)
      const loser1 = new Promise((resolve) =>
        setTimeout(() => resolve('loser1'), 10)
      ).then((result) => {
        expect(getLogicalContextValue(key)).toBe('race-root-value');
        switchToNewLogicalContext('loser1-ctx');
        setLogicalContextValue(key, 'loser1-value');
        loser1Called = true;
        return result;
      });

      const loser2 = new Promise((resolve) =>
        setTimeout(() => resolve('loser2'), 15)
      ).then((result) => {
        expect(getLogicalContextValue(key)).toBe('race-root-value');
        switchToNewLogicalContext('loser2-ctx');
        setLogicalContextValue(key, 'loser2-value');
        loser2Called = true;
        return result;
      });

      vi.advanceTimersByTime(7);
      const raceResult = await Promise.race([winner, loser1, loser2]);

      expect(raceResult).toBe('winner');
      expect(winnerCalled).toBe(true);
      expect(getLogicalContextValue(key)).toBe('race-root-value');

      // Let the losers finish
      vi.advanceTimersByTime(20);
      await Promise.all([loser1, loser2]);

      expect(loser1Called).toBe(true);
      expect(loser2Called).toBe(true);
      expect(getLogicalContextValue(key)).toBe('race-root-value');
    });
  });

  describe('Complex Promise scenarios', () => {
    it('should handle async/await functions with original context maintained', async () => {
      const key = Symbol('test');

      setLogicalContextValue(key, 'async-root-value');

      const asyncFunction = async () => {
        // Start with original context
        expect(getLogicalContextValue(key)).toBe('async-root-value');

        await Promise.resolve();
        // After await, should continue with original context (ConfigureAwait(true) behavior)
        expect(getLogicalContextValue(key)).toBe('async-root-value');

        // Switch context in async function
        switchToNewLogicalContext('async-ctx1');
        setLogicalContextValue(key, 'async-switched-value');

        const delayedPromise = new Promise((resolve) =>
          setTimeout(() => resolve('delayed'), 10)
        );
        vi.advanceTimersByTime(15);
        await delayedPromise;

        // After second await, the switched context persists within the async function execution
        // This is because the context switch affects the current execution context globally
        expect(getLogicalContextValue(key)).toBe('async-switched-value');

        return 'async result';
      };

      const result = asyncFunction().then((value) => {
        // Continuation should have original context (promise continuation restores context)
        expect(getLogicalContextValue(key)).toBe('async-root-value');
        return value;
      });

      const finalResult = await result;

      // The global context has been changed by switchToNewLogicalContext within the async function
      // This is the expected behavior in JavaScript (unlike .NET which auto-restores context)
      expect(getLogicalContextValue(key)).toBe('async-switched-value');
      expect(finalResult).toBe('async result');
    });

    it('should handle deeply nested promise continuations with original context maintained', async () => {
      const key = Symbol('test');

      setLogicalContextValue(key, 'nested-root-value');

      let level1Called = false;
      let level2Called = false;
      let level3Called = false;
      let level4Called = false;

      const result = await Promise.resolve('start')
        .then((data) => {
          // Continue with original context
          expect(getLogicalContextValue(key)).toBe('nested-root-value');
          expect(data).toBe('start');
          // Switch to level1 context
          switchToNewLogicalContext('nested-level1');
          setLogicalContextValue(key, 'level1-value');
          level1Called = true;
          return Promise.resolve('level1');
        })
        .then((data) => {
          // Continue with original context
          expect(getLogicalContextValue(key)).toBe('nested-root-value');
          expect(data).toBe('level1');
          level2Called = true;
          return Promise.resolve('level2').then((nestedData) => {
            // Nested promise continues with original context
            expect(getLogicalContextValue(key)).toBe('nested-root-value');
            expect(nestedData).toBe('level2');
            // Switch to level3 context in nested promise
            switchToNewLogicalContext('nested-level3');
            setLogicalContextValue(key, 'level3-value');
            level3Called = true;
            return Promise.resolve('level3');
          });
        })
        .then((data) => {
          // Continue with original context
          expect(getLogicalContextValue(key)).toBe('nested-root-value');
          expect(data).toBe('level3');
          level4Called = true;
          return 'final';
        });

      // After promise chain, should maintain original context
      expect(getLogicalContextValue(key)).toBe('nested-root-value');
      expect(level1Called).toBe(true);
      expect(level2Called).toBe(true);
      expect(level3Called).toBe(true);
      expect(level4Called).toBe(true);
      expect(result).toBe('final');
    });

    it('should handle deeply nested promise chains with mixed sync/async operations', async () => {
      const key = Symbol('deep-nested-test');

      setLogicalContextValue(key, 'deep-root-value');

      let callCount = 0;

      const result = await Promise.resolve(0)
        .then((n) => {
          expect(getLogicalContextValue(key)).toBe('deep-root-value');
          callCount++;
          return Promise.resolve(n + 1);
        })
        .then((n) => {
          expect(getLogicalContextValue(key)).toBe('deep-root-value');
          callCount++;
          switchToNewLogicalContext('deep-level1');
          setLogicalContextValue(key, 'level1-value');
          return Promise.resolve(n + 1).then((n2) => {
            expect(getLogicalContextValue(key)).toBe('level1-value');
            callCount++;
            return Promise.resolve(n2 + 1).then((n3) => {
              expect(getLogicalContextValue(key)).toBe('level1-value');
              callCount++;
              return n3 + 1;
            });
          });
        })
        .then((n) => {
          expect(getLogicalContextValue(key)).toBe('deep-root-value');
          callCount++;
          return n + 1;
        });

      expect(result).toBe(5);
      expect(callCount).toBe(5);
      expect(getLogicalContextValue(key)).toBe('deep-root-value');
    });

    it('should handle exception in promise chain with context restoration', async () => {
      const key = Symbol('exception-test');

      setLogicalContextValue(key, 'exception-root-value');

      let catchCalled = false;
      let finallyCalled = false;

      try {
        await Promise.resolve('start')
          .then((value) => {
            expect(getLogicalContextValue(key)).toBe('exception-root-value');
            switchToNewLogicalContext('exception-then');
            setLogicalContextValue(key, 'then-value');
            throw new Error('test error');
          })
          .catch((error) => {
            // Should continue with original context
            expect(getLogicalContextValue(key)).toBe('exception-root-value');
            expect(error.message).toBe('test error');
            switchToNewLogicalContext('exception-catch');
            setLogicalContextValue(key, 'catch-value');
            catchCalled = true;
            return 'recovered';
          })
          .finally(() => {
            // Should continue with original context
            expect(getLogicalContextValue(key)).toBe('exception-root-value');
            finallyCalled = true;
          });
      } catch {
        expect.fail('Should not reach this catch');
      }

      expect(getLogicalContextValue(key)).toBe('exception-root-value');
      expect(catchCalled).toBe(true);
      expect(finallyCalled).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle promise with null/undefined handlers', async () => {
      const key = Symbol('null-handler-test');

      setLogicalContextValue(key, 'null-handler-value');

      // Test with null handlers
      const result1 = await Promise.resolve('test-value')
        .then(null, null)
        .catch(null)
        .finally(null);

      expect(result1).toBe('test-value');
      expect(getLogicalContextValue(key)).toBe('null-handler-value');

      // Test with undefined handlers
      const result2 = await Promise.reject('test-error')
        .then(undefined, (err) => {
          expect(getLogicalContextValue(key)).toBe('null-handler-value');
          return 'recovered';
        })
        .catch(undefined)
        .finally(undefined);

      expect(result2).toBe('recovered');
      expect(getLogicalContextValue(key)).toBe('null-handler-value');
    });

    it('should handle already resolved/rejected promises', async () => {
      const key = Symbol('resolved-test');

      setLogicalContextValue(key, 'resolved-value');

      // Create already resolved promise
      const resolvedPromise = Promise.resolve('already-resolved');

      let thenCalled = false;
      const result1 = await resolvedPromise.then((value) => {
        expect(getLogicalContextValue(key)).toBe('resolved-value');
        thenCalled = true;
        return value;
      });

      expect(result1).toBe('already-resolved');
      expect(thenCalled).toBe(true);

      // Create already rejected promise
      const rejectedPromise = Promise.reject('already-rejected');

      let catchCalled = false;
      const result2 = await rejectedPromise.catch((error) => {
        expect(getLogicalContextValue(key)).toBe('resolved-value');
        expect(error).toBe('already-rejected');
        catchCalled = true;
        return 'handled';
      });

      expect(result2).toBe('handled');
      expect(catchCalled).toBe(true);
    });

    it('should handle runOnNewLogicalContext with promise created inside and executed outside', async () => {
      const key = Symbol('inside-outside-test');

      setLogicalContextValue(key, 'outside-value');

      let promiseCreatedInside: Promise<string>;
      let insideCalled = false;

      runOnNewLogicalContext('inside', () => {
        setLogicalContextValue(key, 'inside-value');
        insideCalled = true;

        // Create promise inside the new context
        promiseCreatedInside = Promise.resolve('created-inside').then(
          (value) => {
            // When this promise executes, it should use the context captured when the promise was created (inside context)
            expect(getLogicalContextValue(key)).toBe('inside-value');
            return value;
          }
        );
      });

      // Now execute the promise outside the context
      expect(getLogicalContextValue(key)).toBe('outside-value');
      const result = await promiseCreatedInside!;

      expect(result).toBe('created-inside');
      expect(getLogicalContextValue(key)).toBe('outside-value');
      expect(insideCalled).toBe(true);
    });

    it('should handle promise creation in different contexts with delayed execution', async () => {
      const key = Symbol('delayed-execution-test');

      setLogicalContextValue(key, 'main-context-value');

      const promises: Promise<string>[] = [];

      // Create promises in different contexts
      for (let i = 0; i < 3; i++) {
        runOnNewLogicalContext(`context-${i}`, () => {
          setLogicalContextValue(key, `context-${i}-value`);

          // Create promise that will be executed later
          const promise = Promise.resolve(`promise-${i}`).then((value) => {
            // Should execute with the context captured when promise was created (context-i context)
            expect(getLogicalContextValue(key)).toBe(`context-${i}-value`);
            return value;
          });

          promises.push(promise);
        });
      }

      // All promises should execute with main context
      const results = await Promise.all(promises);

      expect(results).toEqual(['promise-0', 'promise-1', 'promise-2']);
      expect(getLogicalContextValue(key)).toBe('main-context-value');
    });
  });
});
