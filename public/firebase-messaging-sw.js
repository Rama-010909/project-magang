/* Firebase Cloud Messaging service worker. Do not register another root SW. */
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
  const title = d.title || n.title || 'IT Asset Management';
  const body = d.body || n.body || 'Ada pembaruan status aset.';
  self.registration.showNotification(title, {
    body,
    icon: d.icon || n.icon || '/favicon.png',
    badge: d.badge || n.badge || '/favicon.png',
    tag: d.assetId ? `asset-${d.assetId}` : 'asset-update',
    renotify: true,
    requireInteraction: ['trouble', 'offline', 'down', 'error'].includes(String(d.status || '').toLowerCase()),
    data: { url: d.url || '/' }
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find(client => 'focus' in client);
      if (existing) {
        existing.navigate?.(url);
        return existing.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});


