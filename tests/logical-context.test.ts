import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  setLogicalContextValue,
  getLogicalContextValue,
  runOnNewLogicalContext,
  switchToNewLogicalContext,
  getCurrentLogicalContextId,
} from '../src/primitives/logical-context';

describe('LogicalContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should get root context id', () => {
    expect(getCurrentLogicalContextId().toString()).toContain('[root]');
  });

  it('should get new context id (1)', () => {
    switchToNewLogicalContext('test-abc');
    expect(getCurrentLogicalContextId().toString()).toContain('test-abc');
  });

  it('should get new context id (2)', () => {
    runOnNewLogicalContext('test-abc', () => {
      expect(getCurrentLogicalContextId().toString()).toContain('test-abc');
    });
  });

  it('should store and retrieve values', () => {
    const key = Symbol('test');
    const value = 'test value';

    setLogicalContextValue(key, value);
    expect(getLogicalContextValue(key)).toBe(value);
  });

  it('should handle undefined values', () => {
    const key = Symbol('test');
    expect(getLogicalContextValue(key)).toBeUndefined();
  });

  it('should isolate context with new context', () => {
    const key = Symbol('test');
    const value = 'async test value';

    setLogicalContextValue(key, value);

    switchToNewLogicalContext('test2');

    expect(getLogicalContextValue(key)).toBeUndefined();
  });

  it('should isolate context new async boundaries', () => {
    const key = Symbol('test');

    setLogicalContextValue(key, 'value1');

    let called = false;
    runOnNewLogicalContext('test', () => {
      setLogicalContextValue(key, 'value2');

      setTimeout(() => {
        expect(getLogicalContextValue(key)).toBe('value2');
        called = true;
      }, 0);
    });

    vi.advanceTimersByTime(10);

    expect(getLogicalContextValue(key)).toBe('value1');
    expect(called).toBe(true);
  });
});

// Corner case tests for LogicalContext with LogicalContext-like behavior
describe('Corner Cases', () => {
  it('should handle nested runOnNewLogicalContext calls', () => {
    const key = Symbol('nested-test');

    setLogicalContextValue(key, 'root-value');

    let level1Called = false;
    let level2Called = false;
    let level3Called = false;

    runOnNewLogicalContext('level1', () => {
      expect(getLogicalContextValue(key)).toBeUndefined();
      setLogicalContextValue(key, 'level1-value');
      level1Called = true;

      runOnNewLogicalContext('level2', () => {
        expect(getLogicalContextValue(key)).toBeUndefined();
        setLogicalContextValue(key, 'level2-value');
        level2Called = true;

        runOnNewLogicalContext('level3', () => {
          expect(getLogicalContextValue(key)).toBeUndefined();
          setLogicalContextValue(key, 'level3-value');
          level3Called = true;
        });

        // Back to level2
        expect(getLogicalContextValue(key)).toBe('level2-value');
      });

      // Back to level1
      expect(getLogicalContextValue(key)).toBe('level1-value');
    });

    // Back to root
    expect(getLogicalContextValue(key)).toBe('root-value');
    expect(level1Called).toBe(true);
    expect(level2Called).toBe(true);
    expect(level3Called).toBe(true);
  });
});
