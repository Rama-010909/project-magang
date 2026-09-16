# IT Asset Management - Local LAN Monitor (free, no Vercel env)
# Run this script on a Windows PC that stays on inside the same LAN.
$ErrorActionPreference = 'Continue'
$ProjectId = 'it-asset-diskominfo-batang'
# Notifikasi HP memakai ntfy karena pengiriman FCM memerlukan backend/service-account.
# Instal aplikasi ntfy di HP lalu subscribe ke topic yang tercetak saat agent pertama kali dijalankan.
$ConfigPath = Join-Path $PSScriptRoot 'monitor-agent-config.json'
$FirebaseApiKey = "AIzaSyCnybMKpM7Z5gWn49hIsd5ymhFVSVtEuoo"
$ApiBase = "https://firestore.googleapis.com/v1/projects/$ProjectId/databases/(default)/documents"
$ApiQuery = ""
$FirebaseIdToken = $null

function Get-FirebaseIdToken {
  # Login Anonymous Firebase agar agent tetap bisa memakai Firestore Rules
  # yang aman (request.auth != null), tanpa menyimpan password/service account.
  try {
    $url = "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=$([uri]::EscapeDataString($FirebaseApiKey))"
    $body = @{ returnSecureToken = $true } | ConvertTo-Json
    $r = Invoke-RestMethod -Uri $url -Method Post -ContentType "application/json" -Body $body -TimeoutSec 15
    if ([string]::IsNullOrWhiteSpace([string]$r.idToken)) { throw 'Firebase Anonymous Auth tidak mengembalikan idToken.' }
    Write-Host "Firebase Auth: Anonymous OK" -ForegroundColor Green
    return [string]$r.idToken
  } catch {
    Write-Host "[FIREBASE AUTH ERROR] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Pastikan Authentication > Sign-in method > Anonymous sudah Enabled." -ForegroundColor Yellow
    return $null
  }
}

function Invoke-FirestoreRest($Uri,$Method="Get",$Body=$null) {
  $headers = @{}
  if ($FirebaseIdToken) { $headers["Authorization"] = "Bearer $FirebaseIdToken" }
  try {
    if ($null -ne $Body) {
      return Invoke-RestMethod -Uri $Uri -Method $Method -Headers $headers -ContentType "application/json" -Body $Body -TimeoutSec 15
    }
    return Invoke-RestMethod -Uri $Uri -Method $Method -Headers $headers -TimeoutSec 15
  } catch {
    $detail = $_.Exception.Message
    try {
      if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $detail = "$detail | $($_.ErrorDetails.Message)" }
    } catch {}
    throw $detail
  }
}

$AIUrl = 'http://127.0.0.1:8080/v1/chat/completions'
$AIModel = 'local-model'
$AITimeoutSec = 45
$EmbeddedAI = Join-Path $PSScriptRoot 'AI\embedded-diagnosis.ps1'
if (Test-Path $EmbeddedAI) { . $EmbeddedAI }

if (!(Test-Path $ConfigPath) -or [string]::IsNullOrWhiteSpace(([string]((Get-Content $ConfigPath -Raw | ConvertFrom-Json).topic))) ) {
  $topic = -join ((48..57)+(65..90)+(97..122) | Get-Random -Count 28 | ForEach-Object {[char]$_})
  @{ topic=$topic; intervalSeconds=10; failThreshold=1; notifyRecovery=$true; ports=@(80,443,22,23,8291,8080,9100,3389) } | ConvertTo-Json | Set-Content $ConfigPath -Encoding UTF8
  Write-Host "Config dibuat. TOPIC NOTIFIKASI: $topic" -ForegroundColor Green
  Write-Host "Simpan topic ini dan subscribe di aplikasi ntfy." -ForegroundColor Yellow
}
$config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
$Topic = [string]$config.topic
$Interval = 10
$Threshold = 1 # Satu kali gagal = Offline; tidak ada grace period.
if ($Interval -lt 5) { $Interval = 5 }
$States = @{}
$AssetCache = @()
$MonitorDocMap = @{}
$LastMonitorDocRefresh = Get-Date '2000-01-01'
$LastAssetRefresh = Get-Date '2000-01-01'

