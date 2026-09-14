# AI Portable / Real-Time Monitoring

Sistem memiliki dua tingkat diagnosis:

1. **Built-in local diagnostic engine** — langsung tersedia, tidak membutuhkan Ollama, Python, Node, API key, atau download model. Engine ini menganalisis status perangkat + internet, latency, dan riwayat kegagalan untuk menghasilkan status dan confidence.
2. **Optional local LLM** — jika `AI/bin/llama-server.exe` dan `AI/models/model.gguf` ditambahkan, monitor akan memakai LLM lokal melalui endpoint OpenAI-compatible. Tidak perlu API cloud.

Jalankan `JALANKAN-MONITOR-AI.bat` untuk monitoring real-time.

Catatan: built-in engine adalah diagnostic inference berbasis aturan/scoring, bukan model bahasa LLM. Karena itu ia tetap bisa berjalan offline dan ringan.
