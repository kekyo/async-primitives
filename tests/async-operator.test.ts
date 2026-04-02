/**
 * Tests for AsyncOperator functionality
 * These tests verify lazy async collection operators built from iterable values and promises
 */

import { describe, it, expect } from 'vitest';
import { createDeferred, delay, from } from '../src/index.js';

describe('AsyncOperator', () => {
  describe('toArray', () => {
    it('should resolve values in input order', async () => {
      const source = [delay(20).then(() => 1), 2, delay(5).then(() => 3)];
      const actual = await from(source).toArray();

      expect(actual).toEqual([1, 2, 3]);
    });

    it('should stop iterating when the source rejects', async () => {
      const error = new Error('source failed');
      const events: string[] = [];
      const source = {
        [Symbol.iterator]: function* () {
          events.push('yield-1');
          yield Promise.resolve(1);
          events.push('yield-2');
          yield Promise.reject(error);
          events.push('yield-3');
          yield Promise.resolve(3);
        },
      };

      await expect(from(source).toArray()).rejects.toBe(error);
      expect(events).toEqual(['yield-1', 'yield-2']);
    });
  });

  describe('chain operators', () => {
    it('should chain map, filter and flatMap with async callbacks', async () => {
      const result = await from([Promise.resolve(1), 2, 3])
        .map(async (value, index) => {
          await delay(1);
          return value + index;
        })
        .filter(async (value) => {
          await delay(1);
          return value % 2 === 1;
        })
        .flatMap(async (value) => [
          Promise.resolve(value),
          delay(1).then(() => value * 10),
        ])
        .toArray();

      expect(result).toEqual([1, 10, 3, 30, 5, 50]);
    });

    it('should evaluate lazily and re-enumerate on each terminal operation', async () => {
      let iteratorCallCount = 0;
      let mapCallCount = 0;

      const source = {
        [Symbol.iterator]: () => {
          iteratorCallCount++;
          return [1, 2][Symbol.iterator]();
        },
      };

      const operator = from(source).map((value) => {
        mapCallCount++;
        return value * 2;
      });

      expect(iteratorCallCount).toBe(0);

      const first = await operator.toArray();
      const second = await operator.toArray();

      expect(first).toEqual([2, 4]);
      expect(second).toEqual([2, 4]);
      expect(first).not.toBe(second);
      expect(iteratorCallCount).toBe(2);
      expect(mapCallCount).toBe(4);
    });

    it('should process the source and map callback sequentially', async () => {
      const first = createDeferred<number>();
      const second = createDeferred<number>();
      const gate = createDeferred<void>();
      const events: string[] = [];

      const source = {
        [Symbol.iterator]: function* () {
          events.push('yield-1');
          yield first.promise;
          events.push('yield-2');
          yield second.promise;
        },
      };

      const resultPromise = from(source)
        .map(async (value) => {
          events.push(`map-start-${value}`);
          await gate.promise;
          events.push(`map-end-${value}`);
          return value * 2;
        })
        .toArray();

      await delay(0);
      expect(events).toEqual(['yield-1']);

      first.resolve(1);
      await delay(0);
      expect(events).toEqual(['yield-1', 'map-start-1']);

      gate.resolve(undefined);
      await delay(0);
      expect(events).toEqual([
        'yield-1',
        'map-start-1',
        'map-end-1',
        'yield-2',
      ]);

      second.resolve(2);

      await expect(resultPromise).resolves.toEqual([2, 4]);
      expect(events).toEqual([
        'yield-1',
        'map-start-1',
        'map-end-1',
        'yield-2',
        'map-start-2',
        'map-end-2',
      ]);
    });
  });
});
