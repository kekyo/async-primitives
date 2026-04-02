# async-primitives

TypeScript/JavaScript における非同期処理のためのプリミティブ関数集です。

[![Project Status: Active – The project has reached a stable, usable state and is being actively developed.](https://www.repostatus.org/badges/latest/active.svg)](https://www.repostatus.org/#active)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/async-primitives.svg)](https://www.npmjs.com/package/async-primitives)

---

[(For English language)](./README.md)

## これは何ですか?

`Promise<T>` に対して追加の処理を行いたい場合、この小さなライブラリが役に立つかもしれません。
Mutex、producer-consumer 分離（副作用を持つ処理）、シグナリング（フラグ制御）、論理コンテキスト、イテレータチェイニング演算子などを提供します。

- ブラウザ環境と Node.js 環境の両方で動作します（16 以降、テストは 24 のみ）。
- 外部依存はありません。

プリミティブ:

| 関数                          | 説明                                              |
| :---------------------------- | :------------------------------------------------ |
| `delay()`                     | Promise ベースの遅延関数                          |
| `defer()`                     | 次のイベントループでコールバックを実行予約        |
| `onAbort()`                   | クリーンアップ付きの安全な abort signal hook 登録 |
| `createMutex()`               | クリティカルセクション向け Promise ベース mutex   |
| `createSemaphore()`           | 同時アクセス数を制限する Promise ベース semaphore |
| `createReaderWriterLock()`    | 複数 reader / 単一 writer 向け read-write lock    |
| `createDeferred()`            | Promise の resolve/reject を外部制御              |
| `createDeferredGenerator()`   | キュー管理付き async generator の外部制御         |
| `createConditional()`         | 自動条件トリガー（1 トリガーにつき waiter 1 件）  |
| `createManuallyConditional()` | 手動条件制御（状態の raise/drop）                 |

イテレータ操作:

| 関数     | 説明                                            |
| :------- | :---------------------------------------------- |
| `from()` | 非同期値の iterable に対する chainable operator |

高度な機能:

| 関数                 | 説明                                 |
| :------------------- | :----------------------------------- |
| `createAsyncLocal()` | 非同期コンテキストストレージ         |
| `LogicalContext`     | 低レベルな非同期実行コンテキスト管理 |

- 以前 `AsyncLock` および `Signal` として知られていた実装は、`Mutex` および `Conditional` に変更されました。
  これらのシンボル名は引き続き使用できますが、非推奨としてマークされている点に注意してください。
  将来のバージョンで削除される可能性があります。

---

## インストール

```bash
npm install async-primitives
```

---

## 使い方

各関数は独立しており、互いの前提知識を必要としません。

### delay()

`Promise<void>` として await 可能な遅延を提供し、`AbortSignal` によるキャンセルにも対応します。

```typescript
import { delay } from 'async-primitives';

// delay を使う
await delay(1000); // 1 秒待機
```

```typescript
// AbortSignal を使う
const c = new AbortController();
await delay(1000, c.signal); // 1 秒待機
```

### defer()

次のイベントループ反復で非同期に実行されるコールバックをスケジュールします。

```typescript
import { defer } from 'async-primitives';

// defer を使う（次のイベントループでコールバックを実行予約）
defer(() => {
  console.log('Executes asynchronously');
});
```

### onAbort()

`AbortSignal` の abort イベントに hook 関数を登録し、クリーンアップ処理を可能にします。早期解除にも対応しています。

```typescript
import { onAbort } from 'async-primitives';

// onAbort を使う（AbortSignal にフック）
const controller = new AbortController();

const releaseHandle = onAbort(controller.signal, (error: Error) => {
  console.log('Operation was aborted!');
  // （終了時に自動でクリーンアップされます）
});

// （必要なら早期にクリーンアップ）
releaseHandle.release();
```

### createMutex()

Promise ベースの mutex 機能を提供し、非同期処理における競合状態を防ぐクリティカルセクションを実装できます。

```typescript
import { createMutex } from 'async-primitives';

// Mutex を使う
const locker = createMutex();

// Mutex をロック
const handler = await locker.lock();
try {
  // クリティカルセクション。競合状態を防ぎます。
} finally {
  // Mutex を解放
  handler.release();
}
```

```typescript
// AbortSignal を使う
const handler = await locker.lock(c.signal);
```

### createDeferred()

`Promise<T>` の resolve/reject を外部から制御できる `Deferred<T>` オブジェクトを作成します。
非同期処理における producer と consumer の分離に便利です。

```typescript
import { createDeferred } from 'async-primitives';

// Deferred を使う
const deferred = createDeferred<number>();

deferred.resolve(123); // （結果値を供給）
deferred.reject(new Error()); // （エラーを供給）

// （コンシューマ側）
const value = await deferred.promise;
```

```typescript
// AbortSignal 対応
const controller = new AbortController();
const abortableDeferred = createDeferred<number>(controller.signal);
```

### createDeferredGenerator()

async generator `AsyncGenerator<T, ...>` の yield、return、throw を外部から制御できる `DeferredGenerator<T>` オブジェクトを作成します。
ストリーミングデータのような producer/consumer 分離パターンに便利です。

```typescript
import { createDeferredGenerator } from 'async-primitives';

// 基本的な使い方 - ストリーミングデータ
const deferredGen = createDeferredGenerator<string>();

// コンシューマ側 - 値が到着するたびに反復
const consumer = async () => {
  for await (const value of deferredGen.generator) {
    console.log('Received:', value);
  }
  console.log('Stream completed');
};

// 消費を開始
consumer();

// プロデューサ側 - 外部から値を送る（現在は Promise<void> を返す）
await deferredGen.yield('First value');
await deferredGen.yield('Second value');
await deferredGen.yield('Third value');
await deferredGen.return(); // ストリームを完了
```

yield 時にエラーを挿入することもできます:

```typescript
// エラーハンドリング付き
const errorGen = createDeferredGenerator<number>();

const errorConsumer = async () => {
  try {
    for await (const value of errorGen.generator) {
      console.log('Number:', value);
    }
  } catch (error) {
    console.log('Error occurred:', error.message);
  }
};

errorConsumer();
await errorGen.yield(1);
await errorGen.yield(2);
await errorGen.throw(new Error('Something went wrong'));
```

#### キューサイズ管理

`maxItemReserved` オプションにより、キューに保持できるアイテム数の上限を制御できます。

```typescript
// キューの最大サイズを 3 件に制限
const limitedGen = createDeferredGenerator<string>({ maxItemReserved: 3 });

// キューが満杯の場合、yield は空きができるまで待機
await limitedGen.yield('item1');
await limitedGen.yield('item2');
await limitedGen.yield('item3'); // キューは満杯です

// コンシューマがいくつか処理するまで待機します
await limitedGen.yield('item4'); // キューの空きを待機
```

### createConditional()

raise と drop が可能な、自動または手動制御のシグナルを作成します。
複数の waiter が同じシグナルを待機でき、シグナルが raise されると全員が解決されます。

`Conditional`（自動 conditional）は自動的に raise-and-drop され、1 回のトリガーで waiter を 1 件だけ解放します:

```typescript
import { createConditional } from 'async-primitives';

// 自動 Conditional を作成
const signal = createConditional();

// 複数の待機を開始
const waiter1 = signal.wait();
const waiter2 = signal.wait();

// シグナルをトリガー - 1 回のトリガーで 1 つの待機のみ解決
signal.trigger(); // waiter1 が解決される

await waiter1;
console.log('First waiter resolved');

// 2 番目の待機はまだ継続中
signal.trigger(); // waiter2 が解決される

await waiter2;
console.log('Second waiter resolved');
```

```typescript
// AbortSignal 対応の待機
const controller = new AbortController();
try {
  const waitPromise = signal.wait(controller.signal);
  // 待機処理を中断
  controller.abort();
  await waitPromise;
} catch (error) {
  console.log('Wait was aborted');
}
```

### createManuallyConditional()

`ManuallyConditional` は raise/drop 状態を手動で制御するもので、trigger 操作は任意です。

```typescript
import { createManuallyConditional } from 'async-primitives';

// 手動 Conditional を作成
const signal = createManuallyConditional();

// 複数の待機を開始
const waiter1 = signal.wait();
const waiter2 = signal.wait();

// シグナルを raise - すべての待機が解決
signal.raise();

// または、1 つの待機だけ解放することもできます
//signal.trigger(); // waiter1 が解決される

await Promise.all([waiter1, waiter2]);
console.log('All waiters resolved');

// シグナルを drop
signal.drop();
```

```typescript
// AbortSignal 対応の待機
const controller = new AbortController();
try {
  await signal.wait(controller.signal);
} catch (error) {
  console.log('Wait was aborted');
}
```

### createSemaphore()

指定した数まで同時実行を制限する `Semaphore` を作成します。
レート制限、リソースプーリング、制限されたリソースへの同時アクセス制御に便利です。

```typescript
import { createSemaphore } from 'async-primitives';

// 同時 3 処理までの semaphore を作成
const semaphore = createSemaphore(3);

// リソースを取得
const handle = await semaphore.acquire();
try {
  // クリティカルセクション - 同時に 3 処理まで実行可能
  await performExpensiveOperation();
} finally {
  // リソースを解放
  handle.release();
}

// 利用可能なリソース数を確認
console.log(`Available: ${semaphore.availableCount}`);
console.log(`Waiting: ${semaphore.pendingCount}`);
```

API 呼び出しのレート制限例:

```typescript
// API 呼び出しを同時 5 件に制限
const apiSemaphore = createSemaphore(5);

const rateLimitedFetch = async (url: string) => {
  const handle = await apiSemaphore.acquire();
  try {
    return await fetch(url);
  } finally {
    handle.release();
  }
};

// 並行数を制御しながら多数の URL を処理
const urls = ['url1', 'url2' /* ... ほか多数 ... */];
const promises = urls.map((url) => rateLimitedFetch(url));
const results = await Promise.all(promises);
// 常に同時実行中のリクエストは 5 件まで
```

```typescript
// AbortSignal 対応
const controller = new AbortController();
try {
  const handle = await semaphore.acquire(controller.signal);

  // リソースを使う
  handle.release();
} catch (error) {
  console.log('Semaphore acquisition was aborted');
}
```

### createReaderWriterLock()

複数の同時 reader と、1 つの排他的 writer を許可する `ReaderWriterLock` を作成します。

ロックポリシー:

- `write-preferring`（デフォルト）: writer が待機中の場合、新しい reader は writer 完了まで待機します
- `read-preferring`: writer が待機中でも新しい reader はロックを取得できます

```typescript
import { createReaderWriterLock } from 'async-primitives';

// ReaderWriterLock を作成（デフォルト: write-preferring）
const rwLock = createReaderWriterLock();

// ポリシーを指定して作成
const readPreferringLock = createReaderWriterLock({
  policy: 'read-preferring',
});

// 従来 API との後方互換
const rwLockLegacy = createReaderWriterLock(10); // maxConsecutiveCalls を指定

// 複数の reader が同時にアクセス可能
const readData = async () => {
  const handle = await rwLock.readLock();
  try {
    // 複数の読み取り処理を同時に実行できます
    const data = await readFromSharedResource();
    return data;
  } finally {
    handle.release();
  }
};

// writer は排他的にアクセス
const writeData = async (newData: any) => {
  const handle = await rwLock.writeLock();
  try {
    // 排他的アクセス - reader も他の writer も不可
    await writeToSharedResource(newData);
  } finally {
    handle.release();
  }
};

// ロック状態を確認
console.log(`Current readers: ${rwLock.currentReaders}`);
console.log(`Has writer: ${rwLock.hasWriter}`);
console.log(`Pending readers: ${rwLock.pendingReadersCount}`);
console.log(`Pending writers: ${rwLock.pendingWritersCount}`);
```

キャッシュ実装例:

```typescript
const cacheLock = createReaderWriterLock();
const cache = new Map();

// キャッシュから読み取る（複数同時読み取り可）
const getCached = async (key: string) => {
  const handle = await cacheLock.readLock();
  try {
    return cache.get(key);
  } finally {
    handle.release();
  }
};

// キャッシュを更新（排他的書き込み）
const updateCache = async (key: string, value: any) => {
  const handle = await cacheLock.writeLock();
  try {
    cache.set(key, value);
  } finally {
    handle.release();
  }
};

// キャッシュを消去（排他的書き込み）
const clearCache = async () => {
  const handle = await cacheLock.writeLock();
  try {
    cache.clear();
  } finally {
    handle.release();
  }
};
```

```typescript
// AbortSignal 対応
const controller = new AbortController();
try {
  const readHandle = await rwLock.readLock(controller.signal);

  // 読み取り処理...
  readHandle.release();
} catch (error) {
  console.log('Lock acquisition was aborted');
}
```

### from()

値または `Promise` の `Iterable` / `AsyncIterable` から `AsyncOperator<T>` を作成し、遅延評価かつ順次実行される演算子のチェイニングを可能にします。
`Array.map()` のような関数を、非同期イテレータにも適用できる、と考えると良いでしょう。

```typescript
import { from } from 'async-primitives';

// 配列を演算子で処理する
const values = await from([Promise.resolve(1), 2, Promise.resolve(3)])
  .map(async (value) => value * 2)
  .filter((value) => value > 2)
  .flatMap((value) => [value, value + 100])
  .toArray();

console.log(values); // [4, 104, 6, 106]
```

`AsyncOperator<T>` は `AsyncIterable<T>` でもあるため、`for await` で直接消費できます。

```typescript
// AsyncIterable<T> として直接消費
for await (const value of from(iterable).map((value) => value * 2)) {
  console.log(value);
}
```

`AsyncIterable<T>` （主に非同期ジェネレータとして生成される）を投入することも出来ます:

```typescript
// AsyncIterable<T> のソースにも対応
const asyncIterable = (async function* () {
  yield 1;
  yield 2;
  yield 3;
})();

const values = await from(asyncIterable).toArray();
```

非同期ジェネレータインスタンスのように、一度しか列挙できないソースもあります。
同じソースを再列挙できない場合、同じ `AsyncOperator` に対して複数の終端操作を呼ぶと、
2 回目以降の列挙では異なる結果になる可能性があります。

中間演算子:

| 演算子          | 説明                                                                |
| :-------------- | :------------------------------------------------------------------ |
| `map()`         | 解決済みの各値を別の値へ写像します                                  |
| `flatMap()`     | 解決済みの各値を iterable に写像し、1 段 flatten します             |
| `filter()`      | predicate が truthy を返した値だけを残します                        |
| `concat()`      | 追加の iterable または async iterable の値を連結します              |
| `choose()`      | 各値を写像し、`null` と `undefined` の結果を除外します              |
| `slice()`       | `Array.prototype.slice()` と同じ意味論で部分範囲を返します          |
| `distinct()`    | 重複する値を取り除きます                                            |
| `distinctBy()`  | 射影キーで重複する値を取り除きます                                  |
| `skip()`        | 指定した数の値をスキップします                                      |
| `skipWhile()`   | predicate が true を返す間、値をスキップします                      |
| `take()`        | 指定した数の値を取得します                                          |
| `takeWhile()`   | predicate が true を返す間、値を取得します                          |
| `pairwise()`    | 隣接する値のペアを生成します                                        |
| `zip()`         | 別の iterable と要素ごとに結合します                                |
| `scan()`        | 初期値を含む途中の accumulator 状態を生成します                     |
| `union()`       | このシーケンスと別シーケンスを順に見て一意な値を生成します          |
| `unionBy()`     | 2 つのシーケンス全体で射影キーごとの一意値を生成します              |
| `intersect()`   | 両方のシーケンスに現れる一意な値を生成します                        |
| `intersectBy()` | 両方のシーケンスに現れる射影キーごとの一意値を生成します            |
| `except()`      | 別シーケンスに現れない一意な値を生成します                          |
| `exceptBy()`    | 別シーケンスに存在しない射影キーごとの一意値を生成します            |
| `chunkBySize()` | 固定最大サイズの配列に値をグループ化します                          |
| `windowed()`    | 固定サイズのスライディングウィンドウを生成します                    |
| `flat()`        | `Array.prototype.flat()` と同じ意味論でネスト配列を平坦化します     |
| `reverse()`     | 逆順のシーケンスを返します                                          |
| `toReversed()`  | 逆順コピーを返します                                                |
| `sort()`        | `Array.prototype.sort()` と同じ意味論で整列したシーケンスを返します |
| `toSorted()`    | `Array.prototype.toSorted()` と同じ意味論の整列コピーを返します     |

終端演算子:

| 演算子            | 説明                                                               |
| :---------------- | :----------------------------------------------------------------- |
| `forEach()`       | 各値に対して action を実行します                                   |
| `reduce()`        | シーケンスを単一の値に畳み込みます                                 |
| `reduceRight()`   | 右から左へシーケンスを畳み込みます                                 |
| `some()`          | いずれかの値が predicate を満たすと true を返します                |
| `every()`         | すべての値が predicate を満たすと true を返します                  |
| `find()`          | predicate を満たす最初の値を返します                               |
| `findIndex()`     | predicate を満たす最初の値のインデックスを返します                 |
| `at()`            | `Array.prototype.at()` に対応する指定インデックスの値を返します    |
| `includes()`      | `Array.prototype.includes()` に対応する包含判定を返します          |
| `indexOf()`       | `Array.prototype.indexOf()` に対応する最初の一致位置を返します     |
| `lastIndexOf()`   | `Array.prototype.lastIndexOf()` に対応する最後の一致位置を返します |
| `findLast()`      | predicate を満たす最後の値を返します                               |
| `findLastIndex()` | predicate を満たす最後の値のインデックスを返します                 |
| `min()`           | 最小値を返し、空シーケンスでは `undefined` を返します              |
| `minBy()`         | 射影キーが最小の値を返し、空シーケンスでは `undefined` を返します  |
| `max()`           | 最大値を返し、空シーケンスでは `undefined` を返します              |
| `maxBy()`         | 射影キーが最大の値を返し、空シーケンスでは `undefined` を返します  |
| `groupBy()`       | 射影キーごとに `Map` へ値を収集します                              |
| `countBy()`       | 射影キーごとに `Map` へ件数を集計します                            |
| `join()`          | `Array.prototype.join()` に対応して値を文字列連結します            |
| `toArray()`       | 結果の値を配列として実体化します                                   |

`slice()`、`at()`、`includes()`、`indexOf()`、`lastIndexOf()` のようなインデックスベースの operator は、
対応する `Array` の意味論に従います。
負のインデックスや負の `fromIndex` は、結果が判明するまでソース全体の消費が必要になる場合があります。

`flat()`、`reverse()`、`toReversed()`、`sort()`、`toSorted()`、`reduceRight()` のような実体化を伴う operator は、
結果を生成する前にソース全体を消費します。

### ES2022+ の using statement

using statement と組み合わせて使用できます（ES2022+ または同等の polyfill が必要です）

```typescript
const locker = createMutex();

{
  using handler = await locker.lock();

  // （スコープを抜けると自動解放されます）
}

{
  using handle = onAbort(controller.signal, () => {
    console.log('Cleanup on aborts');
  });

  // （スコープを抜けると自動解放されます）
}

// using statement を使った Semaphore
const semaphore = createSemaphore(3);

{
  using handle = await semaphore.acquire();

  // レート制限付きの処理を実行
  await performOperation();

  // （スコープを抜けると自動解放されます）
}

// using statement を使った ReaderWriterLock
const rwLock = createReaderWriterLock();

{
  // 読み取りスコープ
  using readHandle = await rwLock.readLock();

  const data = await readSharedData();

  // （スコープを抜けると自動解放されます）
}

{
  // 書き込みスコープ
  using writeHandle = await rwLock.writeLock();

  await writeSharedData(newData);

  // （スコープを抜けると自動解放されます）
}
```

## 高度な話題

### createAsyncLocal()

スレッドローカルストレージに似た非同期コンテキストストレージを提供しますが、スレッドではなく非同期コンテキスト単位で分離されます。
値は同一の論理コンテキスト内で、`setTimeout`、`await`、`Promise` チェーンのような非同期境界をまたいでも維持されます。

```typescript
import { createAsyncLocal } from 'async-primitives';

// AsyncLocal インスタンスを作成
const asyncLocal = createAsyncLocal<string>();

// 現在のコンテキストに値を設定
asyncLocal.setValue('context value');

// 値は setTimeout をまたいでも維持される
setTimeout(() => {
  console.log(asyncLocal.getValue()); // 'context value'
}, 100);

// 値は await 境界をまたいでも維持される
const example = async () => {
  asyncLocal.setValue('before await');

  await delay(100);

  console.log(asyncLocal.getValue()); // 'before await'
};

// 値は Promise チェーン内でも維持される
Promise.resolve()
  .then(() => {
    asyncLocal.setValue('in promise');
    return asyncLocal.getValue();
  })
  .then((value) => {
    console.log(value); // 'in promise'
  });
```

注: 上の例はグローバルスコープの変数を使う場合と違いがありません。
実際に「非同期コンテキスト」を分離して異なる結果を観測するには、以下の `LogicalContext` セクションを使う必要があります。

### LogicalContext の操作

`LogicalContext` は非同期実行コンテキストを管理するための低レベル API を提供します。
これらは `createAsyncLocal()` によって自動的に利用されますが、高度な用途では直接使うこともできます。

```typescript
import {
  setLogicalContextValue,
  getLogicalContextValue,
  runOnNewLogicalContext,
  getCurrentLogicalContextId,
} from 'async-primitives';

// コンテキスト値を直接操作
const key = Symbol('my-context-key');
setLogicalContextValue(key, 'some value');
const value = getLogicalContextValue<string>(key); // 'some value'

// 現在のコンテキスト ID を取得
const contextId = getCurrentLogicalContextId();
console.log(`Current context: ${contextId.toString()}`);

// 新しい分離コンテキストでコードを実行
const result = runOnNewLogicalContext('my-operation', () => {
  // これは完全に新しいコンテキストで実行される
  const isolatedValue = getLogicalContextValue<string>(key); // undefined

  setLogicalContextValue(key, 'isolated value');
  return getLogicalContextValue<string>(key); // 'isolated value'
});

// 元のコンテキストに戻る
const originalValue = getLogicalContextValue<string>(key); // 'some value'
```

`LogicalContext` を初めて使用すると、コンテキストを正しく維持するために JavaScript のさまざまなランタイム関数や定義へ hook が挿入されます。これにより一定のオーバーヘッドが発生する点に注意してください。

| 対象                           | 目的                                                                  |
| :----------------------------- | :-------------------------------------------------------------------- |
| `setTimeout`                   | タイマーコールバックをまたいでコンテキストを維持します                |
| `setInterval`                  | interval コールバックをまたいでコンテキストを維持します               |
| `queueMicrotask`               | microtask queue 内でコンテキストを保持します                          |
| `setImmediate`                 | immediate queue 内でコンテキストを保持します（Node.js のみ）          |
| `process.nextTick`             | next tick queue 内でコンテキストを保持します（Node.js のみ）          |
| `Promise`                      | `then()`、`catch()`、`finally()` チェーン用のコンテキストを捕捉します |
| `EventTarget.addEventListener` | すべての EventTarget ハンドラでコンテキストを維持します               |
| `Element.addEventListener`     | DOM イベントハンドラでコンテキストを維持します                        |
| `requestAnimationFrame`        | アニメーションコールバック内でコンテキストを保持します                |
| `XMLHttpRequest`               | XHR のイベントハンドラとコールバックでコンテキストを維持します        |
| `WebSocket`                    | WebSocket のイベントハンドラとコールバックでコンテキストを維持します  |
| `MutationObserver`             | DOM 変化監視コールバック内でコンテキストを保持します                  |
| `ResizeObserver`               | 要素サイズ監視コールバック内でコンテキストを保持します                |
| `IntersectionObserver`         | intersection observer コールバック内でコンテキストを保持します        |
| `Worker`                       | Web Worker のイベントハンドラでコンテキストを維持します               |
| `MessagePort`                  | MessagePort 通信ハンドラでコンテキストを維持します                    |

注: `LogicalContext` の値は異なるコンテキスト間では分離されますが、同一コンテキスト内の非同期境界をまたいでは維持されます。
これにより、複雑な非同期アプリケーションでも適切なコンテキスト分離が可能になります。

### createMutex() のパラメータ詳細

`createMutex(maxConsecutiveCalls?: number)` では、`maxConsecutiveCalls` パラメータ（デフォルト値: 20）を指定できます。

この値はロック待機キューを処理する際の連続実行回数の上限を設定します:

- **小さい値（例: 1-5）**
  - イベントループにより頻繁に制御を返します
  - 他の非同期処理への影響を最小化します
  - ロック処理スループットはやや低下する可能性があります

- **大きい値（例: 50-100）**
  - より多くのロック処理を連続実行します
  - ロック処理スループットが向上します
  - 他の非同期処理をより長くブロックする可能性があります

- **推奨設定**
  - デフォルト値（20）はほとんどの用途に適しています
  - UI 応答性を優先する場合: 低めの値（3-7）
  - バッチ処理のように高スループットが必要な場合: 高めの値（20-100）

```typescript
// UI 応答性を優先
const uiLocker = createMutex(5);

// 高スループット処理
const batchLocker = createMutex(50);
```

---

## ベンチマーク結果

これらの結果には `LogicalContext` による hook は導入されていません。[benchmarks/suites/](benchmarks/suites/) を参照してください。

すべてのベンチマークスイートは以下で実行できます:

```bash
npm run benchmark
```

`AsyncOperator` ベンチマークのみを実行することもできます:

```bash
npm run benchmark -- --suite=async-operator
```

機械可読な出力が必要な場合:

```bash
npm run --silent benchmark:json -- --suite=async-operator
```

以下のベンチマークテーブルは `./run_benchmark.sh` により生成されています。値はマシンやランタイム環境に依存します。

<!-- benchmark-results:start -->

| Benchmark                                                                | Operations/sec | Avg Time (ms) | Median Time (ms) | Std Dev (ms) | Total Time (ms) |
| ------------------------------------------------------------------------ | -------------- | ------------- | ---------------- | ------------ | --------------- |
| delay(0)                                                                 | 1,074          | 1.083         | 1.078            | 0.076        | 1000.76         |
| delay(1)                                                                 | 1,082          | 1.086         | 1.079            | 0.091        | 1000.59         |
| Mutex acquire/release                                                    | 259,111        | 0.005         | 0.003            | 0.076        | 1000.87         |
| Semaphore(1) acquire/release                                             | 295,582        | 0.004         | 0.003            | 0.069        | 1000            |
| Semaphore(2) acquire/release                                             | 287,243        | 0.005         | 0.003            | 0.081        | 1000            |
| Semaphore(5) acquire/release                                             | 292,272        | 0.004         | 0.003            | 0.08         | 1000            |
| Semaphore(10) acquire/release                                            | 285,535        | 0.005         | 0.003            | 0.074        | 1000            |
| Semaphore(1) sequential (100x)                                           | 11,351         | 0.102         | 0.084            | 0.287        | 1000.04         |
| Semaphore(5) sequential (100x)                                           | 11,316         | 0.103         | 0.084            | 0.297        | 1000.16         |
| Semaphore(1) concurrent (10x)                                            | 65,322         | 0.02          | 0.014            | 0.237        | 1000.02         |
| Semaphore(2) concurrent (10x)                                            | 60,323         | 0.021         | 0.014            | 0.101        | 1000.01         |
| Semaphore(5) concurrent (10x)                                            | 62,271         | 0.021         | 0.014            | 0.229        | 1000.6          |
| Semaphore(2) high contention (20x)                                       | 33,628         | 0.037         | 0.027            | 0.127        | 1000.02         |
| Semaphore(5) high contention (50x)                                       | 15,884         | 0.075         | 0.061            | 0.476        | 1000.01         |
| Semaphore(5) maxCalls=10 sequential (100x)                               | 11,353         | 0.1           | 0.087            | 0.268        | 1001.04         |
| Semaphore(5) maxCalls=50 sequential (100x)                               | 11,368         | 0.11          | 0.086            | 0.915        | 1036.13         |
| Semaphore(5) maxCalls=100 sequential (100x)                              | 11,465         | 0.098         | 0.085            | 0.254        | 1000.03         |
| ReaderWriterLock readLock acquire/release (write-preferring)             | 211,300        | 0.006         | 0.005            | 0.125        | 1003.45         |
| ReaderWriterLock writeLock acquire/release (write-preferring)            | 210,102        | 0.007         | 0.005            | 0.451        | 1000            |
| ReaderWriterLock readLock acquire/release (read-preferring)              | 202,592        | 0.007         | 0.005            | 0.234        | 1000            |
| ReaderWriterLock writeLock acquire/release (read-preferring)             | 206,635        | 0.006         | 0.005            | 0.109        | 1000            |
| ReaderWriterLock sequential reads (100x, write-preferring)               | 10,950         | 0.106         | 0.087            | 0.273        | 1000.09         |
| ReaderWriterLock sequential writes (100x, write-preferring)              | 10,040         | 0.143         | 0.09             | 1.523        | 1000.08         |
| ReaderWriterLock sequential reads (100x, read-preferring)                | 10,966         | 0.106         | 0.086            | 0.259        | 1000.07         |
| ReaderWriterLock sequential writes (100x, read-preferring)               | 11,171         | 0.102         | 0.086            | 0.265        | 1000.08         |
| ReaderWriterLock concurrent readers (10x, write-preferring)              | 64,896         | 0.018         | 0.015            | 0.109        | 1000.01         |
| ReaderWriterLock concurrent readers (20x, write-preferring)              | 38,968         | 0.03          | 0.025            | 0.146        | 1000.02         |
| ReaderWriterLock concurrent readers (10x, read-preferring)               | 65,577         | 0.021         | 0.015            | 0.655        | 1000            |
| ReaderWriterLock concurrent readers (20x, read-preferring)               | 39,536         | 0.029         | 0.025            | 0.14         | 1000.01         |
| ReaderWriterLock read-heavy (100 ops, write-preferring)                  | 7,753          | 0.158         | 0.115            | 0.228        | 1000.01         |
| ReaderWriterLock read-heavy (100 ops, read-preferring)                   | 8,052          | 0.147         | 0.117            | 0.218        | 1000.38         |
| ReaderWriterLock write-heavy (100 ops, write-preferring)                 | 7,698          | 0.152         | 0.126            | 0.764        | 1000.11         |
| ReaderWriterLock write-heavy (100 ops, read-preferring)                  | 7,582          | 0.15          | 0.129            | 0.236        | 1000.11         |
| ReaderWriterLock balanced (100 ops, write-preferring)                    | 7,237          | 0.17          | 0.126            | 0.265        | 1001.98         |
| ReaderWriterLock balanced (100 ops, read-preferring)                     | 8,158          | 0.145         | 0.116            | 0.266        | 1000.02         |
| ReaderWriterLock maxCalls=10 mixed (100 ops, write-preferring)           | 8,268          | 0.137         | 0.116            | 0.204        | 1000.09         |
| ReaderWriterLock maxCalls=50 mixed (100 ops, write-preferring)           | 8,911          | 0.125         | 0.109            | 0.209        | 1000.06         |
| ReaderWriterLock maxCalls=10 mixed (100 ops, read-preferring)            | 8,361          | 0.134         | 0.117            | 0.199        | 1000.07         |
| ReaderWriterLock maxCalls=50 mixed (100 ops, read-preferring)            | 8,953          | 0.124         | 0.108            | 0.207        | 1000.01         |
| ReaderWriterLock write-preference test (50 ops)                          | 15,933         | 0.074         | 0.06             | 0.155        | 1000.03         |
| ReaderWriterLock read-preference test (50 ops)                           | 15,473         | 0.074         | 0.061            | 0.144        | 1000.01         |
| Deferred resolve                                                         | 1,003,856      | 0.001         | 0.001            | 0.004        | 1000            |
| Deferred reject/catch                                                    | 133,475        | 0.008         | 0.007            | 0.051        | 1000            |
| defer callback                                                           | 609,937        | 0.002         | 0.002            | 0.002        | 1000            |
| defer [setTimeout(0)]                                                    | 1,182          | 1.081         | 1.077            | 0.182        | 1001.06         |
| onAbort setup/cleanup                                                    | 775,586        | 0.001         | 0.001            | 0.001        | 1000            |
| Mutex Sequential (1000x) - maxCalls: 1                                   | 828            | 1.581         | 1.092            | 2.062        | 1000.84         |
| Mutex Sequential (1000x) - maxCalls: 5                                   | 821            | 1.544         | 1.073            | 1.654        | 1000.65         |
| Mutex Sequential (1000x) - maxCalls: 10                                  | 866            | 1.329         | 1.067            | 0.902        | 1000.9          |
| Mutex Sequential (1000x) - maxCalls: 20                                  | 895            | 1.24          | 1.068            | 0.765        | 1000.68         |
| Mutex Sequential (1000x) - maxCalls: 50                                  | 846            | 1.403         | 1.055            | 0.941        | 1001.77         |
| Mutex Sequential (1000x) - maxCalls: 100                                 | 894            | 1.258         | 1.045            | 0.777        | 1000.46         |
| Mutex Sequential (1000x) - maxCalls: 1000                                | 920            | 1.267         | 1.044            | 2.515        | 1000.92         |
| Mutex High-freq (500x) - maxCalls: 1                                     | 1,716          | 0.719         | 0.552            | 1.152        | 1000.42         |
| Mutex High-freq (500x) - maxCalls: 5                                     | 1,712          | 0.691         | 0.539            | 0.696        | 1000.49         |
| Mutex High-freq (500x) - maxCalls: 10                                    | 1,780          | 0.637         | 0.538            | 0.578        | 1000.3          |
| Mutex High-freq (500x) - maxCalls: 20                                    | 1,815          | 0.679         | 0.537            | 2.953        | 1000.1          |
| Mutex High-freq (500x) - maxCalls: 50                                    | 1,819          | 0.603         | 0.537            | 0.515        | 1000.39         |
| Mutex High-freq (500x) - maxCalls: 100                                   | 1,813          | 0.602         | 0.536            | 0.491        | 1000.13         |
| Mutex High-freq (500x) - maxCalls: 1000                                  | 1,834          | 0.595         | 0.535            | 0.479        | 1000.35         |
| Mutex Concurrent (20x) - maxCalls: 1                                     | 16,719         | 0.071         | 0.058            | 0.831        | 1000.04         |
| Mutex Concurrent (20x) - maxCalls: 5                                     | 30,918         | 0.037         | 0.031            | 0.106        | 1000.02         |
| Mutex Concurrent (20x) - maxCalls: 10                                    | 35,457         | 0.032         | 0.028            | 0.112        | 1000            |
| Mutex Concurrent (20x) - maxCalls: 20                                    | 38,797         | 0.031         | 0.025            | 0.315        | 1000            |
| Mutex Concurrent (20x) - maxCalls: 50                                    | 39,698         | 0.028         | 0.025            | 0.107        | 1000.02         |
| Mutex Concurrent (20x) - maxCalls: 100                                   | 39,646         | 0.03          | 0.025            | 0.331        | 1000.01         |
| Mutex Concurrent (20x) - maxCalls: 1000                                  | 39,152         | 0.029         | 0.025            | 0.113        | 1000.02         |
| Mutex Ultra-high-freq (2000x) - maxCalls: 1                              | 429            | 2.988         | 2.155            | 4.031        | 1003.9          |
| Mutex Ultra-high-freq (2000x) - maxCalls: 5                              | 450            | 2.43          | 2.108            | 1.233        | 1000.97         |
| Mutex Ultra-high-freq (2000x) - maxCalls: 10                             | 455            | 2.376         | 2.105            | 1.093        | 1000.12         |
| Mutex Ultra-high-freq (2000x) - maxCalls: 20                             | 454            | 2.546         | 2.094            | 3.739        | 1000.65         |
| Mutex Ultra-high-freq (2000x) - maxCalls: 50                             | 458            | 2.333         | 2.095            | 0.956        | 1000.79         |
| Mutex Ultra-high-freq (2000x) - maxCalls: 100                            | 456            | 2.348         | 2.078            | 0.973        | 1000.44         |
| Mutex Ultra-high-freq (2000x) - maxCalls: 1000                           | 457            | 2.339         | 2.102            | 0.97         | 1000.91         |
| Conditional trigger/wait                                                 | 525,765        | 0.002         | 0.002            | 0.006        | 1000            |
| Conditional trigger reaction time                                        | 485,457        | 0.002         | 0.002            | 0.024        | 1000            |
| Conditional multiple waiters with trigger                                | 86,356         | 0.012         | 0.011            | 0.041        | 1000            |
| ManuallyConditional raise/wait                                           | 375,703        | 0.003         | 0.003            | 0.005        | 1000            |
| ManuallyConditional raise reaction time                                  | 366,014        | 0.003         | 0.003            | 0.014        | 1000            |
| ManuallyConditional trigger/wait                                         | 382,759        | 0.003         | 0.003            | 0.027        | 1000            |
| ManuallyConditional trigger reaction time                                | 355,576        | 0.003         | 0.003            | 0.01         | 1000            |
| ManuallyConditional multiple waiters with raise                          | 81,321         | 0.013         | 0.012            | 0.025        | 1000            |
| ManuallyConditional multiple waiters with trigger                        | 78,183         | 0.013         | 0.012            | 0.017        | 1000            |
| Conditional vs ManuallyConditional - single waiter (Conditional)         | 540,861        | 0.002         | 0.002            | 0.004        | 1000            |
| Conditional vs ManuallyConditional - single waiter (ManuallyConditional) | 372,273        | 0.003         | 0.003            | 0.006        | 1000            |
| Conditional vs ManuallyConditional - batch waiters (Conditional)         | 146,693        | 0.007         | 0.007            | 0.004        | 1000.01         |
| Conditional vs ManuallyConditional - batch waiters (ManuallyConditional) | 130,035        | 0.008         | 0.007            | 0.029        | 1000.01         |
| [Comparison] Mutex single acquire/release                                | 259,708        | 0.006         | 0.003            | 0.562        | 1000            |
| [Comparison] Semaphore(1) single acquire/release                         | 299,682        | 0.004         | 0.003            | 0.075        | 1000            |
| [Comparison] Mutex sequential (50x)                                      | 17,488         | 0.074         | 0.054            | 0.849        | 1000.06         |
| [Comparison] Semaphore(1) sequential (50x)                               | 21,430         | 0.056         | 0.044            | 0.197        | 1000.03         |
| [Comparison] RWLock write-only sequential (50x)                          | 19,596         | 0.063         | 0.047            | 0.205        | 1000.01         |
| [Comparison] Mutex concurrent (20x)                                      | 36,904         | 0.032         | 0.026            | 0.122        | 1003.5          |
| [Comparison] Semaphore(1) concurrent (20x)                               | 30,608         | 0.042         | 0.028            | 0.124        | 1000.06         |
| [Comparison] RWLock write-only concurrent (20x)                          | 32,133         | 0.04          | 0.028            | 0.126        | 1000            |
| [Comparison] Semaphore(5) for pool (20 requests)                         | 38,564         | 0.036         | 0.025            | 1.094        | 1000.01         |
| [Comparison] 5 Mutexes round-robin (20 requests)                         | 24,071         | 0.053         | 0.037            | 0.201        | 1000.01         |
| [Comparison] RWLock read-mostly (90% read)                               | 17,228         | 0.066         | 0.056            | 0.172        | 1000.05         |
| [Comparison] Mutex for read-mostly (simulated)                           | 16,288         | 0.076         | 0.06             | 0.825        | 1000.04         |
| [Scenario] Connection Pool - Semaphore(3)                                | 72,053         | 0.016         | 0.014            | 0.1          | 1000.01         |
| [Scenario] Cache - RWLock (70% read, 30% write)                          | 26,320         | 0.044         | 0.037            | 0.173        | 1000.02         |
| [Scenario] Critical Section - Mutex                                      | 49,951         | 0.024         | 0.02             | 0.132        | 1005.46         |
| [HighContention] Mutex (50 concurrent)                                   | 15,432         | 0.073         | 0.064            | 0.192        | 1000            |
| [HighContention] Semaphore(1) (50 concurrent)                            | 15,239         | 0.075         | 0.064            | 0.199        | 1000.05         |
| [HighContention] Semaphore(10) (50 concurrent)                           | 16,618         | 0.071         | 0.058            | 0.228        | 1000.02         |
| [HighContention] RWLock writes (50 concurrent)                           | 15,253         | 0.076         | 0.064            | 0.252        | 1001.12         |
| [HighContention] RWLock reads (50 concurrent)                            | 18,199         | 0.063         | 0.052            | 0.18         | 1000.04         |
| [AsyncOperator] toArray()                                                | 36,727         | 0.028         | 0.026            | 0.024        | 1000.02         |
| [AsyncOperator] toArray() on AsyncIterable                               | 9,192          | 0.112         | 0.106            | 0.045        | 1000.06         |
| [AsyncOperator] map() -> toArray()                                       | 17,498         | 0.06          | 0.055            | 0.047        | 1000            |
| [AsyncOperator] map() -> toArray() on AsyncIterable                      | 5,140          | 0.226         | 0.174            | 0.136        | 1000.44         |
| [AsyncOperator] map(async) -> toArray()                                  | 13,518         | 0.081         | 0.069            | 0.06         | 1000.01         |
| [AsyncOperator] flatMap() -> toArray()                                   | 7,272          | 0.157         | 0.125            | 0.129        | 1000.11         |
| [AsyncOperator] flatMap(async) -> toArray()                              | 6,951          | 0.148         | 0.14             | 0.058        | 1000.06         |
| [AsyncOperator] filter() -> toArray()                                    | 15,020         | 0.071         | 0.063            | 0.048        | 1000.07         |
| [AsyncOperator] filter() -> toArray() on AsyncIterable                   | 6,363          | 0.173         | 0.146            | 0.093        | 1000.11         |
| [AsyncOperator] filter(async) -> toArray()                               | 11,990         | 0.09          | 0.078            | 0.055        | 1000.12         |
| [AsyncOperator] concat() -> toArray()                                    | 18,289         | 0.058         | 0.053            | 0.069        | 1000.02         |
| [AsyncOperator] choose() -> toArray()                                    | 14,735         | 0.074         | 0.064            | 0.052        | 1000.88         |
| [AsyncOperator] slice() -> toArray()                                     | 15,938         | 0.066         | 0.061            | 0.045        | 1000.05         |
| [AsyncOperator] distinct() -> toArray()                                  | 16,856         | 0.063         | 0.056            | 0.047        | 1000.05         |
| [AsyncOperator] distinctBy() -> toArray()                                | 15,943         | 0.067         | 0.059            | 0.067        | 1000.01         |
| [AsyncOperator] skip() -> toArray()                                      | 7,711          | 0.144         | 0.12             | 0.086        | 1000.1          |
| [AsyncOperator] skipWhile() -> toArray()                                 | 14,753         | 0.074         | 0.064            | 0.054        | 1000.05         |
| [AsyncOperator] take() -> toArray()                                      | 15,713         | 0.068         | 0.06             | 0.048        | 1000.01         |
| [AsyncOperator] takeWhile() -> toArray()                                 | 15,307         | 0.072         | 0.06             | 0.053        | 1000.14         |
| [AsyncOperator] pairwise() -> toArray()                                  | 9,951          | 0.115         | 0.091            | 0.084        | 1000.01         |
| [AsyncOperator] zip() -> toArray()                                       | 10,099         | 0.105         | 0.095            | 0.056        | 1000.08         |
| [AsyncOperator] scan() -> toArray()                                      | 11,857         | 0.087         | 0.082            | 0.047        | 1000            |
| [AsyncOperator] union() -> toArray()                                     | 10,105         | 0.102         | 0.096            | 0.047        | 1000.04         |
| [AsyncOperator] unionBy() -> toArray()                                   | 8,533          | 0.132         | 0.107            | 0.079        | 1000.08         |
| [AsyncOperator] intersect() -> toArray()                                 | 12,073         | 0.085         | 0.08             | 0.043        | 1000.03         |
| [AsyncOperator] intersectBy() -> toArray()                               | 10,865         | 0.095         | 0.091            | 0.048        | 1000.05         |
| [AsyncOperator] except() -> toArray()                                    | 12,935         | 0.083         | 0.074            | 0.066        | 1000.01         |
| [AsyncOperator] exceptBy() -> toArray()                                  | 12,592         | 0.081         | 0.078            | 0.044        | 1000.07         |
| [AsyncOperator] chunkBySize() -> toArray()                               | 19,965         | 0.052         | 0.049            | 0.041        | 1000.01         |
| [AsyncOperator] windowed() -> toArray()                                  | 9,945          | 0.104         | 0.097            | 0.048        | 1000.09         |
| [AsyncOperator] flat() -> toArray()                                      | 10,781         | 0.097         | 0.089            | 0.051        | 1000.02         |
| [AsyncOperator] reverse() -> toArray()                                   | 11,057         | 0.094         | 0.089            | 0.048        | 1000.05         |
| [AsyncOperator] toReversed() -> toArray()                                | 11,107         | 0.094         | 0.088            | 0.078        | 1000.05         |
| [AsyncOperator] sort() -> toArray()                                      | 8,306          | 0.123         | 0.117            | 0.048        | 1000.11         |
| [AsyncOperator] toSorted() -> toArray()                                  | 8,700          | 0.12          | 0.11             | 0.055        | 1000.03         |
| [AsyncOperator] forEach()                                                | 41,074         | 0.025         | 0.024            | 0.009        | 1000.02         |
| [AsyncOperator] reduce()                                                 | 39,909         | 0.025         | 0.024            | 0.008        | 1000.02         |
| [AsyncOperator] reduceRight()                                            | 33,283         | 0.03          | 0.029            | 0.014        | 1000.02         |
| [AsyncOperator] some()                                                   | 40,059         | 0.025         | 0.024            | 0.008        | 1000.02         |
| [AsyncOperator] every()                                                  | 40,837         | 0.025         | 0.024            | 0.011        | 1000.02         |
| [AsyncOperator] find()                                                   | 40,632         | 0.025         | 0.024            | 0.008        | 1000.01         |
| [AsyncOperator] findIndex()                                              | 39,717         | 0.026         | 0.024            | 0.011        | 1000.01         |
| [AsyncOperator] at()                                                     | 46,189         | 0.022         | 0.021            | 0.009        | 1000            |
| [AsyncOperator] includes()                                               | 41,313         | 0.025         | 0.024            | 0.011        | 1000.01         |
| [AsyncOperator] indexOf()                                                | 41,459         | 0.024         | 0.024            | 0.008        | 1000.01         |
| [AsyncOperator] lastIndexOf()                                            | 37,385         | 0.027         | 0.026            | 0.009        | 1000.01         |
| [AsyncOperator] findLast()                                               | 40,993         | 0.025         | 0.024            | 0.008        | 1000.01         |
| [AsyncOperator] findLastIndex()                                          | 41,058         | 0.025         | 0.024            | 0.008        | 1000.02         |
| [AsyncOperator] min()                                                    | 38,433         | 0.026         | 0.025            | 0.008        | 1000.02         |
| [AsyncOperator] minBy()                                                  | 36,195         | 0.029         | 0.026            | 0.015        | 1000.02         |
| [AsyncOperator] max()                                                    | 35,691         | 0.031         | 0.026            | 0.019        | 1000.01         |
| [AsyncOperator] maxBy()                                                  | 34,688         | 0.031         | 0.027            | 0.017        | 1000.02         |
| [AsyncOperator] groupBy()                                                | 30,537         | 0.035         | 0.031            | 0.017        | 1000.03         |
| [AsyncOperator] countBy()                                                | 30,991         | 0.034         | 0.031            | 0.014        | 1000.02         |
| [AsyncOperator] join()                                                   | 35,589         | 0.029         | 0.027            | 0.01         | 1000            |
| [AsyncOperator] linear chain(depth=5) -> toArray()                       | 6,558          | 0.156         | 0.151            | 0.057        | 1000.07         |
| [AsyncOperator] linear chain(depth=5, async callbacks) -> toArray()      | 5,525          | 0.186         | 0.176            | 0.069        | 1000.13         |

**Test Environment:** Node.js v24.11.1, linux x64  
**CPU:** Intel(R) Core(TM) i9-9980XE CPU @ 3.00GHz  
**Memory:** 62GB  
**Last Updated:** 2026-04-02

<!-- benchmark-results:end -->

---

## ライセンス

MIT.