function Get-FieldValue($field) {
  if ($null -eq $field) { return '' }
  if ($field.stringValue -ne $null) { return [string]$field.stringValue }
  if ($field.integerValue -ne $null) { return [int64]$field.integerValue }
  if ($field.booleanValue -ne $null) { return [bool]$field.booleanValue }
  return ''
}
function Get-Assets {
  try {
    $r = Invoke-FirestoreRest -Uri "$ApiBase/assets?pageSize=1000" -Method Get
    $rows = @($r.documents | ForEach-Object {
      $f = $_.fields
      $docId = ($_.name -split '/')[-1]
      $kode = [string](Get-FieldValue $f.kodeAset)
      if ([string]::IsNullOrWhiteSpace($kode)) { $kode = $docId }
      [pscustomobject]@{ id=$docId; monitorId=$kode; nama=(Get-FieldValue $f.nama); kodeAset=$kode; ipAddress=(Get-FieldValue $f.ipAddress); monitorUrl=(Get-FieldValue $f.monitorUrl); internetIp=(Get-FieldValue $f.internetIp); publicIp=(Get-FieldValue $f.publicIp); ipPublic=(Get-FieldValue $f.ipPublic); ipInternet=(Get-FieldValue $f.ipInternet); internetCheckUrl=(Get-FieldValue $f.internetCheckUrl); monitorPorts=(Get-FieldValue $f.monitorPorts); lokasi=(Get-FieldValue $f.lokasi) }
    })
    $script:AssetCache = @($rows)
    $script:LastAssetRefresh = Get-Date
    return $script:AssetCache
  } catch {
    Write-Host "[FIRESTORE READ ERROR] $($_.Exception.Message)" -ForegroundColor Red
    if ($script:AssetCache.Count -gt 0) {
      Write-Host "[ASSET CACHE] Memakai $($script:AssetCache.Count) aset terakhir agar aset offline tidak hilang dari daftar monitoring." -ForegroundColor Yellow
      return $script:AssetCache
    }
    return @()
  }
}

