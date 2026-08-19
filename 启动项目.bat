@echo off
setlocal
title XuanCe Project Launcher
rem ============================================================
rem  XuanCe IP Ops Center - one-click launcher
rem  Starts 3 services in separate windows:
rem    backend  http://127.0.0.1:8000
rem    crawler  http://127.0.0.1:8080
rem    frontend http://127.0.0.1:5173
rem  NOTE: keep this file ASCII-only (no Chinese) so cmd.exe
rem        parses it correctly regardless of code page.
rem ============================================================

set "ROOT=%~dp0"

echo [1/3] Starting backend      http://127.0.0.1:8000
cd /d "%ROOT%page-agent\backend"
start "XuanCe-Backend-8000" cmd /k ".venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000"

echo [2/3] Starting MediaCrawler http://127.0.0.1:8080
cd /d "%ROOT%MediaCrawler"
start "MediaCrawler-8080" cmd /k ".\.venv\Scripts\python.exe -m uvicorn api.main:app --host 127.0.0.1 --port 8080"

echo [3/3] Starting frontend     http://127.0.0.1:5173
cd /d "%ROOT%page-agent\frontend"
start "XuanCe-Frontend-5173" cmd /k "npm run dev"

echo.
echo All 3 services started in separate windows.
echo Open http://127.0.0.1:5173 after a few seconds.
echo Close each window to stop that service.
echo This window can be closed now.
echo.
pause
