# CLOUD MONITORING — MODE SERIUS

Cloud sekarang menjadi monitor utama. Windows/Android tidak wajib menyala untuk pemeriksaan aset yang dapat dijangkau dari internet.

## Cara kerja
1. Cloud membaca koleksi `assets`.
2. Untuk aset dengan `monitorUrl`, cloud melakukan HTTP check.
3. Jika tidak ada `monitorUrl`, cloud menggunakan `publicIp` dan mencoba port monitoring yang ditentukan di `monitorPorts`.
4. Hasil ditulis ke `monitorStatus/{assetId}` setiap menit.
5. Firestore realtime mengirim perubahan ke dashboard.
6. Firebase Cloud Function mengirim notifikasi perubahan Online/Offline.

## Penting
IP publik saja belum cukup. Router/firewall harus benar-benar mengizinkan port monitoring yang dipakai. Jangan membuka port administrasi hanya demi monitoring; lebih aman gunakan endpoint health-check HTTPS khusus.

## Firebase Cloud Scheduler
Versi utama menggunakan `functions.cloudMonitor` dengan jadwal 1 menit. Deploy:

```bash
cd functions
npm install
firebase deploy --only functions:cloudMonitor,functions:notifyMonitorStatus
```

Scheduled Cloud Functions memerlukan project Firebase yang mengaktifkan billing sesuai ketentuan Google Cloud.

## Vercel fallback
`/api/monitor` tetap disediakan sebagai fallback/manual endpoint. Set environment variables di Vercel:
- `FIREBASE_SERVICE_ACCOUNT_JSON` = JSON service account Firebase
- `CRON_SECRET` = secret panjang acak

Jangan taruh service-account JSON di source code atau GitHub.

## Field aset yang disarankan
```text
kodeAset: "PC-001"
publicIp: "203.0.113.10"
monitorUrl: "https://203.0.113.10/health"
monitorPorts: [443]
```

Gunakan `monitorUrl` bila perangkat punya endpoint health-check. `publicIp` + `monitorPorts` adalah fallback TCP.
