/**
 * 唯讀 GET 快取嘅純函數測試：fresh／stale／過期、copy 隔離、single-flight、上限。
 * 呢層快取只放入 proxy sanitizeGet 之後嘅公開資料；提交同 getSystem 唔會經佢。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReadCache } from '../lib/readCache';

test('TTL 內 fresh；過期但未過 maxStale 標 stale；再耐就清走', () => {
  let now = 1_000;
  const cache = new ReadCache<unknown>({ now: () => now, maxStaleMs: 500 });
  cache.set('k', { troops: [1] }, 1_000);

  assert.deepEqual(cache.lookup('k'), { value: { troops: [1] }, state: 'fresh' });
  now = 1_900;
  assert.equal(cache.lookup('k')?.state, 'fresh');
  now = 2_100;
  assert.equal(cache.lookup('k')?.state, 'stale');
  now = 2_600;
  assert.equal(cache.lookup('k'), null);
  assert.equal(cache.size, 0);
});

test('lookup 回傳 copy，呼叫方改極都唔會污染快取', () => {
  const cache = new ReadCache<{ rows: number[] }>({ now: () => 0 });
  cache.set('k', { rows: [1, 2] }, 10_000);
  const first = cache.lookup('k')!;
  first.value.rows.push(3);
  assert.deepEqual(cache.lookup('k')!.value, { rows: [1, 2] });
});

test('single-flight：同一 key 並行請求只會呼叫一次 loader', async () => {
  const cache = new ReadCache<number>({ now: () => 0 });
  let calls = 0;
  const loader = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return 42;
  };
  const [a, b, c] = await Promise.all([
    cache.run('same', loader),
    cache.run('same', loader),
    cache.run('other', loader),
  ]);
  assert.deepEqual([a, b, c], [42, 42, 42]);
  assert.equal(calls, 2, '不同 key 各一次；相同 key 共用一個 Promise');
});

test('loader 失敗後 flight 要清走，下次可以重試', async () => {
  const cache = new ReadCache<number>({ now: () => 0 });
  let attempt = 0;
  const loader = async () => {
    attempt += 1;
    if (attempt === 1) throw new Error('upstream down');
    return 7;
  };
  await assert.rejects(() => cache.run('k', loader), /upstream down/);
  assert.equal(await cache.run('k', loader), 7);
});

test('maxEntries 上限：超額刪最舊，唔會無限累積', () => {
  const cache = new ReadCache<number>({ now: () => 0, maxEntries: 2 });
  cache.set('a', 1, 60_000);
  cache.set('b', 2, 60_000);
  cache.set('c', 3, 60_000);
  assert.equal(cache.size, 2);
  assert.equal(cache.lookup('a'), null);
  assert.equal(cache.lookup('c')?.value, 3);
  cache.clear();
  assert.equal(cache.size, 0);
});

test('ttl <= 0 唔會寫入；set 唔接受負數', () => {
  const cache = new ReadCache<number>({ now: () => 0 });
  cache.set('a', 1, 0);
  cache.set('b', 1, -1);
  assert.equal(cache.size, 0);
});
