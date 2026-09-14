import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { app, db } from './firebase';

const VAPID_KEY = 'BJUtN9rNIvbZiWVGgmEk-acXNUk0QZ8efxYC-RNMXp18ecH-ovVa8sO7tBSq0ns8Jh0i9eeOSHeeWW61tnFQHkE';

export async function registerNotificationServiceWorker() {
  if (!('serviceWorker' in navigator)) throw new Error('Service Worker tidak didukung.');
  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  return registration;
}

export async function enableAssetNotifications() {
  if (!('Notification' in window)) throw new Error('Browser tidak mendukung notifikasi.');
  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Izin notifikasi ditolak. Izinkan notifikasi pada pengaturan situs.');
  if (!(await isSupported().catch(() => false))) throw new Error('FCM Web tidak didukung browser ini. Gunakan Chrome/Edge terbaru melalui HTTPS.');

  const registration = await registerNotificationServiceWorker();
  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  if (!token) throw new Error('Token FCM kosong.');

  await setDoc(doc(db, 'notificationTokens', token), {
    token,
    platform: /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
    userAgent: navigator.userAgent.slice(0, 500),
    enabled: true,
    updatedAt: serverTimestamp()
  }, { merge: true });
  return { permission, token };
}

export function showAssetNotification({ type = 'trouble', asset = {} } = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  const title = type === 'trouble' ? 'Peringatan Aset Trouble' : 'Aset Kembali Aman';
  const body = `${asset.nama || asset.name || 'Perangkat'} (${asset.kodeAset || asset.id || 'tanpa kode'}) • ${asset.status || 'Perlu diperiksa'}${asset.lokasi ? ` • ${asset.lokasi}` : ''}`;
  try {
    const options = { body, tag: `asset-${asset.id || asset.kodeAset || 'alert'}-${type}`, renotify: true, icon: '/favicon.png', badge: '/favicon.png', data: { url: '/' } };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => reg.showNotification(title, options)).catch(() => new Notification(title, options));
    } else new Notification(title, options);
    return true;
  } catch (_) { return false; }
}

export async function updateNotificationPreferences(preferences) {
  localStorage.setItem('asset_notify_trouble', String(!!preferences.notifyTrouble));
  localStorage.setItem('asset_notify_maintenance', String(!!preferences.notifyMaintenance));
}

export async function listenForegroundNotifications(callback) {
  if (!(await isSupported().catch(() => false))) return () => {};
  try {
    const unsubscribe = onMessage(getMessaging(app), payload => {
      const n = payload.notification || {};
      const d = payload.data || {};
      if (Notification.permission === 'granted') {
        showAssetNotification({ type: String(d.status || '').toLowerCase() === 'trouble' ? 'trouble' : 'safe', asset: { nama: n.title || d.title || 'Aset', status: n.body || d.body || d.status, id: d.assetId } });
      }
      callback?.(payload);
    });
    return unsubscribe;
  } catch (_) { return () => {}; }
}
