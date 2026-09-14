# STATUS FIX6

Masalah pada versi sebelumnya: Monitor Agent mendapat `400 Bad Request` dari Firebase Auth/Firestore karena API key Web App dipakai langsung pada REST endpoint. Akibatnya `Aset terbaca: 0`, sehingga dashboard terus `Menunggu Monitoring`.

FIX6 mengubah agent agar endpoint Firestore REST tidak lagi menempelkan API key. Firestore akan menentukan izin berdasarkan Security Rules. Ini cocok bila aplikasi web saat ini memang bisa membaca collection `assets` tanpa login.

Jalankan `JALANKAN-MONITOR.bat`.

Hasil yang diharapkan:
- `Aset terbaca: N` dengan N > 0
- setiap aset menghasilkan `ONLINE` atau `OFFLINE`
- tidak ada `[FIRESTORE READ ERROR]`
- tidak ada `[STATUS TIDAK TERKIRIM]`

Jika muncul `PERMISSION_DENIED`, berarti Rules Firestore memang tidak mengizinkan agent tanpa autentikasi. Jangan membuka database ke publik hanya untuk memperbaiki agent; gunakan autentikasi/endpoint backend yang aman.
