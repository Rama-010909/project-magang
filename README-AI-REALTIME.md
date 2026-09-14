# IT Asset Management Diskominfo Batang — Monitoring Real-Time + AI Lokal

Versi ini sudah dirapikan untuk monitoring real-time.

## Yang berjalan
- Agent Windows mengecek aset secara berkala (default 30 detik).
- Target perangkat dicek dari IP/monitor URL.
- Kesehatan internet jaringan monitoring dicek terpisah.
- Status dipisahkan menjadi `online`, `device_trouble`, `internet_trouble`, atau `network_trouble`.
- Data status dikirim ke Firestore `monitorStatus/{assetId}`.
- `consecutiveTrouble` dipakai agar gangguan sesaat tidak langsung dianggap alert.
- Firebase Function mengirim FCM background push setelah minimal 2 pemeriksaan gangguan.
- Payload FCM dibuat data-only supaya Service Worker tidak menampilkan notifikasi dua kali.
- Setelah izin notifikasi dan token FCM pernah diaktifkan, registrasi dapat dipulihkan otomatis saat aplikasi dibuka kembali.
- AI lokal memakai endpoint OpenAI-compatible llama.cpp di `127.0.0.1:8080` jika engine/model tersedia.
- Jika AI lokal tidak tersedia, diagnosis rule-based tetap berjalan.

## AI portable
Folder yang disiapkan:
- `AI/bin/llama-server.exe`
- `AI/models/model.gguf`

Binary engine dan model belum termasuk karena tidak tersedia di lingkungan pembuatan paket ini. Jangan menganggap versi ini sudah memiliki model AI di dalam ZIP.

## Menjalankan
Klik `JALANKAN-MONITOR-AI.bat` di Windows.

Untuk notifikasi FCM cloud, Firebase Functions harus dideploy terpisah:
`firebase deploy --only functions`

## Catatan
Real-time berarti agent melakukan polling berkala dan Firestore mengalirkan perubahan ke dashboard. Default interval 30 detik; ubah `intervalSeconds` pada `monitor-agent-config.json` bila diperlukan.