function Refresh-MonitorDocMap {
  try {
    $r = Invoke-FirestoreRest -Uri "$ApiBase/monitorStatus?pageSize=1000" -Method Get
    $map = @{}
    foreach ($doc in @($r.documents)) {
      $id = ($doc.name -split '/')[-1]
      $f = $doc.fields
      $code = [string](Get-FieldValue $f.kodeAset)
      if ([string]::IsNullOrWhiteSpace($code)) { $code = [string](Get-FieldValue $f.assetId) }
      if (-not [string]::IsNullOrWhiteSpace($code)) {
        $map[$code] = $id
      }
    }
    $script:MonitorDocMap = $map
    $script:LastMonitorDocRefresh = Get-Date
  } catch {
    Write-Host "[MONITOR MAP] Tidak bisa membaca dokumen monitor lama: $($_.Exception.Message)" -ForegroundColor DarkYellow
  }
}
function Test-InternetHealth($hostName) {
  # Pemeriksaan koneksi internet secara nyata, bukan hanya ping IP WAN.
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $checks = @(
    @{url='https://www.google.com/generate_204'; name='Internet HTTPS'},
    @{url='https://www.cloudflare.com/cdn-cgi/trace'; name='Internet Cloudflare'}
  )
  $passed = 0
  foreach ($check in $checks) {
    try {
      Invoke-WebRequest -Uri $check.url -Method Head -UseBasicParsing -TimeoutSec 6 | Out-Null
      $passed++
    } catch {}
  }
  try {
    Resolve-DnsName -Name 'dns.google' -Type A -Server 8.8.8.8 -ErrorAction Stop | Out-Null
    $passed++
  } catch {}
  $sw.Stop()
  if ($passed -ge 2) {
    return @{online=$true; latency=$sw.ElapsedMilliseconds; method='InternetHealth'; reason='Koneksi internet terdeteksi normal'}
  }
  return @{online=$false; latency=$null; method='InternetHealth'; reason='Koneksi internet gagal atau tidak stabil'}
}
function Test-Target($asset) {
  # IP aset bisa berisi beberapa alamat sekaligus, misalnya:
  # "206.99.80.2/29, 192.168.100.12/24".
  # Jangan kirim seluruh string sebagai hostname. Ambil dan uji setiap target.
  $rawTargets = @()
  if (-not [string]::IsNullOrWhiteSpace([string]$asset.ipAddress)) { $rawTargets += [string]$asset.ipAddress }
  if (-not [string]::IsNullOrWhiteSpace([string]$asset.monitorUrl)) { $rawTargets += [string]$asset.monitorUrl }
  if (!$rawTargets.Count) { return @{online=$false; latency=$null; method='none'; reason='Alamat perangkat kosong'} }

  $targets = @()
  foreach ($raw in $rawTargets) {
    if ($raw -match '^https?://') {
      $targets += $raw.Trim()
      continue
    }
    # Ambil semua IPv4 dari field, termasuk yang memakai CIDR /24, /29, dll.
    $ips = [regex]::Matches($raw, '(?<!\d)(?:\d{1,3}\.){3}\d{1,3}(?:/\d{1,2})?(?!\d)') | ForEach-Object { $_.Value }
    if ($ips.Count) {
      foreach ($ip in $ips) { $targets += ($ip -replace '/\d{1,2}$','') }
    } else {
      # Fallback untuk hostname biasa.
      $parts = $raw -split '[,;\s]+' | Where-Object { $_ -and $_ -notmatch '^/\d+$' }
      foreach ($part in $parts) { $targets += ($part -replace '^https?://','' -replace '/.*$','' -replace ':\d+$','') }
    }
  }
  $targets = @($targets | Where-Object { $_ } | Select-Object -Unique)
  if (!$targets.Count) { return @{online=$false; latency=$null; method='parse'; reason="Alamat perangkat tidak dapat dibaca: $($rawTargets -join ', ')"} }

  foreach ($target in $targets) {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    if ($target -match '^https?://') {
      try {
        Invoke-WebRequest -Uri $target -UseBasicParsing -TimeoutSec 6 | Out-Null
        $sw.Stop(); return @{online=$true; latency=$sw.ElapsedMilliseconds; method='HTTP'; reason="Alamat monitoring $target merespons"}
      } catch {
        $sw.Stop(); continue
      }
    }

    $hostName = $target
    try {
      # System.Net.NetworkInformation.Ping kompatibel dengan Windows PowerShell 5.1
      # dan tidak bergantung pada parameter -TimeoutSeconds yang hanya tersedia pada
      # versi PowerShell tertentu.
      $pinger = New-Object System.Net.NetworkInformation.Ping
      $reply = $pinger.Send($hostName, 1500)
      if ($reply.Status -eq [System.Net.NetworkInformation.IPStatus]::Success) {
        $sw.Stop(); return @{online=$true; latency=[int]$reply.RoundtripTime; method='ICMP'; reason="IP perangkat $hostName merespons ping"}
      }
    } catch {}

    foreach ($port in @(443,80,8080,8291,8728,8729,9100,3389,445,139,554,8000,37777,34567)) {
      try {
        $client = New-Object Net.Sockets.TcpClient
        $task = $client.ConnectAsync($hostName,[int]$port)
        if ($task.Wait(1800) -and $client.Connected) {
          $client.Close(); $sw.Stop()
          return @{online=$true; latency=$sw.ElapsedMilliseconds; method="TCP:$port"; reason="Perangkat $hostName merespons pada port $port"}
        }
        $client.Close()
      } catch {}
    }
    $sw.Stop()
  }
  return @{online=$false; latency=$null; method='ICMP/TCP'; reason="Tidak ada target perangkat yang merespons: $($targets -join ', ')"}
}

