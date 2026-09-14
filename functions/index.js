const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

exports.notifyMonitorStatus = onDocumentWritten('monitorStatus/{assetId}', async (event) => {
  const before = event.data?.before?.exists ? event.data.before.data() : null;
  const after = event.data?.after?.exists ? event.data.after.data() : null;
  if (!after) return;

  const previous = String(before?.status ?? before?.state ?? '').trim().toLowerCase();
  const current = String(after.status ?? after.state ?? '').trim().toLowerCase();
  const trouble = ['trouble', 'offline', 'gangguan', 'unreachable', 'down', 'error'].includes(current);
  const safe = ['online', 'aman', 'ok', 'healthy', 'up', 'normal'].includes(current);
  if (!trouble && !safe) return;
  if (previous === current) return;

  const db = getFirestore();
  const snap = await db.collection('notificationTokens').where('enabled', '==', true).get();
  const tokens = snap.docs.map(d => d.data().token || d.id).filter(Boolean);
  if (!tokens.length) return;

  const title = trouble ? 'Peringatan Gangguan Aset' : 'Aset Kembali Aman';
  const body = `${after.nama || after.name || after.assetName || 'Perangkat'}: ${current}`;
  const response = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: { assetId: String(event.params.assetId), status: current, title, body, url: '/' },
    webpush: { fcmOptions: { link: '/' }, notification: { icon: '/favicon.png', badge: '/favicon.png', tag: `asset-${event.params.assetId}`, requireInteraction: trouble } }
  });

  const invalid = [];
  response.responses.forEach((r, i) => {
    const code = r.error?.code;
    if (!r.success && ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(code)) invalid.push(tokens[i]);
  });
  await Promise.all(invalid.map(token => db.collection('notificationTokens').doc(token).delete().catch(() => null)));
  console.log(`FCM: ${response.successCount} berhasil, ${response.failureCount} gagal`);
});
