/**
 * Service worker 原始碼（由 `app/sw.js/route.ts` 喺每次 request 注入 build 版本後輸出）。
 *
 * 三件事，全部係本平台自己嘅決定：
 *   1. Web Push：沿用通告圖書館既有協定（唔改動）；
 *   2. 靜態資源快取：只快取本站 JS/CSS/圖示/manifest 等靜態檔，減少重複下載；
 *      版本化 cache 名，每次 platform build 自動換新。HTML、RSC、`/api/*`、
 *      POST、跨 origin 一律唔接管，亦冇離線頁面回落；
 *   3. 已加入主畫面嘅 APP 更新：呢個**唯一**參考 BOOK 嘅部分——版本化 SW →
 *      waiting → SKIP_WAITING → controllerchange → reload，令用戶唔使刪除／
 *      重新加入主畫面就換新版，而且唔會靜靜自動重載未提交表格。
 *
 * 唔預快取 app shell、唔做 navigation network-first、唔套用其他專案嘅部署
 * 或 iframe 設定。`public/sw.js` 已改由 route 產生：每次 build 將
 * `NEXT_PUBLIC_PORTAL_BUILD_VERSION` 寫入本文，已安裝 APP 嘅 `reg.update()`
 * 先會偵測到 byte 改變。
 *
 * 注意：唔好喺呢個 template string 入面用 backtick 或 ${...}。
 */
export const SERVICE_WORKER_SOURCE = String.raw`/* member-portal service worker — Web Push、靜態資源快取、加入主畫面後版本更新 */
'use strict';

const BUILD_VERSION = __PORTAL_BUILD_VERSION__;
const CACHE_PREFIX = 'member-portal-static-';
const CACHE_NAME = CACHE_PREFIX + BUILD_VERSION;
const NOTIFICATION_ICON = '/icons/icon-192.png';
const NOTIFICATION_BADGE = '/icons/badge-96.png';

/* 只快取呢啲同 origin 靜態路徑；其餘（頁面、API、RSC、POST、跨域）一律唔接管。 */
const STATIC_PATHS = [
  /^\/_next\/static\//,
  /^\/icons\//,
  /^\/favicon\.ico$/,
  /^\/manifest\.webmanifest$/,
  /^\/push-client\.js$/,
];
const MUTABLE_STATIC_PATHS = [
  /^\/manifest\.webmanifest$/,
  /^\/push-client\.js$/,
];

function isStaticAsset(url, request) {
  if (request.method !== 'GET' || url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/api/') || url.pathname === '/sw.js') return false;
  if (request.mode === 'navigate') return false;
  return STATIC_PATHS.some(pattern => pattern.test(url.pathname));
}

function isMutableStatic(url) {
  return MUTABLE_STATIC_PATHS.some(pattern => pattern.test(url.pathname));
}

/* 唔自動 skipWaiting：新 worker 裝好會停喺 waiting，等用戶按「立即更新」
   先叫佢接手，避免無故中斷未提交嘅表格。淨係開一個新版本 cache，唔預載檔案。 */
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  let url;
  try { url = new URL(request.url); } catch (_) { return; }
  if (!isStaticAsset(url, request)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    // manifest／push-client.js 未必跟 build hash 改，先攞網絡，失敗先用快取。
    if (isMutableStatic(url)) {
      try {
        const response = await fetch(request);
        if (response && response.ok) await cache.put(request, response.clone());
        return response;
      } catch (error) {
        if (cached) return cached;
        throw error;
      }
    }
    // hashed JS/CSS／圖示：快取命中就直接回，唔使重複下載；miss 先上網並入快取。
    if (cached) return cached;
    const response = await fetch(request);
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  })());
});

/* ── Web Push（沿用 scout-circulars 共用協定，唔改動） ── */
function asPayload(raw) {
  const fallback = {
    title: '🔔 童軍通告',
    body: '有新通告，點擊查看',
    url: 'https://scout-circulars.vercel.app/',
    tag: 'scout-circulars-personal',
  };
  if (!raw) return fallback;
  try {
    const value = raw.json();
    if (!value || typeof value !== 'object') return fallback;
    return {
      title: typeof value.title === 'string' && value.title ? value.title : fallback.title,
      body: typeof value.body === 'string' ? value.body : fallback.body,
      url: typeof value.url === 'string' && value.url ? value.url : fallback.url,
      tag: typeof value.tag === 'string' && value.tag ? value.tag.slice(0, 120) : fallback.tag,
      count: Number(value.count) || 1,
      batchDate: typeof value.batchDate === 'string' ? value.batchDate : '',
      silent: value.silent === true,
    };
  } catch (_) {
    try {
      const title = raw.text();
      return Object.assign({}, fallback, { body: typeof title === 'string' ? title.slice(0, 250) : fallback.body });
    } catch (__) {
      return fallback;
    }
  }
}

self.addEventListener('push', event => {
  const payload = asPayload(event.data);
  const options = {
    body: payload.body,
    tag: payload.tag,
    renotify: false,
    silent: payload.silent,
    data: { url: payload.url, count: payload.count, batchDate: payload.batchDate },
    badge: NOTIFICATION_BADGE,
    icon: NOTIFICATION_ICON,
  };
  if (!payload.silent) options.vibrate = [100, 40, 100];
  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url)
    || 'https://scout-circulars.vercel.app/';
  event.waitUntil((async () => {
    const absoluteTarget = new URL(target, self.location.origin).href;
    const targetOrigin = new URL(absoluteTarget).origin;
    const sameOrigin = targetOrigin === self.location.origin;
    const openClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of openClients) {
      if (client.url === absoluteTarget) {
        await client.focus();
        return;
      }
      if (sameOrigin && client.url.startsWith(self.location.origin + '/')) {
        await client.focus();
        if (client.url !== absoluteTarget && 'navigate' in client) await client.navigate(absoluteTarget);
        return;
      }
      if (!sameOrigin && client.url.startsWith(targetOrigin + '/')) {
        await client.focus();
        return;
      }
    }
    return self.clients.openWindow(absoluteTarget);
  })());
});

self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    clients.forEach(client => client.postMessage({ type: 'scout-push-subscription-change' }));
  }));
});
`;
