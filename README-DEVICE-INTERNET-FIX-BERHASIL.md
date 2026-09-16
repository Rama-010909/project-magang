# Device + Internet Monitoring FIX

Versi ini memperbaiki sumber status monitoring agar tidak saling menimpa.

## Monitoring perangkat
- Agent Windows menjadi sumber utama status Online/Offline.
- Probe memakai ICMP lalu fallback TCP beberapa port.
- Browser/PWA hanya menjadi fallback; hasil browser tidak menimpa hasil agent yang masih fresh.
- Polling agent: 10 detik.
- Polling browser/PWA: 10 detik.

## Monitoring Internet
Field aset yang didukung:
- `internetIp`
- `publicIp`
- `ipPublic`
- `ipInternet`
- `internetCheckUrl` (opsional)

Prioritas:
1. IP Internet/WAN yang terdaftar diprobe.
2. `internetCheckUrl` jika diisi.
3. Probe Internet fallback dari mesin monitoring.

`navigator.onLine` browser TIDAK dipakai lagi sebagai status Internet perangkat.

## Penting
Probe IP WAN dari luar tidak selalu membuktikan koneksi outbound perangkat karena firewall/NAT dapat memblokir ICMP/TCP inbound. Untuk perangkat router seperti MikroTik, pemeriksaan paling akurat adalah probe yang dijalankan dari router/jaringan tersebut (misalnya Netwatch/API).
