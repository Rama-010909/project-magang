const PRIVATE_V4 = /^(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.)/;

export function isPrivateIPv4(value = '') {
  const ip = String(value).trim();
  return PRIVATE_V4.test(ip);
}

function timeoutSignal(ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, clear: () => clearTimeout(t) };
}

async function probeUrl(url, timeoutMs = 2200) {
  const { signal, clear } = timeoutSignal(timeoutMs);
  try {
    const u = new URL(url);
    await fetch(u.href, { method: 'GET', mode: 'no-cors', cache: 'no-store', signal, targetAddressSpace: isPrivateIPv4(u.hostname) ? 'local' : undefined });
    return true;
  } catch {
    return false;
  } finally { clear(); }
}

function extractIps(value = '') {
  return [...String(value).matchAll(/(?<!\d)(?:\d{1,3}\.){3}\d{1,3}(?!\d)/g)].map(m => m[0]).filter(Boolean);
}

export async function probeAssetFromBrowser(asset) {
  const targets = [];
  const direct = String(asset?.monitorUrl || '').trim();
  const raw = [asset?.ipAddress, asset?.internetIp, asset?.publicIp, asset?.ipPublic, asset?.ipInternet].filter(Boolean).join(' ');
  if (direct) targets.push({ url: direct, method: 'monitorUrl', kind: 'device' });

  for (const ip of extractIps(raw)) {
    if (isPrivateIPv4(ip)) {
      for (const port of [80, 443, 8080, 8000, 8291]) {
        targets.push({ url: `${port === 443 ? 'https' : 'http'}://${ip}${port === 80 || port === 443 ? '' : `:${port}`}/`, method: `device:${ip}:${port}`, kind: 'device' });
      }
    } else {
      for (const port of [443, 80]) targets.push({ url: `${port === 443 ? 'https' : 'http'}://${ip}${port === 80 || port === 443 ? '' : `:${port}`}/`, method: `internet:${ip}:${port}`, kind: 'internet' });
    }
  }

  if (!targets.length) return { online: null, method: 'none', reason: 'Tidak ada alamat monitoring' };
  const results = await Promise.all(targets.map(async target => ({ ...target, ok: await probeUrl(target.url) })));
  const deviceHit = results.find(x => x.ok && x.kind === 'device');
  const internetHit = results.find(x => x.ok && x.kind === 'internet');

  if (deviceHit) return {
    online: true,
    internetOnline: !!internetHit,
    internetStatus: internetHit ? 'normal' : 'unknown',
    method: deviceHit.method,
    reason: internetHit ? `Perangkat merespons; IP Internet ${internetHit.method.replace('internet:', '')} juga merespons` : 'Perangkat merespons; status Internet belum dapat dipastikan dari browser'
  };
  return {
    online: false,
    internetOnline: undefined,
    internetStatus: 'unknown',
    method: 'browser-multipath',
    reason: 'Tidak ada jalur perangkat lokal yang merespons'
  };
}
