# IT Asset Management Diskominfo Kabupaten Batang — V15

Versi online: **Firestore untuk data** + **Vercel Blob untuk foto**.
Tidak perlu menjalankan `npm install` atau `npm run` di laptop untuk mengedit project. Saat deploy ke Vercel, Vercel akan memasang dependency server API secara otomatis.

## 1. Firebase / Firestore
1. Buka Firebase Console dan project yang sudah dibuat.
2. Buat/aktifkan Firestore Database.
3. Tambahkan Web App lalu salin konfigurasi ke `firebase-config.js`.
4. Gunakan rules pada `firestore.rules` untuk demo ini.

> Rules ini cocok untuk project/demo tanpa Firebase Authentication, tetapi **bukan aturan production** karena siapa pun yang mengetahui project ID dapat mencoba menulis ke Firestore. Untuk production, tambahkan Authentication/custom backend.

Collection yang dipakai:
- `assets`
- `maintenance`

Data contoh otomatis dibuat sekali jika collection `assets` masih kosong.

## 2. Vercel Blob
Di Vercel Project → Settings → Environment Variables tambahkan:
- `BLOB_READ_WRITE_TOKEN` = token Read/Write dari Vercel Blob Store

API upload berada di `/api/upload` dan foto disimpan pada prefix `asset/`.

## 3. Deploy
Upload folder project ini ke GitHub lalu Import ke Vercel. Vercel otomatis memasang dependency API. Tidak perlu menjalankan npm di laptop.

## Login demo
Username: `admin`
Password: `kominfobatang`

## Catatan
- Data aset dan maintenance tersimpan online di Firestore.
- URL foto tersimpan di Firestore, file foto tersimpan di Vercel Blob.
- Data tidak lagi bergantung pada localStorage sebagai penyimpanan utama.
