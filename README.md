# IT Asset Management Diskominfo Batang — V38 Free Browser Notification

Versi ini sengaja **tidak menggunakan Vercel Environment Variables, Firebase Admin SDK, atau Vercel Pro** untuk notifikasi.

## Notifikasi gratis
- Aktifkan izin notifikasi dari menu lonceng.
- Firestore tetap menjadi sumber data.
- Saat halaman/PWA aktif dan menerima perubahan Firestore, browser menampilkan notifikasi Trouble/Rusak atau Maintenance sesuai pengaturan.
- Tidak ada token FCM dan tidak ada kredensial server.

## Batasan penting
Tanpa layanan pengirim push/server, browser tidak dapat menerima perubahan Firestore secara otomatis ketika seluruh website/PWA benar-benar tidak berjalan. Jadi versi gratis ini tidak mengklaim push background penuh saat aplikasi ditutup.

## Vercel
Framework Preset: Other
Install Command: npm install
Build Command: npm run build
Output Directory: dist

Tidak perlu Environment Variables khusus untuk fitur notifikasi versi ini.
\n\n## V41 — Local LAN Monitor (Gratis, tanpa Vercel Pro / Environment Variables)\n\nVersi ini menambahkan **Local LAN Monitor Agent** untuk memantau PC, server, printer, CCTV, access point, MikroTik, dan perangkat LAN lain dari komputer Windows yang berada di jaringan yang sama. Agent berjalan terpisah dari website sehingga monitoring tetap berjalan saat website ditutup.\n\n### Yang dilakukan agent\n- Membaca aset dari Firestore.\n- Jika aset memiliki `IP Address` atau `Alamat Monitoring`, agent memeriksa target.\n- Untuk URL: pemeriksaan HTTP.\n- Untuk IP/hostname: ICMP ping, lalu mencoba port umum (80, 443, 22, 23, 8291, 8080, 9100, 3389).\n- Setelah 2 kali gagal berturut-turut, aset dianggap **Trouble/Offline**.\n- Status ditulis ke koleksi `monitorStatus` di Firestore.\n- Mengirim notifikasi ke HP melalui **ntfy.sh** ketika perangkat pertama kali masuk Trouble.\n- Mengirim notifikasi pemulihan ketika perangkat kembali Online.\n\n### Cara memakai di Windows\n1. Extract ZIP.\n2. Pastikan Windows memiliki PowerShell (Windows 10/11 biasanya sudah ada).\n3. Jalankan `JALANKAN-MONITOR.bat`.\n4. Saat pertama dijalankan, terminal menampilkan **Topic ntfy** acak. Simpan topic tersebut.\n5. Di HP, instal aplikasi **ntfy** dari sumber aplikasi resmi, lalu subscribe ke topic yang sama. Topic sengaja dibuat acak; jangan membagikannya ke publik.\n6. Biarkan komputer agent menyala selama monitoring diperlukan.\n\n### Firestore Rules\nTambahkan: `monitorStatus` agar agent bisa menulis dan website bisa membaca. Untuk demo sesuai Rules aset saat ini:\n\n```firestore\nmatch /monitorStatus/{document=**} {\n  allow read, write: if true;\n}\n```\n\n### Penting\n- Tidak memakai Firebase Service Account.\n- Tidak memakai Environment Variables Vercel.\n- Tidak membutuhkan Vercel Pro.\n- Agent harus berjalan pada PC yang bisa menjangkau perangkat LAN.\n- Jika komputer agent dimatikan, pemeriksaan berhenti.\n- `ntfy.sh` adalah layanan pihak ketiga gratis; topic publik secara teknis dapat menerima pesan jika topic diketahui, sehingga gunakan topic acak dan jangan dipublikasikan.\n