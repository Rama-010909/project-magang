import { put, del } from '@vercel/blob';
import Busboy from 'busboy';

export const config = { api: { bodyParser: false } };

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const bb = Busboy({ headers: req.headers });
    let fileBuffer = null, filename = 'asset', mime = 'application/octet-stream';
    bb.on('file', (_name, file, info) => {
      filename = info.filename || 'asset';
      mime = info.mimeType || mime;
      const chunks = [];
      file.on('data', c => chunks.push(c));
      file.on('end', () => { fileBuffer = Buffer.concat(chunks); });
    });
    bb.on('finish', () => resolve({ fileBuffer, filename, mime }));
    bb.on('error', reject);
    req.pipe(bb);
  });
}

export default async function handler(req, res) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN belum diatur di Vercel.' });
    if (req.method === 'DELETE') {
      const url = String(req.query.url || '');
      if (url) await del(url);
      return res.status(200).json({ ok: true });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method tidak diizinkan.' });
    const { fileBuffer, filename, mime } = await parseMultipart(req);
    if (!fileBuffer?.length) return res.status(400).json({ error: 'File foto tidak ditemukan.' });
    if (!mime.startsWith('image/')) return res.status(400).json({ error: 'File harus berupa gambar.' });
    if (fileBuffer.length > 8 * 1024 * 1024) return res.status(400).json({ error: 'Ukuran foto maksimal 8 MB.' });
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '-');
    const blob = await put(`asset/${Date.now()}-${safe}`, fileBuffer, { access: 'public', contentType: mime, token: process.env.BLOB_READ_WRITE_TOKEN });
    return res.status(200).json({ url: blob.url });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'Upload gagal.' });
  }
}
