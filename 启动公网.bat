@echo off
setlocal
title XuanCe Cloudflare Quick Tunnel
rem ============================================================
rem  One-click public exposure via Cloudflare quick tunnel
rem  Needs tools\cloudflared.exe (auto-downloaded if missing)
rem  Prints a https://xxxx.trycloudflare.com URL (no account)
rem ============================================================

set "ROOT=%~dp0"
set "CF=%ROOT%tools\cloudflared.exe"

if not exist "%CF%" (
  echo [1/2] Downloading cloudflared ...
  powershell -NoProfile -Command "$c=New-Object System.Net.WebClient; $c.DownloadFile('https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe','%CF%')"
)

if not exist "%CF%" (
  echo Failed to get cloudflared. Download manually:
  echo   https://github.com/cloudflare/cloudflared/releases
  echo then place it at tools\cloudflared.exe
  pause
  exit /b 1
)

echo [2/2] Starting backend http://127.0.0.1:8000 ...
cd /d "%ROOT%page-agent\backend"
start "XuanCe-Backend-8000" cmd /k "%ROOT%page-agent\backend\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000"
cd /d "%ROOT%"

echo Waiting for backend to boot ...
timeout /t 8 /nobreak >nul

echo ============================================================
echo  Public URL is the https://xxxx.trycloudflare.com line below
echo  Keep both windows open - closing either takes the site offline.
echo  Backend window must show: Uvicorn running on http://127.0.0.1:8000
echo  Press Ctrl+C to stop the tunnel when done.
echo ============================================================
"%CF%" tunnel --url http://127.0.0.1:8000 --protocol http2
pause