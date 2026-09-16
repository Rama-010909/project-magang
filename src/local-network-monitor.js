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

async function probeUrl(url, timeoutMs = 2600, readBody = false) {
  const { signal, clear } = timeoutSignal(timeoutMs);
  try {
    const u = new URL(url);
    const opts = { method: 'GET', mode: readBody ? 'cors' : 'no-cors', cache: 'no-store', signal };
    if (u.hostname.match(PRIVATE_V4)) opts.targetAddressSpace = 'local';
    const response = await fetch(u.href, opts);
    if (!readBody) return { ok: true, body: '' };
    return { ok: response.ok, body: await response.text() };
  } catch {
    return { ok: false, body: '' };
  } finally {
    clear();
  }
}

function parseInternetBody(body = '') {
  const text = String(body).trim().toLowerCase();
  if (!text) return null;
  try {
    const json = JSON.parse(text);
    const value = json.internetOnline ?? json.internet ?? json.wanOnline ?? json.online;
    if (typeof value === 'boolean') return value;
    const status = String(json.internetStatus ?? json.status ?? '').toLowerCase();
    if (['normal','online','ok','up','aman','connected'].includes(status)) return true;
    if (['trouble','offline','down','error','disconnected','putus'].includes(status)) return false;
  } catch {}
  if (/\b(normal|online|ok|up|aman|connected)\b/.test(text)) return true;
  if (/\b(trouble|offline|down|error|disconnected|putus)\b/.test(text)) return false;
  return null;
}

export async function probeAssetFromBrowser(asset) {
  const direct = String(asset?.monitorUrl || '').trim();
  const ip = String(asset?.ipAddress || '').trim();
  const internetUrl = String(asset?.internetMonitorUrl || asset?.internetStatusUrl || '').trim();
  if (!direct && !ip) return { online: null, method: 'none', reason: 'Tidak ada alamat monitoring' };

  const targets = [];
  if (direct) targets.push({ url: direct, method: 'monitorUrl' });
  if (ip) {
    for (const port of [80, 443, 8080, 8000]) {
      targets.push({ url: `${port === 443 ? 'https' : 'http'}://${ip}${port === 80 || port === 443 ? '' : `:${port}`}/`, method: `http:${port}` });
    }
  }

  const results = await Promise.all(targets.map(async target => ({ ...target, ...(await probeUrl(target.url)) })));
  const hit = results.find(x => x.ok);

  let internetOnline;
  let internetStatus;
  let internetReason = '';
  if (internetUrl) {
    const internetProbe = await probeUrl(internetUrl, 3000, true);
    if (internetProbe.ok) {
      const parsed = parseInternetBody(internetProbe.body);
      if (typeof parsed === 'boolean') {
        internetOnline = parsed;
        internetStatus = parsed ? 'Normal' : 'Internet Trouble';
        internetReason = parsed ? 'Endpoint status internet melaporkan normal' : 'Endpoint status internet melaporkan trouble';
      } else {
        internetReason = 'Endpoint merespons tetapi format status internet tidak dikenali';
      }
    } else {
      internetReason = 'Endpoint status internet tidak dapat diakses dari browser';
    }
  }

  if (hit) return {
    online: true,
    method: hit.method,
    reason: `Terdeteksi melalui ${hit.method}`,
    internetOnline,
    internetStatus,
    internetReason,
    internetMethod: internetUrl ? 'internetMonitorUrl' : undefined
  };
  return {
    online: false,
    method: 'browser',
    reason: 'Tidak ada jalur HTTP/HTTPS local yang merespons',
    internetOnline: undefined,
    internetStatus: undefined,
    internetReason
  };
}
