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

function classifyError(error) {
  const name = String(error?.name || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  if (name === 'aborterror') return 'timeout';
  if (message.includes('cors')) return 'cors';
  if (message.includes('mixed') || message.includes('insecure')) return 'mixed-content';
  if (message.includes('permission') || message.includes('local network')) return 'local-network-permission';
  return 'network-error';
}

/**
 * Browser liveness probe.
 *
 * Important: a browser cannot do a real ICMP/TCP ping to an arbitrary device.
 * For a normal HTTP endpoint, however, any HTTP response (including 4xx/5xx)
 * proves that the HTTP server was reachable. If CORS blocks reading the
 * response, a no-cors request can still give us an opaque response. Opaque
 * responses cannot expose the HTTP status/body, so they are only used as
 * reachability evidence, never for reading an internet-status payload.
 */
async function probeUrl(url, timeoutMs = 2600, readBody = false) {
  const u = new URL(url);
  const local = isPrivateIPv4(u.hostname) || u.hostname === 'localhost' || u.hostname === '127.0.0.1';

  const request = async (mode) => {
    const { signal, clear } = timeoutSignal(timeoutMs);
    try {
      const opts = {
        method: 'GET',
        mode,
        cache: 'no-store',
        redirect: 'follow',
        signal
      };
      if (local) opts.targetAddressSpace = u.hostname === 'localhost' || u.hostname === '127.0.0.1' ? 'loopback' : 'local';
      const response = await fetch(u.href, opts);

      if (mode === 'no-cors' || response.type === 'opaque') {
        return {
          ok: true,
          reachable: true,
          opaque: true,
          body: '',
          status: 0,
          mode,
          errorType: null
        };
      }

      return {
        ok: true,
        reachable: true,
        opaque: false,
        body: readBody ? await response.text() : '',
        status: response.status,
        mode,
        errorType: null
      };
    } catch (error) {
      return {
        ok: false,
        reachable: false,
        opaque: false,
        body: '',
        status: 0,
        mode,
        errorType: classifyError(error)
      };
    } finally {
      clear();
    }
  };

  // Internet-status endpoints must expose their body, so do not fall back to
  // no-cors for them. An opaque response cannot tell us Normal/Trouble.
  if (readBody) return request('cors');

  // First try CORS so a real HTTP status is available. If CORS is not enabled,
  // fall back to no-cors only for reachability evidence.
  const corsResult = await request('cors');
  if (corsResult.reachable) return corsResult;
  const opaqueResult = await request('no-cors');
  if (opaqueResult.reachable) return opaqueResult;

  return {
    ...corsResult,
    errorType: opaqueResult.errorType || corsResult.errorType || 'network-error',
    fallbackErrorType: corsResult.errorType
  };
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

function errorReason(type = '') {
  const map = {
    timeout: 'Timeout: endpoint tidak memberi respons dalam batas waktu.',
    cors: 'CORS browser memblokir pembacaan endpoint.',
    'mixed-content': 'Browser memblokir HTTP lokal dari halaman HTTPS.',
    'local-network-permission': 'Akses jaringan lokal browser belum diizinkan.',
    'network-error': 'Koneksi ke endpoint gagal atau tidak dapat diverifikasi.'
  };
  return map[type] || map['network-error'];
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
      targets.push({
        url: `${port === 443 ? 'https' : 'http'}://${ip}${port === 80 || port === 443 ? '' : `:${port}`}/`,
        method: `http:${port}`
      });
    }
  }

  const results = await Promise.all(targets.map(async target => {
    try {
      return { ...target, ...(await probeUrl(target.url)) };
    } catch (error) {
      return { ...target, ok: false, reachable: false, errorType: classifyError(error), body: '' };
    }
  }));
  const hit = results.find(x => x.reachable);

  let internetOnline;
  let internetStatus;
  let internetReason = '';
  if (internetUrl) {
    try {
      const internetProbe = await probeUrl(internetUrl, 3000, true);
      if (internetProbe.ok && !internetProbe.opaque) {
        const parsed = parseInternetBody(internetProbe.body);
        if (typeof parsed === 'boolean') {
          internetOnline = parsed;
          internetStatus = parsed ? 'Normal' : 'Internet Trouble';
          internetReason = parsed
            ? 'Endpoint status internet melaporkan normal'
            : 'Endpoint status internet melaporkan trouble';
        } else {
          internetReason = 'Endpoint merespons tetapi format status internet tidak dikenali';
        }
      } else {
        internetReason = errorReason(internetProbe.errorType);
      }
    } catch (error) {
      internetReason = errorReason(classifyError(error));
    }
  }

  if (hit) {
    return {
      online: true,
      method: hit.method,
      reason: hit.opaque
        ? `Endpoint terjangkau melalui ${hit.method}; respons tidak dapat dibaca browser (opaque).`
        : `Terdeteksi melalui ${hit.method} (HTTP ${hit.status})`,
      internetOnline,
      internetStatus,
      internetReason,
      internetMethod: internetUrl ? 'internetMonitorUrl' : undefined,
      probeType: hit.opaque ? 'opaque' : 'http',
      checkedUrl: hit.url
    };
  }

  const primaryError = results.find(x => x.errorType)?.errorType || 'network-error';
  return {
    // Do NOT report Offline here. A browser failure to verify an endpoint is
    // not proof that the device is powered off.
    online: null,
    method: 'browser',
    reason: errorReason(primaryError),
    errorType: primaryError,
    internetOnline: undefined,
    internetStatus: undefined,
    internetReason,
    checkedUrl: targets[0]?.url || ''
  };
}
