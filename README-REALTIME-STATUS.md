# Status Operasional Realtime

Status Operasional memiliki dua mode:
- **Realtime Monitoring**: sistem membaca `monitorStatus/{assetId}` dari agent.
- **Manual**: admin dapat memilih status administrasi.

Jika realtime tetap `Menunggu Monitoring`, jalankan `JALANKAN-MONITOR-AI.bat` dan lihat konsol. Harus muncul `Aset terbaca: N` dan setiap aset menghasilkan `-> ONLINE` atau status trouble.

Agent sekarang memakai Firebase Firestore REST API + API key proyek untuk membaca aset dan menulis `monitorStatus`.

Status realtime dianggap valid selama hasil pengecekan terakhir berumur maksimal 120 detik.


### State notifikasi
State perubahan notifikasi disimpan di `monitorStatus/{assetId}/_notification/state` agar memakai permission path `monitorStatus/{document=**}` yang sama dengan status monitor. Ini menghindari error permission pada collection `notificationState` pada deployment Firestore Rules yang belum diperbarui.
