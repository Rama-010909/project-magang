# Notifikasi Background HP + Komputer

Versi ini menggunakan Firebase Cloud Messaging (FCM) + Service Worker.

## Hasil yang ditargetkan

Setelah perangkat **sekali** membuka aplikasi untuk memberi izin notifikasi dan mendaftarkan token FCM:

- HP tidak perlu membuka aplikasi lagi untuk menerima push.
- PWA Chrome/Edge di komputer tidak perlu membuka jendela aplikasi lagi untuk menerima push.
- Push diproses oleh `public/firebase-messaging-sw.js` di background.
- Saat notifikasi diklik, aplikasi dibuka/fokus kembali.

## Penting

"Tanpa dibuka" berarti **setelah registrasi perangkat selesai**. Browser tidak dapat memperoleh izin notifikasi atau token FCM pertama kali secara diam-diam tanpa interaksi pengguna.

Di komputer, setelah install PWA dan klik Izinkan Notifikasi satu kali, tutup jendelanya lalu uji perubahan status aset. Chrome harus tetap diizinkan menjalankan notifikasi/background.

## Deploy

Build dan deploy project seperti biasa. Function `notifyMonitorStatus` harus ikut dideploy ke Firebase Functions.
