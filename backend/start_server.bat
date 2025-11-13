@echo off
REM Script de démarrage du serveur backend LabLens
cd /d "%~dp0"
python -m uvicorn app.main:app --reload --port 8000

