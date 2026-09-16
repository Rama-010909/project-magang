import crypto from 'node:crypto';
import { probeAsset, isCloudMonitorable } from '../lib/cloud-monitor.mjs';

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
    else if ('arrayValue' in v) out[k] = (v.arrayValue?.values || []).map(x => parseFields({ x }).x);
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

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAnonToken() {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(API_KEY)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || 'Anonymous Firebase Auth gagal. Aktifkan Anonymous sign-in.');
  return data.idToken;
}

async function firestoreFetch(path, token, options = {}) {
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${token}`, 'content-type': 'application/json' }
  });
  const text = await r.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch (_) {}
  if (!r.ok) throw new Error(data?.error?.message || `Firestore request failed: ${r.status}`);
  return data;
}

async function getPreviousStatus(assetId, token) {
  try {
    const data = await firestoreFetch(`monitorStatus/${encodeURIComponent(assetId)}`, token);
    return parseFields(data.fields || {});
  } catch (_) {
    return null;
  }
}

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '';
  if (!raw.trim()) return null;
  try {
    const sa = JSON.parse(raw);
    if (!sa.client_email || !sa.private_key) throw new Error('client_email/private_key tidak ada');
    return sa;
  } catch (e) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT_JSON tidak valid: ${e.message}`);
  }
}

