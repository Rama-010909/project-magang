# Notifikasi HP V65

Versi ini menggunakan ntfy untuk notifikasi yang tetap masuk ketika website ditutup.

## Pengaturan
1. Instal aplikasi **ntfy** di HP dari toko aplikasi resmi.
2. Jalankan `JALANKAN-MONITOR.bat` di komputer monitoring.
3. Salin `TOPIC NOTIFIKASI` yang muncul di jendela PowerShell.
4. Di aplikasi ntfy, pilih **Subscribe**, lalu masukkan:
   `https://ntfy.sh/NAMA_TOPIC`
5. Izinkan notifikasi ntfy di Android dan matikan pembatasan baterai untuk ntfy.

Notifikasi dikirim ketika status aset berubah menjadi trouble setelah jumlah kegagalan mencapai `failThreshold`, dan ketika aset pulih.

Catatan: FCM langsung ke aplikasi web membutuhkan backend/service account Firebase. Karena itu, ntfy digunakan sebagai jalur notifikasi HP yang benar-benar dapat bekerja tanpa website tetap terbuka.
