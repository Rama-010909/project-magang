# Monitoring IP Internet/WAN

Versi ini tidak menganggap IP WAN trouble hanya karena ping atau port router ditutup.
Agent mencoba ping/port terlebih dahulu, kemudian melakukan pemeriksaan kesehatan internet:
- HTTPS ke endpoint internet
- HTTPS ke Cloudflare
- DNS Google melalui 8.8.8.8

Jika minimal dua pemeriksaan berhasil, status dianggap **AMAN**. Jika gagal, status dianggap **GANGGUAN**.

Catatan: pemeriksaan kesehatan internet menunjukkan koneksi internet dari komputer agent. Untuk memastikan router tertentu secara spesifik, gunakan API MikroTik/SNMP/VPN.
