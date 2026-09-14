# Instalasi monitoring otomatis

## Windows
1. Letakkan folder project di PC yang selalu menyala dan berada di LAN kantor.
2. Jalankan `PASANG-MONITOR-SEMUA.bat` satu kali.
3. Setelah berhasil, monitoring berjalan di background saat Windows login.
4. Tidak perlu membuka BAT/aplikasi monitor lagi.

## Android
Folder `android-monitor` berisi project Android Studio untuk aplikasi background monitor.
1. Build/install APK.
2. Buka aplikasi satu kali untuk mengaktifkan service.
3. Setelah aktif, UI aplikasi tidak perlu dibuka lagi.
4. Setelah HP restart, service akan mencoba aktif kembali.
5. Untuk monitoring LAN, HP harus berada di jaringan LAN yang sama.

Android modern memang tidak mengizinkan service foreground dinyalakan diam-diam segera setelah instalasi. Karena itu pembukaan pertama diperlukan sekali.
