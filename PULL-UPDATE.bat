@echo off
title Celery Launcher — Check for Updates
cd /d "%~dp0"

echo.
echo  Checking for updates...
echo.

git pull

echo.
echo  Restarting launcher...
echo.
timeout /t 1 /nobreak >nul
npm start