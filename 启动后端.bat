@echo off
title XuanCe Backend 8000
cd /d "%~dp0page-agent\backend"
echo ============================================
echo  XuanCe backend starting on
echo  http://127.0.0.1:8000
echo  Keep this window OPEN while the site is
echo  published. Close it = backend offline.
echo  Success line: Uvicorn running on
echo  http://127.0.0.1:8000
echo ============================================
".venv\Scripts\python.exe" -m uvicorn main:app --host 127.0.0.1 --port 8000
pause