@echo off
setlocal
title XuanCe - Cloudflare Quick Tunnel
rem ============================================================
rem  ZhanCe one-click public exposure via Cloudflare quick tunnel
rem  Requires: tools\cloudflared.exe (auto-downloaded by this script)
rem  Result: prints a https://xxx.trycloudflare.com URL (no account)
rem  NOTE: keep this file ASCII-only (like 启动项目.bat)
rem ============================================================

set "ROOT=%~dp0"
set "CF=%ROOT%tools\cloudflared.exe"

if not exist "%CF%" (
  echo [1/2] Downloading cloudflared ...
  powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile '%CF%'"
  if errorlevel 1 (
    echo Failed to download cloudflared. Get it manually from:
    echo   https://github.com/cloudflare/cloudflared/releases
    echo and place it at tools\cloudflared.exe
    pause
    exit /b 1
  )
)

echo [2/2] Starting backend http://127.0.0.1:8000 ...
start "XuanCe-Backend-8000" cmd /k "%ROOT%page-agent\backend\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000"

echo.
echo Waiting for backend to boot ...
timeout /t 8 /nobreak >nul

echo.
echo ============================================================
echo  Public URL appears in the line "https://xxxx.trycloudflare.com"
echo  Keep this window open - closing it takes the site offline.
echo  Press Ctrl+C to stop the tunnel when done.
echo ============================================================
echo.
"%CF%" tunnel --url http://127.0.0.1:8000
