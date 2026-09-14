# Built-in local diagnostic engine.
# Tidak membutuhkan Ollama/Python/Node/API/model eksternal.
# Ini adalah inference berbasis aturan + confidence scoring, bukan LLM.
function Invoke-EmbeddedAIDiagnosis {
  param($asset,$device,$internet,$history)
  $deviceOk = [bool]$device.online
  $internetOk = [bool]$internet.online
  $lat = 0
  [int]::TryParse([string]$device.latency,[ref]$lat) | Out-Null
  $fails = 0
  $troubles = 0
  if ($history) {
    $fails = [int]$history.consecutiveFail
    $troubles = [int]$history.consecutiveTrouble
  }

  if ($deviceOk -and $internetOk) {
    $confidence = 94
    if ($lat -gt 200) { $confidence = 84 }
    elseif ($lat -gt 100) { $confidence = 89 }
    return @{status='online';deviceStatus='aktif';internetStatus='aman';diagnosis= if($lat -gt 200){'Perangkat aktif dan internet tersedia, tetapi respons perangkat cukup lambat.'}else{'Perangkat aktif dan sumber internet terdeteksi aman.'};reason="$($device.reason); $($internet.reason).";confidence=$confidence}
  }

  if ($deviceOk -and !$internetOk) {
    $confidence = if($troubles -ge 2){93}else{87}
    return @{status='internet_trouble';deviceStatus='aktif';internetStatus='trouble';diagnosis='Perangkat masih aktif, tetapi sumber internet atau jalur keluar jaringan terindikasi bermasalah.';reason="$($device.reason); $($internet.reason). Gangguan terdeteksi $troubles kali berturut-turut.";confidence=$confidence}
  }

  if (!$deviceOk -and $internetOk) {
    $confidence = if($fails -ge 3){94}elseif($fails -ge 2){91}else{83}
    return @{status='device_trouble';deviceStatus='mati/tidak terjangkau';internetStatus='aman';diagnosis='Sumber internet monitoring aman, tetapi perangkat tidak terjangkau. Kemungkinan perangkat mati, kabel/LAN bermasalah, atau jalur menuju perangkat terputus.';reason="$($device.reason); $($internet.reason). Kegagalan perangkat $fails kali berturut-turut.";confidence=$confidence}
  }

  return @{status='network_trouble';deviceStatus='tidak terjangkau';internetStatus='trouble';diagnosis='Perangkat tidak terjangkau dan internet monitoring juga bermasalah. Gangguan jaringan/ISP perlu diperiksa sebelum menyimpulkan perangkat mati.';reason="$($device.reason); $($internet.reason). Data belum cukup untuk memastikan penyebab tunggal.";confidence=86}
}
