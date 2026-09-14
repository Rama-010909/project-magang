@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0monitor-agent.ps1"
echo.
echo Monitor berhenti. ExitCode=%ERRORLEVEL%
pause
