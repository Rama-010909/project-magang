# iOS — IT Asset Monitoring

Aplikasi iOS ini dibuat sebagai dashboard monitoring native untuk iPhone/iPad.

## Yang dilakukan
- Membuka dashboard IT Asset Monitoring.
- Mengikuti status realtime yang sudah ditulis oleh Windows/Android monitor ke Firestore.
- Bisa dipakai sebagai dashboard utama dari iPhone.

## Batasan iOS
iOS tidak mengizinkan aplikasi pihak ketiga menjalankan scanner LAN permanen 24/7 di background seperti Windows service atau Android foreground service.

Jadi arsitektur yang aman:
- Windows/Android di jaringan kantor = pemeriksa perangkat/LAN.
- Firestore = penyimpan status realtime.
- iPhone = dashboard dan penerima fitur notifikasi yang diizinkan iOS.

Jangan mengandalkan iPhone sebagai satu-satunya mesin scanner LAN 24/7.

## Cara membuka
1. Buka project ini dengan Xcode di Mac.
2. Ganti `YOUR-VERCEL-DOMAIN.vercel.app` di `ContentView.swift` dengan domain Vercel aplikasi.
3. Atur Signing & Capabilities dengan Apple Developer account.
4. Jalankan ke iPhone.

Catatan:
- Project ini adalah source project iOS, bukan file IPA siap install.
- Pembuatan/signing IPA membutuhkan Xcode + macOS dan akun Apple yang sesuai.
