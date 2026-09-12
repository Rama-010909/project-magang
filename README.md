# IT Asset Management — Diskominfo Kabupaten Batang (V44)

Perbaikan V44:
- Memperbaiki blank putih setelah login: menambahkan `Icons.Monitor` yang sebelumnya direferensikan tetapi belum didefinisikan, penyebab React error #130 pada halaman setelah login.
- Memperbaiki tombol mata password agar ikon utuh, terpusat, dan tidak terpotong.
- Favicon browser menggunakan lambang Kabupaten Batang dengan latar transparan.
- Memakai React + Vite + Firebase Firestore + Supabase Storage untuk foto aset. Vercel Blob tidak digunakan.

Deploy Vercel (sesuai pengaturan yang dipakai):
- Framework Preset: Other
- Install Command: npm install
- Build Command: npm run build
- Output Directory: dist
- Tidak perlu Vercel Pro.


## Penyimpanan Foto
Upload foto aset sekarang menggunakan Supabase Storage bucket `asset-photos` (public). Vercel Blob tidak lagi digunakan. Firestore tetap menyimpan data aset dan URL foto. Pastikan Storage RLS mengizinkan INSERT untuk bucket `asset-photos`.
