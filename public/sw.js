const CACHE_NAME = 'it-asset-batang-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() || '' }; }

  const title = data.title || 'IT Asset Management — Diskominfo Batang';
  const options = {
    body: data.body || 'Ada pembaruan pada sistem aset TIK.',
    icon: data.icon || '/src/assets/pemkab-batang.png',
    badge: data.badge || '/src/assets/pemkab-batang.png',
    data: { url: data.url || '/' },
    tag: data.tag || 'it-asset-alert',
    renotify: true
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const existing = list.find(client => 'focus' in client);
    if (existing) {
      existing.navigate(url);
      return existing.focus();
    }
    return clients.openWindow(url);
  }));
});
