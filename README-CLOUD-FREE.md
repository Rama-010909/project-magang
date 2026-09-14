# Cloud Monitoring GRATIS

Paket ini tidak memakai Firebase Admin SDK, Service Account, Cloud Functions, atau Firebase Blaze. Firebase tetap bisa berada di Spark.

## Cara kerja
- Vercel: hanya hosting web + API manual.
- GitHub Actions: menjalankan cloud monitor otomatis setiap 5 menit. GitHub menyatakan interval schedule minimum adalah 5 menit.
- Firebase Auth Anonymous: memberi ID token sementara ke monitor.
- Firestore: membaca `assets` dan menulis `monitorStatus`.

## 1. Firebase Authentication
Firebase Console → Authentication → Sign-in method → aktifkan **Anonymous**.

## 2. Firestore Rules
Monitor membutuhkan akses authenticated untuk membaca `assets` dan menulis `monitorStatus`. Tambahkan/ sesuaikan aturan di rules project kamu; jangan mengganti aturan collection lain secara sembarangan. Contoh bagian minimal:

```text
match /assets/{id} {
  allow read: if request.auth != null;
}
match /monitorStatus/{id} {
  allow read, write: if request.auth != null;
}
```

Jika aplikasi web kamu sekarang memakai aturan public untuk membaca data, aturan existing boleh tetap dipakai selama monitor anonymous mendapat izin yang diperlukan.

## 3. GitHub
Upload seluruh isi project ke repository. Folder `.github/workflows/cloud-monitor.yml` akan menjalankan monitor tiap 5 menit. Kamu juga bisa menjalankan manual dari tab Actions → Cloud Monitor (Free) → Run workflow.

GitHub Actions standard runner gratis untuk repository public. Repository private memakai kuota GitHub Free.

## 4. Vercel
Tidak perlu `FIREBASE_SERVICE_ACCOUNT_JSON`. Tidak perlu Firebase Blaze. Tidak perlu memasang Cloud Functions. Deploy project seperti biasa.

`/api/monitor` masih tersedia untuk pengecekan manual jika `CRON_SECRET` diisi di Vercel Environment, tetapi monitoring otomatis utama berasal dari GitHub Actions.

## Catatan penting
- GitHub scheduled workflow tidak menjamin tepat pada detik/menit tertentu; jadwal dapat mengalami delay.
- Target `publicIp`/`monitorUrl` harus benar-benar dapat dijangkau dari internet.
- Public IP saja tidak menjamin perangkat dapat diprobe jika firewall/NAT menutup port.
- Jangan membuka Winbox/SSH/RDP ke internet hanya untuk monitoring. Gunakan endpoint/port monitoring khusus.
