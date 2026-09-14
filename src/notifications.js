import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { app, db } from './firebase';

const VAPID_KEY = 'BJUtN9rNIvbZiWVGgmEk-acXNUk0QZ8efxYC-RNMXp18ecH-ovVa8sO7tBSq0ns8Jh0i9eeOSHeeWW61tnFQHkE';

let activeRegistration = null;
let activeToken = null;

// Daftarkan token tanpa menampilkan prompt.
// Ini dipakai saat izin notifikasi sudah pernah diberikan pada perangkat.
export async function autoRegisterNotifications() {
  if (!('Notification' in window)) return null;
  if (Notification.permission !== 'granted') return null;
  if (!(await isSupported().catch(() => false))) return null;

  try {
    const registration = await registerNotificationServiceWorker();
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    });
    if (!token) return null;

    activeToken = token;
    await setDoc(doc(db, 'notificationTokens', token), {
      token,
      platform: /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      userAgent: navigator.userAgent.slice(0, 500),
      enabled: true,
      updatedAt: serverTimestamp()
    }, { merge: true });

    return { permission: 'granted', token };
  } catch (error) {
    console.warn('Auto-register notifikasi:', error);
    return null;
  }
}

export async function registerNotificationServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Worker tidak didukung browser ini.');
  }
  // This must be the only root service worker used by the application.
  activeRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
    scope: '/',
    updateViaCache: 'none'
  });
  await navigator.serviceWorker.ready;
  // Force Chrome/Edge to check the newest background worker immediately.
  try { await activeRegistration.update(); } catch (_) {}
  if (activeRegistration.waiting) {
    activeRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
  return activeRegistration;
}

export async function enableAssetNotifications() {
  if (!('Notification' in window)) {
    throw new Error('Browser tidak mendukung notifikasi.');
  }

  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();

  if (permission !== 'granted') {
    throw new Error('Izin notifikasi ditolak. Izinkan notifikasi pada pengaturan situs.');
  }

  if (!(await isSupported().catch(() => false))) {
    throw new Error('FCM Web tidak didukung. Gunakan Chrome/Edge terbaru melalui HTTPS.');
  }

  const registration = await registerNotificationServiceWorker();
  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration
  });

  if (!token) throw new Error('Token FCM kosong.');
  activeToken = token;

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

  const options = {
    body,
    tag: `asset-${asset.id || asset.kodeAset || 'alert'}-${type}`,
    renotify: true,
    icon: '/favicon.png',
    badge: '/favicon.png',
    data: { url: '/' }
  };

  try {
    if (activeRegistration) {
      activeRegistration.showNotification(title, options);
    } else if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => reg.showNotification(title, options)).catch(() => {});
    }
    return true;
  } catch (_) {
    return false;
  }
}

export async function updateNotificationPreferences(preferences) {
  localStorage.setItem('asset_notify_trouble', String(!!preferences.notifyTrouble));
  localStorage.setItem('asset_notify_maintenance', String(!!preferences.notifyMaintenance));
}

export async function listenForegroundNotifications(callback) {
  if (!(await isSupported().catch(() => false))) return () => {};
  try {
    const messaging = getMessaging(app);
    return onMessage(messaging, payload => {
      // Background messages are displayed by firebase-messaging-sw.js.
      // Foreground messages are displayed here so the user also gets feedback
      // while the app is open.
      const n = payload.notification || {};
      const d = payload.data || {};
      // Foreground messages do not get an automatic browser notification.
      // Show one through the active Service Worker.
      if (Notification.permission === 'granted') {
        showAssetNotification({
          type: ['trouble', 'offline', 'down', 'error'].includes(String(d.status || '').toLowerCase()) ? 'trouble' : 'safe',
          asset: {
            nama: d.assetName || n.title || d.title || 'Aset',
            status: d.status || n.body || d.body,
            id: d.assetId
          }
        });
      }
      callback?.(payload);
    });
  } catch (_) {
    return () => {};
  }
}


export async function diagnoseNotifications() {
  const result = {
    https: location.protocol === 'https:' || location.hostname === 'localhost',
    notificationApi: 'Notification' in window,
    permission: 'Notification' in window ? Notification.permission : 'unsupported',
    serviceWorker: 'serviceWorker' in navigator,
    pushManager: 'PushManager' in window,
    fcmToken: !!activeToken
  };
  if (result.serviceWorker) {
    try {
      const reg = await navigator.serviceWorker.ready;
      result.serviceWorkerActive = !!reg.active;
      result.pushSubscription = !!(await reg.pushManager.getSubscription());
    } catch (_) {
      result.serviceWorkerActive = false;
      result.pushSubscription = false;
    }
  }
  return result;
}
