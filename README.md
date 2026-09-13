# V58 — Laporan, Cetak, dan Login Eye Fix

Perubahan:
- Pilihan laporan disederhanakan menjadi **Download Laporan** dan **Cetak**.
- Download laporan tetap berisi dokumen lengkap dengan kop, rekap, tabel, dan tanda tangan.
- Cetak menggunakan A4 landscape, tabel dibuat responsif agar tidak terpotong, dan tombol/bekas kontrol disembunyikan.
- Tombol mata password diperbaiki agar tidak tertutup atau terpotong.


## Notifikasi HP
Versi ini sudah memakai Firebase Cloud Messaging Web: izin notifikasi, VAPID key, Service Worker, token perangkat, dan penyimpanan token ke Firestore. Agar notifikasi otomatis dikirim saat aset berubah menjadi trouble/offline, tetap diperlukan pengirim FCM dari server/Cloud Functions. Pengiriman tidak bisa dilakukan hanya dari browser yang sudah ditutup.
