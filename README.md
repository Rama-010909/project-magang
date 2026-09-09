# IT Asset Management — Diskominfo Kabupaten Batang

Sistem Manajemen & Inventarisasi Perangkat Teknologi Informasi dan Komunikasi (TIK) Pemerintah Kabupaten Batang berbasis React 19, Vite, Firebase Firestore, dan Vercel Blob.

## Kredensial Login
- **Username**: `admin`
- **Password**: `kominfobatang`
*(Sesi tersimpan aman di peramban dan tombol logout dapat diakses baik pada desktop maupun ponsel)*

## Cara Menjalankan
1. `npm install`
2. Jalankan `npm run dev` untuk langsung mencoba (aplikasi dilengkapi penyimpanan lokal persisten dengan data awal perangkat Diskominfo Batang).
3. Jika ingin menghubungkan ke Cloud Firebase Firestore:
   - Salin `.env.example` menjadi `.env.local`
   - Isi kredensial project Firebase Anda.
4. Untuk upload foto di production Vercel:
   - Hubungkan Blob Store dan tambahkan `BLOB_READ_WRITE_TOKEN`.
   - Di lingkungan lokal tanpa Vercel Blob, sistem secara otomatis mengompres foto secara client-side agar upload tetap berfungsi 100%.

## Fitur Utama
- **Desain Modern Pemerintahan & SPBE**: Antarmuka berwibawa khas Diskominfo Batang dengan palet warna navy, biru teknologi, dan aksen cyan.
- **Penyesuaian Logo Proporsional**: Mengintegrasikan Lambang Resmi Kabupaten Batang (`pemkab-batang.png`) dan Logo Diskominfo secara tajam di Sidebar, Header Ponsel, Login, dan Kop Surat.
- **Dashboard Operasional**: Ringkasan metrik (Total, Aktif, Maintenance, Rusak), progress bar status, dan cloud tag kategori.
- **Manajemen Inventaris (CRUD)**:
  - Pencarian pintar multi-kolom (kode, nama, lokasi, IP, MAC, serial number).
  - Filter kategori, status, kondisi, dan pengurutan data.
  - Mode tampilan berganti: **Tampilan Kartu (Grid)** atau **Tampilan Tabel (List)**.
- **Detail Aset & Stiker Label QR**:
  - Generator dan pembaca QR Code penaut URL perangkat.
  - **Cetak Stiker Label Aset BMD**: Format siap cetak untuk ditempelkan pada fisik CPU/Server/Router.
  - Tombol salin cepat untuk IP Address, MAC Address, dan Serial Number.
- **Pemeliharaan & Servis (Maintenance)**:
  - Pencatatan servis dengan teknisi, keluhan, tindakan, dan hasil akhir.
  - Opsi otomatisasi pembaruan status perangkat setelah servis selesai.
- **Laporan Resmi**:
  - Format Cetak / PDF dengan **KOP SURAT RESMI** Pemerintah Kabupaten Batang - Dinas Komunikasi dan Informatika lengkap dengan kolom tanda tangan pengesahan.
  - Ekspor data tabel ke format **Excel / CSV** dengan UTF-8 BOM.
- **Optimalisasi Layar Ponsel (Mobile)**:
  - Top Bar khusus seluler dengan info dinas dan tombol Logout cepat.
  - Dock Bottom Navigation melayang dengan efek kaca (*glassmorphism*) dan Floating Action Button (+).
  - Modal adaptif gaya *bottom-sheet* yang pas di layar HP.

