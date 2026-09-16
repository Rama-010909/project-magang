# IT Asset Monitoring — Website Monitor + AI

Sistem monitoring aset TI berbasis React/Vite/Firebase.

## Cara kerja
- Website menjadi monitor utama ketika halaman monitoring dibuka.
- Semua aset yang memiliki IP Address atau Monitor URL dipantau setiap 10 detik.
- Status perangkat: Online / Offline / Menunggu Monitoring.
- Status internet per-perangkat hanya dinyatakan Normal/Trouble jika aset menyediakan endpoint `internetMonitorUrl` yang benar-benar melaporkan status WAN/internet. Website tidak menganggap internet aset normal hanya karena HP/PC pemantau memiliki internet.
- AI Network Analyst membaca snapshot hasil monitoring dan membuat ringkasan, gangguan, dan prioritas pemeriksaan.
- Jika Gemini/Firebase AI Logic belum aktif atau gagal, sistem memakai analisis lokal sebagai fallback.

## AI
Aktifkan Firebase AI Logic di Firebase Console > AI Services > AI Logic. Firebase menyediakan SDK JavaScript untuk web dan Gemini Developer API. App Check perlu dikonfigurasi untuk penggunaan produksi.

## Batasan browser
Browser tidak menyediakan ICMP ping mentah. Pemeriksaan website menggunakan HTTP/HTTPS yang diizinkan browser dan dapat dipengaruhi Local Network Access, mixed content, CORS, firewall, dan layanan perangkat.

## Menambahkan status internet perangkat
Isi `URL Status Internet Perangkat` pada data aset jika perangkat/router memiliki endpoint yang mengembalikan salah satu format:
- JSON: `{ "internetOnline": true }`
- JSON: `{ "internetStatus": "normal" }`
- JSON: `{ "internetStatus": "trouble" }`
- teks yang mengandung `normal/online/ok` atau `trouble/offline/down/error`.

Tanpa endpoint tersebut, status internet akan tetap `Belum Diperiksa` agar sistem tidak memberikan diagnosis palsu.
