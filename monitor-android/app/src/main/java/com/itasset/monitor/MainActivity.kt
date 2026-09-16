package com.itasset.monitor

import android.app.Activity
import android.os.Bundle
import android.widget.TextView
import kotlinx.coroutines.*

class MainActivity : Activity() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val view = TextView(this)
        view.text = "IT Asset Monitor\nMonitoring lokal: 10 detik"
        setContentView(view)
        // Starter: jaringan dipantau saat aplikasi aktif.
        // Background service + FCM dapat ditambahkan setelah Firebase config
        // dan daftar aset project dimasukkan.
    }
    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }
}
