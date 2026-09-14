# Status Operasional Realtime

Status Operasional memiliki dua mode:
- **Realtime Monitoring**: sistem membaca `monitorStatus/{assetId}` dari agent.
- **Manual**: admin dapat memilih status administrasi.

Jika realtime tetap `Menunggu Monitoring`, jalankan `JALANKAN-MONITOR-AI.bat` dan lihat konsol. Harus muncul `Aset terbaca: N` dan setiap aset menghasilkan `-> ONLINE` atau status trouble.

Agent sekarang memakai Firebase Firestore REST API + API key proyek untuk membaca aset dan menulis `monitorStatus`.

Status realtime dianggap valid selama hasil pengecekan terakhir berumur maksimal 120 detik.