function Get-PublicInternetTargets($asset) {
  $raw = @()
  foreach ($field in @('internetIp','publicIp','ipPublic','ipInternet')) {
    $value = [string]$asset.$field
    if (-not [string]::IsNullOrWhiteSpace($value)) { $raw += $value }
  }
  if (-not [string]::IsNullOrWhiteSpace([string]$asset.ipAddress)) { $raw += [string]$asset.ipAddress }
  $out = @()
  foreach ($item in $raw) {
    foreach ($m in [regex]::Matches($item, '(?<!\d)(?:\d{1,3}\.){3}\d{1,3}(?!\d)')) {
      $ip = $m.Value
      if (-not (Test-IsPrivateIPv4 $ip)) { $out += $ip }
    }
  }
  return @($out | Select-Object -Unique)
}
function Test-IsPrivateIPv4($ip) {
  $p = [string]$ip -split '\.'
  if ($p.Count -ne 4) { return $true }
  try { $a=[int]$p[0]; $b=[int]$p[1] } catch { return $true }
  return ($a -eq 10 -or $a -eq 127 -or $a -eq 0 -or ($a -eq 169 -and $b -eq 254) -or ($a -eq 172 -and $b -ge 16 -and $b -le 31) -or ($a -eq 192 -and $b -eq 168) -or $a -ge 224)
}
function Test-PublicIpReachability($ip, $ports=@(443,80,8291,8728,8729)) {
  foreach ($port in $ports) {
    try {
      $client = New-Object Net.Sockets.TcpClient
      $task = $client.ConnectAsync($ip,[int]$port)
      if ($task.Wait(1200) -and $client.Connected) {
        $client.Close()
        return @{online=$true; method="WAN-IP:TCP:$port"; reason="IP Internet $ip merespons pada port $port"}
      }
      $client.Close()
    } catch {}
  }
  try {
    $pinger = New-Object System.Net.NetworkInformation.Ping
    $reply = $pinger.Send($ip,1200)
    if ($reply.Status -eq [System.Net.NetworkInformation.IPStatus]::Success) {
      return @{online=$true; method='WAN-IP:ICMP'; latency=[int]$reply.RoundtripTime; reason="IP Internet $ip merespons ping"}
    }
  } catch {}
  return @{online=$false; method='WAN-IP'; reason="IP Internet $ip tidak merespons probe"}
}
function Test-InternetCheckUrl($url) {
  if ([string]::IsNullOrWhiteSpace([string]$url)) { return $null }
  try {
    $sw=[Diagnostics.Stopwatch]::StartNew()
    $r=Invoke-WebRequest -Uri ([string]$url) -Method Get -UseBasicParsing -TimeoutSec 5
    $sw.Stop()
    if ([int]$r.StatusCode -ge 200 -and [int]$r.StatusCode -lt 400) { return @{online=$true; latency=$sw.ElapsedMilliseconds; method='InternetCheckURL'; reason="Internet check URL merespons HTTP $($r.StatusCode)"} }
  } catch {}
  return @{online=$false; method='InternetCheckURL'; reason='Internet check URL gagal diakses'}
}
function Get-InternetHealth($asset) {
  # Prioritas 1: alamat Internet/WAN yang memang dicatat pada aset.
  $targets=Get-PublicInternetTargets $asset
  if ($targets.Count -gt 0) {
    foreach ($ip in $targets) {
      $r=Test-PublicIpReachability $ip
      if ($r.online) { return @{online=$true; latency=$(if($null -ne $r.latency){$r.latency}else{0}); method=$r.method; reason=$r.reason; sourceIp=$ip} }
    }
    # Jika IP WAN terdaftar tetapi tidak merespons, jangan langsung menebak.
    # Lakukan probe URL internet dari monitor sebagai bukti jalur Internet cadangan.
  }
  $urlResult=Test-InternetCheckUrl $asset.internetCheckUrl
  if ($null -ne $urlResult) { return $urlResult }
  $sw=[Diagnostics.Stopwatch]::StartNew(); $passed=0
  foreach ($u in @('https://www.google.com/generate_204','https://www.cloudflare.com/cdn-cgi/trace')) {
    try { Invoke-WebRequest -Uri $u -Method Head -UseBasicParsing -TimeoutSec 4 | Out-Null; $passed++ } catch {}
  }
  try { Resolve-DnsName -Name 'dns.google' -Type A -Server 8.8.8.8 -ErrorAction Stop | Out-Null; $passed++ } catch {}
  $sw.Stop()
  if ($passed -ge 2) { return @{online=$true; latency=$sw.ElapsedMilliseconds; method='InternetHealth-Fallback'; reason='Internet terdeteksi normal dari jalur monitoring'} }
  return @{online=$false; latency=$null; method='InternetHealth'; reason='Tidak ada bukti jalur Internet yang berhasil'}
}

