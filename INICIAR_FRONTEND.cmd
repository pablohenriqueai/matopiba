@echo off
cd /d "%~dp0"
where pnpm >nul 2>nul || (echo pnpm nao encontrado. Ative o Corepack ou instale pnpm.& pause& exit /b 1)
pnpm dev
