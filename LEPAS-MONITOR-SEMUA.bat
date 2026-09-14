@echo off
powershell -NoProfile -ExecutionPolicy Bypass -Command "Unregister-ScheduledTask -TaskName 'IT Asset Monitoring Agent' -Confirm:$false -ErrorAction SilentlyContinue"
echo Monitoring background Windows dilepas.
pause
