# Cloud Monitoring

Monitoring sekarang dapat dipanggil otomatis oleh Vercel Cron melalui `/api/monitor`.

**Batasan penting:** Vercel berjalan di internet, bukan di jaringan kantor/LAN. IP private seperti `192.168.x.x`, `10.x.x.x`, dan `172.16.x.x–172.31.x.x` tidak dapat diping/diakses langsung dari Vercel. Untuk aset LAN, tetap diperlukan jalur dari jaringan LAN ke cloud (agent/service/VPN/tunnel). Jangan menganggap cron cloud dapat mendeteksi PC LAN yang mati.

Untuk target yang mempunyai URL/IP yang memang dapat diakses dari internet, endpoint akan memperbarui `monitorStatus` otomatis setiap menit. Jika sudah ada dokumen `monitorStatus` lama yang memiliki `assetId` atau `kodeAset`, ID acak tersebut dipertahankan.

Firestore Rules harus mengizinkan akses yang digunakan endpoint. Jangan membuat rules publik hanya untuk mengatasi error.
