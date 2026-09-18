/**
 * Serverless Monitor & Push Notification API (Gratis - Vercel Hobby + Firebase Spark)
 * ---------------------------------------------------------------------------------
 * Pakai Firebase Admin SDK (bukan REST publik) untuk baca/tulis Firestore, karena
 * security rules project ini (FIRESTORE-RULES-FINAL.txt) mewajibkan request.auth
 * != null untuk semua akses. Admin SDK berjalan dengan privilese server dan
 * otomatis melewati rules tsb (ini aman, karena kredensialnya cuma dipegang oleh
 * server Vercel, bukan disebar ke browser).
 *
 * 2 MODE:
 * 1. MODE BACA (tanpa header rahasia) - dipanggil bebas oleh website/PWA (mis.
 *    dari Periodic Background Sync di firebase-messaging-sw.js). Cuma
 *    mengembalikan ringkasan status, TIDAK mengirim push.
 * 2. MODE KIRIM PUSH (header Authorization: Bearer <CRON_SECRET> cocok) -
 *    dipanggil otomatis oleh GitHub Actions setiap 5 menit (lihat
 *    .github/workflows/monitor-cron.yml). Mengirim notifikasi FCM nyata ke
 *    semua device di collection "notificationTokens" - INI YANG BIKIN
 *    NOTIFIKASI MUNCUL DI HP/LAPTOP WALAU APLIKASINYA TERTUTUP.
 *
 * PENTING - batas yang tidak bisa dihilangkan: endpoint ini hanya MEMBACA &
 * MENERUSKAN status yang sudah tersimpan di Firestore. Ia TIDAK bisa
 * mengecek langsung IP privat di jaringan kantor dari server Vercel (secara
 * jaringan itu tidak bisa dijangkau dari luar). Data yang diteruskan hanya
 * akan akurat kalau dashboard sesekali dibuka di jaringan yang sama dengan
 * aset-asetnya (itulah yang benar-benar menulis status ke Firestore).
 *
 * ENV VARS (isi di Vercel Project Settings > Environment Variables):
 *   - FIREBASE_SERVICE_ACCOUNT : seluruh isi JSON service account (Firebase
 *     Console > Project Settings > Service Accounts > Generate new private
 *     key) sebagai satu string.
 *   - CRON_SECRET : string acak panjang, harus SAMA dengan secret
 *     CRON_SECRET di GitHub Actions.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

const STALE_MS = 45 * 1000;
const RENOTIFY_MS = 15 * 60 * 1000; // jangan kirim ulang alert yang sama dalam 15 menit

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT env var belum diisi di Vercel.');
  return initializeApp({ credential: cert(JSON.parse(raw)) });
}

function toMillis(v) {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : 0;
}

function isStale(st) {
  return (Date.now() - toMillis(st.checkedAt)) > STALE_MS;
}

function computeAlerts(monitorStatuses) {
  const alerts = [];
  const summary = { totalMonitored: monitorStatuses.length, onlineNormal: 0, offlineMati: 0, internetTrouble: 0, dataBasi: 0 };

  monitorStatuses.forEach(st => {
    const stale = isStale(st);
    const isMati = st.online === false || st.deviceStatus === 'Mati' || st.status === 'offline';
    const isTrouble = st.online === true && !stale && (st.internetStatus === 'Internet Trouble' || st.internetOnline === false);
    const isNormal = st.online === true && !stale && (st.internetStatus === 'Normal' || st.internetOnline === true);

    if (stale && !isMati) {
      summary.dataBasi++;
      alerts.push({ id: st.id, nama: st.nama || st.kodeAset || 'Perangkat', type: 'stale', status: 'Tidak Ada Laporan Terbaru', reason: 'Belum ada update status baru dalam 45 detik terakhir' });
    } else if (isMati) {
      summary.offlineMati++;
      alerts.push({ id: st.id, nama: st.nama || st.kodeAset || 'Perangkat', type: 'mati', status: 'Perangkat Mati / Offline', reason: st.reason || 'Tidak merespons jaringan' });
    } else if (isTrouble) {
      summary.internetTrouble++;
      alerts.push({ id: st.id, nama: st.nama || st.kodeAset || 'Perangkat', type: 'trouble', status: 'Internet Trouble', reason: st.internetReason || st.reason || 'Koneksi WAN terputus' });
    } else if (isNormal) {
      summary.onlineNormal++;
    }
  });

  return { alerts, summary };
}

async function sendPushForAlerts(db, alerts) {
  if (alerts.length === 0) return { sent: 0, skippedDebounced: 0 };

  const now = Date.now();
  const stateRefs = alerts.map(a => db.collection('notificationState').doc(`${a.id}_${a.type}`));
  const stateSnaps = await db.getAll(...stateRefs);

  const toSend = alerts.filter((a, i) => {
    const data = stateSnaps[i].data();
    const last = data ? toMillis(data.lastNotifiedAt) : 0;
    return (now - last) > RENOTIFY_MS;
  });
  if (toSend.length === 0) return { sent: 0, skippedDebounced: alerts.length };

  const tokenDocs = await db.collection('notificationTokens').get();
  const tokens = [...new Set(tokenDocs.docs.map(d => d.data().token).filter(Boolean))];
  if (tokens.length === 0) return { sent: 0, skippedDebounced: alerts.length - toSend.length, noTokens: true };

  const messaging = getMessaging();
  let sent = 0;

  for (const alert of toSend) {
    const message = {
      tokens,
      notification: {
        title: alert.type === 'mati' ? '🚨 Perangkat Mati Terdeteksi'
          : alert.type === 'trouble' ? '⚠️ Internet Trouble'
          : '⏳ Tidak Ada Laporan Terbaru',
        body: `${alert.nama}: ${alert.reason}`
      },
      data: { assetId: String(alert.id), status: alert.status, url: '/#monitor' }
    };
    try {
      await messaging.sendEachForMulticast(message);
      sent++;
      await db.collection('notificationState').doc(`${alert.id}_${alert.type}`)
        .set({ lastNotifiedAt: FieldValue.serverTimestamp() }, { merge: true });
    } catch (err) {
      console.error('Gagal kirim push untuk', alert.id, err.message);
    }
  }
  return { sent, skippedDebounced: alerts.length - toSend.length };
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
    const monitorStatuses = statusSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const { alerts, summary } = computeAlerts(monitorStatuses);

    const authHeader = req.headers.authorization || '';
    const isTrustedCaller = !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;

    let pushResult = null;
    if (isTrustedCaller) {
      pushResult = await sendPushForAlerts(db, alerts);
    }

    return res.status(200).json({
      ok: true,
      timestamp: new Date().toISOString(),
      summary,
      alerts,
      pushResult,
      message: alerts.length > 0
        ? `Terdeteksi ${alerts.length} masalah pada infrastruktur TI Diskominfo.`
        : 'Seluruh perangkat terpantau normal dan aktif.'
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Internal Server Error' });
  }
}
