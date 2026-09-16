# Mode PWA - Instal Sekali

Alur penggunaan:

1. Buka website melalui HTTPS.
2. Aktifkan **Notifikasi** sekali dari menu lonceng.
3. Jika browser menampilkan tombol **Pasang Aplikasi**, pilih **Pasang Aplikasi**.
4. Setelah terpasang, buka dari ikon aplikasi.
5. Service Worker tetap menangani FCM ketika aplikasi/browser berada di background atau tidak sedang dibuka.
6. Monitoring perangkat tetap dilakukan oleh monitor-agent/cloud monitor, bukan oleh halaman PWA.

Catatan:
- Browser/OS tetap meminta izin notifikasi dan instalasi sekali. Website tidak boleh memasang aplikasi secara paksa.
- Windows agent harus sudah dipasang sebagai auto-start pada komputer yang memang menjadi mesin monitoring LAN.
- Android native monitor tetap memerlukan izin notifikasi dan pengaturan baterai yang sesuai pada perangkat.
- iPhone/iPad mengikuti batasan background iOS; PWA dapat menerima web push setelah izin diberikan.
- HTTPS diperlukan untuk FCM Web/Service Worker.
