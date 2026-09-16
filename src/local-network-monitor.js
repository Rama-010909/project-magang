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

async function probeUrl(url, timeoutMs = 2600) {
  const { signal, clear } = timeoutSignal(timeoutMs);
  try {
    const u = new URL(url);
    const opts = { method: 'GET', mode: 'no-cors', cache: 'no-store', signal };
    if (u.hostname.match(PRIVATE_V4)) opts.targetAddressSpace = 'local';
    await fetch(u.href, opts);
    return true;
  } catch {
    return false;
  } finally {
    clear();
  }
}

export async function probeAssetFromBrowser(asset) {
  const direct = String(asset?.monitorUrl || '').trim();
  const ip = String(asset?.ipAddress || '').trim();
  if (!direct && !ip) return { online: null, method: 'none', reason: 'Tidak ada alamat monitoring' };

  const targets = [];
  if (direct) targets.push({ url: direct, method: 'monitorUrl' });
  if (ip) {
    // Multi-path HTTP probes. no-cors intentionally treats any network-level
    // response as reachable; the browser cannot inspect the response body.
    for (const port of [80, 443, 8080, 8000]) {
      targets.push({ url: `${port === 443 ? 'https' : 'http'}://${ip}${port === 80 || port === 443 ? '' : `:${port}`}/`, method: `http:${port}` });
    }
  }

  const results = await Promise.all(targets.map(async target => ({ ...target, ok: await probeUrl(target.url) })));
  const hit = results.find(x => x.ok);
  if (hit) return { online: true, method: hit.method, reason: `Terdeteksi melalui ${hit.method}` };
  return { online: false, method: 'browser', reason: 'Tidak ada jalur HTTP/HTTPS local yang merespons' };
}
