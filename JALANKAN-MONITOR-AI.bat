@echo off
setlocal
cd /d "%~dp0"
set "AI_EXE=%CD%\AI\bin\llama-server.exe"
set "AI_MODEL=%CD%\AI\models\model.gguf"

echo ================================================
echo IT ASSET MANAGEMENT - REAL-TIME MONITORING
 echo ================================================
if exist "%AI_EXE%" if exist "%AI_MODEL%" (
  echo [AI LLM] Menjalankan llama.cpp portable...
  tasklist /FI "IMAGENAME eq llama-server.exe" | find /I "llama-server.exe" >nul
  if errorlevel 1 start "IT Asset Local AI" /min "%AI_EXE%" -m "%AI_MODEL%" --host 127.0.0.1 --port 8080 -c 2048
  timeout /t 3 /nobreak >nul
) else (
  echo [AI BUILT-IN] Engine/model LLM tidak tersedia.
  echo [AI BUILT-IN] Diagnosis lokal tetap aktif tanpa instalasi tambahan.
)
echo [MONITOR] Memulai monitoring real-time...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0monitor-agent.ps1"
pause
