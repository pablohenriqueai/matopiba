@echo off
cd /d "%~dp0backend"
if not exist ".venv\Scripts\python.exe" (echo Ambiente virtual ausente. Crie com python -m venv .venv e instale requirements.txt.& pause& exit /b 1)
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
pause
