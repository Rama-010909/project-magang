# IT Asset Management — Diskominfo Kabupaten Batang

Versi ini mengembalikan desain/UI dari project pertama yang dikirim, sambil mempertahankan koneksi Firestore dan endpoint Vercel Blob.

## Login demo
Username: `admin`
Password: `kominfobatang`

## Deploy Vercel
- Framework: Vite (terdeteksi otomatis)
- Build Command: kosong / default Vercel
- Output Directory: kosong / default Vite (`dist`)
- Jangan menambahkan runtime function manual.
- Tambahkan `BLOB_READ_WRITE_TOKEN` di Environment Variables untuk upload foto.

Firebase Web App config sudah diletakkan di `src/firebase.js`.
