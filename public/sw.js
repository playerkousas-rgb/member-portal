/* Service Worker for member-portal Web Push (shares infrastructure with scout-circulars). */
'use strict';

const NOTIFICATION_ICON = '/icons/notification-192.png';
const NOTIFICATION_BADGE = '/icons/badge-96.png';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

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
      return { ...fallback, body: typeof title === 'string' ? title.slice(0, 250) : fallback.body };
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
    ...(payload.silent ? {} : { vibrate: [100, 40, 100] }),
  };
  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const absoluteTarget = new URL(target, self.location.origin).href;
    const openClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of openClients) {
      if (client.url === absoluteTarget || client.url.startsWith(self.location.origin + '/')) {
        await client.focus();
        if (client.url !== absoluteTarget && 'navigate' in client) await client.navigate(absoluteTarget);
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
