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

function buildNotification(payload) {
  const n = (payload && payload.notification) || {};
  const d = (payload && payload.data) || {};
  const statusStr = String(d.status || n.title || '').toLowerCase();

  let title = n.title || d.title || '';
  if (!title) {
    if (statusStr.includes('mati') || statusStr.includes('offline')) {
      title = 'MONITORING  |  Perangkat Offline';
    } else if (statusStr.includes('trouble')) {
      title = 'MONITORING  |  Gangguan Internet';
    } else {
      title = 'MONITORING  |  Diskominfo Batang';
    }
  }

  // Hapus emoji sisa jika ada
  title = String(title).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim();

  const body = n.body || d.body || d.diagnosis ||
    ((d.assetName || d.nama || 'Perangkat') + ': ' + (d.status || 'Ada pembaruan status'));

  return {
    title,
    options: {
      body: String(body).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim(),
      icon: n.icon || d.icon || '/favicon.png',
      badge: n.badge || d.badge || '/favicon.png',
      tag: d.assetId ? ('asset-' + d.assetId) : (d.tag || 'asset-update'),
      renotify: true,
      requireInteraction: statusStr.includes('mati') || statusStr.includes('offline'),
      vibrate: [300, 100, 300],
      data: {
        url: d.url || '/#monitor',
        assetId: d.assetId || ''
      }
    }
  };
}

/**
 * Background message (aplikasi tertutup / di background).
 * Wajib agar notifikasi muncul TANPA membuka aplikasi.
 */
messaging.onBackgroundMessage((payload) => {
  const { title, options } = buildNotification(payload || {});
  return self.registration.showNotification(title, options);
});

/**
 * Cadangan Web Push API
 */
self.addEventListener('push', (event) => {
  if (!event.data) return;
  event.waitUntil((async () => {
    let payload = {};
    try {
      payload = event.data.json();
    } catch (_) {
      payload = { notification: { title: 'Peringatan Monitoring', body: event.data.text() } };
    }
    // Jika FCM sudah menampilkan notification otomatis, payload.notification
    // tetap kita tampilkan lewat SW agar konsisten di semua browser.
    const { title, options } = buildNotification(payload);
    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag !== 'check-asset-status') return;
  event.waitUntil(
    fetch('/api/monitor?check=1')
      .then((res) => res.json())
      .then((result) => {
        if (!result || !result.alerts || !result.alerts.length) return;
        const first = result.alerts[0];
        return self.registration.showNotification(
          'MONITORING  |  Gangguan Terdeteksi',
          {
            body:
              result.alerts.length +
              ' perangkat memerlukan tindakan. Contoh: ' +
              first.nama +
              ' (' +
              first.status +
              ').',
            icon: '/favicon.png',
            badge: '/favicon.png',
            tag: 'periodic-alert',
            renotify: true,
            data: { url: '/#monitor' }
          }
        );
      })
      .catch(() => {})
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(
    (event.notification.data && event.notification.data.url) || '/',
    self.location.origin
  ).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find(
        (c) => c.url.startsWith(self.location.origin) && 'focus' in c
      );
      if (existing) {
        return existing.focus().then(() =>
          'navigate' in existing && existing.url !== target
            ? existing.navigate(target)
            : existing
        );
      }
      return self.clients.openWindow(target);
    })
  );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

const APP_CACHE = 'it-asset-pwa-v3';
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
