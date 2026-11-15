@echo off
cd /d "%~dp0"
start "" http://localhost:8137
where node >nul 2>nul
if %errorlevel%==0 (node server.js) else (python -m http.server 8137)
pause
