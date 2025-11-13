# Script de démarrage du serveur backend LabLens
Set-Location -Path $PSScriptRoot
python -m uvicorn app.main:app --reload --port 8000

