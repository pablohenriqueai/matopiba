@echo off
setlocal
cd /d "%~dp0"
where python >nul 2>nul || (echo Python nao encontrado. Instale Python 3.11 ou 3.12 e adicione ao PATH.& pause& exit /b 1)
where node >nul 2>nul || (echo Node.js nao encontrado. Instale Node.js LTS e adicione ao PATH.& pause& exit /b 1)
if not exist "backend\.venv\Scripts\python.exe" (
  echo Criando ambiente virtual do backend...
  python -m venv backend\.venv || (echo Falha ao criar ambiente virtual.& pause& exit /b 1)
)
backend\.venv\Scripts\python.exe -c "import torch, torchvision" >nul 2>nul
if errorlevel 1 (
  echo PyTorch ou Torchvision nao encontrados neste ambiente.
  echo Instale ambos no backend\.venv com a variante CPU ou CUDA escolhida em https://pytorch.org/get-started/locally/.
  pause
  exit /b 1
)
if not exist "backend\.venv\Scripts\uvicorn.exe" (
  echo Instalando dependencias Python restantes...
  call backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt || (echo Falha ao instalar dependencias.& pause& exit /b 1)
)
if not exist "node_modules" (
  echo Dependencias do frontend ausentes. Execute pnpm install.
  pause
  exit /b 1
)
start "SoJao API" /D "%~dp0backend" "%~dp0backend\.venv\Scripts\python.exe" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
start "SoJao Web" /D "%~dp0" cmd /k pnpm dev
timeout /t 3 /nobreak >nul
start "" http://localhost:3000
