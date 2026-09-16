# PWA INSTAL SEKALI — IT Asset Management Diskominfo Batang

Versi ini disiapkan supaya alurnya:

1. Buka website HTTPS.
2. Service Worker otomatis terdaftar.
3. Browser menampilkan opsi **Pasang Aplikasi** jika PWA install prompt tersedia.
4. Setelah dipasang, aplikasi berjalan dalam mode standalone.
5. Jika izin notifikasi sudah diberikan, token FCM dipulihkan otomatis.
6. Saat aplikasi/web tidak sedang dibuka, `firebase-messaging-sw.js` menangani push notification.

## Catatan penting

PWA tidak boleh dipaksa memasang dirinya sendiri atau meminta izin notifikasi tanpa tindakan pengguna. Instalasi dan izin notifikasi dilakukan sekali oleh pengguna.

Monitoring LAN tetap dilakukan oleh monitor-agent Windows/Android. PWA berfungsi sebagai tampilan dan penerima notifikasi, bukan scanner LAN ketika proses PWA sudah ditutup.

## Deploy

Gunakan HTTPS (misalnya Vercel). Setelah deploy:

- buka website;
- login;
- izinkan notifikasi;
- pilih **Pasang Aplikasi** jika tombol muncul;
- tutup tab/browser dan uji push notification.

Firebase Cloud Messaging Web membutuhkan HTTPS dan service worker untuk push notification.
