# IT Asset Management - Monitoring Otomatis

1. Masukkan IP sumber internet, IP perangkat, hostname, atau URL monitoring pada data aset.
2. Jalankan `JALANKAN-MONITOR.bat` pada komputer Windows yang terhubung ke jaringan melalui Wi-Fi atau kabel.
3. Agent mengambil data aset dari Firestore dan memeriksa setiap alamat secara berkala menggunakan HTTPS/HTTP, ICMP, dan port TCP umum.
4. Hasil pemeriksaan disimpan ke koleksi `monitorStatus` dan dashboard menampilkan status Aman/Online atau Gangguan/Trouble.

Catatan penting: agent harus berada pada jaringan yang dapat menjangkau IP target. IP publik yang berada di balik NAT/firewall harus menyediakan akses monitoring yang sesuai. Jika tidak dapat dijangkau, status ditampilkan sebagai gangguan/tidak merespons, bukan dianggap aman.

## Auto monitoring
Lihat `README-AUTO-MONITORING.md` dan `auto-discovery-config.example.json` untuk konfigurasi deteksi perangkat otomatis dari MikroTik.
