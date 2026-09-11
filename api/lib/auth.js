import crypto from 'node:crypto';

const COOKIE = 'asset_admin_session';
const MAX_AGE = 60 * 60 * 8;

function secret() {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET belum dikonfigurasi atau terlalu pendek.');
  }
  return process.env.SESSION_SECRET;
}

function sign(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url');
}

export function createSession(username) {
  const payload = Buffer.from(JSON.stringify({ sub: username, exp: Math.floor(Date.now() / 1000) + MAX_AGE })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifySession(token) {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch { return null; }
}

export function parseCookies(req) {
  const raw = req.headers.cookie || '';
  return Object.fromEntries(raw.split(';').map(x => x.trim()).filter(Boolean).map(x => {
    const i = x.indexOf('=');
    return [decodeURIComponent(x.slice(0, i)), decodeURIComponent(x.slice(i + 1))];
  }));
}

export function getSession(req) { return verifySession(parseCookies(req)[COOKIE]); }
export function setSession(res, username) {
  res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(createSession(username))}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MAX_AGE}`);
}
export function clearSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
}
export function requireSession(req, res) {
  const session = getSession(req);
  if (!session) { res.status(401).json({ error: 'Sesi login tidak valid atau sudah berakhir.' }); return null; }
  return session;
}


// Password utilities. A changed password is stored only as a salted scrypt hash.
export function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derived) => {
      if (err) return reject(err);
      resolve(`scrypt$${salt}$${derived.toString('hex')}`);
    });
  });
}

export function verifyPassword(password, stored) {
  return new Promise((resolve, reject) => {
    if (!stored || !stored.startsWith('scrypt$')) return resolve(false);
    const [, salt, hash] = stored.split('$');
    if (!salt || !hash) return resolve(false);
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derived) => {
      if (err) return reject(err);
      const expected = Buffer.from(hash, 'hex');
      resolve(expected.length === derived.length && crypto.timingSafeEqual(expected, derived));
    });
  });
}

export const SESSION_COOKIE_NAME = COOKIE;
