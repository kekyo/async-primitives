/**
 * Tests for onAbort function functionality
 * These tests verify the abort hook behavior
 */

import { describe, it, expect, vi } from 'vitest';
import { onAbort } from '../src/primitives/abort-hook.js';

describe('onAbort', () => {
  describe('Basic functionality', () => {
    it('should call callback when signal is aborted', () => {
      const controller = new AbortController();
      const callback = vi.fn();

      const handle = onAbort(controller.signal, callback);
      
      expect(callback).not.toHaveBeenCalled();
      expect(handle).toBeDefined();
      expect(typeof handle.release).toBe('function');
      
      controller.abort();
      
      expect(callback).toHaveBeenCalledOnce();
    });

    it('should call callback immediately if signal is already aborted', () => {
      const controller = new AbortController();
      controller.abort(); // Abort before setting up the hook
      
      const callback = vi.fn();

      const handle = onAbort(controller.signal, callback);
      
      expect(callback).toHaveBeenCalledOnce();
      expect(handle).toBeDefined();
      expect(typeof handle.release).toBe('function');
    });

    it('should do nothing when signal is undefined', () => {
      const callback = vi.fn();

      const handle = onAbort(undefined, callback);
      
      expect(callback).not.toHaveBeenCalled();
      expect(handle).toBeDefined();
      expect(typeof handle.release).toBe('function');
    });

    it('should do nothing when signal is null', () => {
      const callback = vi.fn();

      // @ts-expect-error Testing null value
      const handle = onAbort(null, callback);
      
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Releasable handle functionality', () => {
    it('should allow early release of the abort listener', () => {
      const controller = new AbortController();
      const callback = vi.fn();

      const handle = onAbort(controller.signal, callback);
      
      expect(callback).not.toHaveBeenCalled();
      
      // Release the handle before abort
      handle.release();
      
      // Abort should not call the callback now
      controller.abort();
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('should be safe to release multiple times', () => {
      const controller = new AbortController();
      const callback = vi.fn();

      const handle = onAbort(controller.signal, callback);
      
      // Release multiple times
      handle.release();
      handle.release();
      handle.release();
      
      controller.abort();
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('should support Symbol.dispose', () => {
      const controller = new AbortController();
      const callback = vi.fn();

      const handle = onAbort(controller.signal, callback);
      
      expect(handle[Symbol.dispose]).toBeDefined();
      expect(typeof handle[Symbol.dispose]).toBe('function');
      
      // Use Symbol.dispose
      handle[Symbol.dispose]();
      
      controller.abort();
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('should work with manual dispose pattern', () => {
      const controller = new AbortController();
      const callback = vi.fn();

      const handle = onAbort(controller.signal, callback);
      expect(handle).toBeDefined();
      
      // Manually call Symbol.dispose to simulate using declaration behavior
      handle[Symbol.dispose]();
      
      controller.abort();
      
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Event listener management', () => {
    it('should remove event listener after callback is called', () => {
      const controller = new AbortController();
      const callback = vi.fn();
      
      // Spy on addEventListener and removeEventListener
      const addEventListenerSpy = vi.spyOn(controller.signal, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(controller.signal, 'removeEventListener');

      const handle = onAbort(controller.signal, callback);
      
      expect(addEventListenerSpy).toHaveBeenCalledOnce();
      expect(addEventListenerSpy).toHaveBeenCalledWith('abort', expect.any(Function), { once: true });
      
      controller.abort();
      
      expect(callback).toHaveBeenCalledOnce();
      expect(removeEventListenerSpy).toHaveBeenCalledOnce();
      
      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });

    it('should handle multiple callbacks on the same signal', () => {
      const controller = new AbortController();
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      const handle1 = onAbort(controller.signal, callback1);
      const handle2 = onAbort(controller.signal, callback2);
      const handle3 = onAbort(controller.signal, callback3);
      
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
      expect(callback3).not.toHaveBeenCalled();
      
      controller.abort();
      
      expect(callback1).toHaveBeenCalledOnce();
      expect(callback2).toHaveBeenCalledOnce();
      expect(callback3).toHaveBeenCalledOnce();
    });

    it('should not call callback multiple times even if abort is called multiple times', () => {
      const controller = new AbortController();
      const callback = vi.fn();

      const handle = onAbort(controller.signal, callback);
      
      controller.abort();
      expect(callback).toHaveBeenCalledOnce();
      
      // Try to abort again (should have no effect)
      controller.abort();
      expect(callback).toHaveBeenCalledOnce(); // Still only called once
    });
  });

  describe('Error handling', () => {
    it('should handle callback that throws an error', () => {
      const controller = new AbortController();
      const error = new Error('Callback error');
      const callback = vi.fn(() => {
        throw error;
      });

      // Should not throw when setting up the hook
      let handle: any;
      expect(() => { handle = onAbort(controller.signal, callback); }).not.toThrow();
      
      // Should not throw when aborting, even though callback throws
      expect(() => controller.abort()).not.toThrow();
      
      expect(callback).toHaveBeenCalledOnce();
    });

    it('should handle async callback functions', async () => {
      const controller = new AbortController();
      const callback = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'async result';
      });

      const handle = onAbort(controller.signal, callback);
      
      controller.abort();
      
      expect(callback).toHaveBeenCalledOnce();
      
      // Wait a bit to ensure the async callback completes
      await new Promise(resolve => setTimeout(resolve, 20));
    });
  });

  describe('Edge cases', () => {
    it('should work with custom AbortSignal-like objects', () => {
      // Create a custom object that implements the AbortSignal interface
      const customSignal = {
        aborted: false,
        reason: undefined,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        throwIfAborted: vi.fn(),
        onabort: null,
        [Symbol.toStringTag]: 'AbortSignal'
      } as unknown as AbortSignal;

      const callback = vi.fn();

      const handle = onAbort(customSignal, callback);
      
      expect(customSignal.addEventListener).toHaveBeenCalledOnce();
      expect(customSignal.addEventListener).toHaveBeenCalledWith(
        'abort', 
        expect.any(Function), 
        { once: true }
      );
    });

    it('should handle signal that becomes aborted between setup and execution', () => {
      const controller = new AbortController();
      const callback = vi.fn();

      const handle = onAbort(controller.signal, callback);
      
      // Simulate a race condition by aborting immediately
      setTimeout(() => controller.abort(), 0);
      
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(callback).toHaveBeenCalledOnce();
          resolve();
        }, 10);
      });
    });

    it('should work correctly when called multiple times with the same signal and callback', () => {
      const controller = new AbortController();
      const callback = vi.fn();

      const handle1 = onAbort(controller.signal, callback);
      const handle2 = onAbort(controller.signal, callback); // Same callback, same signal
      
      controller.abort();
      
      // The callback should be called twice (once for each registration)
      expect(callback).toHaveBeenCalledTimes(2);
    });
  });

  describe('Memory management', () => {
    it('should not prevent garbage collection of the signal', () => {
      // This test is more conceptual since we can't easily test GC directly
      const controller = new AbortController();
      const callback = vi.fn();

      const handle = onAbort(controller.signal, callback);
      
      // After abort, the event listener should be removed
      controller.abort();
      
      expect(callback).toHaveBeenCalledOnce();
      
      // The signal should be able to be garbage collected now
      // (though we can't test this directly in this environment)
    });

    it('should clean up properly when signal is already aborted during setup', () => {
      const controller = new AbortController();
      controller.abort();
      
      const callback = vi.fn();
      const addEventListenerSpy = vi.spyOn(controller.signal, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(controller.signal, 'removeEventListener');

      const handle = onAbort(controller.signal, callback);
      
      expect(callback).toHaveBeenCalledOnce();
      // For already-aborted signals, no event listener should be added
      expect(addEventListenerSpy).not.toHaveBeenCalled();
      expect(removeEventListenerSpy).not.toHaveBeenCalled();
      
      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });
  });
}); 