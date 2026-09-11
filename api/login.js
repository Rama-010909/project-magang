import { firestore } from './lib/firestore.js';
import { setSession, verifyPassword } from './lib/auth.js';

const ADMIN_USERNAME = 'admin';
const DEFAULT_PASSWORD = 'kominfobatang';

async function getStoredPassword() {
  try {
    const snap = await firestore.collection('pengaturan').doc('admin').get();
    const passwordHash = snap.exists ? snap.data()?.passwordHash : null;
    return passwordHash ? { hash: passwordHash } : { plain: process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD };
  } catch (e) {
    // Firestore may not be configured yet; keep the fixed server-side login available.
    return { plain: process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username dan password wajib diisi.' });

    const credentials = await getStoredPassword();
    const valid = credentials.hash
      ? await verifyPassword(password, credentials.hash)
      : password === credentials.plain;

    if (username.trim() !== ADMIN_USERNAME || !valid) {
      return res.status(401).json({ error: 'Username atau password salah.' });
    }

    setSession(res, ADMIN_USERNAME);
    return res.status(200).json({ ok: true, username: ADMIN_USERNAME });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Login server gagal.' });
  }
}
