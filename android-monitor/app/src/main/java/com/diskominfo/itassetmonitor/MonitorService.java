package com.diskominfo.itassetmonitor;

import android.app.*;
import android.content.*;
import android.os.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.text.*;
import java.util.*;
import org.json.*;

public class MonitorService extends Service {
  static final String PROJECT="it-asset-diskominfo-batang";
  static final String API_KEY="AIzaSyCnybMKpM7Z5gWn49hIsd5ymhFVSVtEuoo";
  static final String BASE="https://firestore.googleapis.com/v1/projects/"+PROJECT+"/databases/(default)/documents";
  static final long INTERVAL_MS=10000L;
  String idToken=null; long tokenAt=0;
  Handler h=new Handler(Looper.getMainLooper()); Runnable loop;
  final Map<String,Boolean> previousDeviceStates=new HashMap<>();
  final Map<String,Boolean> previousInternetStates=new HashMap<>();

  @Override public void onCreate(){
    super.onCreate();
    createChannels();
    startForeground(7,notification("Monitoring aktif • interval 10 detik"));
    loop=()->{ new Thread(this::check).start(); h.postDelayed(loop,INTERVAL_MS); };
    h.post(loop);
  }

  void createChannels(){
    NotificationManager m=getSystemService(NotificationManager.class);
    if(Build.VERSION.SDK_INT>=26){
      m.createNotificationChannel(new NotificationChannel("monitor","IT Asset Monitor",NotificationManager.IMPORTANCE_LOW));
      m.createNotificationChannel(new NotificationChannel("asset-alert","Peringatan Aset",NotificationManager.IMPORTANCE_HIGH));
    }
  }

  Notification notification(String s){
    Notification.Builder b=Build.VERSION.SDK_INT>=26
      ? new Notification.Builder(this,"monitor")
      : new Notification.Builder(this);
    return b.setContentTitle("IT Asset Monitor")
      .setContentText(s)
      .setSmallIcon(android.R.drawable.stat_notify_sync)
      .setOngoing(true).build();
  }

  void check(){
    try{
      ensureAuth();
      String raw=get(BASE+"/assets?pageSize=1000");
      JSONObject root=new JSONObject(raw);
      JSONArray docs=root.optJSONArray("documents");
      if(docs==null){ updateNote("Monitoring aktif • tidak ada aset"); return; }
      int online=0;
      for(int i=0;i<docs.length();i++){
        JSONObject d=docs.getJSONObject(i);
        String fullName=d.optString("name");
        String id=fullName.substring(fullName.lastIndexOf('/')+1);
        JSONObject f=d.optJSONObject("fields");
        String code=str(f,"kodeAset"); if(code.isEmpty()) code=id;
        String name=str(f,"nama"); if(name.isEmpty()) name=code;
        String ip=str(f,"ipAddress");
        String url=str(f,"monitorUrl");
        boolean deviceOk=probeDevice(url,ip);
        if(deviceOk) online++;

        String internetIp=first(f,"internetIp","publicIp","ipPublic","ipInternet","wanIp","ipWan");
        String internetUrl=first(f,"internetUrl","wanUrl","internetMonitorUrl");
        InternetResult internet=probeInternet(internetUrl,internetIp);

        write(code,id,name,deviceOk,url,ip,internetIp,internet);
        notifyDeviceTransition(code,name,deviceOk,previousDeviceStates.get(code));
        previousDeviceStates.put(code,deviceOk);
        if(internet.known){
          notifyInternetTransition(code,name,internet.online,previousInternetStates.get(code));
          previousInternetStates.put(code,internet.online);
        }
      }
      updateNote("Monitoring aktif • Online: "+online+" • "+new SimpleDateFormat("HH:mm:ss",Locale.getDefault()).format(new Date()));
    }catch(Exception e){
      updateNote("Monitoring • koneksi Firestore bermasalah");
    }
  }

  String str(JSONObject f,String k){
    if(f==null)return "";
    JSONObject x=f.optJSONObject(k);
    return x==null?"":x.optString("stringValue","");
  }

