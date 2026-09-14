NOTIFIKASI BACKGROUND HP + DESKTOP

Alur:
Firebase monitorStatus -> Cloud Function -> FCM -> Chrome/Android service worker -> notifikasi.

Setelah sebuah perangkat pernah memberikan izin notifikasi dan berhasil memperoleh token FCM,
website/PWA tidak perlu dibuka untuk menerima push.

PENTING:
- Install/download aplikasi saja TIDAK dapat membuat token FCM atau memberikan izin notifikasi.
- Browser wajib diberi izin notifikasi oleh pengguna minimal satu kali.
- Setelah token tersimpan, halaman boleh ditutup; FCM dapat membangunkan service worker di background.
- Cloud Function harus sudah dideploy dan Firebase Cloud Messaging aktif.
