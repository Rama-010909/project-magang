import { put, del } from '@vercel/blob';
import Busboy from 'busboy';

export const config = { api: { bodyParser: false } };

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    let finished = false;
    const bb = Busboy({ headers: req.headers, limits: { files: 1, fileSize: 8 * 1024 * 1024 } });
    let fileBuffer = null;
    let filename = 'asset';
    let mime = 'application/octet-stream';

    bb.on('file', (_field, file, info) => {
      filename = info?.filename || 'asset';
      mime = info?.mimeType || mime;
      const chunks = [];
      file.on('data', chunk => chunks.push(chunk));
      file.on('limit', () => reject(new Error('Ukuran foto maksimal 8 MB.')));
      file.on('end', () => { fileBuffer = Buffer.concat(chunks); });
    });
    bb.on('finish', () => {
      if (!finished) { finished = true; resolve({ fileBuffer, filename, mime }); }
    });
    bb.on('error', err => {
      if (!finished) { finished = true; reject(err); }
    });
    req.pipe(bb);
  });
}

export default async function handler(req, res) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN belum diatur di Vercel.' });
    }

    if (req.method === 'DELETE') {
      const url = String(req.query?.url || '');
      if (!url || !url.includes('blob.vercel-storage.com')) {
        return res.status(400).json({ error: 'URL Blob tidak valid.' });
      }
      await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
      return res.status(200).json({ ok: true });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method tidak diizinkan.' });
    }

    const { fileBuffer, filename, mime } = await parseMultipart(req);
    if (!fileBuffer?.length) return res.status(400).json({ error: 'File foto tidak ditemukan.' });
    if (!mime.startsWith('image/')) return res.status(400).json({ error: 'File harus berupa gambar.' });

    const safe = String(filename).replace(/[^a-zA-Z0-9._-]/g, '-');
    const blob = await put(`asset/${Date.now()}-${safe}`, fileBuffer, {
      access: 'public',
      contentType: mime,
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    return res.status(200).json({ url: blob.url });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e?.message || 'Upload gagal.' });
  }
}
