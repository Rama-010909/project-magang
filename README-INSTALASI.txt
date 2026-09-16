IT ASSET MONITORING - VERSI GRATIS FIREBASE SPARK

VERSI INI TIDAK MENGGUNAKAN CLOUD FUNCTIONS.
JANGAN UPGRADE FIREBASE KE BLAZE DAN JANGAN MASUKKAN BILLING.

WEBSITE:
1. npm install
2. npm run build
3. Deploy hasil website ke Vercel.

FIREBASE:
- Tetap menggunakan Firestore pada Firebase Spark.
- Tidak ada folder/functions dan tidak perlu firebase deploy --only functions.
- Firebase CLI hanya diperlukan jika kamu memang ingin memakai Firebase Hosting.

NOTIFIKASI:
- Service Worker + FCM tetap tersedia untuk pendaftaran token.
- Notifikasi lokal/perubahan status saat website sedang terbuka tetap bisa digunakan.
- Untuk mengirim FCM dari server ketika website benar-benar ditutup, dibutuhkan komponen pengirim yang selalu berjalan. Cloud Functions dihapus pada versi gratis ini agar project tetap Spark tanpa billing.
- Jadi versi ini TIDAK menjanjikan monitoring/notifikasi server-side saat seluruh website ditutup.

MONITORING:
- Monitoring browser tetap berjalan ketika website/PWA sedang aktif.
- Pengecekan perangkat mengikuti kemampuan browser dan aturan keamanan jaringan lokal.

TUJUAN:
- 100% tanpa Blaze.
- Tanpa billing.
- Tanpa Cloud Functions.
- Tetap menggunakan Firebase Spark + Firestore + Vercel.
