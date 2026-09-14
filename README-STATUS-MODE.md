# Status Operasional: Manual + Realtime

Status operasional sekarang memiliki dua mode:

- **Realtime Monitoring (default):** status tampilan ditentukan otomatis oleh monitor agent. Perangkat online = Aktif; perangkat tidak terjangkau = Trouble; internet/jalur bermasalah mendapat status diagnosis yang sesuai.
- **Manual:** admin tetap dapat memilih status administrasi (Aktif, Maintenance, Rusak, Tidak Digunakan). Mode manual dipakai bila status operasional memang ingin dikendalikan admin.

Di form perangkat, **Status Realtime Saat Ini** selalu ditampilkan sebagai informasi read-only dan tidak dapat dipilih.

Aset lama yang belum memiliki `statusMode` otomatis dianggap **Realtime Monitoring**, sehingga tidak perlu mengedit satu per satu.
