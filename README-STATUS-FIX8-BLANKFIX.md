# FIX8 Blank Screen Fix

Memperbaiki error React `ReferenceError: agentMonitorStates is not defined` yang terjadi di komponen Dashboard/Inventory karena komponen tersebut menerima prop bernama `monitorStates`.

Semua pemanggilan status di komponen anak sekarang menggunakan `monitorStates`, sedangkan `agentMonitorStates` tetap hanya dipakai di App sebagai sumber Firestore realtime.
