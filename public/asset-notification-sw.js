self.addEventListener('install', event => { event.waitUntil(self.skipWaiting()); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = { body: event.data ? event.data.text() : '' }; }
  const notification = data.notification || {};
  const title = data.title || notification.title || 'IT Asset Management';
  const body = data.body || notification.body || 'Ada pembaruan pada sistem aset.';
  const options = {
    body,
    icon: data.icon || notification.icon || '/favicon.png',
    badge: data.badge || '/favicon.png',
    tag: data.tag || 'asset-update',
    data: data.data || {},
    renotify: true
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    if (list.length) return list[0].focus();
    return self.clients.openWindow('/');
  }));
});
