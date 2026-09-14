# Notifikasi HP

1. Deploy website menggunakan HTTPS.
2. Buka website melalui Chrome Android.
3. Buka menu notifikasi aplikasi, lalu tekan **Aktifkan Notifikasi**.
4. Pastikan izin notifikasi situs di Chrome adalah **Izinkan**.
5. Pastikan dokumen `notificationTokens` muncul di Firestore.
6. Deploy Cloud Functions:

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

Aplikasi kini memakai satu service worker Firebase untuk notifikasi latar belakang. Jangan mendaftarkan service worker lain dengan scope `/`, karena dapat mengambil alih service worker FCM.
