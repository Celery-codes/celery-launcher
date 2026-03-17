# Celery Launcher — Installation Guide

## Option A: Installer (easiest — share this with friends)

```
npm run build
```

This creates `dist/Celery Launcher Setup 2.1.0.exe` — a standalone Windows installer.
Send that file to your friends. They double-click it, click through the wizard, and it
installs Celery Launcher with a desktop shortcut. No Node.js or npm required on their end.

## Option B: Run from source (for development)

Requirements: Node.js 18+ (https://nodejs.org)

```
npm install    (first time only)
npm start
```

Or double-click START.bat after running npm install once.

## What your friends need

Just the .exe installer from `dist/`. They'll need:
- Windows 10 or 11 (64-bit)
- Java 17 or 21 — download free from https://adoptium.net
  (Temurin 21 LTS, Windows x64 .msi installer)
- A Minecraft Java Edition account

## Data location

Everything is stored in: %APPDATA%\CeleryLauncher\
- instances\   — your game profiles
- versions\    — downloaded Minecraft versions
- assets\      — game assets (textures, sounds)
- libraries\   — game libraries

## Building the installer

1. npm install
2. npm run build
3. Find the installer in dist\
