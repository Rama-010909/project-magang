# STATUS FIX8

Perbaikan utama:
- Browser tidak lagi melakukan ping langsung ke IP perangkat. Ini mencegah mixed-content/CORS dari HTTPS yang sebelumnya dapat menghasilkan OFFLINE palsu dan notifikasi palsu.
- Local LAN Monitor Agent menjadi sumber kebenaran tunggal untuk status perangkat.
- Satu hasil pemeriksaan gagal dari agent langsung menjadi `online=false` / OFFLINE.
- Data monitoring tetap ditulis ke `monitorStatus/{assetId}`.
- Status internet tetap terpisah dari status perangkat.

Setelah update, jalankan `JALANKAN-MONITOR.bat` dan tunggu satu siklus (sekitar 30 detik). Jika perangkat dimatikan, hasil berikutnya harus OFFLINE. Jika dinyalakan kembali dan merespons, siklus berikutnya harus ONLINE.
