const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

exports.notifyMonitorStatus = onDocumentWritten('monitorStatus/{assetId}', async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!after) return;

  const previous = before?.status || before?.state;
  const current = after.status || after.state;
  const trouble = ['trouble', 'offline', 'gangguan', 'unreachable'].includes(String(current).toLowerCase());
  const recovered = ['online', 'aman', 'ok', 'healthy'].includes(String(current).toLowerCase());
  if (!trouble && !recovered) return;
  if (previous && String(previous).toLowerCase() === String(current).toLowerCase()) return;

  const db = getFirestore();
  const snap = await db.collection('notificationTokens').where('enabled', '==', true).get();
  const tokens = snap.docs.map(d => d.get('token')).filter(Boolean);
  if (!tokens.length) return;

  const title = trouble ? 'Peringatan Gangguan Aset' : 'Aset Kembali Aman';
  const body = `${after.nama || after.name || after.assetName || 'Perangkat'}: ${current}`;
  const response = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: { assetId: event.params.assetId, status: String(current) },
    webpush: { fcmOptions: { link: '/' }, notification: { icon: '/favicon.png', tag: `asset-${event.params.assetId}` } }
  });

  const invalid = [];
  response.responses.forEach((r, i) => {
    if (!r.success && ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(r.error?.code)) invalid.push(tokens[i]);
  });
  await Promise.all(invalid.map(token => db.collection('notificationTokens').doc(token).delete().catch(() => null)));
});
