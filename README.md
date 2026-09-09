# IT Asset Management — Diskominfo Kabupaten Batang

Sistem inventaris perangkat IT dengan React/Vite, Firebase Firestore, dan Vercel Blob.

## Login
- Username: `admin`
- Password: `kominfobatang`

## Jalankan
1. `npm install`
2. Salin `.env.example` menjadi `.env.local`
3. Isi konfigurasi Firebase.
4. Di Vercel buat Blob Store dan tambahkan `BLOB_READ_WRITE_TOKEN`.
5. Jalankan `npm run dev`.

## Firestore
Buat collection `assets` dan `maintenance`. Dokumen akan dibuat otomatis oleh aplikasi.

## Fitur
- Dashboard statistik dan grafik status aset.
- Tambah, edit, hapus, cari, dan filter aset.
- Detail aset lengkap.
- Upload foto perangkat melalui Vercel Blob.
- Riwayat maintenance tambah/hapus.
- QR Code yang membuka detail aset.
- Laporan cetak/PDF.
- Export data CSV.
- Navigasi desktop dan bottom navigation khusus HP.
- Logo Pemkab Batang dan Diskominfo menggunakan file gambar asli tanpa perubahan.
