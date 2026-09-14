@echo off
setlocal
cd /d "%~dp0"
set "TASK=IT Asset Monitoring Agent"
schtasks /Create /TN "%TASK%" /TR "wscript.exe \"%~dp0monitor-agent-hidden.vbs\"" /SC ONLOGON /RL HIGHEST /F >nul
schtasks /Run /TN "%TASK%" >nul
echo Monitoring Windows sudah dipasang dan dijalankan otomatis.
echo Tidak perlu membuka CMD lagi.
pause
