# CLOUD MONITORING — FINAL

## Tujuan
Cloud menjadi pemeriksa utama. Windows dan Android tidak wajib menyala agar aset yang dapat dijangkau dari internet tetap diperiksa.

## 1. Deploy web ke Vercel
Import repository/project ke Vercel dan gunakan:
- Build: `npm run build`
- Output: `dist`
- Install: `npm install`

## 2. Buat Firebase service account
Firebase Console → Project settings → Service accounts → Generate new private key.

Simpan JSON tersebut sebagai Vercel Environment Variable:
- `FIREBASE_SERVICE_ACCOUNT_JSON` = seluruh isi JSON dalam satu baris.
- `CRON_SECRET` = secret acak panjang.

Jangan masukkan JSON service account ke GitHub atau frontend.

## 3. Deploy ulang Vercel
Setelah Environment Variables disimpan, Redeploy project.
Vercel Cron akan memanggil `/api/monitor` setiap menit dan mengirim `Authorization: Bearer <CRON_SECRET>`.

## 4. Isi aset
Di Firestore collection `assets`, contoh:

```json
{
  "kodeAset": "PC-001",
  "nama": "PC Operator",
  "publicIp": "203.0.113.10",
  "monitorPorts": [443]
}
```

Lebih baik memakai endpoint health-check:

```json
{
  "kodeAset": "PC-001",
  "nama": "PC Operator",
  "monitorUrl": "https://monitor.example.go.id/health"
}
```

`monitorUrl` diprioritaskan. Jika kosong, cloud mencoba `publicIp` + `monitorPorts`.

## 5. Uji manual
Sesudah deploy, buka endpoint `/api/monitor` tanpa Authorization akan mendapat `401 Unauthorized`. Itu normal.
Cron Vercel yang memiliki `CRON_SECRET` yang benar akan dapat menjalankannya.

## 6. Arti status
- Target dapat dijangkau → `Online`
- Tidak ada port/endpoint yang dapat dijangkau → `Offline`
- Perangkat Offline → `internetStatus` tidak otomatis dianggap gangguan internet.

## 7. Keamanan
Jangan membuka port administrasi seperti Winbox/SSH hanya untuk monitoring. Gunakan endpoint health-check HTTPS atau port layanan yang memang sudah dibutuhkan.

Cloud hanya memeriksa alamat yang diisi di collection `assets`. IP private `10.x.x.x`, `172.16-31.x.x`, `192.168.x.x`, localhost, dan alamat link-local tidak dianggap target public cloud.

## Catatan
IP publik saja tidak menjamin target dapat diperiksa. Firewall/NAT/service pada sisi target harus mengizinkan koneksi dari internet.
