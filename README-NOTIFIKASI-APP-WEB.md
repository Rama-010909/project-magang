# Notifikasi Aplikasi + Website

Versi ini memakai dua jalur notifikasi:

1. Android native monitor: memunculkan notifikasi lokal ketika status perangkat berubah atau Internet berubah. Monitoring berjalan 10 detik.
2. Website/PWA: Firestore listener menampilkan notifikasi ketika halaman/PWA aktif. FCM + service worker menangani push ketika website/PWA berada di background, selama token FCM sudah terdaftar dan backend FCM aktif.

Perubahan yang dipantau:
- Perangkat Online -> Offline
- Perangkat Offline -> Online
- Internet Normal -> Trouble
- Internet Trouble -> Normal

Notifikasi tidak dikirim setiap 10 detik; hanya ketika status berubah.
