@echo off
title Celery Launcher — Build Installer
echo.
echo  Celery Launcher — Building Windows Installer
echo  =============================================
echo.

:: Check Node is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo  ERROR: Node.js not found. Install it from https://nodejs.org
  pause
  exit /b 1
)

:: Install dependencies if node_modules missing
if not exist "node_modules" (
  echo  Installing dependencies...
  call npm install
  if %errorlevel% neq 0 (
    echo  ERROR: npm install failed.
    pause
    exit /b 1
  )
)

:: Run the build
echo  Building installer...
echo  This takes 1-3 minutes. Please wait.
echo.
call npm run build

if %errorlevel% neq 0 (
  echo.
  echo  ERROR: Build failed. See output above for details.
  pause
  exit /b 1
)

echo.
echo  Build complete!
echo  Your installer is in the dist\ folder.
echo  File: dist\Celery-Launcher-Setup-2.0.0.exe
echo.
echo  Share that .exe file with your friends.
echo  They just double-click it to install — no setup required.
echo.
pause
