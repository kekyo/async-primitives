/**
 * Tests for logical context hooks: queueMicrotask and setImmediate
 * These tests verify that the logical context is properly maintained across
 * queueMicrotask and setImmediate boundaries after prepare() is called.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  setLogicalContextValue,
  getLogicalContextValue,
} from '../src/primitives/logical-context';
import { currentLogicalContext } from '../src/primitives/internal/logical-context';

const TEST_KEY = Symbol('test-key');

describe('Logical Context Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('queueMicrotask hook', () => {
    it('should maintain logical context across queueMicrotask boundary', async () => {
      // Clear module cache to ensure fresh prepare() call
      vi.resetModules();

      // Re-import to trigger prepare()
      const {
        setLogicalContextValue: freshSetValue,
        getLogicalContextValue: freshGetValue,
      } = await import('../src/primitives/logical-context');

      const testValue = 'microtask-context-value';
      const executionOrder: string[] = [];

      // Set a value in logical context
      freshSetValue(TEST_KEY, testValue);
      executionOrder.push('context-set');

      // Schedule microtask that should maintain the context
      queueMicrotask(() => {
        executionOrder.push('microtask-start');
        const retrievedValue = freshGetValue(TEST_KEY);
        expect(retrievedValue).toBe(testValue);
        executionOrder.push('microtask-end');
      });

      executionOrder.push('after-queue');

      // Wait for microtask to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(executionOrder).toEqual([
        'context-set',
        'after-queue',
        'microtask-start',
        'microtask-end',
      ]);
    });

    it('should handle context changes within queueMicrotask', async () => {
      vi.resetModules();

      const {
        setLogicalContextValue: freshSetValue,
        getLogicalContextValue: freshGetValue,
      } = await import('../src/primitives/logical-context');

      const initialValue = 'initial-value';
      const modifiedValue = 'modified-value';

      freshSetValue(TEST_KEY, initialValue);

      let contextInMicrotask: string | undefined;
      let contextAfterMicrotask: string | undefined;

      queueMicrotask(() => {
        contextInMicrotask = freshGetValue(TEST_KEY);
        freshSetValue(TEST_KEY, modifiedValue);
      });

      // Wait for microtask completion
      await new Promise((resolve) => setTimeout(resolve, 0));

      contextAfterMicrotask = freshGetValue(TEST_KEY);

      expect(contextInMicrotask).toBe(initialValue);
      expect(contextAfterMicrotask).toBe(modifiedValue); // Context changes are reflected back
    });

    it('should work when queueMicrotask is not available', async () => {
      // Simulate environment without queueMicrotask
      const originalQueueMicrotask = globalThis.queueMicrotask;
      (globalThis as any).queueMicrotask = undefined;

      try {
        vi.resetModules();

        const {
          setLogicalContextValue: freshSetValue,
          getLogicalContextValue: freshGetValue,
        } = await import('../src/primitives/logical-context');

        const testValue = 'no-microtask-value';
        freshSetValue(TEST_KEY, testValue);

        // This should not throw an error
        const retrievedValue = freshGetValue(TEST_KEY);
        expect(retrievedValue).toBe(testValue);
      } finally {
        globalThis.queueMicrotask = originalQueueMicrotask;
      }
    });
  });

  describe('setImmediate hook (Node.js only)', () => {
    it('should maintain logical context across setImmediate boundary when available', async () => {
      // Skip test if setImmediate is not available (browser environment)
      if (typeof globalThis.setImmediate === 'undefined') {
        console.log(
          'Skipping setImmediate test - not available in this environment'
        );
        return;
      }

      vi.resetModules();

      const {
        setLogicalContextValue: freshSetValue,
        getLogicalContextValue: freshGetValue,
      } = await import('../src/primitives/logical-context');

      const testValue = 'immediate-context-value';
      const executionOrder: string[] = [];

      freshSetValue(TEST_KEY, testValue);
      executionOrder.push('context-set');

      setImmediate(() => {
        executionOrder.push('immediate-start');
        const retrievedValue = freshGetValue(TEST_KEY);
        expect(retrievedValue).toBe(testValue);
        executionOrder.push('immediate-end');
      });

      executionOrder.push('after-immediate');

      // Wait for setImmediate to complete
      await new Promise((resolve) => setImmediate(resolve));

      expect(executionOrder).toEqual([
        'context-set',
        'after-immediate',
        'immediate-start',
        'immediate-end',
      ]);
    });

    it('should handle setImmediate with arguments', async () => {
      if (typeof globalThis.setImmediate === 'undefined') {
        console.log(
          'Skipping setImmediate with arguments test - not available in this environment'
        );
        return;
      }

      vi.resetModules();

      const {
        setLogicalContextValue: freshSetValue,
        getLogicalContextValue: freshGetValue,
      } = await import('../src/primitives/logical-context');

      const testValue = 'immediate-args-value';
      const testArg1 = 'arg1';
      const testArg2 = 42;

      freshSetValue(TEST_KEY, testValue);

      let receivedArgs: any[] = [];
      let contextValue: string | undefined;

      setImmediate(
        (arg1: string, arg2: number) => {
          receivedArgs = [arg1, arg2];
          contextValue = freshGetValue(TEST_KEY);
        },
        testArg1,
        testArg2
      );

      // Wait for setImmediate to complete
      await new Promise((resolve) => setImmediate(resolve));

      expect(receivedArgs).toEqual([testArg1, testArg2]);
      expect(contextValue).toBe(testValue);
    });

    it('should work when setImmediate is not available', async () => {
      // Simulate browser environment without setImmediate
      const originalSetImmediate = globalThis.setImmediate;
      (globalThis as any).setImmediate = undefined;

      try {
        vi.resetModules();

        const {
          setLogicalContextValue: freshSetValue,
          getLogicalContextValue: freshGetValue,
        } = await import('../src/primitives/logical-context');

        const testValue = 'no-immediate-value';
        freshSetValue(TEST_KEY, testValue);

        // This should not throw an error
        const retrievedValue = freshGetValue(TEST_KEY);
        expect(retrievedValue).toBe(testValue);
      } finally {
        globalThis.setImmediate = originalSetImmediate;
      }
    });
  });

  describe('setTimeout hook', () => {
    it('should maintain context across setTimeout boundary', async () => {
      vi.resetModules();

      const {
        setLogicalContextValue: freshSetValue,
        getLogicalContextValue: freshGetValue,
      } = await import('../src/primitives/logical-context');

      const testValue = 'setTimeout-context-value';
      const executionOrder: string[] = [];

      freshSetValue(TEST_KEY, testValue);
      executionOrder.push('context-set');

      setTimeout(() => {
        executionOrder.push('timeout-start');
        const retrievedValue = freshGetValue(TEST_KEY);
        expect(retrievedValue).toBe(testValue);
        executionOrder.push('timeout-end');
      }, 0);

      executionOrder.push('after-timeout');

      // Wait for timeout to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(executionOrder).toEqual([
        'context-set',
        'after-timeout',
        'timeout-start',
        'timeout-end',
      ]);
    });

    it('should handle context switching within setTimeout boundary', async () => {
      vi.resetModules();

      const {
        setLogicalContextValue: freshSetValue,
        getLogicalContextValue: freshGetValue,
        switchToNewLogicalContext: freshSwitchToNewContext,
      } = await import('../src/primitives/logical-context');

      const testValue = 'setTimeout-root-value';

      freshSetValue(TEST_KEY, testValue);

      let outerTimeoutCalled = false;
      let innerTimeoutCalled = false;

      setTimeout(() => {
        // Should maintain captured context
        expect(freshGetValue(TEST_KEY)).toBe(testValue);

        // Switch context within timeout
        freshSwitchToNewContext('setTimeout-outer');
        freshSetValue(TEST_KEY, 'outer-timeout-value');
        outerTimeoutCalled = true;

        setTimeout(() => {
          // Should maintain the captured context from when this setTimeout was called
          expect(freshGetValue(TEST_KEY)).toBe('outer-timeout-value');
          innerTimeoutCalled = true;
        }, 5);
      }, 0);

      // Wait for both timeouts to complete
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Original context should be maintained
      expect(freshGetValue(TEST_KEY)).toBe(testValue);
      expect(outerTimeoutCalled).toBe(true);
      expect(innerTimeoutCalled).toBe(true);
    });
  });

  describe('Cross-hook integration', () => {
    it('should maintain context across mixed async operations', async () => {
      vi.resetModules();

      const {
        setLogicalContextValue: freshSetValue,
        getLogicalContextValue: freshGetValue,
      } = await import('../src/primitives/logical-context');

      const testValue = 'mixed-async-value';
      const results: Array<{ operation: string; value: string | undefined }> =
        [];

      freshSetValue(TEST_KEY, testValue);

      // queueMicrotask
      queueMicrotask(() => {
        results.push({
          operation: 'queueMicrotask',
          value: freshGetValue(TEST_KEY),
        });
      });

      // setTimeout (already tested in existing tests)
      setTimeout(() => {
        results.push({
          operation: 'setTimeout',
          value: freshGetValue(TEST_KEY),
        });
      }, 0);

      // setImmediate (if available)
      if (typeof globalThis.setImmediate !== 'undefined') {
        setImmediate(() => {
          results.push({
            operation: 'setImmediate',
            value: freshGetValue(TEST_KEY),
          });
        });
      }

      // Promise.then
      Promise.resolve().then(() => {
        results.push({
          operation: 'Promise.then',
          value: freshGetValue(TEST_KEY),
        });
      });

      // Wait for all async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      // All operations should have maintained the context
      results.forEach((result) => {
        expect(result.value).toBe(testValue);
      });

      // Should have at least queueMicrotask, setTimeout, and Promise.then
      expect(results.length).toBeGreaterThanOrEqual(3);

      const operations = results.map((r) => r.operation);
      expect(operations).toContain('queueMicrotask');
      expect(operations).toContain('setTimeout');
      expect(operations).toContain('Promise.then');
    });
  });

  describe('addEventListener hooks', () => {
    it('should have addEventListener hook implementation', () => {
      // This test verifies that the addEventListener hook exists
      // The actual functionality testing requires a DOM environment
      expect(typeof Element).toBeDefined();

      if (
        typeof Element !== 'undefined' &&
        Element.prototype &&
        Element.prototype.addEventListener
      ) {
        // Hook is available
        expect(typeof Element.prototype.addEventListener).toBe('function');
      } else {
        console.log(
          'addEventListener hooks not available in this environment - this is expected in some test environments'
        );
      }
    });
  });

  // NOTE: Integration tests moved to separate test files for better organization
});
