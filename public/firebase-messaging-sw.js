/* Firebase Cloud Messaging service worker for IT Asset Management.
   Must stay at the site root so installed Chrome/Edge PWAs can receive
   background push notifications even when the app window is closed. */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCnybMKpM7Z5gWn49hIsd5ymhFVSVtEuoo',
  authDomain: 'it-asset-diskominfo-batang.firebaseapp.com',
  projectId: 'it-asset-diskominfo-batang',
  storageBucket: 'it-asset-diskominfo-batang.firebasestorage.app',
  messagingSenderId: '1083945766646',
  appId: '1:1083945766646:web:0fbd3b32f88fd34784a6d7'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const n = payload.notification || {};
  const d = payload.data || {};
  const status = String(d.status || '').toLowerCase();
  const trouble = ['trouble','offline','down','error','gangguan','unreachable'].includes(status);
  const title = d.title || n.title || (trouble ? 'Peringatan Gangguan Aset' : 'IT Asset Management');
  const body = d.body || n.body || `${d.assetName || 'Perangkat'}: ${status || 'Ada pembaruan status aset.'}`;

  return self.registration.showNotification(title, {
    body,
    icon: d.icon || n.icon || '/favicon.png',
    badge: d.badge || n.badge || '/favicon.png',
    tag: d.assetId ? `asset-${d.assetId}-${status || 'update'}` : `asset-update-${Date.now()}`,
    renotify: true,
    requireInteraction: trouble,
    data: {
      url: d.url || self.location.origin + '/',
      assetId: d.assetId || ''
    }
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || self.location.origin + '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find(c => c.url.startsWith(self.location.origin) && 'focus' in c);
      if (existing) {
        return existing.focus().then(() => {
          if ('navigate' in existing && existing.url !== target) return existing.navigate(target);
          return existing;
        });
      }
      return self.clients.openWindow(target);
    })
  );
});

self.addEventListener('message', (event) => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
