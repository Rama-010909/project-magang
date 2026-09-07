# IT Asset Management

Sistem inventaris perangkat IT dengan React/Vite, Firebase Firestore, dan Vercel Blob.

## Jalankan
1. `npm install`
2. salin `.env.example` menjadi `.env.local`
3. isi konfigurasi Firebase.
4. di Vercel buat Blob Store dan tambahkan `BLOB_READ_WRITE_TOKEN`.
5. `npm run dev`

## Firestore
Buat collection `assets` dan `maintenance`. Aplikasi membuat dokumen otomatis.

## Catatan
Login pada versi awal adalah demo. Untuk penggunaan kantor, tambahkan Firebase Authentication dan Firestore Security Rules.
