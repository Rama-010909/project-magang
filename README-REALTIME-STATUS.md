# Status Operasional Realtime

Status yang tampil pada kartu inventaris, dashboard, filter status, detail aset, dan form edit sekarang membaca `monitorStatus/{assetId}` dari Firestore jika hasil monitoring masih fresh.

## Aturan
- `online` -> **Aktif**
- `device_trouble` / `offline` -> **Trouble**
- `internet_trouble` -> **Internet Trouble**
- `network_trouble` -> **Network Trouble**
- Jika hasil monitoring lebih lama dari 120 detik atau belum ada -> kembali ke status administrasi aset.

Status administrasi pada dokumen `assets` tidak dihapus/ditimpa oleh agent. Dengan begitu status seperti Maintenance/Rusak tetap aman sebagai data inventaris, sementara tampilan operasional mengikuti kondisi realtime.

## Agent
Jalankan `JALANKAN-MONITOR-AI.bat` pada PC Windows yang tetap menyala dan berada pada jaringan yang dapat menjangkau IP perangkat.

Interval default: 30 detik. Setelah perangkat dimatikan, status biasanya berubah setelah satu-dua siklus pemeriksaan.