  String first(JSONObject f,String... keys){
    for(String k:keys){ String v=str(f,k); if(!v.isEmpty()) return v; }
    return "";
  }

  boolean probeDevice(String url,String ip){
    try{
      if(!url.isEmpty()){
        URL u=new URL(url);
        HttpURLConnection c=(HttpURLConnection)u.openConnection();
        c.setConnectTimeout(1800); c.setReadTimeout(1800); c.setRequestMethod("GET");
        c.setInstanceFollowRedirects(false);
        int r=c.getResponseCode(); c.disconnect();
        if(r>0) return true;
      }
      if(ip.isEmpty())return false;
      for(int p:new int[]{80,443,8080,8000,22,8291}){
        try(Socket s=new Socket()){
          s.connect(new InetSocketAddress(ip,p),700); return true;
        }catch(Exception ignored){}
      }
      try { return InetAddress.getByName(ip).isReachable(900); } catch(Exception ignored) { return false; }
    }catch(Exception e){return false;}
  }

  static class InternetResult{
    boolean known=false; boolean online=false; String method="none"; String reason="";
  }

  InternetResult probeInternet(String url,String ip){
    InternetResult r=new InternetResult();
    try{
      if(!url.isEmpty()){
        URL u=new URL(url);
        HttpURLConnection c=(HttpURLConnection)u.openConnection();
        c.setConnectTimeout(1800); c.setReadTimeout(1800); c.setRequestMethod("GET");
        int code=c.getResponseCode(); c.disconnect();
        r.known=true; r.online=code>0; r.method="internetUrl"; r.reason="HTTP "+code; return r;
      }
      if(ip.isEmpty()) return r;
      if(isPrivateIPv4(ip)) return r;
      r.known=true;
      for(int p:new int[]{443,80,8080}){
        try(Socket s=new Socket()){
          s.connect(new InetSocketAddress(ip,p),900);
          r.online=true; r.method="internetIp"; r.reason="TCP port "+p+" merespons"; return r;
        }catch(Exception ignored){}
      }
      r.online=false; r.method="internetIp"; r.reason="IP Internet tidak merespons";
      return r;
    }catch(Exception e){
      r.known=true; r.online=false; r.method="internet"; r.reason=e.getMessage()==null?"Gagal memeriksa":e.getMessage(); return r;
    }
  }

  boolean isPrivateIPv4(String ip){
    try{
      String[] a=ip.split("\\."); if(a.length!=4)return true;
      int x=Integer.parseInt(a[0]), b=Integer.parseInt(a[1]);
      return x==10||x==127||x==0||(x==169&&b==254)||(x==172&&b>=16&&b<=31)||(x==192&&b==168)||x>=224;
    }catch(Exception e){return true;}
  }

  void notifyDeviceTransition(String code,String name,boolean online,Boolean previous){
    if(previous==null || previous.booleanValue()==online) return;
    String title=online?"Perangkat Kembali Online":"Peringatan Perangkat Offline";
    String body=name+" ("+code+") "+(online?"kembali online.":"terdeteksi offline.");
    showAlert(title,body,"device-"+code);
  }

  void notifyInternetTransition(String code,String name,boolean online,Boolean previous){
    if(previous==null || previous.booleanValue()==online) return;
    String title=online?"Internet Kembali Normal":"Peringatan Internet Trouble";
    String body=name+" ("+code+") "+(online?"internet kembali normal.":"internet terdeteksi bermasalah.");
    showAlert(title,body,"internet-"+code);
  }

  void showAlert(String title,String body,String tag){
    NotificationManager m=getSystemService(NotificationManager.class);
    Notification.Builder b=Build.VERSION.SDK_INT>=26
      ? new Notification.Builder(this,"asset-alert")
      : new Notification.Builder(this);
    Notification n=b.setContentTitle(title).setContentText(body)
      .setSmallIcon(android.R.drawable.stat_notify_sync)
      .setAutoCancel(true).setPriority(Notification.PRIORITY_HIGH).setCategory(Notification.CATEGORY_ALARM).build();
    m.notify(Math.abs((tag+System.currentTimeMillis()).hashCode()),n);
  }

