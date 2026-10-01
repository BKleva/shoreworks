@echo off
cd /d "%~dp0"
python -m pip install -q -r requirements.txt
start "" http://127.0.0.1:5057
python app.py
