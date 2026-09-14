# IT Asset Management - Local LAN Monitor (free, no Vercel env)
# Run this script on a Windows PC that stays on inside the same LAN.
$ErrorActionPreference = 'Continue'
$ProjectId = 'it-asset-diskominfo-batang'
# Notifikasi HP memakai ntfy karena pengiriman FCM memerlukan backend/service-account.
# Instal aplikasi ntfy di HP lalu subscribe ke topic yang tercetak saat agent pertama kali dijalankan.
$ConfigPath = Join-Path $PSScriptRoot 'monitor-agent-config.json'
$FirebaseApiKey = "AIzaSyCnybMKpM7Z5gWn49hIsd5ymhFVSVtEuoo"
$ApiBase = "https://firestore.googleapis.com/v1/projects/$ProjectId/databases/(default)/documents"
$ApiQuery = "?key=$FirebaseApiKey"
$AIUrl = 'http://127.0.0.1:8080/v1/chat/completions'
$AIModel = 'local-model'
$AITimeoutSec = 45
$EmbeddedAI = Join-Path $PSScriptRoot 'AI\embedded-diagnosis.ps1'
if (Test-Path $EmbeddedAI) { . $EmbeddedAI }

if (!(Test-Path $ConfigPath) -or [string]::IsNullOrWhiteSpace(([string]((Get-Content $ConfigPath -Raw | ConvertFrom-Json).topic))) ) {
  $topic = -join ((48..57)+(65..90)+(97..122) | Get-Random -Count 28 | ForEach-Object {[char]$_})
  @{ topic=$topic; intervalSeconds=30; failThreshold=2; notifyRecovery=$true; ports=@(80,443,22,23,8291,8080,9100,3389) } | ConvertTo-Json | Set-Content $ConfigPath -Encoding UTF8
  Write-Host "Config dibuat. TOPIC NOTIFIKASI: $topic" -ForegroundColor Green
  Write-Host "Simpan topic ini dan subscribe di aplikasi ntfy." -ForegroundColor Yellow
}
$config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
$Topic = [string]$config.topic
$Interval = [int]$config.intervalSeconds
$Threshold = [int]$config.failThreshold
$States = @{}
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
    $r = Invoke-RestMethod -Uri "$ApiBase/assets?pageSize=1000&key=$FirebaseApiKey" -Method Get -TimeoutSec 15
    @($r.documents | ForEach-Object {
      $f = $_.fields
      [pscustomobject]@{ id=($_.name -split '/')[-1]; nama=(Get-FieldValue $f.nama); kodeAset=(Get-FieldValue $f.kodeAset); ipAddress=(Get-FieldValue $f.ipAddress); monitorUrl=(Get-FieldValue $f.monitorUrl); lokasi=(Get-FieldValue $f.lokasi) }
    })
  } catch { Write-Host "[FIRESTORE READ ERROR] $($_.Exception.Message)" -ForegroundColor Red; return @() }
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
      $ok = Test-Connection -ComputerName $hostName -Count 1 -Quiet -TimeoutSeconds 4 -ErrorAction SilentlyContinue
      if ($ok) { $sw.Stop(); return @{online=$true; latency=$sw.ElapsedMilliseconds; method='ICMP'; reason="IP perangkat $hostName merespons ping"} }
    } catch {}

    foreach ($port in @(443,80,8291,8728,8729,8080,9100,3389)) {
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

function Get-InternetHealth {
  # Ini adalah kesehatan sumber internet dari PC monitoring/LAN, disimpan terpisah.
  $sw = [Diagnostics.Stopwatch]::StartNew(); $passed=0
  try { Invoke-WebRequest -Uri 'https://www.google.com/generate_204' -Method Head -UseBasicParsing -TimeoutSec 6 | Out-Null; $passed++ } catch {}
  try { Invoke-WebRequest -Uri 'https://www.cloudflare.com/cdn-cgi/trace' -Method Head -UseBasicParsing -TimeoutSec 6 | Out-Null; $passed++ } catch {}
  try { Resolve-DnsName -Name 'dns.google' -Type A -Server 8.8.8.8 -ErrorAction Stop | Out-Null; $passed++ } catch {}
  $sw.Stop()
  if ($passed -ge 2) { return @{online=$true; latency=$sw.ElapsedMilliseconds; reason='Sumber internet jaringan monitoring terdeteksi normal'} }
  return @{online=$false; latency=$null; reason='Sumber internet jaringan monitoring bermasalah atau tidak stabil'}
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
  $paths=@('online','status','state','deviceStatus','internetOnline','internetStatus','latency','checkedAt','consecutiveFail','consecutiveTrouble','method','reason','diagnosis','confidence','nama','kodeAset','lokasi','ipAddress')
  $mask=($paths | ForEach-Object { "updateMask.fieldPaths=$($_)" }) -join '&'
  $url="$ApiBase/monitorStatus/$assetId?$mask&key=$FirebaseApiKey"
  $fields=@{
    online=@{booleanValue=[bool]$device.online}; status=@{stringValue=[string]$ai.status}; state=@{stringValue=[string]$ai.status};
    deviceStatus=@{stringValue=[string]$ai.deviceStatus}; internetOnline=@{booleanValue=[bool]$internet.online}; internetStatus=@{stringValue=[string]$ai.internetStatus};
    latency=@{integerValue=[string]($(if($null -eq $device.latency){0}else{$device.latency}))}; checkedAt=@{timestampValue=(Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')};
    consecutiveFail=@{integerValue=[string]$consecutiveFail}; consecutiveTrouble=@{integerValue=[string]$consecutiveTrouble}; method=@{stringValue=[string]$device.method}; reason=@{stringValue=[string]$ai.reason}; diagnosis=@{stringValue=[string]$ai.diagnosis}; confidence=@{integerValue=[string]$ai.confidence}; nama=@{stringValue=[string]$asset.nama}; kodeAset=@{stringValue=[string]$asset.kodeAset}; lokasi=@{stringValue=[string]$asset.lokasi}; ipAddress=@{stringValue=[string]$asset.ipAddress}
  }
  try { Invoke-RestMethod -Uri $url -Method Patch -ContentType 'application/json' -Body (@{fields=$fields}|ConvertTo-Json -Depth 8) -TimeoutSec 10 | Out-Null; return $true } catch { Write-Host "[FIRESTORE ERROR] $assetId : $($_.Exception.Message)" -ForegroundColor Red; return $false }
}

function Send-Ntfy($asset,$title,$message,$priority='high') {
  if ([string]::IsNullOrWhiteSpace($Topic)) { return }
  try {
    Invoke-RestMethod -Uri "https://ntfy.sh/$Topic" -Method Post -Headers @{Title=$title; Priority=$priority; Tags='warning,computer'; Click="https://xii-tkj3-smknubandar.vercel.app"} -Body $message -TimeoutSec 10 | Out-Null
  } catch {}
}
Write-Host "IT Asset LAN Monitor + Local AI aktif. Interval $Interval detik." -ForegroundColor Cyan
Write-Host "AI lokal: $AIModel ($AIUrl)" -ForegroundColor Magenta
Write-Host "Topic ntfy: $Topic" -ForegroundColor Yellow
while ($true) {
  $assets = Get-Assets
  Write-Host "[$(Get-Date -Format HH:mm:ss)] Aset terbaca: $($assets.Count)" -ForegroundColor DarkCyan
  if ($assets.Count -eq 0) { Write-Host "Tidak ada aset yang terbaca dari Firestore. Cek koneksi/Firebase Rules/API Key." -ForegroundColor Yellow }
  foreach ($asset in $assets) {
    if ([string]::IsNullOrWhiteSpace($asset.monitorUrl) -and [string]::IsNullOrWhiteSpace($asset.ipAddress)) { continue }
    $old = $States[$asset.id]
    $device = Test-Target $asset
    $internet = Get-InternetHealth
    $ai = Invoke-AIDiagnosis $asset $device $internet $old
    $troubleNow = ($ai.status -ne 'online')
    $consecutiveFail = if ($device.online) { 0 } else { [int](if($old){$old.consecutiveFail}else{0}) + 1 }
    $consecutiveTrouble = if ($troubleNow) { [int](if($old){$old.consecutiveTrouble}else{0}) + 1 } else { 0 }
    Set-FirestoreStatus $asset.id $device $internet $ai $consecutiveFail $consecutiveTrouble $asset

    $previousStatus = if($old){[string]$old.status}else{''}
    if ($ai.status -ne 'online' -and $previousStatus -eq 'online' -and $consecutiveTrouble -ge $Threshold) {
      Send-Ntfy $asset 'Peringatan Gangguan Aset' "$($asset.nama) ($($asset.kodeAset)): $($ai.diagnosis) Keterangan: $($ai.reason)"
    }
    if ($ai.status -eq 'online' -and $previousStatus -ne 'online' -and $old -and $config.notifyRecovery) {
      Send-Ntfy $asset 'Aset Kembali Aman' "$($asset.nama) ($($asset.kodeAset)) kembali aman. $($ai.diagnosis)" 'default'
    }
    $States[$asset.id] = @{consecutiveFail=$consecutiveFail; consecutiveTrouble=$consecutiveTrouble; online=$device.online; status=$ai.status}
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $($asset.nama) -> $($ai.status.ToUpper()) | Perangkat: $($ai.deviceStatus) | Internet: $($ai.internetStatus) | $($ai.diagnosis)"
  }
  Start-Sleep -Seconds $Interval
}
