const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const net = require('node:net');

initializeApp();

function portsFor(asset) {
  const raw = asset.monitorPorts || asset.ports;
  if (Array.isArray(raw)) return raw.map(Number).filter(p => p >= 1 && p <= 65535).slice(0, 8);
  if (raw) return String(raw).split(/[ ,;]+/).map(Number).filter(p => p >= 1 && p <= 65535).slice(0, 8);
  return [443, 80, 8291, 22];
}
function probePort(host, port, timeoutMs = 5000) {
  return new Promise(resolve => {
    const socket = new net.Socket(); let done = false; const started = Date.now();
    const finish = r => { if (done) return; done = true; socket.destroy(); resolve(r); };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish({ ok: true, port, latency: Date.now() - started }));
    socket.once('timeout', () => finish({ ok: false, port, error: 'Timeout' }));
    socket.once('error', e => finish({ ok: false, port, error: e?.code || e?.message || 'Connection failed' }));
    socket.connect(port, host);
  });
}
async function probe(asset) {
  const url = String(asset.monitorUrl || '').trim();
  if (url) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 5000); const started = Date.now();
    try { const r = await fetch(url, { method: 'GET', redirect: 'manual', cache: 'no-store', signal: controller.signal }); clearTimeout(timer); return { online: true, reason: `HTTP ${r.status}`, method: 'http', latency: Date.now() - started, port: null }; }
    catch (e) { clearTimeout(timer); return { online: false, reason: e?.name === 'AbortError' ? 'Timeout' : String(e?.message || e), method: 'http', latency: Date.now() - started, port: null }; }
  }
  const host = String(asset.publicIp || asset.ipPublic || asset.ipAddress || asset.ip || '').trim();
  if (!host) return { online: false, reason: 'Target monitoring belum diatur.', method: 'none', latency: 0, port: null };
  const ports = portsFor(asset); const results = await Promise.all(ports.map(p => probePort(host, p)));
  const ok = results.find(r => r.ok);
  return ok ? { online: true, reason: `TCP port ${ok.port} terbuka`, method: 'tcp', latency: ok.latency, port: ok.port } : { online: false, reason: `Tidak ada port monitoring yang dapat dijangkau (${ports.join(', ')})`, method: 'tcp', latency: 5000, port: null };
}

exports.cloudMonitor = onSchedule({ schedule: 'every 1 minutes', timeoutSeconds: 60, memory: '256MiB', maxInstances: 1, region: 'asia-southeast2' }, async () => {
  const db = getFirestore(); const snap = await db.collection('assets').get(); const assets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  for (let i = 0; i < assets.length; i += 15) {
    const chunk = assets.slice(i, i + 15); const checked = await Promise.all(chunk.map(async asset => ({ asset, probe: await probe(asset) })));
    const batch = db.batch(); const now = new Date();
    for (const { asset, probe: p } of checked) batch.set(db.collection('monitorStatus').doc(asset.id), {
      assetId: asset.id, kodeAset: String(asset.kodeAset || ''), nama: String(asset.nama || asset.name || ''), online: !!p.online,
      status: p.online ? 'online' : 'offline', deviceStatus: p.online ? 'Online' : 'Offline', internetStatus: p.online ? 'Normal' : 'Belum Diperiksa',
      reason: String(p.reason || ''), method: String(p.method || ''), latency: Number(p.latency || 0), port: p.port || null, checkedAt: now, source: 'cloud-monitor-v2'
    }, { merge: true });
    await batch.commit();
  }
  console.log(`Cloud monitor: ${assets.length} aset diperiksa.`);
});

exports.notifyMonitorStatus = onDocumentWritten('monitorStatus/{assetId}', async (event) => {
  const before = event.data?.before?.exists ? event.data.before.data() : null;
  const after = event.data?.after?.exists ? event.data.after.data() : null;
  if (!after) return;
  const previous = String(before?.status ?? '').trim().toLowerCase();
  const current = String(after.status ?? '').trim().toLowerCase();
  if (previous === current) return;
  const trouble = current === 'offline' || current === 'trouble';
  const safe = current === 'online' || current === 'normal';
  if (!trouble && !safe) return;
  const db = getFirestore(); const snap = await db.collection('notificationTokens').where('enabled', '==', true).get();
  const tokens = snap.docs.map(d => d.data().token || d.id).filter(Boolean); if (!tokens.length) return;
  const name = after.nama || 'Perangkat'; const code = after.kodeAset ? ` (${after.kodeAset})` : '';
  const title = trouble ? 'Peringatan Gangguan Aset' : 'Aset Kembali Online';
  const body = trouble ? `${name}${code}: ${after.reason || 'Perangkat tidak dapat dijangkau dari cloud.'}` : `${name}${code}: perangkat kembali dapat dijangkau.`;
  for (let i = 0; i < tokens.length; i += 500) await getMessaging().sendEachForMulticast({ tokens: tokens.slice(i, i + 500), data: { assetId: String(event.params.assetId), status: current, title, body, url: '/' }, webpush: { headers: { Urgency: trouble ? 'high' : 'normal' } } });
});