function Get-RuleDiagnosis($asset,$device,$internet,$history) {
  if (Get-Command Invoke-EmbeddedAIDiagnosis -ErrorAction SilentlyContinue) {
    return Invoke-EmbeddedAIDiagnosis $asset $device $internet $history
  }
  if ($device.online -and $internet.online) { return @{status='online';deviceStatus='aktif';internetStatus='aman';diagnosis='Perangkat aktif dan sumber internet terdeteksi aman.';confidence=95;reason="$($device.reason); $($internet.reason)."} }
  if ($device.online -and !$internet.online) { return @{status='internet_trouble';deviceStatus='aktif';internetStatus='trouble';diagnosis='Perangkat aktif tetapi sumber internet bermasalah.';confidence=88;reason="$($device.reason); $($internet.reason)."} }
  if (!$device.online -and $internet.online) { return @{status='device_trouble';deviceStatus='mati/tidak terjangkau';internetStatus='aman';diagnosis='Perangkat tidak terjangkau sementara internet monitoring aman.';confidence=90;reason="$($device.reason); $($internet.reason)."} }
  return @{status='network_trouble';deviceStatus='tidak terjangkau';internetStatus='trouble';diagnosis='Perangkat dan internet monitoring sama-sama bermasalah; periksa jalur jaringan.';confidence=82;reason="$($device.reason); $($internet.reason)."}
}
function Invoke-AIDiagnosis($asset,$device,$internet,$history) {
  $fallback = Get-RuleDiagnosis $asset $device $internet $history
  $prompt = @"
Anda adalah AI analis monitoring jaringan untuk sistem IT Asset Management Diskominfo Batang.
Analisis DATA YANG DIBERIKAN SAJA. Jangan mengarang hasil ping, kabel, listrik, ISP, atau sensor yang tidak ada.

Aset: $($asset.nama)
Kode: $($asset.kodeAset)
Lokasi: $($asset.lokasi)
IP/Target: $($asset.ipAddress)
Perangkat terjangkau: $($device.online)
Metode perangkat: $($device.method)
Alasan perangkat: $($device.reason)
Latency perangkat: $($device.latency)
Internet monitoring: $($internet.online)
Alasan internet: $($internet.reason)
Latency internet: $($internet.latency)

Klasifikasikan menjadi tepat satu status: online, device_trouble, internet_trouble, network_trouble.
Buat diagnosis singkat dalam Bahasa Indonesia.
Kembalikan HANYA JSON valid tanpa markdown dengan format:
{"status":"online|device_trouble|internet_trouble|network_trouble","deviceStatus":"aktif|mati/tidak terjangkau","internetStatus":"aman|trouble","diagnosis":"...","reason":"...","confidence":0}
Confidence 0-100. Jika data tidak cukup membedakan penyebab, katakan bahwa penyebab belum dapat dipastikan.
"@
  try {
    $body = @{model=$AIModel; messages=@(@{role='system'; content='Anda adalah analis monitoring jaringan. Jawab hanya berdasarkan data yang diberikan.'},@{role='user'; content=$prompt}); temperature=0.1; max_tokens=300; response_format=@{type='json_object'}} | ConvertTo-Json -Depth 10
    $resp = Invoke-RestMethod -Uri $AIUrl -Method Post -ContentType 'application/json' -Body $body -TimeoutSec $AITimeoutSec
    $text = [string]$resp.choices[0].message.content
    if ([string]::IsNullOrWhiteSpace($text)) { return $fallback }
    $ai = $text | ConvertFrom-Json
    $status = [string]$ai.status
    if ($status -notin @('online','device_trouble','internet_trouble','network_trouble')) { return $fallback }
    $confidence = 0
    [int]::TryParse([string]$ai.confidence, [ref]$confidence) | Out-Null
    if ($confidence -lt 0) { $confidence = 0 }
    if ($confidence -gt 100) { $confidence = 100 }
    return @{
      status=$status
      deviceStatus=[string]$ai.deviceStatus
      internetStatus=[string]$ai.internetStatus
      diagnosis=[string]$ai.diagnosis
      reason=[string]$ai.reason
      confidence=$confidence
    }
  } catch {
    return $fallback
  }
}

