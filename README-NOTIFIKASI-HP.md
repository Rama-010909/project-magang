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


## Penting setelah update

- Deploy ulang website agar `firebase-messaging-sw.js` berada di root domain HTTPS.
- Deploy ulang Cloud Functions setelah perubahan `functions/index.js`.
- Pada setiap HP/desktop, buka website sekali, tekan **Aktifkan Notifikasi**, lalu pilih **Izinkan**.
- Untuk Android, instal PWA dari Chrome setelah izin notifikasi diberikan.
- Jangan menghapus izin notifikasi, data situs, atau Service Worker setelah token dibuat.
- Perubahan status yang dikirim adalah perubahan pada `monitorStatus/{assetId}`. Jika status tidak berubah, fungsi tidak mengirim notifikasi baru.


## Checklist HP dan desktop

1. Deploy ulang website dan Functions.
2. Hapus Service Worker lama melalui DevTools > Application > Service Workers jika versi lama masih tersimpan.
3. Buka website sekali pada setiap perangkat, lalu tekan Aktifkan Notifikasi.
4. Izinkan notifikasi untuk website dan untuk Chrome/Edge di pengaturan Windows/Android.
5. Jangan gunakan mode Incognito untuk pengujian.
6. Di desktop, aktifkan opsi background apps Chrome/Edge jika browser menyediakan opsi tersebut.
7. Uji dengan tab ditutup terlebih dahulu. Menutup seluruh browser dapat bergantung pada pengaturan browser/OS.


## Versi v72

Cloud Function sekarang mengirim payload `notification` + `data`. Saat aplikasi/tab berada di background, Chrome/Edge dan Firebase Service Worker dapat menampilkan notifikasi sistem; saat aplikasi terbuka, `onMessage` menampilkan notifikasi melalui Service Worker. Hindari mendaftarkan Service Worker kedua dengan scope `/`.
