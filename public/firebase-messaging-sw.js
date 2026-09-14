/*
 * Background push service worker.
 * Penting: file ini berada di root agar FCM dapat menerima push walaupun
 * tab/PWA sedang ditutup. Chrome/Edge akan menjalankan service worker ini
 * di background ketika ada push dari FCM.
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

const messaging = firebase.messaging();

function isTrouble(status) {
  return ['trouble', 'offline', 'down', 'error', 'gangguan', 'unreachable'].includes(
    String(status || '').trim().toLowerCase()
  );
}

messaging.onBackgroundMessage((payload) => {
  const n = payload.notification || {};
  const d = payload.data || {};
  const status = String(d.status || '').trim().toLowerCase();
  const trouble = isTrouble(status);

  const title = d.title || n.title || (trouble ? 'Peringatan Gangguan Aset' : 'Aset Kembali Aman');
  const body = d.body || n.body || `${d.assetName || 'Perangkat'}: ${status || 'Ada pembaruan status aset.'}`;
  const assetId = d.assetId || '';
  const target = d.url || self.location.origin + '/';

  return self.registration.showNotification(title, {
    body,
    icon: d.icon || n.icon || '/favicon.png',
    badge: d.badge || n.badge || '/favicon.png',
    tag: assetId ? `asset-${assetId}-${status || 'update'}` : `asset-update-${Date.now()}`,
    renotify: true,
    requireInteraction: trouble,
    data: { url: target, assetId }
  });
});

self.addEventListener('push', (event) => {
  // Fallback untuk push payload non-FCM yang mungkin dikirim di masa depan.
  // Jangan tampilkan dua kali jika FCM sudah menangani payload tersebut.
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch (_) { return; }
  if (payload?.from === 'fcm') return;
  if (!payload?.title && !payload?.body) return;

  event.waitUntil(self.registration.showNotification(payload.title || 'IT Asset Management', {
    body: payload.body || '',
    icon: payload.icon || '/favicon.png',
    badge: payload.badge || '/favicon.png',
    data: { url: payload.url || self.location.origin + '/' }
  }));
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

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