function Set-FirestoreStatus($assetId,$device,$internet,$ai,$consecutiveFail,$consecutiveTrouble,$asset) {
  if ([string]::IsNullOrWhiteSpace([string]$assetId)) {
    Write-Host "[FIRESTORE ERROR] monitorId kosong untuk $($asset.nama)" -ForegroundColor Red
    return $false
  }
  # Pakai kodeAset sebagai document ID. Jangan gunakan updateMask query agar tidak
  # terjadi document ID/query yang kacau pada Firestore REST. PATCH tanpa mask tetap
  # meng-update field yang dikirim.
  if ((Get-Date) - $script:LastMonitorDocRefresh -gt [TimeSpan]::FromSeconds(60)) { Refresh-MonitorDocMap }
  $targetDocId = [string]$script:MonitorDocMap[[string]$assetId]
  if ([string]::IsNullOrWhiteSpace($targetDocId)) { $targetDocId = [string]$assetId }
  $encodedId = [System.Uri]::EscapeDataString($targetDocId)
  $url = "$ApiBase/monitorStatus/$encodedId"
  $latencyValue = 0
  if ($null -ne $device.latency) { $latencyValue = [int64]$device.latency }
  $checkedAt = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
  $fields=@{
    online=@{booleanValue=[bool]$device.online}; status=@{stringValue=[string]$ai.status}; state=@{stringValue=[string]$ai.status};
    deviceStatus=@{stringValue=($(if([bool]$device.online){'aktif'}else{'mati/tidak terjangkau'}))}; internetOnline=@{booleanValue=[bool]$internet.online}; internetStatus=@{stringValue=[string]$ai.internetStatus};
    latency=@{integerValue=[string]$latencyValue}; checkedAt=@{timestampValue=$checkedAt};
    consecutiveFail=@{integerValue=[string]$consecutiveFail}; consecutiveTrouble=@{integerValue=[string]$consecutiveTrouble};
    method=@{stringValue=[string]$device.method}; reason=@{stringValue=[string]$device.reason}; diagnosis=@{stringValue=[string]$ai.diagnosis}; confidence=@{integerValue=[string]$ai.confidence};
    nama=@{stringValue=[string]$asset.nama}; kodeAset=@{stringValue=[string]$asset.kodeAset}; lokasi=@{stringValue=[string]$asset.lokasi}; ipAddress=@{stringValue=[string]$asset.ipAddress}; internetIp=@{stringValue=[string]$asset.internetIp}; publicIp=@{stringValue=[string]$asset.publicIp}; ipPublic=@{stringValue=[string]$asset.ipPublic}; ipInternet=@{stringValue=[string]$asset.ipInternet}; internetMethod=@{stringValue=[string]$internet.method}; internetReason=@{stringValue=[string]$internet.reason}
  }
  try {
    $body = (@{fields=$fields}|ConvertTo-Json -Depth 8)
    Write-Host "[MONITOR WRITE] kodeAset='$assetId' -> monitorStatus/$targetDocId | online=$($device.online) | deviceStatus=$(if([bool]$device.online){'aktif'}else{'mati/tidak terjangkau'})" -ForegroundColor DarkGray
    Invoke-FirestoreRest -Uri $url -Method Patch -Body $body | Out-Null
    return $true
  } catch { Write-Host "[FIRESTORE ERROR] monitorStatus/$assetId : $($_.Exception.Message)" -ForegroundColor Red; return $false }
}
function Send-WindowsNotification($title, $message, $isWarning=$true) {
  try {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    $icon = New-Object System.Windows.Forms.NotifyIcon
    $icon.Icon = [System.Drawing.SystemIcons]::Application
    $icon.Visible = $true
    $icon.BalloonTipTitle = $title
    $icon.BalloonTipText = $message
    $icon.BalloonTipIcon = $(if($isWarning){'Warning'}else{'Info'})
    $icon.ShowBalloonTip(1500)
    Start-Sleep -Milliseconds 1800
    $icon.Dispose()
  } catch {}
}

