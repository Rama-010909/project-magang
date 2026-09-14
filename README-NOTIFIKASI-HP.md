# Notifikasi HP dan Desktop

1. Deploy website melalui HTTPS.
2. Buka website di HP dan desktop.
3. Tekan tombol **Aktifkan Notifikasi** dan pilih **Izinkan**.
4. Pastikan dokumen muncul di Firestore pada koleksi `notificationTokens`.
5. Deploy Cloud Functions:

```bash
firebase login
firebase use PROJECT_ID_KAMU
cd functions
npm install
cd ..
firebase deploy --only functions
```

Notifikasi dikirim ketika status pada `monitorStatus/{assetId}` berubah, misalnya `online` menjadi `trouble` atau `trouble` menjadi `online`.
