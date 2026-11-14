/**
 * Service worker 行為測試（無瀏覽器，用 vm 真跑一次 SW 原始碼）。
 *
 * 覆蓋：版本注入、A2HS 更新生命週期、本站靜態資源快取邊界、Web Push。
 * 唔快取 HTML／RSC／API／POST／跨域；冇離線頁面回落、冇 app shell 預快取。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

process.env.NEXT_PUBLIC_PORTAL_BUILD_VERSION = 'build-sw-test-1';
const { SERVICE_WORKER_SOURCE } = await import('../lib/serviceWorkerSource.ts');
const { GET } = await import('../app/sw.js/route.ts');

const BUILD_VERSION = 'build-sw-test-1';

function loadServiceWorker(options = {}) {
  const handlers = {};
  const cacheStore = new Map(options.initialCache || []);
  const calls = {
    skipWaiting: 0, claim: 0, notifications: [], cacheNames: [],
    cacheDeletes: [], cachePuts: [], addAll: 0, fetches: [],
  };
  const cache = {
    match: async (request) => {
      const hit = cacheStore.get(request.url);
      return hit ? hit.clone() : null;
    },
    put: async (request, response) => {
      calls.cachePuts.push(request.url);
      cacheStore.set(request.url, response.clone());
    },
    addAll: async () => { calls.addAll += 1; },
  };
  const sandbox = {
    self: {
      location: { origin: 'https://member.test' },
      addEventListener: (type, fn) => { handlers[type] = fn; },
      skipWaiting: () => { calls.skipWaiting += 1; },
      clients: {
        claim: async () => { calls.claim += 1; },
        matchAll: async () => [],
        openWindow: async () => undefined,
      },
      registration: {
        showNotification: async (title, opts) => { calls.notifications.push({ title, options: opts }); },
      },
    },
    caches: {
      open: async (name) => { calls.cacheNames.push(name); return cache; },
      keys: async () => options.cacheKeys || [],
      delete: async (key) => { calls.cacheDeletes.push(key); return true; },
    },
    fetch: async (request) => {
      calls.fetches.push(request.url);
      if (options.network) return options.network(request);
      return new Response('asset-body', { status: 200 });
    },
    Response,
    URL,
    console,
  };
  sandbox.self.self = sandbox.self;
  vm.createContext(sandbox);
  const source = SERVICE_WORKER_SOURCE.replace('__PORTAL_BUILD_VERSION__', JSON.stringify(BUILD_VERSION));
  vm.runInContext(source, sandbox);
  return { handlers, calls, cacheStore, cache, sandbox, source };
}

function fetchEvent(request, handlers) {
  let promise = null;
  handlers.fetch({ request, respondWith: (value) => { promise = value; } });
  return promise;
}

test('/sw.js route：注入 build 版本、JS MIME、no-store；唔套用其他專案嘅 SW header', async () => {
  const response = GET();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /javascript/);
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
  assert.equal(response.headers.get('service-worker-allowed'), null);
  const body = await response.text();
  assert.ok(body.includes('"' + BUILD_VERSION + '"'), '版本寫入 SW 本文，byte 先會隨 build 改變');
  assert.ok(!body.includes('__PORTAL_BUILD_VERSION__'));
  assert.ok(body.includes("addEventListener('push'"), '推播邏輯唔可以唔見');
  assert.ok(body.includes('STATIC_PATHS'), '要保留本站靜態資源快取');
  for (const banned of ['SHELL =', 'addAll(', 'offlineFallback', 'navigationPreload', 'X-Frame-Options']) {
    assert.ok(!body.includes(banned), `唔應該有其他專案嘅離線／部署設定：${banned}`);
  }
});

test('SW install：開版本化 cache 但唔 skipWaiting、唔預快取 app shell', async () => {
  const { handlers, calls } = loadServiceWorker();
  let install;
  handlers.install({ waitUntil: (promise) => { install = promise; } });
  await install;
  assert.equal(calls.skipWaiting, 0);
  assert.deepEqual(calls.cacheNames, ['member-portal-static-' + BUILD_VERSION]);
  assert.equal(calls.addAll, 0);
  assert.deepEqual(calls.cachePuts, []);
});

test('SW activate：只清舊嘅本站 cache，再 clients.claim()', async () => {
  const { handlers, calls } = loadServiceWorker({
    cacheKeys: ['member-portal-static-old', 'member-portal-static-' + BUILD_VERSION, 'unrelated-cache'],
  });
  let activate;
  handlers.activate({ waitUntil: (promise) => { activate = promise; } });
  await activate;
  assert.equal(calls.claim, 1);
  assert.deepEqual(calls.cacheDeletes, ['member-portal-static-old']);
});

test('SW message：收到 SKIP_WAITING 先 skipWaiting，其他訊息唔理', () => {
  const { handlers, calls } = loadServiceWorker();
  handlers.message({ data: { type: 'SKIP_WAITING' } });
  assert.equal(calls.skipWaiting, 1);
  handlers.message({ data: { type: 'PING' } });
  assert.equal(calls.skipWaiting, 1);
});

test('靜態 JS/CSS／圖示：hashed 檔 cache-first，miss 先上網並入版本 cache', async () => {
  const url = 'https://member.test/_next/static/chunks/app.js';
  const { handlers, calls, cacheStore } = loadServiceWorker();
  const request = { url, method: 'GET', mode: 'cors' };
  const response = await fetchEvent(request, handlers);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'asset-body');
  assert.deepEqual(calls.fetches, [url]);
  assert.deepEqual(calls.cachePuts, [url]);
  assert.ok(cacheStore.has(url));

  calls.fetches.length = 0;
  calls.cachePuts.length = 0;
  const cached = await fetchEvent(request, handlers);
  assert.equal(await cached.text(), 'asset-body');
  assert.deepEqual(calls.fetches, [], '命中快取唔應該再下載');
  assert.deepEqual(calls.cachePuts, []);
});

test('manifest／push-client.js：network-first，斷網時先用已快取版本', async () => {
  const url = 'https://member.test/manifest.webmanifest';
  let offline = false;
  const { handlers, calls, cacheStore } = loadServiceWorker({
    initialCache: [[url, new Response('cached-manifest', { status: 200 })]],
    network: async () => {
      if (offline) throw new Error('offline');
      return new Response('fresh-manifest', { status: 200 });
    },
  });
  const request = { url, method: 'GET', mode: 'cors' };
  const fresh = await fetchEvent(request, handlers);
  assert.equal(await fresh.text(), 'fresh-manifest');
  assert.deepEqual(calls.fetches, [url]);
  assert.equal(await cacheStore.get(url).clone().text(), 'fresh-manifest');

  offline = true;
  const fallback = await fetchEvent(request, handlers);
  assert.equal(await fallback.text(), 'fresh-manifest', '斷網用最後成功嘅靜態檔，唔係 app shell');
});

test('唔接管 HTML／RSC／API／POST／SW 本身／跨域：冇離線頁面回落', () => {
  const { handlers, calls } = loadServiceWorker();
  const requests = [
    { method: 'GET', mode: 'navigate', url: 'https://member.test/troops' },
    { method: 'GET', mode: 'cors', url: 'https://member.test/troops?_rsc=abc' },
    { method: 'GET', mode: 'cors', url: 'https://member.test/api/proxy?action=listItems' },
    { method: 'GET', mode: 'cors', url: 'https://member.test/api/version' },
    { method: 'POST', mode: 'cors', url: 'https://member.test/_next/static/chunks/app.js' },
    { method: 'GET', mode: 'cors', url: 'https://member.test/sw.js' },
    { method: 'GET', mode: 'cors', url: 'https://cdn.example/_next/static/chunks/app.js' },
  ];
  for (const request of requests) {
    assert.equal(fetchEvent(request, handlers), null, `${request.url} 唔應該由 SW 回應／快取`);
  }
  assert.deepEqual(calls.fetches, []);
  assert.deepEqual(calls.cachePuts, []);
});

test('SW push：沿用通告推播協定，標題同圖示唔變', async () => {
  const { handlers, calls } = loadServiceWorker();
  let push;
  handlers.push({
    data: { json: () => ({ title: '📢 測試通告', body: '內容', url: 'https://scout-circulars.vercel.app/' }) },
    waitUntil: (promise) => { push = promise; },
  });
  await push;
  assert.equal(calls.notifications.length, 1);
  assert.equal(calls.notifications[0].title, '📢 測試通告');
  assert.equal(calls.notifications[0].options.icon, '/icons/icon-192.png');
  assert.equal(typeof handlers.notificationclick, 'function');
});
