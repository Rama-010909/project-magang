/**
 * Serverless Monitor & Push Notification API (Gratis - Vercel Hobby + Firebase Spark)
 * ---------------------------------------------------------------------------------
 * Pakai Firebase Admin SDK untuk baca/tulis Firestore (melewati security rules).
 *
 * 2 MODE:
 * 1. MODE BACA (tanpa header rahasia) - ringkasan status, TIDAK kirim push.
 * 2. MODE KIRIM PUSH (Authorization: Bearer <CRON_SECRET>) - GitHub Actions tiap 5 menit.
 *
 * PERBAIKAN:
 * - Saat offline/mati, collection "assets" ikut di-update (status + statusLive)
 *   supaya Dashboard & Data Aset sinkron dengan halaman Monitoring.
 * - Saat kembali online, status di-restore ke Aktif.
 * - Token FCM invalid otomatis dibersihkan.
 *
 * ENV: FIREBASE_SERVICE_ACCOUNT, CRON_SECRET
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

const STALE_MS = 45 * 1000;
const RENOTIFY_MS = 15 * 60 * 1000;

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT env var belum diisi di Vercel.');
  return initializeApp({ credential: cert(JSON.parse(raw)) });
}

function toMillis(v) {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v === 'object' && typeof v.seconds === 'number') {
    return v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6);
  }
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : 0;
}

function isStale(st) {
  return (Date.now() - toMillis(st.checkedAt)) > STALE_MS;
}

function isMatiStatus(st) {
  // Internet Trouble berarti perangkat masih hidup & terjangkau
  const net = String(st.internetStatus || '').toLowerCase();
  const stt = String(st.status || '').toLowerCase();
  if (net.includes('internet trouble') || stt === 'trouble') return false;
  if (st.online === true) return false;
  if (String(st.deviceStatus || '') === 'Online') return false;
  return (
    st.online === false ||
    st.deviceStatus === 'Mati' ||
    st.status === 'offline' ||
    String(st.deviceStatus || '').toLowerCase() === 'offline'
  );
}

function computeAlerts(monitorStatuses) {
  const alerts = [];
  const summary = {
    totalMonitored: monitorStatuses.length,
    onlineNormal: 0,
    offlineMati: 0,
    internetTrouble: 0,
    dataBasi: 0
  };

  monitorStatuses.forEach(st => {
    const stale = isStale(st);
    const net = String(st.internetStatus || '').toLowerCase();
    const stt = String(st.status || '').toLowerCase();
    if (net.includes('internet trouble') || stt === 'trouble') {
      st.online = true;
      st.deviceStatus = 'Online';
    }
    const isMati = isMatiStatus(st);
    const isTrouble =
      !isMati &&
      !stale &&
      (net.includes('internet trouble') || stt === 'trouble' ||
        (st.internetStatus === 'Internet Trouble' && st.internetOnline === false));
    const isNormal =
      st.online === true &&
      !stale &&
      (st.internetStatus === 'Normal' || st.internetOnline === true);

    if (stale && !isMati) {
      summary.dataBasi++;
      alerts.push({
        id: st.id,
        nama: st.nama || st.kodeAset || 'Perangkat',
        type: 'stale',
        status: 'Tidak Ada Laporan Terbaru',
        reason: 'Belum ada update status baru dalam 45 detik terakhir'
      });
    } else if (isMati) {
      summary.offlineMati++;
      alerts.push({
        id: st.id,
        nama: st.nama || st.kodeAset || 'Perangkat',
        type: 'mati',
        status: 'Perangkat Mati / Offline',
        reason: st.reason || 'Tidak merespons jaringan'
      });
    } else if (isTrouble) {
      summary.internetTrouble++;
      alerts.push({
        id: st.id,
        nama: st.nama || st.kodeAset || 'Perangkat',
        type: 'trouble',
        status: 'Internet Trouble',
        reason: st.internetReason || st.reason || 'Koneksi WAN terputus'
      });
    } else if (isNormal) {
      summary.onlineNormal++;
    }
  });

  return { alerts, summary };
}

/**
 * Sinkronkan status live ke dokumen assets supaya Dashboard & Data Aset
 * menampilkan Offline/Online yang sama dengan halaman Monitoring.
 */
