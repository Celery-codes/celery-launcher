@echo off
setlocal EnableDelayedExpansion
title Celery Launcher — Update
cd /d "%~dp0"

if "%~1"=="" (
  echo.
  echo  Celery Launcher Update
  echo  ======================
  echo  To apply an update, drag a patch .zip file
  echo  and drop it onto this UPDATE.bat file.
  echo.
  pause
  exit /b 0
)

set "ZIPFILE=%~1"
set "TMPDIR=%TEMP%\CeleryUpdate_%RANDOM%"

echo.
echo  Celery Launcher Update
echo  ======================
echo  Applying: %~nx1
echo.

if not exist "%ZIPFILE%" (
  echo  ERROR: File not found: %ZIPFILE%
  pause
  exit /b 1
)

echo  Extracting...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Expand-Archive -LiteralPath '%ZIPFILE%' -DestinationPath '%TMPDIR%' -Force"
if errorlevel 1 (
  echo  ERROR: Could not extract zip. Make sure it is a valid .zip file.
  pause
  exit /b 1
)

echo  Copying files...
echo.

call :CopyFile "launch.js"           "src\launcher\launch.js"
call :CopyFile "microsoft.js"        "src\auth\microsoft.js"
call :CopyFile "main.js"             "src\main.js"
call :CopyFile "preload.js"          "src\preload.js"
call :CopyFile "downloader.js"       "src\launcher\downloader.js"
call :CopyFile "mods.js"             "src\launcher\mods.js"
call :CopyFile "modpack.js"          "src\launcher\modpack.js"
call :CopyFile "options.js"          "src\launcher\options.js"
call :CopyFile "versions.js"         "src\api\versions.js"
call :CopyFile "modrinth.js"         "src\api\modrinth.js"
call :CopyFile "curseforge.js"       "src\api\curseforge.js"
call :CopyFile "app.js"              "renderer\app.js"
call :CopyFile "index.html"          "renderer\index.html"
call :CopyFile "style.css"           "renderer\style.css"
call :CopyFile "console.js"          "renderer\panels\console.js"
call :CopyFile "console-style.css"   "renderer\console-style.css"
call :CopyFile "theme-additions.css" "renderer\theme-additions.css"
call :CopyFile "mod-ui.css"          "renderer\mod-ui.css"
call :CopyFile "settings.js"         "renderer\panels\settings.js"
call :CopyFile "accounts.js"         "renderer\panels\accounts.js"
call :CopyFile "instances.js"        "renderer\panels\instances.js"
call :CopyFile "instance-detail.js"  "renderer\panels\instance-detail.js"
call :CopyFile "modpacks.js"         "renderer\panels\modpacks.js"

rmdir /s /q "%TMPDIR%" 2>nul

echo.
echo  ================================
echo   Update complete! Restarting...
echo  ================================
echo.
timeout /t 2 /nobreak >nul
start "" cmd /c "cd /d "%~dp0" && npm start"
exit /b 0

:CopyFile
set "FNAME=%~1"
set "DEST=%~dp0%~2"
for %%D in ("%DEST%") do (
  if not exist "%%~dpD" mkdir "%%~dpD"
)
for /r "%TMPDIR%" %%F in ("%FNAME%") do (
  copy /y "%%F" "%DEST%" >nul 2>&1
  echo   [OK] %FNAME%
  goto :eof
)
goto :eof
