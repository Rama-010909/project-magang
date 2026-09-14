# STATUS FIX9

Fix ini menyatukan sumber status perangkat pada `monitorStatus/{assetId}` dari agent LAN. Browser tidak melakukan ping ke IP aset. Online/Offline berasal langsung dari field boolean `online` yang ditulis agent. Notifikasi perubahan Online -> Offline juga dipicu dari perubahan dokumen monitorStatus saat web aktif, sedangkan agent mengirim notifikasi ntfy untuk transisi perangkat.

FIX9 juga menghapus grace period yang dapat membuat perangkat yang sudah mati tetap terlihat Online.
