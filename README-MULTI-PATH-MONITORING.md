# Multi-Path Monitoring

Versi ini menambahkan jalur deteksi LAN dari browser/PWA sebagai jalur tambahan.

## Cara kerja
- Cloud monitor tetap menangani target publik.
- Saat website/PWA sedang aktif pada jaringan yang sama, sistem mencoba mendeteksi IP lokal melalui beberapa endpoint HTTP/HTTPS.
- Status browser dibandingkan dengan status monitor lain berdasarkan timestamp terbaru.
- Internet browser dipisahkan dari status perangkat: perangkat bisa Online walaupun internet browser sedang Trouble.
- FCM/service worker tetap menangani notifikasi background.

## Batas teknis
Browser tidak dapat dijadikan scanner LAN 24/7 setelah semua halaman/PWA benar-benar dihentikan. Local Network Access, permission, mixed-content dan CORS tetap dikendalikan browser. Untuk monitoring LAN tanpa perangkat/agent yang aktif sama sekali, tidak ada jalur jaringan yang dapat mencapai alamat private dari cloud.

Build penuh belum diverifikasi di environment ini karena `npm install` timeout. Source JS tambahan sudah lolos import syntax check.


### State notifikasi
State perubahan notifikasi disimpan di `monitorStatus/{assetId}/_notification/state` agar memakai permission path `monitorStatus/{document=**}` yang sama dengan status monitor. Ini menghindari error permission pada collection `notificationState` pada deployment Firestore Rules yang belum diperbarui.
