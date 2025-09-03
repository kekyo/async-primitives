import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAsyncLocal } from '../src/primitives/async-local';
import {
  runOnNewLogicalContext,
  switchToNewLogicalContext,
  getCurrentLogicalContextId,
} from '../src/primitives/logical-context';

describe('AsyncLocal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic functionality', () => {
    it('should set and get values', () => {
      const asyncLocal = createAsyncLocal<string>();

      expect(asyncLocal.getValue()).toBeUndefined();

      asyncLocal.setValue('test value');
      expect(asyncLocal.getValue()).toBe('test value');
    });

    it('should handle undefined values', () => {
      const asyncLocal = createAsyncLocal<string>();

      asyncLocal.setValue('initial value');
      expect(asyncLocal.getValue()).toBe('initial value');

      asyncLocal.setValue(undefined);
      expect(asyncLocal.getValue()).toBeUndefined();
    });

    it('should handle different data types', () => {
      const stringLocal = createAsyncLocal<string>();
      const numberLocal = createAsyncLocal<number>();
      const objectLocal = createAsyncLocal<{ id: number; name: string }>();

      stringLocal.setValue('string value');
      numberLocal.setValue(123);
      objectLocal.setValue({ id: 1, name: 'test' });

      expect(stringLocal.getValue()).toBe('string value');
      expect(numberLocal.getValue()).toBe(123);
      expect(objectLocal.getValue()).toEqual({ id: 1, name: 'test' });
    });
  });

  describe('LogicalContext isolation', () => {
    it('should isolate values with runOnNewLogicalContext', () => {
      const asyncLocal = createAsyncLocal<string>();

      // Set value in original context
      asyncLocal.setValue('original value');
      expect(asyncLocal.getValue()).toBe('original value');

      // Execute in new LogicalContext
      runOnNewLogicalContext('test', () => {
        // Value should not be available in new context
        expect(asyncLocal.getValue()).toBeUndefined();

        // Set value in new context
        asyncLocal.setValue('new value');
        expect(asyncLocal.getValue()).toBe('new value');
      });

      // Back to original context
      expect(asyncLocal.getValue()).toBe('original value');
    });

    it('should isolate values with switchToNewLogicalContext', () => {
      const asyncLocal = createAsyncLocal<string>();

      asyncLocal.setValue('initial value');
      expect(asyncLocal.getValue()).toBe('initial value');

      const originalContextId = getCurrentLogicalContextId();

      // Switch to new context
      switchToNewLogicalContext('new context');
      const newContextId = getCurrentLogicalContextId();

      // Confirm context has changed
      expect(newContextId).not.toBe(originalContextId);
      expect(newContextId.toString()).toContain('new context');

      // Value should not be available in new context
      expect(asyncLocal.getValue()).toBeUndefined();

      // Set value in new context
      asyncLocal.setValue('value after switch');
      expect(asyncLocal.getValue()).toBe('value after switch');
    });

    it('should correctly isolate values in nested LogicalContexts', () => {
      const asyncLocal = createAsyncLocal<string>();

      asyncLocal.setValue('level 0');

      runOnNewLogicalContext('level 1', () => {
        expect(asyncLocal.getValue()).toBeUndefined();
        asyncLocal.setValue('level 1 value');

        runOnNewLogicalContext('level 2', () => {
          expect(asyncLocal.getValue()).toBeUndefined();
          asyncLocal.setValue('level 2 value');

          expect(asyncLocal.getValue()).toBe('level 2 value');
        });

        // Back to level 1
        expect(asyncLocal.getValue()).toBe('level 1 value');
      });

      // Back to level 0
      expect(asyncLocal.getValue()).toBe('level 0');
    });
  });

  describe('Multiple AsyncLocal instances', () => {
    it('should maintain independence between different AsyncLocal instances', () => {
      const asyncLocal1 = createAsyncLocal<string>();
      const asyncLocal2 = createAsyncLocal<number>();

      asyncLocal1.setValue('string value');
      asyncLocal2.setValue(42);

      expect(asyncLocal1.getValue()).toBe('string value');
      expect(asyncLocal2.getValue()).toBe(42);

      // Independence is maintained even when LogicalContext switches
      runOnNewLogicalContext('test', () => {
        expect(asyncLocal1.getValue()).toBeUndefined();
        expect(asyncLocal2.getValue()).toBeUndefined();

        asyncLocal1.setValue('new string');
        asyncLocal2.setValue(100);

        expect(asyncLocal1.getValue()).toBe('new string');
        expect(asyncLocal2.getValue()).toBe(100);
      });

      expect(asyncLocal1.getValue()).toBe('string value');
      expect(asyncLocal2.getValue()).toBe(42);
    });

    it('should maintain independence between multiple AsyncLocal instances of same type', () => {
      const asyncLocal1 = createAsyncLocal<string>();
      const asyncLocal2 = createAsyncLocal<string>();

      asyncLocal1.setValue('value 1');
      asyncLocal2.setValue('value 2');

      expect(asyncLocal1.getValue()).toBe('value 1');
      expect(asyncLocal2.getValue()).toBe('value 2');

      // Changing one should not affect the other
      asyncLocal1.setValue('modified value 1');
      expect(asyncLocal1.getValue()).toBe('modified value 1');
      expect(asyncLocal2.getValue()).toBe('value 2');
    });
  });

  describe('Async boundary behavior', () => {
    it('should maintain LogicalContext across setTimeout', async () => {
      vi.resetModules();

      const { createAsyncLocal } = await import(
        '../src/primitives/async-local'
      );
      const asyncLocal = createAsyncLocal<string>();

      asyncLocal.setValue('value before timeout');

      let valueInTimeout: string | undefined;

      setTimeout(() => {
        valueInTimeout = asyncLocal.getValue();
      }, 0);

      vi.advanceTimersByTime(10);

      expect(valueInTimeout).toBe('value before timeout');
    });

    it('should maintain LogicalContext across queueMicrotask', async () => {
      vi.resetModules();

      const { createAsyncLocal } = await import(
        '../src/primitives/async-local'
      );
      const asyncLocal = createAsyncLocal<string>();

      asyncLocal.setValue('value before microtask');

      let valueInMicrotask: string | undefined;
      let microtaskExecuted = false;

      queueMicrotask(() => {
        valueInMicrotask = asyncLocal.getValue();
        microtaskExecuted = true;
      });

      // Wait for microtask to execute (using Promise)
      await Promise.resolve();

      expect(microtaskExecuted).toBe(true);
      expect(valueInMicrotask).toBe('value before microtask');
    });

    it('should work with Promise chains', async () => {
      vi.resetModules();

      const { createAsyncLocal } = await import(
        '../src/primitives/async-local'
      );
      const asyncLocal = createAsyncLocal<string>();

      asyncLocal.setValue('value before Promise');

      const result = await Promise.resolve()
        .then(() => asyncLocal.getValue())
        .then((value) => {
          asyncLocal.setValue('value in Promise');
          return { before: value, after: asyncLocal.getValue() };
        });

      expect(result.before).toBe('value before Promise');
      expect(result.after).toBe('value in Promise');
      expect(asyncLocal.getValue()).toBe('value in Promise');
    });

    it('should handle LogicalContext switching correctly across async boundaries', async () => {
      vi.resetModules();

      const { createAsyncLocal } = await import(
        '../src/primitives/async-local'
      );
      const { runOnNewLogicalContext } = await import(
        '../src/primitives/logical-context'
      );
      const asyncLocal = createAsyncLocal<string>();

      asyncLocal.setValue('external context value');

      let valuesInTimeout: Array<string | undefined> = [];

      runOnNewLogicalContext('internal context', () => {
        asyncLocal.setValue('internal context value');

        setTimeout(() => {
          valuesInTimeout.push(asyncLocal.getValue());
        }, 0);
      });

      setTimeout(() => {
        valuesInTimeout.push(asyncLocal.getValue());
      }, 5);

      vi.advanceTimersByTime(10);

      expect(valuesInTimeout).toEqual([
        'internal context value',
        'external context value',
      ]);
    });
  });

  describe('Edge cases', () => {
    it('should handle null as a value', () => {
      const asyncLocal = createAsyncLocal<string | null>();

      asyncLocal.setValue(null);
      expect(asyncLocal.getValue()).toBe(null);

      asyncLocal.setValue(undefined);
      expect(asyncLocal.getValue()).toBeUndefined();
    });

    it('should work with complex object types', () => {
      interface ComplexObject {
        id: number;
        data: {
          items: string[];
          metadata: { [key: string]: any };
        };
      }

      const asyncLocal = createAsyncLocal<ComplexObject>();

      const complexValue: ComplexObject = {
        id: 123,
        data: {
          items: ['item1', 'item2'],
          metadata: { flag: true, count: 42 },
        },
      };

      asyncLocal.setValue(complexValue);
      const retrievedValue = asyncLocal.getValue();

      expect(retrievedValue).toEqual(complexValue);
      expect(retrievedValue?.data.items).toContain('item1');
      expect(retrievedValue?.data.metadata.flag).toBe(true);
    });

    it('should handle same AsyncLocal instance across different contexts', () => {
      const asyncLocal = createAsyncLocal<string>();

      // Use same instance across multiple contexts and confirm values are isolated
      const results: Array<{ context: string; value: string | undefined }> = [];

      runOnNewLogicalContext('context 1', () => {
        asyncLocal.setValue('context 1 value');
        results.push({ context: 'context 1', value: asyncLocal.getValue() });
      });

      runOnNewLogicalContext('context 2', () => {
        asyncLocal.setValue('context 2 value');
        results.push({ context: 'context 2', value: asyncLocal.getValue() });
      });

      runOnNewLogicalContext('context 3', () => {
        // Don't set any value
        results.push({ context: 'context 3', value: asyncLocal.getValue() });
      });

      expect(results).toEqual([
        { context: 'context 1', value: 'context 1 value' },
        { context: 'context 2', value: 'context 2 value' },
        { context: 'context 3', value: undefined },
      ]);
    });
  });
});
