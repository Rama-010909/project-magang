import { probeAsset } from '../lib/cloud-monitor.mjs';

const PROJECT_ID = 'it-asset-diskominfo-batang';
const API_KEY = 'AIzaSyCnybMKpM7Z5gWn49hIsd5ymhFVSVtEuoo';

function parseFields(fields = {}) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) {
    if ('stringValue' in v) out[k] = v.stringValue;
    else if ('booleanValue' in v) out[k] = v.booleanValue;
    else if ('integerValue' in v) out[k] = Number(v.integerValue);
    else if ('doubleValue' in v) out[k] = Number(v.doubleValue);
    else if ('timestampValue' in v) out[k] = v.timestampValue;
    else if ('nullValue' in v) out[k] = null;
    else if ('arrayValue' in v) out[k] = (v.arrayValue?.values || []).map(x => parseFields({x}).x);
    else if ('mapValue' in v) out[k] = parseFields(v.mapValue?.fields || {});
  }
  return out;
}
function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toValue(x)])) } };
  return { stringValue: String(v) };
}
async function getAnonToken() {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(API_KEY)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || 'Anonymous Firebase Auth gagal. Aktifkan Anonymous sign-in.');
  return data.idToken;
}
async function firestoreFetch(path, token, options = {}) {
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`, { ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || `Firestore request failed: ${r.status}`);
  return data;
}
async function main() {
  const token = await getAnonToken();
  const data = await firestoreFetch('assets?pageSize=1000', token);
  const assets = (data.documents || []).map(doc => ({ id: doc.name.split('/').pop(), ...parseFields(doc.fields || {}) }));
  const checkedAt = new Date();
  const results = [];
  for (let i = 0; i < assets.length; i += 10) {
    const batch = assets.slice(i, i + 10);
    await Promise.all(batch.map(async asset => {
      const probe = await probeAsset(asset);
      const body = { fields: { assetId: toValue(asset.id), kodeAset: toValue(String(asset.kodeAset || '')), nama: toValue(String(asset.nama || asset.name || '')), online: toValue(!!probe.online), status: toValue(probe.online ? 'online' : 'offline'), deviceStatus: toValue(probe.online ? 'Online' : 'Offline'), internetStatus: toValue(probe.online ? 'Normal' : 'Belum Diperiksa'), reason: toValue(String(probe.reason || '')), method: toValue(String(probe.method || '')), latency: toValue(Number(probe.latency || 0)), port: toValue(probe.port || null), checkedAt: toValue(checkedAt), source: toValue('cloud-monitor-free') } };
      await firestoreFetch(`monitorStatus/${encodeURIComponent(asset.id)}`, token, { method: 'PATCH', body: JSON.stringify(body) });
      results.push({ assetId: asset.id, online: !!probe.online, reason: probe.reason });
    }));
  }
  console.log(JSON.stringify({ ok: true, checked: assets.length, online: results.filter(x => x.online).length, offline: results.filter(x => !x.online).length, checkedAt: checkedAt.toISOString() }, null, 2));
}
main().catch(err => { console.error(err); process.exit(1); });
