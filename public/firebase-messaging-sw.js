/*
 * Firebase Cloud Messaging service worker.
 *
 * This worker is the background receiver for BOTH desktop Chrome/Edge PWA
 * and mobile browsers/PWA. Once the device has granted notification
 * permission and obtained an FCM token, the page itself does NOT need to be
 * open for push notifications to be displayed.
 */
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

// Initialize FCM so the browser's FCM push subscription is handled correctly.
const messaging = firebase.messaging();

const DEFAULT_ICON = '/favicon.png';
const DEFAULT_URL = self.location.origin + '/';

function showPushNotification(payload) {
  const notification = payload?.notification || {};
  const data = payload?.data || {};

  const title = notification.title || data.title || 'IT Asset Management';
  const body = notification.body || data.body ||
    `${data.assetName || 'Perangkat'}: ${data.status || 'Ada pembaruan'}`;

  const options = {
    body,
    icon: notification.icon || data.icon || DEFAULT_ICON,
    badge: notification.badge || data.badge || DEFAULT_ICON,
    tag: data.assetId
      ? `asset-${data.assetId}-${data.status || 'update'}`
      : `asset-update-${Date.now()}`,
    renotify: true,
    requireInteraction: String(data.status || '').toLowerCase() === 'trouble',
    data: {
      url: data.url || notification.click_action || DEFAULT_URL,
      assetId: data.assetId || ''
    }
  };

  return self.registration.showNotification(title, options);
}

/*
 * Handle the raw Web Push event ourselves. This is deliberately independent
 * of the React page, so it also works while the installed PWA is closed.
 */
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch (_) {
    payload = { data: { body: event.data.text() } };
  }

  event.waitUntil(showPushNotification(payload));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || DEFAULT_URL;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) =>
        client.url.startsWith(self.location.origin) && 'focus' in client
      );

      if (existing) {
        return existing.focus().then(() => {
          if ('navigate' in existing && existing.url !== target) {
            return existing.navigate(target);
          }
          return existing;
        });
      }

      return self.clients.openWindow(target);
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