async function syncAssetsStatus(db, monitorStatuses) {
  const batch = db.batch();
  let ops = 0;
  const now = FieldValue.serverTimestamp();

  for (const st of monitorStatuses) {
    if (!st.id) continue;
    const stale = isStale(st);
    const net = String(st.internetStatus || '').toLowerCase();
    const stt = String(st.status || '').toLowerCase();
    // Self-heal: trouble internet = perangkat masih online
    if (net.includes('internet trouble') || stt === 'trouble') {
      st.online = true;
      st.deviceStatus = 'Online';
    }
    const isMati = isMatiStatus(st);
    const isOnline = st.online === true && !stale;
    const isTrouble =
      !isMati &&
      (net.includes('internet trouble') || stt === 'trouble' ||
        (st.internetStatus === 'Internet Trouble' && st.internetOnline === false));

    const patch = {
      lastMonitorAt: now,
      lastMonitorReason: st.reason || '',
      lastMonitorSource: st.source || 'monitor-api'
    };

    if (isMati) {
      patch.status = 'Offline';
      patch.statusLive = 'Offline';
      patch.online = false;
    } else if (isTrouble) {
      // Perangkat tetap ONLINE — hanya internet yang bermasalah
      patch.statusLive = 'Online';
      patch.online = true;
      patch.status = 'Aktif';
      patch.internetStatus = 'Internet Trouble';
    } else if (isOnline) {
      patch.statusLive = 'Online';
      patch.online = true;
      patch.internetStatus = st.internetStatus || 'Normal';
      patch.status = 'Aktif';
    } else if (stale) {
      patch.statusLive = 'Tidak Terjangkau';
    } else {
      continue;
    }

    const ref = db.collection('assets').doc(String(st.id));
    batch.set(ref, patch, { merge: true });
    ops++;
    if (ops >= 450) break;
  }

  if (ops > 0) await batch.commit();
  return { synced: ops };
}

async function sendPushForAlerts(db, alerts) {
  if (alerts.length === 0) return { sent: 0, skippedDebounced: 0 };

  const now = Date.now();
  const stateRefs = alerts.map(a =>
    db.collection('notificationState').doc(`${a.id}_${a.type}`)
  );
  const stateSnaps = await db.getAll(...stateRefs);

  const toSend = alerts.filter((a, i) => {
    const data = stateSnaps[i].data();
    const last = data ? toMillis(data.lastNotifiedAt) : 0;
    return now - last > RENOTIFY_MS;
  });
  if (toSend.length === 0) {
    return { sent: 0, skippedDebounced: alerts.length };
  }

  const tokenDocs = await db.collection('notificationTokens').get();
  const tokens = [
    ...new Set(tokenDocs.docs.map(d => d.data().token).filter(Boolean))
  ];
  if (tokens.length === 0) {
    return {
      sent: 0,
      skippedDebounced: alerts.length - toSend.length,
      noTokens: true
    };
  }

  const messaging = getMessaging();
  let sent = 0;
  const failures = [];

  for (const alert of toSend) {
    const message = {
      tokens,
      notification: {
        title:
          alert.type === 'mati'
            ? 'MONITORING  |  Perangkat Offline'
            : alert.type === 'trouble'
              ? 'MONITORING  |  Gangguan Internet'
              : 'MONITORING  |  Data Tidak Diperbarui',
        body: `${alert.nama}: ${alert.reason}`
      },
      data: {
        assetId: String(alert.id),
        status: alert.status,
        url: '/#monitor'
      },
      webpush: {
        fcmOptions: { link: '/#monitor' },
        notification: {
          requireInteraction: alert.type === 'mati',
          tag: `asset-${alert.id}-${alert.type}`
        }
      }
    };
    try {
      const result = await messaging.sendEachForMulticast(message);
      sent++;
      await db
        .collection('notificationState')
        .doc(`${alert.id}_${alert.type}`)
        .set({ lastNotifiedAt: FieldValue.serverTimestamp() }, { merge: true });

      if (result.failureCount > 0) {
        const invalid = [];
        result.responses.forEach((r, i) => {
          if (
            !r.success &&
            r.error &&
            (r.error.code === 'messaging/registration-token-not-registered' ||
              r.error.code === 'messaging/invalid-registration-token')
          ) {
            invalid.push(tokens[i]);
          }
        });
        for (const tok of invalid) {
          const q = await db
            .collection('notificationTokens')
            .where('token', '==', tok)
            .get();
          for (const d of q.docs) await d.ref.delete();
        }
      }
    } catch (err) {
      console.error('Gagal kirim push untuk', alert.id, err.message);
      failures.push({ id: alert.id, error: err.message });
    }
  }
  return {
    sent,
    skippedDebounced: alerts.length - toSend.length,
    failures: failures.length ? failures : undefined
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    getAdminApp();
    const db = getFirestore();

    const statusSnap = await db.collection('monitorStatus').get();
    const monitorStatuses = statusSnap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));
    const { alerts, summary } = computeAlerts(monitorStatuses);

    const authHeader = req.headers.authorization || '';
    const isTrustedCaller =
      !!process.env.CRON_SECRET &&
      authHeader === `Bearer ${process.env.CRON_SECRET}`;

    let syncResult = null;
    try {
      syncResult = await syncAssetsStatus(db, monitorStatuses);
    } catch (syncErr) {
      console.error('Gagal sync assets status:', syncErr.message);
      syncResult = { synced: 0, error: syncErr.message };
    }

    let pushResult = null;
    if (isTrustedCaller) {
      pushResult = await sendPushForAlerts(db, alerts);
    }

    return res.status(200).json({
      ok: true,
      timestamp: new Date().toISOString(),
      summary,
      alerts,
      syncResult,
      pushResult,
      message:
        alerts.length > 0
          ? `Terdeteksi ${alerts.length} masalah pada infrastruktur TI. Status aset sudah disinkronkan.`
          : 'Seluruh perangkat terpantau normal dan aktif.'
    });
  } catch (error) {
    return res
      .status(500)
      .json({ ok: false, error: error.message || 'Internal Server Error' });
  }
}
