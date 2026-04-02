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

    it('should support direct consumption with for await', async () => {
      const values: number[] = [];

      for await (const value of from([
        Promise.resolve(1),
        2,
        delay(1).then(() => 3),
      ])) {
        values.push(value);
      }

      expect(values).toEqual([1, 2, 3]);
    });

    it('should accept AsyncIterable sources', async () => {
      const createSource = async function* () {
        yield Promise.resolve(1);
        await delay(1);
        yield 2;
        yield Promise.resolve(3);
      };

      const collected = await from(createSource()).toArray();
      const iterated: number[] = [];

      for await (const value of from(createSource())) {
        iterated.push(value);
      }

      expect(collected).toEqual([1, 2, 3]);
      expect(iterated).toEqual([1, 2, 3]);
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

  describe('intermediate operators', () => {
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

    it('should support flatMap with AsyncIterable inner sources', async () => {
      const result = await from([1, 2])
        .flatMap((value) =>
          (async function* () {
            yield value;
            await delay(1);
            yield value * 10;
          })()
        )
        .toArray();

      expect(result).toEqual([1, 10, 2, 20]);
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

    it('should support choose, distinct and distinctBy', async () => {
      const objects = [
        { id: 1, name: 'alice' },
        { id: 1, name: 'alice-duplicate' },
        { id: 2, name: 'bob' },
      ] as const;

      const chosen = await from([1, 2, 2, 3, 4, 4])
        .choose((value) => (value % 2 === 0 ? value * 10 : undefined))
        .distinct()
        .toArray();

      const distinctObjects = await from(objects)
        .distinctBy((value) => value.id)
        .map((value) => value.name)
        .toArray();

      expect(chosen).toEqual([20, 40]);
      expect(distinctObjects).toEqual(['alice', 'bob']);
    });

    it('should support concat with iterable and async iterable sources', async () => {
      const result = await from([Promise.resolve(1), 2])
        .concat(
          [Promise.resolve(3)],
          (async function* () {
            yield 4;
            await delay(1);
            yield Promise.resolve(5);
          })()
        )
        .toArray();

      expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it('should support skip, take, skipWhile and takeWhile', async () => {
      const result = await from([1, 2, 3, 4, 5, 6, 7])
        .skip(1)
        .skipWhile((value) => value < 3)
        .take(4)
        .takeWhile((value) => value < 7)
        .toArray();

      expect(result).toEqual([3, 4, 5, 6]);
    });

    it('should support pairwise and zip', async () => {
      const pairwise = await from([1, 2, 3, 4]).pairwise().toArray();
      const zipped = await from([1, 2, 3])
        .zip([Promise.resolve('a'), 'b'])
        .toArray();
      const zippedAsync = await from([1, 2, 3])
        .zip(
          (async function* () {
            yield 'x';
            await delay(1);
            yield Promise.resolve('y');
          })()
        )
        .toArray();

      expect(pairwise).toEqual([
        [1, 2],
        [2, 3],
        [3, 4],
      ]);
      expect(zipped).toEqual([
        [1, 'a'],
        [2, 'b'],
      ]);
      expect(zippedAsync).toEqual([
        [1, 'x'],
        [2, 'y'],
      ]);
    });

    it('should support scan including the initial value', async () => {
      const values = await from([1, 2, 3])
        .scan(async (state, value) => {
          await delay(1);
          return state + value;
        }, 0)
        .toArray();

      const emptyValues = await from<number>([])
        .scan((state, value) => state + value, 0)
        .toArray();

      expect(values).toEqual([0, 1, 3, 6]);
      expect(emptyValues).toEqual([0]);
    });

    it('should support union and unionBy', async () => {
      const unionValues = await from([1, 2, 2, 3])
        .union(
          (async function* () {
            yield Promise.resolve(3);
            yield 4;
            yield Promise.resolve(1);
            yield 5;
          })()
        )
        .toArray();

      const unionByValues = await from([
        { id: 1, name: 'alice' },
        { id: 2, name: 'bob' },
      ])
        .unionBy(
          [
            { id: 2, name: 'bob-duplicate' },
            { id: 3, name: 'charlie' },
          ],
          (value) => value.id
        )
        .map((value) => value.name)
        .toArray();

      expect(unionValues).toEqual([1, 2, 3, 4, 5]);
      expect(unionByValues).toEqual(['alice', 'bob', 'charlie']);
    });

    it('should support intersect, intersectBy, except and exceptBy', async () => {
      const intersectValues = await from([1, 2, 2, 3, 4])
        .intersect(
          (async function* () {
            yield 2;
            yield Promise.resolve(4);
            yield 4;
            yield 6;
          })()
        )
        .toArray();

      const exceptValues = await from([1, 2, 2, 3, 4]).except([2, 5]).toArray();

      const intersectByValues = await from([
        { id: 1, name: 'alice' },
        { id: 2, name: 'bob' },
        { id: 2, name: 'bob-duplicate' },
        { id: 3, name: 'charlie' },
      ])
        .intersectBy(
          [
            { id: 2, name: 'other-bob' },
            { id: 4, name: 'david' },
          ],
          (value) => value.id
        )
        .map((value) => value.name)
        .toArray();

      const exceptByValues = await from([
        { id: 1, name: 'alice' },
        { id: 2, name: 'bob' },
        { id: 2, name: 'bob-duplicate' },
        { id: 3, name: 'charlie' },
      ])
        .exceptBy([{ id: 2, name: 'other-bob' }], (value) => value.id)
        .map((value) => value.name)
        .toArray();

      expect(intersectValues).toEqual([2, 4]);
      expect(exceptValues).toEqual([1, 3, 4]);
      expect(intersectByValues).toEqual(['bob']);
      expect(exceptByValues).toEqual(['alice', 'charlie']);
    });

    it('should support chunkBySize and windowed', async () => {
      const chunks = await from([1, 2, 3, 4, 5]).chunkBySize(2).toArray();
      const windows = await from([1, 2, 3, 4]).windowed(3).toArray();
      const emptyWindows = await from([1, 2]).windowed(3).toArray();

      expect(chunks).toEqual([[1, 2], [3, 4], [5]]);
      expect(windows).toEqual([
        [1, 2, 3],
        [2, 3, 4],
      ]);
      expect(emptyWindows).toEqual([]);
    });

    it('should reject invalid chunk and window sizes', async () => {
      await expect(from([1, 2, 3]).chunkBySize(0).toArray()).rejects.toThrow(
        'Chunk size must be greater than 0'
      );
      await expect(from([1, 2, 3]).windowed(0).toArray()).rejects.toThrow(
        'Window size must be greater than 0'
      );
    });
  });

  describe('terminal operators', () => {
    it('should support forEach and reduce with an initial value', async () => {
      const visited: string[] = [];

      await from([1, 2, 3]).forEach(async (value, index) => {
        await delay(1);
        visited.push(`${index}:${value}`);
      });

      const sum = await from([1, 2, 3, 4]).reduce(
        async (state, value) => state + value,
        0
      );

      expect(visited).toEqual(['0:1', '1:2', '2:3']);
      expect(sum).toBe(10);
    });

    it('should support reduce without an initial value and reject empty sources', async () => {
      const sum = await from([1, 2, 3, 4]).reduce(
        async (state, value) => state + value
      );

      await expect(
        from<number>([]).reduce((state, value) => state + value)
      ).rejects.toThrow('Reduce of empty AsyncOperator with no initial value');
      expect(sum).toBe(10);
    });

    it('should short-circuit some and every', async () => {
      const someVisits: number[] = [];
      const everyVisits: number[] = [];

      const someResult = await from([1, 2, 3, 4]).some((value) => {
        someVisits.push(value);
        return value >= 3;
      });

      const everyResult = await from([1, 2, 3, 4]).every((value) => {
        everyVisits.push(value);
        return value < 3;
      });

      expect(someResult).toBe(true);
      expect(everyResult).toBe(false);
      expect(someVisits).toEqual([1, 2, 3]);
      expect(everyVisits).toEqual([1, 2, 3]);
    });

    it('should support find and findIndex', async () => {
      const found = await from([5, 7, 9, 10]).find((value) => value % 2 === 0);
      const foundIndex = await from([5, 7, 9, 10]).findIndex(
        (value) => value % 2 === 0
      );
      const missingIndex = await from([1, 3, 5]).findIndex(
        (value) => value % 2 === 0
      );

      expect(found).toBe(10);
      expect(foundIndex).toBe(3);
      expect(missingIndex).toBe(-1);
    });

    it('should support findLast, findLastIndex and join', async () => {
      const found = await from([5, 7, 9, 10, 11, 12]).findLast(
        (value) => value % 2 === 0
      );
      const foundIndex = await from([5, 7, 9, 10, 11, 12]).findLastIndex(
        (value) => value % 2 === 0
      );
      const missingIndex = await from([1, 3, 5]).findLastIndex(
        (value) => value % 2 === 0
      );
      const joined = await from<number | null | undefined>([
        1,
        null,
        undefined,
        4,
      ]).join();
      const joinedWithSeparator = await from(['a', 'b', 'c']).join(' / ');

      expect(found).toBe(12);
      expect(foundIndex).toBe(5);
      expect(missingIndex).toBe(-1);
      expect(joined).toBe('1,,,4');
      expect(joinedWithSeparator).toBe('a / b / c');
    });

    it('should support min, minBy, max and maxBy', async () => {
      const values = [5, 2, 9, 3];
      const objects = [
        { name: 'alice', score: 20 },
        { name: 'bob', score: 10 },
        { name: 'charlie', score: 30 },
      ] as const;

      const min = await from(values).min();
      const max = await from(values).max();
      const minBy = await from(objects).minBy((value) => value.score);
      const maxBy = await from(objects).maxBy((value) => value.score);
      const emptyMin = await from<number>([]).min();

      expect(min).toBe(2);
      expect(max).toBe(9);
      expect(minBy).toEqual({ name: 'bob', score: 10 });
      expect(maxBy).toEqual({ name: 'charlie', score: 30 });
      expect(emptyMin).toBeUndefined();
    });

    it('should support groupBy and countBy', async () => {
      const grouped = await from(['ant', 'ape', 'bear', 'bee']).groupBy(
        (value) => value[0]
      );
      const counted = await from(['ant', 'ape', 'bear', 'bee']).countBy(
        (value) => value[0]
      );

      expect(Array.from(grouped.entries())).toEqual([
        ['a', ['ant', 'ape']],
        ['b', ['bear', 'bee']],
      ]);
      expect(Array.from(counted.entries())).toEqual([
        ['a', 2],
        ['b', 2],
      ]);
    });
  });
});
