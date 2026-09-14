package com.diskominfo.itassetmonitor;

import android.Manifest;import android.app.*;import android.content.*;import android.content.pm.PackageManager;import android.os.*;import android.widget.*;

public class MainActivity extends Activity {
  @Override public void onCreate(Bundle b){super.onCreate(b); TextView t=new TextView(this); t.setPadding(40,60,40,40); t.setText("IT Asset Monitor\n\nMonitoring berjalan di background setelah diaktifkan.\n\nJika diminta, izinkan notifikasi dan matikan pembatasan baterai untuk aplikasi ini."); setContentView(t);
    if(Build.VERSION.SDK_INT>=33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED) requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},10);
    start(); }
  void start(){Intent i=new Intent(this,MonitorService.class); if(Build.VERSION.SDK_INT>=26) startForegroundService(i); else startService(i);}
}
