const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

exports.notifyMonitorStatus = onDocumentWritten('monitorStatus/{assetId}', async (event) => {
  const before = event.data?.before?.exists ? event.data.before.data() : null;
  const after = event.data?.after?.exists ? event.data.after.data() : null;
  if (!after) return;

  // Monitor agent menyimpan status utama pada field `online`, bukan `status`.
  // Gunakan online sebagai sumber kebenaran agar perubahan hasil monitoring
  // benar-benar memicu FCM walaupun dashboard tidak sedang dibuka.
  const previousOnline = before?.online;
  const currentOnline = after?.online;
  const previous = String(before?.status ?? before?.state ?? (previousOnline === true ? 'online' : previousOnline === false ? 'trouble' : '')).trim().toLowerCase();
  const current = String(after.status ?? after.state ?? (currentOnline === true ? 'online' : currentOnline === false ? 'trouble' : '')).trim().toLowerCase();
  const trouble = current === 'trouble' || ['offline', 'gangguan', 'unreachable', 'down', 'error'].includes(current);
  const safe = current === 'online' || ['aman', 'ok', 'healthy', 'up', 'normal'].includes(current);
  if (!trouble && !safe) return;
  if (previous === current) return;

  const db = getFirestore();
  const snap = await db.collection('notificationTokens').where('enabled', '==', true).get();
  const tokens = snap.docs.map(d => d.data().token || d.id).filter(Boolean);
  if (!tokens.length) return;

  const title = trouble ? 'Peringatan Gangguan Aset' : 'Aset Kembali Aman';
  const body = `${after.nama || after.name || after.assetName || 'Perangkat'}: ${current === 'trouble' ? 'Tidak merespons / trouble' : 'Kembali online'}`;
  // FCM multicast maksimal 500 token per request. Pecah otomatis agar
  // semua perangkat (HP maupun komputer) tetap menerima push.
  const chunks = [];
  for (let i = 0; i < tokens.length; i += 500) chunks.push(tokens.slice(i, i + 500));

  let successCount = 0;
  let failureCount = 0;
  const invalid = [];

  for (const chunk of chunks) {
    const response = await getMessaging().sendEachForMulticast({
      tokens: chunk,
      notification: {
        title,
        body
      },
      data: {
        assetId: String(event.params.assetId),
        assetName: String(after.nama || after.name || after.assetName || 'Perangkat'),
        status: current,
        title,
        body,
        url: 'https://it-asset-management-diskominfo-batang.vercel.app/'
      },
      webpush: {
        headers: { Urgency: trouble ? 'high' : 'normal' },
        fcmOptions: { link: 'https://it-asset-management-diskominfo-batang.vercel.app/' }
      }
    });

    successCount += response.successCount;
    failureCount += response.failureCount;
    response.responses.forEach((r, i) => {
      const code = r.error?.code;
      if (!r.success && [
        'messaging/registration-token-not-registered',
        'messaging/invalid-registration-token'
      ].includes(code)) invalid.push(chunk[i]);
    });
  }

  await Promise.all(invalid.map(token =>
    db.collection('notificationTokens').doc(token).delete().catch(() => null)
  ));
  console.log(`FCM background push: ${successCount} berhasil, ${failureCount} gagal`);
});
