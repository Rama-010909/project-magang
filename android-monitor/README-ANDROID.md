# IT Asset Monitor — Android Background Monitor

Aplikasi Android menjalankan monitoring LAN di background menggunakan Foreground Service.

- Install dan buka sekali untuk mengaktifkan service.
- Setelah aktif, UI aplikasi tidak perlu dibuka lagi.
- Setelah restart HP, service mencoba aktif kembali melalui BOOT_COMPLETED.
- Interval pemeriksaan default 30 detik.
- Untuk perangkat private LAN, HP harus berada di jaringan LAN yang sama.
- Android dapat membatasi background; izinkan notifikasi dan gunakan Battery > Unrestricted untuk aplikasi ini bila tersedia.

Catatan: Android modern tidak mengizinkan aplikasi langsung menyalakan foreground service secara diam-diam saat baru selesai di-install. Pengguna perlu membuka aplikasi minimal sekali untuk mengaktifkannya. Setelah itu service berjalan di background.
