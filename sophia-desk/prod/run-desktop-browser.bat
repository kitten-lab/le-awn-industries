@echo off
cd /d "%~dp0\desk_sys"
start "" http://127.0.0.1:43167/
python server.py
if errorlevel 1 pause
