# IT Asset Management — Diskominfo Kabupaten Batang

Versi ini mempertahankan desain React/Vite asli dan menerapkan perubahan yang diminta:

- Firestore sebagai penyimpanan data aset dan maintenance (tanpa fallback localStorage).
- Vercel Blob untuk foto perangkat melalui `/api/upload`.
- Login `admin` / `kominfobatang`, tanpa menampilkan kredensial di halaman login.
- Logo Pemkab/Diskominfo dapat diklik untuk melihat ukuran besar.
- Lokasi aset dapat diklik untuk membuka Google Maps.
- QR code tetap menggunakan `qrcode.react`.

## Deploy Vercel

Framework: Vite (deteksi otomatis). Build Command: `npm run build`. Output Directory: `dist`.

Jangan menambahkan runtime custom pada `vercel.json`.

Buat Vercel Blob Store dan pastikan `BLOB_READ_WRITE_TOKEN` tersedia pada Environment Variables project.

## Firebase

Konfigurasi Firebase Web App berada di `src/firebase.js`. Firestore collections yang digunakan: `assets` dan `maintenance`.

## Catatan

Endpoint foto membutuhkan deployment Vercel. Data Firestore dapat digunakan dari browser setelah konfigurasi Firebase/Rules selesai.
