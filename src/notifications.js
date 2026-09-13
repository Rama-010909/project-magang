import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { app, db, firebaseConfig } from './firebase';

const VAPID_KEY = 'BJUtN9rNIvbZiWVGgmEk-acXNUk0QZ8efxYC-RNMXp18ecH-ovVa8sO7tBSq0ns8Jh0i9eeOSHeeWW61tnFQHkE';

export async function registerNotificationServiceWorker() {
  if (!('serviceWorker' in navigator)) throw new Error('Browser tidak mendukung Service Worker.');
  return navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
}

export async function enableAssetNotifications() {
  if (!('Notification' in window)) throw new Error('Browser ini tidak mendukung notifikasi.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Izin notifikasi belum diberikan.');
  const supported = await isSupported().catch(() => false);
  if (!supported) throw new Error('FCM Web tidak didukung oleh browser ini.');
  const registration = await registerNotificationServiceWorker();
  await registration.update().catch(() => {});
  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  if (!token) throw new Error('Token perangkat belum berhasil dibuat.');
  await setDoc(doc(db, 'notificationTokens', token), {
    token,
    platform: /Android/i.test(navigator.userAgent) ? 'android' : 'web',
    userAgent: navigator.userAgent.slice(0, 300),
    enabled: true,
    updatedAt: serverTimestamp()
  }, { merge: true });
  return { permission, token };
}

export function showAssetNotification({ type = 'trouble', asset = {} } = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  const title = type === 'trouble' ? 'Peringatan Aset Trouble/Rusak' : 'Peringatan Maintenance Aset';
  const body = `${asset.nama || 'Perangkat'} (${asset.kodeAset || 'tanpa kode'}) • ${asset.status || 'Perlu diperiksa'}${asset.lokasi ? ` • ${asset.lokasi}` : ''}`;
  try { new Notification(title, { body, tag: `asset-${asset.id || 'alert'}-${type}`, renotify: true, icon: '/favicon.png', badge: '/favicon.png' }); return true; } catch (_) { return false; }
}

export async function updateNotificationPreferences(preferences) {
  localStorage.setItem('asset_notify_trouble', String(!!preferences.notifyTrouble));
  localStorage.setItem('asset_notify_maintenance', String(!!preferences.notifyMaintenance));
}

export async function listenForegroundNotifications(callback) {
  if (!(await isSupported().catch(() => false))) return () => {};
  try { const messaging = getMessaging(app); return onMessage(messaging, payload => callback?.(payload)); } catch (_) { return () => {}; }
}
