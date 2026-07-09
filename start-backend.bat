@echo off
setlocal

cd /d "%~dp0"
if errorlevel 1 (
  echo Failed to enter backend directory.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found in PATH. Please install Node.js or add it to PATH.
  pause
  exit /b 1
)

curl.exe -fsS --max-time 3 http://localhost:3000/api/health >nul 2>nul
if not errorlevel 1 (
  echo Backend is already running at http://localhost:3000
  echo.
  curl.exe -s --max-time 3 http://localhost:3000/api/health
  echo.
  pause
  exit /b 0
)

echo Starting campus trade backend...
echo URL: http://localhost:3000
echo WebSocket: ws://localhost:3000/ws
echo.

node server.js

echo.
echo Backend process exited.
pause
