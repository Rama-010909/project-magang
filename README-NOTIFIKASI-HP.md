# Notifikasi Background HP + Desktop

## Alur sekarang
GitHub Actions -> Cloud Monitor -> Firestore `monitorStatus` -> deteksi perubahan status -> Firebase Cloud Messaging (FCM) -> Chrome/Edge/PWA.

### Aktivasi browser
1. Deploy website melalui HTTPS.
2. Buka website sekali di HP/desktop.
3. Izinkan notifikasi saat diminta.
4. Pastikan token muncul di Firestore `notificationTokens`.
5. Setelah token tersimpan, browser dapat menerima push saat website tidak sedang dibuka, selama browser/OS mengizinkan notifikasi background.

### Kredensial push server
GitHub Actions membutuhkan repository secret bernama:

`FIREBASE_SERVICE_ACCOUNT_JSON`

Isinya seluruh JSON key service account Firebase/Google Cloud. Jangan commit JSON tersebut ke repository.

GitHub -> Settings -> Secrets and variables -> Actions -> New repository secret.

Workflow akan tetap menjalankan monitoring jika secret belum ada, tetapi log akan menyebut bahwa push FCM dilewati.

### Jenis notifikasi
- `Online -> Offline`: Peringatan Perangkat Offline.
- `Offline -> Online`: Perangkat Kembali Online.
- Tidak ada perubahan status: tidak mengirim notifikasi baru.

### Android native
Android monitor tetap mempunyai monitoring lokal. Saat service mendeteksi perubahan Online/Offline, aplikasi menampilkan notifikasi lokal. Untuk push FCM native terpisah, Android app harus didaftarkan sebagai app Android di Firebase dan dikonfigurasi dengan kredensial Android Firebase.

### Windows
LAN monitor PowerShell juga menampilkan notifikasi Windows lokal ketika mendeteksi transisi Online/Offline. ntfy tetap tersedia jika `Topic` di konfigurasi diisi.

## Catatan
- Scheduled GitHub Actions berjalan dengan interval minimum 5 menit dan jadwal dapat sedikit terlambat.
- Vercel Hobby tidak digunakan sebagai scheduler per menit.
- Jangan membuka port administrasi seperti Winbox/SSH/RDP ke internet hanya untuk monitoring. Gunakan `monitorUrl` atau port monitoring khusus.


## Status FIX terbaru
Untuk aset LAN/private, sumber status adalah Windows/Android LAN monitor. GitHub Actions hanya membaca status tersebut untuk meneruskan event ke FCM dan tidak menimpanya dengan hasil probe cloud.
