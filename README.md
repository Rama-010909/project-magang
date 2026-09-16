# IT Asset Monitoring — Website Monitor + AI

Sistem monitoring aset TI berbasis React/Vite/Firebase.

## Cara kerja
- Website menjadi monitor utama ketika halaman monitoring dibuka.
- Semua aset yang memiliki IP Address atau Monitor URL dipantau setiap 10 detik.
- Status perangkat: Online / Offline / Menunggu Monitoring.
- Status internet per-perangkat hanya dinyatakan Normal/Trouble jika aset menyediakan endpoint `internetMonitorUrl` yang benar-benar melaporkan status WAN/internet. Website tidak menganggap internet aset normal hanya karena HP/PC pemantau memiliki internet.
- AI Network Analyst membaca snapshot hasil monitoring dan membuat ringkasan, gangguan, dan prioritas pemeriksaan.
- Jika Gemini/Firebase AI Logic belum aktif atau gagal, sistem memakai analisis lokal sebagai fallback.

## AI
Aktifkan Firebase AI Logic di Firebase Console > AI Services > AI Logic. Firebase menyediakan SDK JavaScript untuk web dan Gemini Developer API. App Check perlu dikonfigurasi untuk penggunaan produksi.

## Batasan browser
Browser tidak menyediakan ICMP ping mentah. Pemeriksaan website menggunakan HTTP/HTTPS yang diizinkan browser dan dapat dipengaruhi Local Network Access, mixed content, CORS, firewall, dan layanan perangkat.

## Menambahkan status internet perangkat
Isi `URL Status Internet Perangkat` pada data aset jika perangkat/router memiliki endpoint yang mengembalikan salah satu format:
- JSON: `{ "internetOnline": true }`
- JSON: `{ "internetStatus": "normal" }`
- JSON: `{ "internetStatus": "trouble" }`
- teks yang mengandung `normal/online/ok` atau `trouble/offline/down/error`.

Tanpa endpoint tersebut, status internet akan tetap `Belum Diperiksa` agar sistem tidak memberikan diagnosis palsu.

## Notifikasi saat website/PWA tidak dibuka

Versi ini memakai Firebase Cloud Messaging (FCM) + Firebase Cloud Function. Setelah pengguna mengaktifkan izin notifikasi minimal sekali dan token tersimpan di `notificationTokens`, perubahan status pada `monitorStatus/{assetId}` akan dikirim oleh Cloud Function ke perangkat yang terdaftar. Service worker `public/firebase-messaging-sw.js` menerima pesan background.

### Deploy Cloud Function

Dari folder project:

```bash
cd functions
npm install
cd ..
firebase deploy --only functions:notifyAssetStatusChange
```

Jika Firebase CLI meminta login/project, pilih project `it-asset-diskominfo-batang`.

### Penting

- Website harus HTTPS (Vercel sudah HTTPS).
- Pengguna harus mengaktifkan izin notifikasi satu kali.
- Token FCM harus berhasil tersimpan di Firestore collection `notificationTokens`.
- Monitor yang tetap berjalan saat website ditutup harus berasal dari LAN agent/router/server yang menulis perubahan ke `monitorStatus`. Browser tidak dapat terus melakukan scanning LAN setelah halaman ditutup.
- Cloud Function hanya mengirim notifikasi ketika nilai `online` atau `internetOnline` benar-benar berubah, sehingga tidak mengirim spam setiap 10 detik.
- Scheduled Cloud Functions memakai Cloud Scheduler dan dapat memerlukan billing/Blaze; fungsi trigger Firestore di atas dipicu oleh perubahan data, bukan timer.


VERSI GRATIS: Cloud Functions sengaja tidak digunakan agar project tetap Firebase Spark tanpa billing.
