import { firestore } from './lib/firestore.js';
import { requireSession } from './lib/auth.js';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req, res) {
  if (!requireSession(req, res)) return;
  try {
    const ref = firestore.collection('assets');
    if (req.method === 'GET') {
      const snap = await ref.orderBy('createdAt', 'desc').get();
      return res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
    if (req.method === 'POST') {
      const data = { ...(req.body || {}), createdAt: FieldValue.serverTimestamp() };
      const created = await ref.add(data);
      return res.status(201).json({ id: created.id });
    }
    if (req.method === 'PATCH') {
      const { id, ...data } = req.body || {};
      if (!id) return res.status(400).json({ error: 'ID aset wajib diisi.' });
      await ref.doc(id).update({ ...data, updatedAt: FieldValue.serverTimestamp() });
      return res.json({ ok: true });
    }
    if (req.method === 'DELETE') {
      const id = req.query?.id || req.body?.id;
      if (!id) return res.status(400).json({ error: 'ID aset wajib diisi.' });
      await ref.doc(id).delete();
      return res.json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Operasi aset gagal.' }); }
}
