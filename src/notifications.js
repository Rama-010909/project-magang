export async function registerNotificationServiceWorker() {
  if (!('serviceWorker' in navigator)) throw new Error('Browser tidak mendukung Service Worker.');
  return navigator.serviceWorker.register('/asset-notification-sw.js');
}

export async function enableAssetNotifications() {
  if (!('Notification' in window)) throw new Error('Browser ini tidak mendukung notifikasi.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Izin notifikasi belum diberikan.');
  await registerNotificationServiceWorker().catch(() => {});
  return { permission };
}

export function showAssetNotification({ type = 'trouble', asset = {} } = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  const title = type === 'trouble' ? 'Peringatan Aset Trouble/Rusak' : 'Peringatan Maintenance Aset';
  const status = asset.status || (type === 'trouble' ? 'Rusak' : 'Maintenance');
  const body = `${asset.nama || 'Perangkat'} (${asset.kodeAset || 'tanpa kode'}) • ${status}${asset.lokasi ? ` • ${asset.lokasi}` : ''}`;
  try {
    const n = new Notification(title, {
      body,
      tag: `asset-${asset.id || 'alert'}-${type}`,
      renotify: true,
      icon: '/favicon.ico',
      badge: '/favicon.ico'
    });
    n.onclick = () => {
      window.focus();
      if (asset.id) window.location.hash = `asset=${asset.id}`;
      n.close();
    };
    return true;
  } catch (e) {
    console.info('Browser notification:', e);
    return false;
  }
}

export async function updateNotificationPreferences(preferences) {
  localStorage.setItem('asset_notify_trouble', String(!!preferences.notifyTrouble));
  localStorage.setItem('asset_notify_maintenance', String(!!preferences.notifyMaintenance));
}

export function listenForegroundNotifications() {
  return () => {};
}