async function getGoogleAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }));
  const unsigned = `${header}.${claim}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(sa.private_key, 'base64url');
  const jwt = `${unsigned}.${signature}`;

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error_description || data?.error || 'Google OAuth gagal');
  return data.access_token;
}

async function getNotificationTokens(token) {
  const data = await firestoreFetch('notificationTokens?pageSize=1000', token);
  return (data.documents || []).map(doc => ({ id: doc.name.split('/').pop(), ...parseFields(doc.fields || {}) }))
    .filter(x => x.token && x.enabled !== false);
}

async function sendFcm(accessToken, registrationToken, { title, body, assetId, type }) {
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      message: {
        token: registrationToken,
        notification: { title, body },
        data: {
          assetId: String(assetId || ''),
          status: String(type || ''),
          assetName: body.split(' • ')[0] || 'Aset',
          title,
          body,
          url: '/',
          type: String(type || '')
        },
        webpush: {
          notification: { title, body, icon: '/favicon.png', badge: '/favicon.png', tag: `asset-${assetId || 'update'}`, renotify: true },
          fcmOptions: { link: '/' }
        },
        android: { priority: 'high', notification: { channelId: 'asset-monitor', sound: 'default' } }
      }
    })
  });
  const text = await r.text();
  if (!r.ok) throw new Error(text || `FCM failed: ${r.status}`);
  return true;
}

async function notifyChange(fcmAccessToken, tokens, asset, previous, online, probe) {
  if (!fcmAccessToken || !tokens.length || !previous || typeof previous.online !== 'boolean' || previous.online === online) return 0;
  const type = online ? 'recovery' : 'offline';
  const title = online ? 'Perangkat Kembali Online' : 'Peringatan Perangkat Offline';
  const name = asset.nama || asset.name || 'Perangkat';
  const code = asset.kodeAset || asset.id || '';
  const body = `${name} • ${code} • ${online ? 'Online kembali' : 'Offline'}${probe.reason ? ` • ${probe.reason}` : ''}`;
  let sent = 0;
  const stale = [];
  await Promise.all(tokens.map(async item => {
    try {
      await sendFcm(fcmAccessToken, item.token, { title, body, assetId: asset.id, type });
      sent++;
    } catch (e) {
      const msg = String(e.message || e);
      if (/UNREGISTERED|registration-token-not-registered|INVALID_ARGUMENT/i.test(msg)) stale.push(item.id);
      console.warn(`[FCM] gagal ${item.platform || 'device'} ${item.id}: ${msg}`);
    }
  }));
  for (const id of stale) {
    try { await firestoreFetch(`notificationTokens/${encodeURIComponent(id)}`, fcmFirestoreToken, { method: 'DELETE' }); } catch (_) {}
  }
  return sent;
}


async function notifyInternetChange(fcmAccessToken, tokens, asset, previous, internetOnline, probe) {
  if (!fcmAccessToken || !tokens.length || !previous || typeof previous.internetOnline !== 'boolean' || previous.internetOnline === internetOnline) return 0;
  const type = internetOnline ? 'internet_recovery' : 'internet_trouble';
  const title = internetOnline ? 'Internet Kembali Normal' : 'Peringatan Internet Trouble';
  const name = asset.nama || asset.name || 'Perangkat';
  const code = asset.kodeAset || asset.id || '';
  const body = `${name} • ${code} • ${internetOnline ? 'Internet kembali normal' : 'Internet bermasalah'}${probe?.reason ? ` • ${probe.reason}` : ''}`;
  let sent = 0; const stale = [];
  await Promise.all(tokens.map(async item => {
    try { await sendFcm(fcmAccessToken, item.token, { title, body, assetId: asset.id, type }); sent++; }
    catch (e) { const msg=String(e.message||e); if(/UNREGISTERED|registration-token-not-registered|INVALID_ARGUMENT/i.test(msg)) stale.push(item.id); console.warn(`[FCM] gagal internet ${item.platform||'device'} ${item.id}: ${msg}`); }
  }));
  for (const id of stale) { try { await firestoreFetch(`notificationTokens/${encodeURIComponent(id)}`, fcmFirestoreToken, { method:'DELETE' }); } catch (_) {} }
  return sent;
}

let fcmFirestoreToken = null;

// Simpan state notifikasi di subcollection monitorStatus agar mengikuti
// permission path monitorStatus/{document=**}. Ini menghindari dependency
// tambahan pada collection notificationState yang pada deployment lama bisa
// belum ikut ter-deploy di Firestore Rules.
//
// Path:
//   monitorStatus/{assetId}/_notification/state
//
// Dokumen ini terpisah dari monitorStatus/{assetId}, jadi agent LAN tetap
// bebas menulis status monitor setiap 10 detik tanpa menghapus state notifikasi.
function notificationStatePath(assetId) {
  return `monitorStatus/${encodeURIComponent(assetId)}/_notification/state`;
}

async function getNotificationState(assetId, token) {
  try {
    const data = await firestoreFetch(notificationStatePath(assetId), token);
    return parseFields(data.fields || {});
  } catch (_) { return null; }
}

async function setNotificationState(assetId, online, internetOnline, token) {
  const fields = { online: toValue(!!online), updatedAt: toValue(new Date()) };
  if (typeof internetOnline === 'boolean') fields.internetOnline = toValue(internetOnline);
  const body = { fields };
  try {
    await firestoreFetch(notificationStatePath(assetId), token, {
      method: 'PATCH',
      body: JSON.stringify(body)
    });
  } catch (e) {
    console.warn(`[NOTIFY STATE] gagal ${assetId} (${notificationStatePath(assetId)}): ${e.message}`);
  }
}

async function main() {
  const token = await getAnonToken();
  fcmFirestoreToken = token;
  const data = await firestoreFetch('assets?pageSize=1000', token);
  const assets = (data.documents || []).map(doc => ({ id: doc.name.split('/').pop(), ...parseFields(doc.fields || {}) }));
  const checkedAt = new Date();
  const results = [];

  let tokens = [];
  let fcmAccessToken = null;
  const serviceAccount = loadServiceAccount();
  if (serviceAccount) {
    try {
      fcmAccessToken = await getGoogleAccessToken(serviceAccount);
      tokens = await getNotificationTokens(token);
      console.log(`[FCM] token aktif: ${tokens.length}`);
    } catch (e) {
      console.warn(`[FCM] tidak aktif: ${e.message}`);
    }
  } else {
    console.warn('[FCM] FIREBASE_SERVICE_ACCOUNT_JSON belum diatur. Monitoring tetap berjalan, push notification dilewati.');
  }

  for (let i = 0; i < assets.length; i += 10) {
    const batch = assets.slice(i, i + 10);
    await Promise.all(batch.map(async asset => {
      // Aset LAN/private HARUS dipantau oleh monitor-agent di jaringan lokal.
      // GitHub Actions tidak boleh menimpa status LAN menjadi Offline.
      if (!isCloudMonitorable(asset)) {
        const monitorId = String(asset.kodeAset || asset.id);
        try {
          const current = await firestoreFetch(`monitorStatus/${encodeURIComponent(monitorId)}`, token);
          const currentState = parseFields(current.fields || {});
          if (fcmAccessToken && tokens.length && typeof currentState.online === 'boolean') {
            const ns = await getNotificationState(asset.id, token);
            let notified = 0;
            if (ns && typeof ns.online === 'boolean' && ns.online !== currentState.online) {
              notified += await notifyChange(fcmAccessToken, tokens, asset, ns, currentState.online, { reason: currentState.reason || '' });
            }
            if (ns && typeof currentState.internetOnline === 'boolean' && typeof ns.internetOnline === 'boolean' && ns.internetOnline !== currentState.internetOnline) {
              notified += await notifyInternetChange(fcmAccessToken, tokens, asset, ns, currentState.internetOnline, { reason: currentState.internetReason || currentState.reason || '' });
            }
            if (!ns || typeof ns.online !== 'boolean' || (typeof currentState.internetOnline === 'boolean' && typeof ns.internetOnline !== 'boolean')) {
              await setNotificationState(asset.id, currentState.online, typeof currentState.internetOnline === 'boolean' ? currentState.internetOnline : undefined, token);
            } else if (notified) {
              await setNotificationState(asset.id, currentState.online, typeof currentState.internetOnline === 'boolean' ? currentState.internetOnline : ns.internetOnline, token);
            }
            results.push({ assetId: asset.id, online: !!currentState.online, notified, source: 'lan-agent' });
          } else {
            results.push({ assetId: asset.id, online: !!currentState.online, notified: 0, source: 'lan-agent' });
          }
          results.push({ assetId: asset.id, online: !!currentState.online, notified: 0, source: 'lan-agent' });
        } catch (_) {
          results.push({ assetId: asset.id, skipped: true, source: 'lan-agent' });
        }
        return;
      }

      const probe = await probeAsset(asset);
      const previous = await getPreviousStatus(asset.id, token);
      const body = {
        fields: {
          assetId: toValue(asset.id),
          kodeAset: toValue(String(asset.kodeAset || '')),
          nama: toValue(String(asset.nama || asset.name || '')),
          online: toValue(!!probe.online),
          status: toValue(probe.online ? 'online' : 'offline'),
          deviceStatus: toValue(probe.online ? 'Online' : 'Offline'),
          internetStatus: toValue(probe.online ? 'Normal' : 'Belum Diperiksa'),
          reason: toValue(String(probe.reason || '')),
          method: toValue(String(probe.method || '')),
          latency: toValue(Number(probe.latency || 0)),
          port: toValue(probe.port || null),
          checkedAt: toValue(checkedAt),
          source: toValue('cloud-monitor-free')
        }
      };
      await firestoreFetch(`monitorStatus/${encodeURIComponent(asset.id)}`, token, { method: 'PATCH', body: JSON.stringify(body) });
      let notified = 0;
      if (fcmAccessToken && tokens.length && previous && typeof previous.online === 'boolean' && previous.online !== !!probe.online) {
        notified = await notifyChange(fcmAccessToken, tokens, asset, previous, !!probe.online, probe);
      }
      await setNotificationState(asset.id, !!probe.online, undefined, token);
      results.push({ assetId: asset.id, online: !!probe.online, notified, reason: probe.reason, source: 'cloud' });
    }));
  }
  console.log(JSON.stringify({ ok: true, checked: assets.length, online: results.filter(x => x.online).length, offline: results.filter(x => !x.online).length, notifications: results.reduce((n, x) => n + x.notified, 0), checkedAt: checkedAt.toISOString() }, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
