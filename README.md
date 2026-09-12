# IT Asset Management — Diskominfo Kabupaten Batang (V44)

Perbaikan V44:
- Memperbaiki blank putih setelah login: menambahkan `Icons.Monitor` yang sebelumnya direferensikan tetapi belum didefinisikan, penyebab React error #130 pada halaman setelah login.
- Memperbaiki tombol mata password agar ikon utuh, terpusat, dan tidak terpotong.
- Favicon browser menggunakan lambang Kabupaten Batang dengan latar transparan.
- Tetap memakai React + Vite + Firebase Firestore + Vercel Blob seperti versi sebelumnya.

Deploy Vercel (sesuai pengaturan yang dipakai):
- Framework Preset: Other
- Install Command: npm install
- Build Command: npm run build
- Output Directory: dist
- Tidak perlu Vercel Pro.
