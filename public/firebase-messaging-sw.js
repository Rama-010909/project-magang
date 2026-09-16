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
  const title = n.title || d.title || 'IT Asset Management';
  const body = n.body || d.body || d.diagnosis || `${d.assetName || 'Perangkat'}: ${d.status || 'Ada pembaruan'}`;
  self.registration.showNotification(title, {
    body,
    icon: n.icon || d.icon || '/favicon.png',
    badge: n.badge || d.badge || '/favicon.png',
    tag: d.assetId ? `asset-${d.assetId}` : 'asset-update',
    renotify: true,
    data: { url: d.url || '/', assetId: d.assetId || '' }
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type:'window', includeUncontrolled:true }).then(clients => {
    const existing = clients.find(c => c.url.startsWith(self.location.origin) && 'focus' in c);
    if (existing) return existing.focus().then(() => ('navigate' in existing && existing.url !== target) ? existing.navigate(target) : existing);
    return self.clients.openWindow(target);
  }));
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('message', event => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });


// PWA shell/runtime cache: keeps the installed app usable when the network is
// temporarily unavailable. Firebase messaging continues to work in this same worker.
const APP_CACHE = 'it-asset-pwa-v1';
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Jangan cache Firestore/API atau file yang bersifat dinamis.
  if (url.pathname.startsWith('/api/') || url.pathname.includes('firestore')) return;
  event.respondWith((async () => {
    const cache = await caches.open(APP_CACHE);
    const cached = await cache.match(req);
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok) cache.put(req, fresh.clone());
      return fresh;
    } catch (_) {
      return cached || (req.mode === 'navigate' ? cache.match('/') : Response.error());
    }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== APP_CACHE).map(k => caches.delete(k)))));
});
