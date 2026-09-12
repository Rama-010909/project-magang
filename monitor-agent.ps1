# IT Asset Management - Local LAN Monitor (free, no Vercel env)
# Run this script on a Windows PC that stays on inside the same LAN.
$ErrorActionPreference = 'SilentlyContinue'
$ProjectId = 'it-asset-diskominfo-batang'
$ConfigPath = Join-Path $PSScriptRoot 'monitor-agent-config.json'
$ApiBase = "https://firestore.googleapis.com/v1/projects/$ProjectId/databases/(default)/documents"

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

function Get-FieldValue($field) {
  if ($null -eq $field) { return '' }
  if ($field.stringValue -ne $null) { return [string]$field.stringValue }
  if ($field.integerValue -ne $null) { return [int64]$field.integerValue }
  if ($field.booleanValue -ne $null) { return [bool]$field.booleanValue }
  return ''
}
function Get-Assets {
  try {
    $r = Invoke-RestMethod -Uri "$ApiBase/assets?pageSize=1000" -Method Get -TimeoutSec 15
    @($r.documents | ForEach-Object {
      $f = $_.fields
      [pscustomobject]@{ id=($_.name -split '/')[-1]; nama=(Get-FieldValue $f.nama); kodeAset=(Get-FieldValue $f.kodeAset); ipAddress=(Get-FieldValue $f.ipAddress); monitorUrl=(Get-FieldValue $f.monitorUrl); lokasi=(Get-FieldValue $f.lokasi) }
    })
  } catch { @() }
}
function Test-Target($asset) {
  $target = [string]$asset.monitorUrl
  if ([string]::IsNullOrWhiteSpace($target)) { $target = [string]$asset.ipAddress }
  if ([string]::IsNullOrWhiteSpace($target)) { return @{online=$false; latency=$null; method='none'; reason='Alamat monitoring kosong'} }
  $sw = [Diagnostics.Stopwatch]::StartNew()
  if ($target -match '^https?://') {
    try { Invoke-WebRequest -Uri $target -UseBasicParsing -TimeoutSec 4 | Out-Null; $sw.Stop(); return @{online=$true; latency=$sw.ElapsedMilliseconds; method='HTTP'; reason='HTTP merespons'} } catch { $sw.Stop(); return @{online=$false; latency=$null; method='HTTP'; reason='Tidak merespons HTTP'} }
  }
  $hostName = $target -replace '^https?://','' -replace '/.*$',''
  try {
    $ok = Test-Connection -ComputerName $hostName -Count 1 -Quiet -ErrorAction SilentlyContinue
    if ($ok) { $sw.Stop(); return @{online=$true; latency=$sw.ElapsedMilliseconds; method='ICMP'; reason='Ping berhasil'} }
  } catch {}
  foreach ($port in @($config.ports)) {
    try {
      $client = New-Object Net.Sockets.TcpClient
      $task = $client.ConnectAsync($hostName,[int]$port)
      if ($task.Wait(1200) -and $client.Connected) { $client.Close(); $sw.Stop(); return @{online=$true; latency=$sw.ElapsedMilliseconds; method="TCP:$port"; reason="Port $port merespons"} }
      $client.Close()
    } catch {}
  }
  $sw.Stop(); return @{online=$false; latency=$null; method='ICMP/TCP'; reason='Ping dan port umum tidak merespons'}
}
function Set-FirestoreStatus($assetId,$result,$consecutiveFail) {
  $url = "$ApiBase/monitorStatus/$assetId?updateMask.fieldPaths=online&updateMask.fieldPaths=latency&updateMask.fieldPaths=checkedAt&updateMask.fieldPaths=consecutiveFail&updateMask.fieldPaths=method&updateMask.fieldPaths=reason"
  $fields = @{ online=@{booleanValue=[bool]$result.online}; latency=@{integerValue=[string]($(if($null -eq $result.latency){0}else{$result.latency}))}; checkedAt=@{timestampValue=(Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')}; consecutiveFail=@{integerValue=[string]$consecutiveFail}; method=@{stringValue=[string]$result.method}; reason=@{stringValue=[string]$result.reason} }
  try { Invoke-RestMethod -Uri $url -Method Patch -ContentType 'application/json' -Body (@{fields=$fields}|ConvertTo-Json -Depth 8) -TimeoutSec 10 | Out-Null } catch {}
}
function Send-Ntfy($asset,$title,$message,$priority='high') {
  if ([string]::IsNullOrWhiteSpace($Topic)) { return }
  try {
    Invoke-RestMethod -Uri "https://ntfy.sh/$Topic" -Method Post -Headers @{Title=$title; Priority=$priority; Tags='warning,computer'; Click="https://xii-tkj3-smknubandar.vercel.app"} -Body $message -TimeoutSec 10 | Out-Null
  } catch {}
}
Write-Host "IT Asset LAN Monitor aktif. Interval $Interval detik." -ForegroundColor Cyan
Write-Host "Topic ntfy: $Topic" -ForegroundColor Yellow
while ($true) {
  $assets = Get-Assets
  foreach ($asset in $assets) {
    if ([string]::IsNullOrWhiteSpace($asset.monitorUrl) -and [string]::IsNullOrWhiteSpace($asset.ipAddress)) { continue }
    $result = Test-Target $asset
    $old = $States[$asset.id]
    $fails = if ($result.online) { 0 } else { [int](if($old){$old.fails}else{0}) + 1 }
    Set-FirestoreStatus $asset.id $result $fails
    if (!$result.online -and $fails -eq $Threshold) {
      Send-Ntfy $asset '⚠️ Aset Trouble' "$($asset.nama) ($($asset.kodeAset)) tidak merespons. Lokasi: $($asset.lokasi). Pemeriksaan: $($result.method)."
    }
    if ($result.online -and $old -and $old.fails -ge $Threshold -and $config.notifyRecovery) {
      Send-Ntfy $asset '✅ Aset Kembali Online' "$($asset.nama) ($($asset.kodeAset)) kembali merespons. Pemeriksaan: $($result.method)." 'default'
    }
    $States[$asset.id] = @{fails=$fails; online=$result.online}
    
    $stateText = if ($result.online) { 'ONLINE' } else { 'TROUBLE' }
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $($asset.nama) -> $stateText $($result.method)"
  }
  Start-Sleep -Seconds $Interval
}
