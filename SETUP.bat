@echo off
setlocal EnableDelayedExpansion
title Celery Launcher — Setup
color 0A
cls

echo.
echo  ==========================================
echo   Celery Launcher — Setup
echo  ==========================================
echo.
echo  This will install everything you need to
echo  run Celery Launcher on this PC.
echo.
echo  Requirements:
echo    - Node.js (will be installed if missing)
echo    - Java 21 (get from adoptium.net if needed)
echo    - A Minecraft Java Edition account
echo.
pause

:: ── Check if Node.js is installed ────────────────────────────────────────────
echo.
echo  [1/3] Checking Node.js...
where node >nul 2>&1
if errorlevel 1 (
  echo  Node.js not found. Opening download page...
  echo  Please install Node.js LTS, then run this setup again.
  start https://nodejs.org/en/download
  echo.
  pause
  exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do set NODEVER=%%v
echo  Node.js found: %NODEVER%

:: ── Install dependencies ──────────────────────────────────────────────────────
echo.
echo  [2/3] Installing dependencies...
cd /d "%~dp0"
call npm install
if errorlevel 1 (
  echo.
  echo  ERROR: npm install failed.
  pause
  exit /b 1
)
echo  Dependencies installed.

:: ── Create desktop shortcut ───────────────────────────────────────────────────
echo.
echo  [3/3] Creating desktop shortcut...
set "SHORTCUT=%USERPROFILE%\Desktop\Celery Launcher.bat"
echo @echo off > "%SHORTCUT%"
echo cd /d "%~dp0" >> "%SHORTCUT%"
echo npm start >> "%SHORTCUT%"
echo  Shortcut created on Desktop.

:: ── Done ─────────────────────────────────────────────────────────────────────
echo.
echo  ==========================================
echo   Setup complete!
echo  ==========================================
echo.
echo  To launch: double-click "Celery Launcher"
echo  on your Desktop, or run START.bat
echo.
echo  NOTE: You also need Java 21 to play.
echo  Get it free from: https://adoptium.net
echo  Download "Temurin 21 LTS" for Windows x64.
echo.
set /p START="Start Celery Launcher now? (Y/N): "
if /i "%START%"=="Y" (
  npm start
)
exit /b 0
