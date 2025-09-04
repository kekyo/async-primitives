/**
 * Tests for advanced logical context hooks: requestAnimationFrame, XMLHttpRequest, fetch
 * These tests verify that the logical context is properly maintained across
 * advanced async API boundaries after prepare() is called.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  setLogicalContextValue,
  getLogicalContextValue,
} from '../src/primitives/logical-context';

const TEST_KEY = Symbol('test-key');

describe('Advanced Logical Context Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('requestAnimationFrame hook', () => {
    it('should maintain logical context across requestAnimationFrame boundary', async () => {
      // Skip test if requestAnimationFrame is not available
      if (typeof globalThis.requestAnimationFrame === 'undefined') {
        console.log(
          'Skipping requestAnimationFrame test - not available in this environment'
        );
        return;
      }

      vi.resetModules();

      const {
        setLogicalContextValue: freshSetValue,
        getLogicalContextValue: freshGetValue,
      } = await import('../src/primitives/logical-context');

      const testValue = 'raf-context-value';
      let capturedValue: string | undefined;
      let rafCalled = false;

      // Mock requestAnimationFrame
      const mockRAF = vi.fn((callback: FrameRequestCallback) => {
        // Simulate RAF behavior
        setTimeout(() => callback(performance.now()), 16);
        return 1;
      });
      globalThis.requestAnimationFrame = mockRAF;

      // Set a value in logical context
      freshSetValue(TEST_KEY, testValue);

      // Schedule animation frame that should maintain the context
      requestAnimationFrame((time) => {
        capturedValue = freshGetValue(TEST_KEY);
        rafCalled = true;
      });

      // Change context value after scheduling
      freshSetValue(TEST_KEY, 'changed-value');

      // Wait for animation frame to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(rafCalled).toBe(true);
      expect(capturedValue).toBe(testValue);
    });

    it('should work when requestAnimationFrame is not available', async () => {
      // Simulate environment without requestAnimationFrame
      const originalRAF = globalThis.requestAnimationFrame;
      (globalThis as any).requestAnimationFrame = undefined;

      try {
        vi.resetModules();

        const {
          setLogicalContextValue: freshSetValue,
          getLogicalContextValue: freshGetValue,
        } = await import('../src/primitives/logical-context');

        const testValue = 'no-raf-value';
        freshSetValue(TEST_KEY, testValue);

        // This should not throw an error
        const retrievedValue = freshGetValue(TEST_KEY);
        expect(retrievedValue).toBe(testValue);
      } finally {
        globalThis.requestAnimationFrame = originalRAF;
      }
    });
  });

  describe('XMLHttpRequest hooks', () => {
    it('should maintain logical context in XMLHttpRequest event handlers', async () => {
      // Skip test if XMLHttpRequest is not available
      if (typeof globalThis.XMLHttpRequest === 'undefined') {
        console.log(
          'Skipping XMLHttpRequest test - not available in this environment'
        );
        return;
      }

      vi.resetModules();

      const {
        setLogicalContextValue: freshSetValue,
        getLogicalContextValue: freshGetValue,
      } = await import('../src/primitives/logical-context');

      const testValue = 'xhr-context-value';
      let capturedValue: string | undefined;

      // Set a value in logical context
      freshSetValue(TEST_KEY, testValue);

      // Create XMLHttpRequest
      const xhr = new XMLHttpRequest();

      // Set onreadystatechange handler
      xhr.onreadystatechange = function () {
        if (this.readyState === 4) {
          capturedValue = freshGetValue(TEST_KEY);
        }
      };

      // Change context value after setting handler
      freshSetValue(TEST_KEY, 'changed-value');

      // Mock the response
      Object.defineProperty(xhr, 'readyState', { value: 4, writable: true });
      Object.defineProperty(xhr, 'status', { value: 200, writable: true });
      Object.defineProperty(xhr, 'responseText', {
        value: '{"success": true}',
        writable: true,
      });

      // Trigger the event
      if (xhr.onreadystatechange) {
        xhr.onreadystatechange.call(xhr, {} as Event);
      }

      // Should capture the initial value, not the changed value
      expect(capturedValue).toBe(testValue);
    });

    it('should maintain logical context with XMLHttpRequest addEventListener', async () => {
      if (typeof globalThis.XMLHttpRequest === 'undefined') {
        console.log(
          'Skipping XMLHttpRequest addEventListener test - not available in this environment'
        );
        return;
      }

      vi.resetModules();

      const {
        setLogicalContextValue: freshSetValue,
        getLogicalContextValue: freshGetValue,
      } = await import('../src/primitives/logical-context');

      const testValue = 'xhr-listener-value';
      let capturedValue: string | undefined;

      // Set a value in logical context
      freshSetValue(TEST_KEY, testValue);

      // Create XMLHttpRequest
      const xhr = new XMLHttpRequest();

      // Add event listener
      xhr.addEventListener('load', () => {
        capturedValue = freshGetValue(TEST_KEY);
      });

      // Change context value after adding listener
      freshSetValue(TEST_KEY, 'changed-value');

      // Manually trigger the load event
      const loadEvent = new Event('load');
      xhr.dispatchEvent(loadEvent);

      // Should capture the initial value, not the changed value
      expect(capturedValue).toBe(testValue);
    });

    it('should work when XMLHttpRequest is not available', async () => {
      // Simulate environment without XMLHttpRequest
      const originalXHR = globalThis.XMLHttpRequest;
      (globalThis as any).XMLHttpRequest = undefined;

      try {
        vi.resetModules();

        const {
          setLogicalContextValue: freshSetValue,
          getLogicalContextValue: freshGetValue,
        } = await import('../src/primitives/logical-context');

        const testValue = 'no-xhr-value';
        freshSetValue(TEST_KEY, testValue);

        // This should not throw an error
        const retrievedValue = freshGetValue(TEST_KEY);
        expect(retrievedValue).toBe(testValue);
      } finally {
        globalThis.XMLHttpRequest = originalXHR;
      }
    });
  });

  describe('fetch with Promise hooks', () => {
    it('should maintain logical context in fetch promise handlers via existing Promise hooks', async () => {
      // Skip test if fetch is not available
      if (typeof globalThis.fetch === 'undefined') {
        console.log('Skipping fetch test - not available in this environment');
        return;
      }

      vi.resetModules();

      const {
        setLogicalContextValue: freshSetValue,
        getLogicalContextValue: freshGetValue,
      } = await import('../src/primitives/logical-context');

      const testValue = 'fetch-context-value';
      let capturedValue: string | undefined;

      // Mock fetch
      const mockFetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true }),
        } as Response)
      );
      globalThis.fetch = mockFetch;

      // Set a value in logical context
      freshSetValue(TEST_KEY, testValue);

      // Use fetch with promise handlers - these handlers are automatically wrapped by Promise hooks
      await fetch('/api/test').then((response) => {
        capturedValue = freshGetValue(TEST_KEY);
        return response.json();
      });

      // Should capture the initial value due to existing Promise hooks (not fetch-specific hooks)
      expect(capturedValue).toBe(testValue);
      expect(mockFetch).toHaveBeenCalledWith('/api/test');
    });

    it('should maintain logical context in fetch error handlers via existing Promise hooks', async () => {
      if (typeof globalThis.fetch === 'undefined') {
        console.log(
          'Skipping fetch error test - not available in this environment'
        );
        return;
      }

      vi.resetModules();

      const {
        setLogicalContextValue: freshSetValue,
        getLogicalContextValue: freshGetValue,
      } = await import('../src/primitives/logical-context');

      const testValue = 'fetch-error-value';
      let capturedValue: string | undefined;

      // Mock fetch to reject
      const mockFetch = vi.fn(() => Promise.reject(new Error('Network error')));
      globalThis.fetch = mockFetch;

      // Set a value in logical context
      freshSetValue(TEST_KEY, testValue);

      // Use fetch with error handler - this handler is automatically wrapped by Promise hooks
      try {
        await fetch('/api/error').catch((error) => {
          capturedValue = freshGetValue(TEST_KEY);
          throw error;
        });
      } catch (error) {
        // Expected to throw
      }

      // Should capture the initial value due to existing Promise hooks (not fetch-specific hooks)
      expect(capturedValue).toBe(testValue);
      expect(mockFetch).toHaveBeenCalledWith('/api/error');
    });

    it('should work when fetch is not available (no fetch-specific hooks needed)', async () => {
      // Simulate environment without fetch
      const originalFetch = globalThis.fetch;
      (globalThis as any).fetch = undefined;

      try {
        vi.resetModules();

        const {
          setLogicalContextValue: freshSetValue,
          getLogicalContextValue: freshGetValue,
        } = await import('../src/primitives/logical-context');

        const testValue = 'no-fetch-value';
        freshSetValue(TEST_KEY, testValue);

        // This should not throw an error since we don't have fetch-specific hooks
        const retrievedValue = freshGetValue(TEST_KEY);
        expect(retrievedValue).toBe(testValue);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('Integration with existing hooks', () => {
    it('should work together with setTimeout and Promise hooks', async () => {
      // Skip this complex integration test in environments without full API support
      if (
        typeof globalThis.requestAnimationFrame === 'undefined' ||
        typeof globalThis.fetch === 'undefined'
      ) {
        console.log(
          'Skipping integration test - APIs not available in this environment'
        );
        return;
      }

      vi.resetModules();

      const {
        setLogicalContextValue: freshSetValue,
        getLogicalContextValue: freshGetValue,
      } = await import('../src/primitives/logical-context');

      const testValue = 'integration-value';
      const results: string[] = [];

      // Set initial context
      freshSetValue(TEST_KEY, testValue);

      // Mock fetch
      const mockFetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: 'test' }),
        } as Response)
      );
      globalThis.fetch = mockFetch;

      // Test setTimeout and Promise integration (simpler test)
      setTimeout(() => {
        results.push(freshGetValue(TEST_KEY) as string);

        fetch('/api/data')
          .then((response) => {
            results.push(freshGetValue(TEST_KEY) as string);
            return response.json();
          })
          .then((data) => {
            results.push(freshGetValue(TEST_KEY) as string);
          });
      }, 10);

      // Change context after scheduling
      freshSetValue(TEST_KEY, 'different-value');

      // Wait for all operations to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // All should capture the original value
      expect(results).toEqual([testValue, testValue, testValue]);
    });
  });
});
