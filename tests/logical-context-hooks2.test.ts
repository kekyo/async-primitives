/**
 * Tests for logical context hooks: process.nextTick and EventTarget.addEventListener
 * These tests verify that the logical context is properly maintained across
 * process.nextTick and EventTarget.addEventListener boundaries after prepare() is called.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setLogicalContextValue, getLogicalContextValue, runOnNewLogicalContext } from '../src/primitives/logical-context';

const TEST_KEY = Symbol('test-key');

describe('New Logical Context Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('process.nextTick hook (Node.js only)', () => {
    it('should maintain logical context across process.nextTick boundary when available', async () => {
      // Skip test if process.nextTick is not available (browser environment)
      if (typeof process === 'undefined' || !process.nextTick) {
        console.log('Skipping process.nextTick test - not available in this environment');
        return;
      }

      // Clear module cache to ensure fresh prepare() call
      vi.resetModules();
      
      // Re-import to trigger prepare()
      const { setLogicalContextValue: freshSetValue, getLogicalContextValue: freshGetValue } = 
        await import('../src/primitives/logical-context');

      const testValue = 'nextTick-context-value';
      const executionOrder: string[] = [];
      
      // Set a value in logical context
      freshSetValue(TEST_KEY, testValue);
      executionOrder.push('context-set');

      // Schedule nextTick that should maintain the context
      process.nextTick(() => {
        executionOrder.push('nextTick-start');
        const retrievedValue = freshGetValue(TEST_KEY);
        expect(retrievedValue).toBe(testValue);
        executionOrder.push('nextTick-end');
      });

      executionOrder.push('after-nextTick');

      // Wait for nextTick to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(executionOrder).toEqual([
        'context-set',
        'after-nextTick',
        'nextTick-start',
        'nextTick-end'
      ]);
    });

    it('should handle context changes within process.nextTick', async () => {
      if (typeof process === 'undefined' || !process.nextTick) {
        console.log('Skipping process.nextTick test - not available in this environment');
        return;
      }

      vi.resetModules();
      
      const { setLogicalContextValue: freshSetValue, getLogicalContextValue: freshGetValue } = 
        await import('../src/primitives/logical-context');

      const initialValue = 'initial-nextTick-value';
      const modifiedValue = 'modified-nextTick-value';
      
      freshSetValue(TEST_KEY, initialValue);

      let contextInNextTick: string | undefined;
      let contextAfterNextTick: string | undefined;

      process.nextTick(() => {
        contextInNextTick = freshGetValue(TEST_KEY);
        freshSetValue(TEST_KEY, modifiedValue);
      });

      // Wait for nextTick completion
      await new Promise(resolve => setImmediate(resolve));
      
      contextAfterNextTick = freshGetValue(TEST_KEY);

      expect(contextInNextTick).toBe(initialValue);
      expect(contextAfterNextTick).toBe(modifiedValue); // Context changes are reflected back
    });

    it('should handle process.nextTick with arguments', async () => {
      if (typeof process === 'undefined' || !process.nextTick) {
        console.log('Skipping process.nextTick with arguments test - not available in this environment');
        return;
      }

      vi.resetModules();
      
      const { setLogicalContextValue: freshSetValue, getLogicalContextValue: freshGetValue } = 
        await import('../src/primitives/logical-context');

      const testValue = 'nextTick-args-value';
      const testArg1 = 'arg1';
      const testArg2 = 42;
      
      freshSetValue(TEST_KEY, testValue);

      let receivedArgs: any[] = [];
      let contextValue: string | undefined;

      process.nextTick((arg1: string, arg2: number) => {
        receivedArgs = [arg1, arg2];
        contextValue = freshGetValue(TEST_KEY);
      }, testArg1, testArg2);

      // Wait for nextTick to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(receivedArgs).toEqual([testArg1, testArg2]);
      expect(contextValue).toBe(testValue);
    });

    it('should work when process.nextTick is not available', async () => {
      // Simulate browser environment without process.nextTick
      const originalProcess = globalThis.process;
      (globalThis as any).process = undefined;

      try {
        vi.resetModules();
        
        const { setLogicalContextValue: freshSetValue, getLogicalContextValue: freshGetValue } = 
          await import('../src/primitives/logical-context');

        const testValue = 'no-nextTick-value';
        freshSetValue(TEST_KEY, testValue);

        // This should not throw an error
        const retrievedValue = freshGetValue(TEST_KEY);
        expect(retrievedValue).toBe(testValue);
      } finally {
        globalThis.process = originalProcess;
      }
    });

    it('should handle nested process.nextTick calls', async () => {
      if (typeof process === 'undefined' || !process.nextTick) {
        console.log('Skipping nested process.nextTick test - not available in this environment');
        return;
      }

      vi.resetModules();
      
      const { setLogicalContextValue: freshSetValue, getLogicalContextValue: freshGetValue, runOnNewLogicalContext: freshRunOnNew } = 
        await import('../src/primitives/logical-context');

      const outerValue = 'outer-context-value';
      const innerValue = 'inner-context-value';
      
      freshSetValue(TEST_KEY, outerValue);

      let outerResult: string | undefined;
      let innerResult: string | undefined;

      process.nextTick(() => {
        outerResult = freshGetValue(TEST_KEY);
        
        freshRunOnNew('inner-context', () => {
          freshSetValue(TEST_KEY, innerValue);
          
          process.nextTick(() => {
            innerResult = freshGetValue(TEST_KEY);
          });
        });
      });

      // Wait for all nextTick calls to complete
      await new Promise(resolve => setImmediate(() => setImmediate(resolve)));

      expect(outerResult).toBe(outerValue);
      expect(innerResult).toBe(innerValue);
    });
  });

  describe('EventTarget.addEventListener hook', () => {
    it('should maintain logical context across EventTarget event handlers', async () => {
      // Skip test if EventTarget is not available
      if (typeof EventTarget === 'undefined') {
        console.log('Skipping EventTarget test - not available in this environment');
        return;
      }

      vi.resetModules();
      
      const { setLogicalContextValue: freshSetValue, getLogicalContextValue: freshGetValue } = 
        await import('../src/primitives/logical-context');

      const testValue = 'eventTarget-context-value';
      
      freshSetValue(TEST_KEY, testValue);

      let contextInHandler: string | undefined;
      let handlerExecuted = false;

      // Create a custom EventTarget
      const eventTarget = new EventTarget();
      
      eventTarget.addEventListener('test-event', () => {
        contextInHandler = freshGetValue(TEST_KEY);
        handlerExecuted = true;
      });

      // Dispatch the event
      eventTarget.dispatchEvent(new CustomEvent('test-event'));

      expect(handlerExecuted).toBe(true);
      expect(contextInHandler).toBe(testValue);
    });

    it('should handle EventTarget addEventListener with handleEvent object', async () => {
      if (typeof EventTarget === 'undefined') {
        console.log('Skipping EventTarget handleEvent test - not available in this environment');
        return;
      }

      vi.resetModules();
      
      const { setLogicalContextValue: freshSetValue, getLogicalContextValue: freshGetValue } = 
        await import('../src/primitives/logical-context');

      const testValue = 'handleEvent-context-value';
      
      freshSetValue(TEST_KEY, testValue);

      let contextInHandler: string | undefined;
      let handlerExecuted = false;

      const eventTarget = new EventTarget();
      
      const listenerObject = {
        handleEvent: () => {
          contextInHandler = freshGetValue(TEST_KEY);
          handlerExecuted = true;
        }
      };

      eventTarget.addEventListener('test-event', listenerObject);
      eventTarget.dispatchEvent(new CustomEvent('test-event'));

      expect(handlerExecuted).toBe(true);
      expect(contextInHandler).toBe(testValue);
    });

    it('should handle context isolation across different EventTarget instances', async () => {
      if (typeof EventTarget === 'undefined') {
        console.log('Skipping EventTarget isolation test - not available in this environment');
        return;
      }

      vi.resetModules();
      
      const { setLogicalContextValue: freshSetValue, getLogicalContextValue: freshGetValue, runOnNewLogicalContext: freshRunOnNew } = 
        await import('../src/primitives/logical-context');

      const value1 = 'context-value-1';
      const value2 = 'context-value-2';
      
      let result1: string | undefined;
      let result2: string | undefined;

      const eventTarget1 = new EventTarget();
      const eventTarget2 = new EventTarget();

      // Set up first context
      freshSetValue(TEST_KEY, value1);
      eventTarget1.addEventListener('test-event', () => {
        result1 = freshGetValue(TEST_KEY);
      });

      // Set up second context
      freshRunOnNew('context-2', () => {
        freshSetValue(TEST_KEY, value2);
        eventTarget2.addEventListener('test-event', () => {
          result2 = freshGetValue(TEST_KEY);
        });
      });

      // Dispatch events
      eventTarget1.dispatchEvent(new CustomEvent('test-event'));
      eventTarget2.dispatchEvent(new CustomEvent('test-event'));

      expect(result1).toBe(value1);
      expect(result2).toBe(value2);
    });

    it('should handle EventTarget addEventListener with null listener', async () => {
      if (typeof EventTarget === 'undefined') {
        console.log('Skipping EventTarget null listener test - not available in this environment');
        return;
      }

      vi.resetModules();
      
      await import('../src/primitives/logical-context');

      const eventTarget = new EventTarget();
      
      // This should not throw an error
      expect(() => {
        eventTarget.addEventListener('test-event', null);
      }).not.toThrow();
    });

    it('should work with different event types and options', async () => {
      if (typeof EventTarget === 'undefined') {
        console.log('Skipping EventTarget options test - not available in this environment');
        return;
      }

      vi.resetModules();
      
      const { setLogicalContextValue: freshSetValue, getLogicalContextValue: freshGetValue } = 
        await import('../src/primitives/logical-context');

      const testValue = 'options-context-value';
      
      freshSetValue(TEST_KEY, testValue);

      let contextValues: string[] = [];
      let handlerCallCount = 0;

      const eventTarget = new EventTarget();
      
      // Add listener with once option
      eventTarget.addEventListener('test-event', () => {
        contextValues.push(freshGetValue(TEST_KEY) || 'undefined');
        handlerCallCount++;
      }, { once: true });

      // Dispatch event twice
      eventTarget.dispatchEvent(new CustomEvent('test-event'));
      eventTarget.dispatchEvent(new CustomEvent('test-event'));

      expect(handlerCallCount).toBe(1); // Should only be called once due to 'once' option
      expect(contextValues).toEqual([testValue]);
    });
  });

  describe('Integration between process.nextTick and EventTarget', () => {
    it('should maintain context across process.nextTick and EventTarget combination', async () => {
      if (typeof process === 'undefined' || !process.nextTick || typeof EventTarget === 'undefined') {
        console.log('Skipping integration test - APIs not available in this environment');
        return;
      }

      vi.resetModules();
      
      const { setLogicalContextValue: freshSetValue, getLogicalContextValue: freshGetValue } = 
        await import('../src/primitives/logical-context');

      const testValue = 'integration-context-value';
      
      freshSetValue(TEST_KEY, testValue);

      let nextTickValue: string | undefined;
      let eventValue: string | undefined;
      let integrationComplete = false;

      const eventTarget = new EventTarget();
      
      eventTarget.addEventListener('test-event', () => {
        eventValue = freshGetValue(TEST_KEY);
        
        process.nextTick(() => {
          nextTickValue = freshGetValue(TEST_KEY);
          integrationComplete = true;
        });
      });

      // Dispatch event to trigger the chain
      eventTarget.dispatchEvent(new CustomEvent('test-event'));

      // Wait for all async operations to complete
      await new Promise(resolve => setImmediate(() => setImmediate(resolve)));

      expect(integrationComplete).toBe(true);
      expect(eventValue).toBe(testValue);
      expect(nextTickValue).toBe(testValue);
    });
  });
}); 