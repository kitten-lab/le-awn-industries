@echo off
cd /d "%~dp0concor_sys"
echo Jack's Concor · CO.JX-001-CONCOR
echo Browser: http://127.0.0.1:43150/
echo Prefer Deck Host: run-in-deck-host.py from this folder
python server.py
pause
