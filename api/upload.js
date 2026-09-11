import { put } from '@vercel/blob';
import { requireSession } from './lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  if (!requireSession(req, res)) return;
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(500).json({ error: 'Blob storage belum dikonfigurasi.' });
    const type = req.headers['content-type'] || '';
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(type)) return res.status(415).json({ error: 'Format foto harus JPG, PNG, atau WebP.' });
    const size = Number(req.headers['content-length'] || 0);
    if (size > 8 * 1024 * 1024) return res.status(413).json({ error: 'Ukuran foto maksimal 8 MB.' });
    const ext = type === 'image/jpeg' ? 'jpg' : type.split('/')[1];
    const blob = await put(`assets/${crypto.randomUUID()}.${ext}`, req, { access: 'public', contentType: type, addRandomSuffix: false });
    return res.json({ url: blob.url });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Upload gagal.' }); }
}
