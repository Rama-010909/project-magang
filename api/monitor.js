import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { probeAsset } from '../lib/cloud-monitor.mjs';

export const config = { runtime: 'nodejs20.x' };

function initAdmin() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON belum diatur di Vercel.');
  const sa = JSON.parse(raw);
  return initializeApp({ credential: cert(sa), projectId: sa.project_id });
}

function authorized(req) {
  const secret = process.env.CRON_SECRET || process.env.MONITOR_CRON_SECRET;
  if (!secret) return false;
  const h = req.headers.authorization || '';
  return h === `Bearer ${secret}` || req.headers['x-monitor-secret'] === secret;
}

async function runMonitor() {
  initAdmin();
  const db = getFirestore();
  const snap = await db.collection('assets').get();
  const assets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const results = [];
  const now = Timestamp.now();
  const batchSize = 20;

  for (let i = 0; i < assets.length; i += batchSize) {
    const batch = assets.slice(i, i + batchSize);
    const checked = await Promise.all(batch.map(async asset => ({ asset, probe: await probeAsset(asset) })));
    const writer = db.batch();
    for (const { asset, probe } of checked) {
      const ref = db.collection('monitorStatus').doc(asset.id);
      writer.set(ref, {
        assetId: asset.id,
        kodeAset: String(asset.kodeAset || ''),
        nama: String(asset.nama || asset.name || ''),
        online: !!probe.online,
        status: probe.online ? 'online' : 'offline',
        deviceStatus: probe.online ? 'Online' : 'Offline',
        internetStatus: probe.online ? 'Normal' : 'Belum Diperiksa',
        reason: String(probe.reason || ''),
        method: String(probe.method || ''),
        latency: Number(probe.latency || 0),
        port: probe.port || null,
        checkedAt: now,
        source: 'cloud-monitor'
      }, { merge: true });
      results.push({ assetId: asset.id, online: !!probe.online, reason: probe.reason });
    }
    await writer.commit();
  }
  return { checked: assets.length, online: results.filter(r => r.online).length, offline: results.filter(r => !r.online).length, checkedAt: now.toDate().toISOString() };
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!authorized(req)) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  try { return res.status(200).json({ ok: true, ...(await runMonitor()) }); }
  catch (e) { console.error(e); return res.status(500).json({ ok: false, error: String(e?.message || e) }); }
}
