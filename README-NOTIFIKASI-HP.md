# Notifikasi HP dan Desktop

1. Deploy website melalui HTTPS.
2. Buka website di HP/desktop menggunakan Chrome/Edge.
3. Tekan **Aktifkan Notifikasi** dan pilih **Allow/Izinkan**.
4. Pastikan dokumen `notificationTokens` muncul di Firestore.
5. Deploy Cloud Functions:

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

6. Pastikan agent monitoring menulis perubahan status ke `monitorStatus`.

Notifikasi dikirim ketika status berubah, misalnya `aman -> trouble` atau `trouble -> aman`. Service worker FCM sudah menangani notifikasi ketika tab/website tidak sedang terbuka.
