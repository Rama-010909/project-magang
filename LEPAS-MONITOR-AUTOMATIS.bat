@echo off
setlocal
set "TASKNAME=IT Asset Monitoring Agent"
schtasks /End /TN "%TASKNAME%" >nul 2>&1
schtasks /Delete /TN "%TASKNAME%" /F
if errorlevel 1 (
  echo Task tidak ditemukan atau gagal dihapus.
) else (
  echo Monitor otomatis berhasil dilepas.
)
pause