function Send-Ntfy($asset,$title,$message,$priority='high') {
  if ([string]::IsNullOrWhiteSpace($Topic)) { return }
  try {
    Invoke-RestMethod -Uri "https://ntfy.sh/$Topic" -Method Post -Headers @{Title=$title; Priority=$priority; Tags='warning,computer'; Click="https://xii-tkj3-smknubandar.vercel.app"} -Body $message -TimeoutSec 10 | Out-Null
  } catch {}
}
Write-Host "IT Asset LAN Monitor + Local AI aktif. Interval $Interval detik." -ForegroundColor Cyan
Write-Host "MonitorStatus: ONLINE/OFFLINE dikirim ke Firestore tanpa bergantung pada status administratif." -ForegroundColor Green
Write-Host "Pengecekan ICMP memakai System.Net.NetworkInformation.Ping (PowerShell 5.1 compatible)." -ForegroundColor Green
Write-Host "AI lokal: $AIModel ($AIUrl)" -ForegroundColor Magenta
Write-Host "Topic ntfy: $Topic" -ForegroundColor Yellow
$FirebaseIdToken = Get-FirebaseIdToken
Write-Host "Firestore: REST tanpa API key (mengikuti Firestore Security Rules)" -ForegroundColor Yellow
while ($true) {
  $assets = Get-Assets
  Write-Host "[$(Get-Date -Format HH:mm:ss)] Aset terbaca: $($assets.Count)" -ForegroundColor DarkCyan
  if ($assets.Count -eq 0) { Write-Host "Tidak ada aset yang terbaca dari Firestore. Jika muncul PERMISSION_DENIED, periksa Firestore Rules agar agent boleh membaca assets dan menulis monitorStatus." -ForegroundColor Yellow }
  foreach ($asset in $assets) {
    if ([string]::IsNullOrWhiteSpace($asset.monitorUrl) -and [string]::IsNullOrWhiteSpace($asset.ipAddress)) { continue }
    $monitorId = [string]$asset.kodeAset
    if ([string]::IsNullOrWhiteSpace($monitorId)) { $monitorId = [string]$asset.id }
    $old = $States[$monitorId]
    $device = Test-Target $asset
    # Tidak ada grace period: hasil probe agent langsung menjadi Online/Offline.
    $consecutiveFail = 0
    if (-not [bool]$device.online) {
      $previousFail = 0
      if ($old -and $old.ContainsKey('consecutiveFail')) { $previousFail = [int]$old.consecutiveFail }
      $consecutiveFail = $previousFail + 1
    }
    $internet = Get-InternetHealth $asset
    $ai = Invoke-AIDiagnosis $asset $device $internet $old
    # STATUS PERANGKAT adalah fakta hasil probe agent, bukan hasil AI.
    # AI hanya membantu diagnosis/internet; tidak boleh membalik Online menjadi Offline atau sebaliknya.
    if ($device.online) {
      $ai.deviceStatus = 'aktif'
      if ($ai.status -eq 'device_trouble' -or $ai.status -eq 'network_trouble') {
        if ($internet.online) { $ai.status = 'online' } else { $ai.status = 'internet_trouble' }
      }
    } else {
      $ai.deviceStatus = 'mati/tidak terjangkau'
      $ai.status = 'device_trouble'
    }
    if ($internet.online) { $ai.internetStatus = 'aman' } else { $ai.internetStatus = 'trouble' }
    $troubleNow = (-not [bool]$device.online)
    $consecutiveTrouble = 0
    if ($troubleNow) {
      $previousTrouble = 0
      if ($old -and $old.ContainsKey('consecutiveTrouble')) { $previousTrouble = [int]$old.consecutiveTrouble }
      $consecutiveTrouble = $previousTrouble + 1
    }
    $writeOk = Set-FirestoreStatus -assetId $monitorId -device $device -internet $internet -ai $ai -consecutiveFail $consecutiveFail -consecutiveTrouble $consecutiveTrouble -asset $asset
    if (-not $writeOk) { Write-Host "[STATUS TIDAK TERKIRIM] $($asset.nama)" -ForegroundColor Red }

    $previousOnline = $null
    if ($old -and $old.ContainsKey('online')) { $previousOnline = [bool]$old.online }
    if ($device.online -eq $false -and $previousOnline -eq $true -and $consecutiveFail -ge $Threshold) {
      $msg = "$($asset.nama) ($($asset.kodeAset)) tidak dapat dijangkau. $($device.reason)"
      Send-WindowsNotification 'Peringatan Perangkat Offline' $msg $true
      Send-Ntfy $asset 'Peringatan Perangkat Offline' $msg
    }
    if ($device.online -eq $true -and $previousOnline -eq $false -and $old -and $config.notifyRecovery) {
      $msg = "$($asset.nama) ($($asset.kodeAset)) kembali online. $($device.reason)"
      Send-WindowsNotification 'Perangkat Kembali Online' $msg $false
      Send-Ntfy $asset 'Perangkat Kembali Online' $msg 'default'
    }
    $States[$monitorId] = @{consecutiveFail=$consecutiveFail; consecutiveTrouble=$consecutiveTrouble; online=[bool]$device.online; status=$ai.status}
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $($asset.nama) -> $($ai.status.ToUpper()) | Perangkat: $($ai.deviceStatus) | Internet: $($ai.internetStatus) | $($ai.diagnosis)"
  }
  Start-Sleep -Seconds $Interval
}
