# Android Auto Monitoring

1. Install aplikasi.
2. Buka sekali untuk memberikan izin dan mengaktifkan service.
3. Setelah aktif, aplikasi berjalan sebagai foreground service meskipun layar mati.
4. Setelah restart Android, BootReceiver mencoba menjalankan service kembali.
5. Agar lebih stabil, izinkan Autostart dan Battery = Unrestricted pada pengaturan sistem HP.

Android tetap memiliki pembatasan dari masing-masing vendor, jadi izin baterai/autostart perlu diberikan bila diminta.
