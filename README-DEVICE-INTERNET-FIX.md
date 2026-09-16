# Device + Internet Monitoring FIX

Versi ini memperbaiki tiga hal utama:

1. Status perangkat (Online/Offline) dipisahkan dari status internet.
2. IP management dipakai untuk menentukan perangkat hidup/terjangkau.
3. IP Internet/WAN, jika tersedia di field `publicIp`, `ipPublic`, `internetIp`, `ipInternet`, atau IP publik yang ditemukan di `ipAddress`, diperiksa terpisah.

## Interval

- Windows PowerShell agent: 10 detik.
- Browser/PWA fallback: 10 detik saat aplikasi aktif.
- Android monitor: mengikuti interval agent Android pada paket.
- GitHub Actions/cloud: tetap mengikuti batas scheduler cloud, bukan 10 detik.

## Field aset yang didukung

- `ipAddress`: IP management/LAN. Jika berisi beberapa IP, IP private diprioritaskan untuk status perangkat.
- `monitorUrl`: URL management perangkat.
- `publicIp` / `ipPublic`: IP publik/WAN.
- `internetIp` / `ipInternet`: IP Internet/WAN alternatif.
- `internetUrl`: endpoint HTTP yang memang mewakili koneksi internet aset, jika tersedia.
- `internetPorts`: port WAN yang memang sengaja dapat diuji.

## Notifikasi

Notifikasi lokal Windows tetap dikirim oleh PowerShell ketika terjadi perubahan status. Dashboard/PWA juga mendeteksi perubahan `monitorStatus` Firestore dan menampilkan notifikasi ketika izin browser sudah diberikan.

FCM background tetap membutuhkan token FCM yang aktif dan konfigurasi backend/service account untuk pengiriman dari server.

## Catatan akurasi IP WAN

Koneksi ke IP publik tidak selalu menerima koneksi masuk. Firewall/NAT dapat membuat IP WAN terlihat tidak terjangkau walaupun internet sebenarnya normal. Untuk pemeriksaan internet yang benar-benar berasal dari router, gunakan probe/API dari router itu sendiri (misalnya Netwatch pada MikroTik), bukan hanya menguji IP publik dari PC monitoring.