  void write(String code,String id,String name,boolean online,String url,String ip,String internetIp,InternetResult internet)throws Exception{
    String deviceStatus=online?"aktif":"mati/tidak terjangkau";
    String internetStatus=internet.known?(internet.online?"Normal":"Trouble"):"Belum Diperiksa";
    String body="{\"fields\":{"
      +"\"kodeAset\":{"stringValue":""+esc(code)+""},"
      +"\"assetId\":{"stringValue":""+esc(id)+""},"
      +"\"nama\":{"stringValue":""+esc(name)+""},"
      +"\"online\":{"booleanValue\":"+online+"},"
      +"\"deviceStatus\":{"stringValue":""+esc(deviceStatus)+""},"
      +"\"internetStatus\":{"stringValue":""+esc(internetStatus)+""},"
      +"\"internetOnline\":{"booleanValue\":"+(internet.known?Boolean.toString(internet.online):"false")+"},"
      +"\"internetChecked\":{"booleanValue\":"+internet.known+"},"
      +"\"internetIp\":{"stringValue":""+esc(internetIp)+""},"
      +"\"internetMethod\":{"stringValue":""+esc(internet.method)+""},"
      +"\"internetReason\":{"stringValue":""+esc(internet.reason)+""},"
      +"\"reason\":{"stringValue":""+esc(internet.reason)+""},"
      +"\"checkedAt\":{"timestampValue":""+new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX",Locale.US).format(new Date())+""}"
      +"}}";
    String doc=code.isEmpty()?id:code;
    patch(BASE+"/monitorStatus/"+URLEncoder.encode(doc,StandardCharsets.UTF_8.toString()),body);
  }

  String esc(String s){return s==null?"":s.replace("\\","\\\\").replace("\"","\\\"");}
  void ensureAuth()throws Exception{
    if(idToken!=null && System.currentTimeMillis()-tokenAt<45*60*1000)return;
    String raw=requestRaw("https://identitytoolkit.googleapis.com/v1/accounts:signUp?key="+URLEncoder.encode(API_KEY,"UTF-8"),"POST","{\"returnSecureToken\":true}",false);
    JSONObject j=new JSONObject(raw); idToken=j.optString("idToken","");
    if(idToken.isEmpty())throw new IOException("Anonymous Auth gagal"); tokenAt=System.currentTimeMillis();
  }
  String get(String u)throws Exception{return request(u,"GET",null);}
  void patch(String u,String b)throws Exception{request(u,"PATCH",b);}
  String request(String u,String method,String body)throws Exception{return requestRaw(u,method,body,true);}
  String requestRaw(String u,String method,String body,boolean auth)throws Exception{
    HttpURLConnection c=(HttpURLConnection)new URL(u).openConnection();
    c.setConnectTimeout(5000);c.setReadTimeout(5000);c.setRequestMethod(method);c.setRequestProperty("Content-Type","application/json");
    if(auth&&idToken!=null)c.setRequestProperty("Authorization","Bearer "+idToken);
    if(body!=null){c.setDoOutput(true);try(OutputStream o=c.getOutputStream()){o.write(body.getBytes(StandardCharsets.UTF_8));}}
    int r=c.getResponseCode();InputStream in=r>=400?c.getErrorStream():c.getInputStream();String s="";
    if(in!=null){try(BufferedReader br=new BufferedReader(new InputStreamReader(in))){String x;StringBuilder z=new StringBuilder();while((x=br.readLine())!=null)z.append(x);s=z.toString();}}
    if(r>=400)throw new IOException("HTTP "+r+" "+s);return s;
  }
  void updateNote(String s){h.post(()->{NotificationManager m=getSystemService(NotificationManager.class);m.notify(7,notification(s));});}
  @Override public int onStartCommand(Intent i,int f,int id){return START_STICKY;}
  @Override public IBinder onBind(Intent i){return null;}
  @Override public void onDestroy(){if(loop!=null)h.removeCallbacks(loop);super.onDestroy();}
}
