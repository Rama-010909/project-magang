@echo off
setlocal
cd /d "%~dp0"
echo ================================================
echo IT ASSET MONITOR - INSTAL OTOMATIS WINDOWS
echo ================================================
echo.
if not exist "%~dp0monitor-agent.ps1" (
  echo monitor-agent.ps1 tidak ditemukan.
  pause
  exit /b 1
)
set "TASK=IT Asset Monitoring Agent"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p='%~dp0monitor-agent-hidden.vbs'; $a=New-ScheduledTaskAction -Execute 'wscript.exe' -Argument ('""'+$p+'""'); $t=New-ScheduledTaskTrigger -AtLogOn; Register-ScheduledTask -TaskName '%TASK%' -Action $a -Trigger $t -Description 'IT Asset Monitoring background agent' -Force | Out-Null; Start-ScheduledTask -TaskName '%TASK%'"
if errorlevel 1 (
 echo Gagal memasang scheduled task.
 pause
 exit /b 1
)
echo.
echo BERHASIL. Monitoring sekarang berjalan di background.
echo Tidak perlu membuka aplikasi monitor secara manual.
echo Task: %TASK%
pause
