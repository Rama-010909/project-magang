# Cloud Monitor Gratis + Push Notification

Alur utama:
GitHub Actions (5 menit) -> cek aset -> Firestore monitorStatus -> deteksi perubahan -> FCM -> browser/PWA.

Monitoring tetap berjalan tanpa service account. Push background membutuhkan kredensial Firebase Cloud Messaging yang disimpan aman sebagai GitHub Actions Secret:

`FIREBASE_SERVICE_ACCOUNT_JSON`

Jangan menaruh JSON service account di source code atau mengunggahnya ke GitHub.

## Setup satu kali
1. Di Firebase/Google Cloud, buat Service Account untuk project `it-asset-diskominfo-batang`.
2. Buat key JSON untuk service account tersebut.
3. Di GitHub repository -> Settings -> Secrets and variables -> Actions -> New repository secret.
4. Name: `FIREBASE_SERVICE_ACCOUNT_JSON`
5. Value: isi seluruh JSON key.
6. Jalankan workflow `Cloud Monitor` secara manual sekali untuk pengujian.

Setelah token FCM browser/HP tersimpan di koleksi `notificationTokens`, perubahan `Online -> Offline` dan `Offline -> Online` akan dikirim ke token-token tersebut.

Catatan:
- GitHub Actions scheduled workflow minimal 5 menit dan dapat terlambat beberapa menit.
- Vercel hanya menjadi hosting web/API; bukan scheduler per menit pada paket Hobby.
- Android native pada paket ini tetap punya monitor lokal dan notifikasi lokal saat service mendeteksi perubahan. Push FCM native memerlukan Android app Firebase yang terdaftar jika ingin dijadikan channel push terpisah.
- Windows LAN agent sekarang juga menampilkan notifikasi Windows lokal saat transisi Offline/Online, selain ntfy bila Topic diatur.


### Sinkronisasi notifikasi terbaru
- `monitor-agent.ps1` adalah sumber status untuk aset LAN/private.
- GitHub Actions tidak menimpa `monitorStatus` aset private.
- `notificationState` dipakai untuk mengingat status terakhir yang sudah dikirim ke FCM agar notifikasi tidak spam.


### State notifikasi
State perubahan notifikasi disimpan di `monitorStatus/{assetId}/_notification/state` agar memakai permission path `monitorStatus/{document=**}` yang sama dengan status monitor. Ini menghindari error permission pada collection `notificationState` pada deployment Firestore Rules yang belum diperbarui.
