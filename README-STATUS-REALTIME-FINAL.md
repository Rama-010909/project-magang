# Status Realtime Final

Perubahan utama:
- Status yang tampil pada kartu inventaris, dashboard, tabel, detail, dan filter berasal dari `monitorStatus`, bukan dari `assets.status`.
- `assets.status` tetap menjadi status administratif/manual: Aktif, Maintenance, Rusak, Tidak Digunakan.
- Status administratif tidak pernah menghentikan monitoring. Perangkat berstatus administratif `Tidak Digunakan` tetap boleh dipantau.
- Status realtime: Aktif, Trouble, Internet Trouble, Network Trouble, Menunggu Monitoring.
- Data monitoring dianggap valid maksimal 120 detik. Jika lebih lama, UI menampilkan Menunggu Monitoring agar tidak menampilkan status lama sebagai status realtime.
- Monitor agent menulis hasil ke `monitorStatus/{assetId}` setiap interval.

## Pengujian
1. Pastikan IP Address perangkat di data aset benar.
2. Jalankan `JALANKAN-MONITOR-AI.bat` dari PC yang dapat mengakses IP perangkat.
3. Tunggu 30-60 detik.
4. Perangkat hidup -> Status Realtime: Aktif.
5. Matikan perangkat -> setelah beberapa kali pemeriksaan -> Status Realtime: Trouble.
6. Jangan gunakan Status Administratif untuk menilai apakah perangkat hidup/mati.

Jika tetap Menunggu Monitoring, lihat jendela PowerShell agent. Error `[FIRESTORE READ ERROR]` berarti agent tidak bisa membaca collection `assets`; error `[FIRESTORE ERROR]` berarti hasil tidak bisa ditulis ke `monitorStatus`.
