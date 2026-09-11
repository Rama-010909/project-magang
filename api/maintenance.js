import { firestore } from './lib/firestore.js';
import { requireSession } from './lib/auth.js';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req, res) {
  if (!requireSession(req, res)) return;
  try {
    const ref = firestore.collection('maintenance');
    if (req.method === 'GET') {
      const snap = await ref.orderBy('tanggal', 'desc').get();
      return res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
    if (req.method === 'POST') {
      const { record, assetId, newStatus } = req.body || {};
      const created = await ref.add({ ...(record || {}), assetId, createdAt: FieldValue.serverTimestamp() });
      if (newStatus && assetId) await firestore.collection('assets').doc(assetId).update({ status: newStatus, updatedAt: FieldValue.serverTimestamp() });
      return res.status(201).json({ id: created.id });
    }
    if (req.method === 'DELETE') {
      const id = req.query?.id || req.body?.id;
      if (!id) return res.status(400).json({ error: 'ID maintenance wajib diisi.' });
      await ref.doc(id).delete();
      return res.json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Operasi maintenance gagal.' }); }
}
