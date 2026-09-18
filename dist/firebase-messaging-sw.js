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

/**
 * Tangani pesan latar belakang (FCM Background Message).
 * Berjalan saat aplikasi ditutup di HP (Android) maupun Komputer (Windows/Mac/Linux).
 */
messaging.onBackgroundMessage((payload) => {
  const n = payload.notification || {};
  const d = payload.data || {};
  const statusStr = String(d.status || '').toLowerCase();

  let title = n.title || d.title;
  if (!title) {
    if (statusStr.includes('mati') || statusStr.includes('offline')) {
      title = '🚨 PERINGATAN: Perangkat Mati Terdeteksi!';
    } else if (statusStr.includes('trouble')) {
      title = '⚠️ PERINGATAN: Internet Trouble!';
    } else {
      title = 'IT Asset Monitoring — Diskominfo Batang';
    }
  }

  const body = n.body || d.body || d.diagnosis || `${d.assetName || 'Perangkat'}: ${d.status || 'Ada pembaruan status'}`;

  self.registration.showNotification(title, {
    body,
    icon: n.icon || d.icon || '/favicon.png',
    badge: n.badge || d.badge || '/favicon.png',
    tag: d.assetId ? `asset-${d.assetId}` : 'asset-update',
    renotify: true,
    vibrate: [300, 100, 300],
    data: { url: d.url || '/#monitor', assetId: d.assetId || '' }
  });
});

/**
 * Tangani Web Push API standar (cadangan jika dikirim via raw Web Push VAPID)
 */
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const title = data.title || '⚠️ Peringatan Aset TIK Diskominfo';
    const body = data.body || 'Terdeteksi perubahan status operasional perangkat.';
    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: data.icon || '/favicon.png',
        badge: data.badge || '/favicon.png',
        tag: data.tag || 'it-asset-alert',
        renotify: true,
        vibrate: [300, 100, 300],
        data: { url: data.url || '/' }
      })
    );
  } catch (_) {
    // Payload bukan JSON, tampilkan teks mentah
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('Peringatan Monitoring', {
        body: text,
        icon: '/favicon.png',
        badge: '/favicon.png'
      })
    );
  }
});

/**
 * Periodic Background Sync:
 * Bangunkan Service Worker secara berkala di latar belakang untuk mengecek status aset
 * pada browser HP (Chrome Android) dan Komputer (Edge/Chrome Desktop).
 */
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-asset-status') {
    event.waitUntil(
      fetch('/api/monitor?check=1')
        .then(res => res.json())
        .then(result => {
          if (result && result.alerts && result.alerts.length > 0) {
            const first = result.alerts[0];
            self.registration.showNotification('⚠️ Monitoring Latar Belakang: Gangguan Terdeteksi', {
              body: `${result.alerts.length} perangkat memerlukan tindakan. Contoh: ${first.nama} (${first.status}).`,
              icon: '/favicon.png',
              badge: '/favicon.png',
              tag: 'periodic-alert',
              renotify: true,
              data: { url: '/#monitor' }
            });
          }
        })
        .catch(() => {})
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url.startsWith(self.location.origin) && 'focus' in c);
      if (existing) {
        return existing.focus().then(() => ('navigate' in existing && existing.url !== target) ? existing.navigate(target) : existing);
      }
      return self.clients.openWindow(target);
    })
  );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// PWA Shell Cache
const APP_CACHE = 'it-asset-pwa-v2';
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.includes('firestore')) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(APP_CACHE);
      const cached = await cache.match(req);
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      } catch (_) {
        return cached || (req.mode === 'navigate' ? cache.match('/') : Response.error());
      }
    })()
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== APP_CACHE).map(k => caches.delete(k))))
  );
});
