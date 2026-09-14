# iPhone Auto Monitoring

iPhone tidak dapat menjalankan scanner LAN 24/7 tanpa batas di background seperti Windows/Android.

Mode iPhone pada paket ini diposisikan sebagai dashboard realtime. Agar informasi tetap dapat diterima ketika aplikasi tidak sedang dibuka, notifikasi harus dikirim oleh backend/cloud (misalnya Firebase Cloud Messaging/APNs).

Jadi:
- pemeriksaan perangkat dilakukan oleh cloud endpoint yang dapat menjangkau target publik;
- Firestore menyimpan status;
- iPhone menerima dashboard/status dan notifikasi;
- tidak ada proses scanner permanen di iPhone yang diklaim berjalan 24/7.
