# IT Asset Management Diskominfo Batang

Versi ini menggunakan login admin tanpa Firebase Authentication.

## Login
- Username: `admin`
- Password: `kominfobatang`

Kredensial diverifikasi di endpoint server `/api/login`, bukan di frontend.
Session menggunakan HttpOnly + Secure cookie.

## Environment Variables Vercel
Wajib diisi:
- `SESSION_SECRET` (minimal 32 karakter)
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `BLOB_READ_WRITE_TOKEN` jika fitur upload foto digunakan

Jangan memasukkan file service account atau token rahasia ke GitHub.

## Deploy
Vercel akan menjalankan `npm install` dan `npm run build` otomatis.
Build command: `npm run build`
Output directory: `dist`


## Fitur Keamanan Admin
- Menu **Keamanan Akun** tersedia di sidebar dan mobile.
- Password dapat diubah setelah login.
- Jika belum pernah diubah, login menggunakan `admin / kominfobatang` (server-side).
- Firebase Authentication tidak digunakan.
