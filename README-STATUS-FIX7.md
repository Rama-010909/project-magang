# STATUS FIX7

Memperbaiki bug dokumen Firestore `monitorStatus` yang ID-nya menjadi `updateMask.fieldPaths=...`.

Perubahan:
- pemanggilan Set-FirestoreStatus memakai named parameters
- assetId divalidasi agar tidak kosong
- document ID di-URL-encode
- log menampilkan assetId yang benar sebelum PATCH

Log yang benar:
[MONITOR WRITE] assetId='ID_ASSET' -> monitorStatus/ID_ASSET

Struktur yang benar:
assets/ID_ASSET
monitorStatus/ID_ASSET

Dokumen lama dengan ID `updateMask.fieldPaths=...` adalah dokumen salah dari versi sebelumnya dan dapat dihapus setelah dokumen monitorStatus yang benar muncul.
