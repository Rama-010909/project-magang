# V43 — Blank Fix + UI Polish

Perbaikan dari V42:
- Menghilangkan dependensi Leaflet dari runtime React untuk mencegah halaman blank setelah login.
- Peta laporan tetap tersedia menggunakan OpenStreetMap embed yang aman; daftar titik lokasi tetap bisa dibuka ke Google Maps.
- Service Worker push tidak dipanggil otomatis saat login; notifikasi foreground tetap tersedia tanpa Environment Variables/Vercel Pro.
- Ikon mata password diperbaiki agar tidak terpotong.
- Favicon/tab browser dibuat sebagai ikon persegi yang rapi.
- Firestore tetap menjadi sumber data.

Vercel: Framework Other, install `npm install`, build `npm run build`, output `dist`.
