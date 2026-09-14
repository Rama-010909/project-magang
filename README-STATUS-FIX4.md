# STATUS FIX 4

Perbaikan inti:
- Status realtime perangkat memakai record `monitorStatus/{assetId}` dari agent jika field `online` sudah berupa boolean.
- Timestamp `checkedAt` tidak lagi menyebabkan status berubah menjadi "Menunggu Monitoring" hanya karena format timestamp tidak terbaca SDK.
- Agent LAN memakai `System.Net.NetworkInformation.Ping`, kompatibel dengan Windows PowerShell 5.1.
- Status perangkat tetap hanya Online/Offline; status internet dipisahkan.
- Status administratif tidak memengaruhi monitoring.

Jika setelah menjalankan `JALANKAN-MONITOR.bat` web masih Menunggu Monitoring, berarti record `monitorStatus` belum masuk ke Firestore. Console agent akan menampilkan `[FIRESTORE ERROR]` atau `Aset terbaca: 0` bila jalur Firestore bermasalah.
