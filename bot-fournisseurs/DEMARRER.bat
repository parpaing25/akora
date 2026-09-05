@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Bot fournisseurs Akora
echo.
echo   Demarrage du bot de prospection Akora...
echo.
python demarrer.py
if errorlevel 1 (
  echo.
  echo   Le bot n a pas demarre. Verifiez que Python est installe,
  echo   puis lancez : pip install -r requirements.txt
  echo.
  pause
)
