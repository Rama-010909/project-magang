# FIX10 - Realtime Monitoring Stable

Perbaikan utama:
- LAN monitor agent adalah satu-satunya sumber Online/Offline perangkat.
- Browser tidak lagi melakukan ping HTTP ke IP LAN.
- Firestore `monitorStatus/{assetId}` dipakai langsung oleh web.
- Agent tidak memakai AI untuk membalik fakta Online/Offline.
- `failThreshold` minimal 1, sehingga perangkat yang benar-benar mati menjadi Offline pada pemeriksaan berikutnya.
- Notifikasi web mengikuti transisi `online: true -> false` dan `false -> true` dari Firestore.
- Notifikasi tidak dipicu oleh status administratif atau Internet Trouble.
- PowerShell agent tetap memakai `System.Net.NetworkInformation.Ping`, kompatibel PowerShell 5.1.

Urutan tes:
1. Jalankan `JALANKAN-MONITOR.bat`.
2. Pastikan CMD menunjukkan `Aset terbaca: N` dan write `monitorStatus/{assetId}` berhasil.
3. Saat perangkat hidup, Firestore harus `online: true` dan web Online.
4. Matikan perangkat, tunggu satu interval monitoring, Firestore harus `online: false` dan web Offline.


## FIX10 FINAL2
- Dokumen `monitorStatus` menggunakan `kodeAset` sebagai document ID.
- Web memprioritaskan status berdasarkan `kodeAset`, sehingga dokumen lama ber-ID acak tidak mengambil alih status realtime.
- Kartu Dashboard `Perangkat Aktif` menghitung perangkat yang benar-benar `online` dari monitoring agent, bukan field administratif `status`.
- Device status ditentukan langsung dari hasil probe agent: online = aktif, gagal = mati/tidak terjangkau.
