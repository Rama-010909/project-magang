# Auto Monitoring dari IP Sumber Internet

Versi ini menambahkan konsep **auto-discovery MikroTik**. Admin cukup mengisi IP router/sumber internet dan akun API monitoring. Agent yang berjalan di komputer mana pun yang mempunyai akses ke IP router akan:

1. Mengambil DHCP Lease dan ARP Table MikroTik.
2. Mendeteksi IP/MAC/hostname perangkat secara otomatis.
3. Membuat atau memperbarui aset hasil discovery.
4. Mengecek status perangkat secara berkala.
5. Mengirim status ke Firestore.

Komputer admin/HP tidak harus terhubung ke Wi-Fi kantor. Yang harus mempunyai akses ke router adalah komputer yang menjalankan agent. Untuk akses dari luar jaringan, gunakan VPN atau akses API MikroTik yang diamankan; jangan membuka API ke seluruh internet.

Salin `auto-discovery-config.example.json` menjadi `auto-discovery-config.json`, lalu isi IP router dan akun API khusus read-only.
