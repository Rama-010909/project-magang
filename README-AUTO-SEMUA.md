# AUTO SEMUA PERANGKAT

Target:
- Windows: install/setup sekali, lalu agent background otomatis.
- Android: setup sekali, foreground service + restart setelah boot.
- iPhone: dashboard realtime + notifikasi melalui cloud; iOS tidak menyediakan scanner LAN permanen 24/7.
- Cloud/Vercel: pemeriksaan target yang benar-benar dapat dijangkau dari internet dapat berjalan terjadwal.
- Firestore: sumber status realtime.

Penting:
IP publik harus benar-benar menyediakan service/port yang dapat diuji dan firewall/NAT mengizinkan pengecekan. IP publik saja tidak menjamin perangkat dapat dipantau.
