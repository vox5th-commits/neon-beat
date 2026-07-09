@echo off
chcp 65001 >nul
cd /d "%~dp0"

set "PY=%LOCALAPPDATA%\Python\bin\python.exe"
if not exist "%PY%" set "PY=python"

echo.
echo  NEON BEAT - local server
echo  Browser: http://127.0.0.1:8080
echo  Keep this window OPEN while playing.
echo.

start "" "http://127.0.0.1:8080/"
"%PY%" -m http.server 8080 --bind 127.0.0.1
if errorlevel 1 (
  echo.
  echo Failed to start Python HTTP server.
  echo Install Python or run: py -m http.server 8080 --bind 127.0.0.1
  pause
)
