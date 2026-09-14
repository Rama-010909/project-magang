@echo off
setlocal
cd /d "%~dp0"

echo ================================================
echo   IT ASSET MONITOR - AUTO START
 echo ================================================
echo.

where schtasks.exe >nul 2>&1
if errorlevel 1 (
  echo ERROR: schtasks.exe tidak ditemukan.
  pause
  exit /b 1
)

set "TASKNAME=IT Asset Monitoring Agent"
set "VBS=%~dp0monitor-agent-hidden.vbs"

schtasks /Create /SC ONLOGON /TN "%TASKNAME%" /TR "wscript.exe \"%VBS%\"" /F >nul 2>&1
if errorlevel 1 (
  echo Gagal memasang Task Scheduler.
  echo Coba jalankan file ini sebagai Administrator.
  pause
  exit /b 1
)

echo.
echo BERHASIL.
echo Monitor akan berjalan otomatis setiap kali Windows login.
echo Tidak perlu membuka JALANKAN-MONITOR.bat lagi.
echo.
echo Menjalankan monitor sekarang...
schtasks /Run /TN "%TASKNAME%" >nul 2>&1
if errorlevel 1 echo Peringatan: monitor belum dijalankan sekarang. Akan otomatis jalan saat login berikutnya.
echo.
echo Untuk mengecek task: Task Scheduler ^> %TASKNAME%
echo.
pause
