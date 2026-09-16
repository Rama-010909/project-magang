import net from 'node:net';

export function parsePorts(value) {
  if (Array.isArray(value)) return value.map(Number).filter(p => p >= 1 && p <= 65535).slice(0, 8);
  const raw = String(value || '').trim();
  if (!raw) return [443, 80];
  return raw.split(/[ ,;]+/).map(Number).filter(p => p >= 1 && p <= 65535).slice(0, 8);
}

export function isPrivateIPv4(ip) {
  const p = String(ip).split('.').map(Number);
  if (p.length !== 4 || p.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a,b] = p;
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

function isPrivateHost(host) {
  const h = String(host || '').trim().toLowerCase();
  if (!h || h === 'localhost' || h === '::1') return true;
  return /^\d+(?:\.\d+){3}$/.test(h) ? isPrivateIPv4(h) : false;
}

export function isCloudMonitorable(asset) {
  const url = String(asset.monitorUrl || '').trim();
  if (url) {
    try { return !isPrivateHost(new URL(url).hostname); } catch { return false; }
  }
  const ip = String(asset.internetIp || asset.publicIp || asset.ipPublic || asset.ipInternet || '').trim();
  return !!ip && !isPrivateIPv4(ip);
}

export function getTarget(asset) {
  const url = String(asset.monitorUrl || '').trim();
  if (url) return { type: 'http', target: url };
  const ip = String(asset.internetIp || asset.publicIp || asset.ipPublic || asset.ipInternet || '').trim();
  if (!ip || isPrivateIPv4(ip)) return null;
  return { type: 'tcp', host: ip, ports: parsePorts(asset.monitorPorts || asset.monitorPort || asset.ports) };
}

export async function probeAsset(asset, timeoutMs = 5000) {
  const target = getTarget(asset);
  if (!target) return { online: false, reason: 'IP publik/monitorUrl belum diatur atau alamat bukan IP publik.', method: 'none', latency: 0 };
  if (target.type === 'http') return probeHttp(target.target, timeoutMs);
  return probeTcp(target.host, target.ports, timeoutMs);
}

async function probeHttp(rawUrl, timeoutMs) {
  let parsed;
  try { parsed = new URL(rawUrl); } catch { return { online:false, reason:'monitorUrl tidak valid.', method:'http', latency:0 }; }
  if (!['http:', 'https:'].includes(parsed.protocol)) return { online:false, reason:'monitorUrl harus HTTP/HTTPS.', method:'http', latency:0 };
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(parsed, { method: 'GET', redirect: 'manual', cache: 'no-store', signal: controller.signal });
    clearTimeout(timer);
    return { online: true, reason: `HTTP ${r.status}`, method: 'http', latency: Date.now() - started, httpStatus: r.status };
  } catch (e) {
    clearTimeout(timer);
    return { online: false, reason: e?.name === 'AbortError' ? 'Timeout' : String(e?.message || e), method: 'http', latency: Date.now() - started };
  }
}

function probePort(host, port, timeoutMs) {
  return new Promise(resolve => {
    const started = Date.now();
    const socket = new net.Socket();
    let done = false;
    const finish = result => { if (done) return; done = true; socket.destroy(); resolve(result); };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish({ ok: true, port, latency: Date.now() - started }));
    socket.once('timeout', () => finish({ ok: false, port, error: 'Timeout' }));
    socket.once('error', err => finish({ ok: false, port, error: err?.code || err?.message || 'Connection failed' }));
    socket.connect(port, host);
  });
}

async function probeTcp(host, ports, timeoutMs) {
  const results = await Promise.all(ports.map(p => probePort(host, p, timeoutMs)));
  const ok = results.find(r => r.ok);
  if (ok) return { online: true, reason: `TCP port ${ok.port} terbuka`, method: 'tcp', latency: ok.latency, port: ok.port };
  return { online: false, reason: `Tidak ada port monitoring yang dapat dijangkau (${ports.join(', ')})`, method: 'tcp', latency: timeoutMs };
}
