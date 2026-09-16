# AUTO SEMUA PERANGKAT

Target:
- Windows: install/setup sekali, lalu agent background otomatis.
- Android: setup sekali, foreground service + restart setelah boot.
- iPhone: dashboard realtime + notifikasi melalui cloud; iOS tidak menyediakan scanner LAN permanen 24/7.
- Cloud/Vercel: pemeriksaan target yang benar-benar dapat dijangkau dari internet dapat berjalan terjadwal.
- Firestore: sumber status realtime.

Penting:
IP publik harus benar-benar menyediakan service/port yang dapat diuji dan firewall/NAT mengizinkan pengecekan. IP publik saja tidak menjamin perangkat dapat dipantau.


# FIX monitoring LAN + notifikasi semua sisi

Perbaikan terbaru:
- Windows LAN Agent sekarang login Anonymous Firebase sebelum membaca/menulis Firestore, sehingga cocok dengan Rules `request.auth != null`.
- GitHub Cloud Monitor tidak lagi menimpa status `monitorStatus` untuk IP private/LAN. Status LAN tetap berasal dari PC monitor di jaringan lokal.
- GitHub memakai `notificationState` agar perubahan Online/Offline dari LAN agent bisa diteruskan ke FCM tanpa spam.
- Website/PWA menerima FCM ketika browser berada di background/tertutup selama izin notifikasi dan service worker sudah pernah diaktifkan. Firebase mendukung background notification melalui service worker.
- Windows agent mengirim popup saat transisi Online/Offline dan berjalan otomatis lewat Scheduled Task.
- Android monitor memakai Foreground Service + Boot Receiver, sehingga monitoring dan popup dapat berjalan setelah boot tanpa membuka aplikasi setiap kali. Android tetap membutuhkan setup/izin notifikasi sekali; pembatasan baterai OEM dapat perlu diatur sekali.
- iOS native wrapper tidak dapat dijadikan scanner LAN 24/7 seperti Android/Windows karena pembatasan background iOS. Untuk notifikasi push di iPhone gunakan PWA/Home Screen + izin notifikasi.

## Firestore Rules
Gunakan isi `FIRESTORE-RULES-FINAL.txt`. Jangan memakai `allow ...: if true`.

## Penting
Setelah memasang paket ini, jalankan `JALANKAN-MONITOR.bat` sekali untuk memastikan muncul `Firebase Auth: Anonymous OK`. Setelah itu pasang `PASANG-MONITOR-SEMUA.bat` agar Windows berjalan otomatis saat login.
