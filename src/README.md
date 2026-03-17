# Celery Launcher

A fast, minimal Minecraft launcher built for PvP and SMP performance.

---

## Running from source (for you)

```
npm install
npm start
```

Or just double-click **START.bat** after the first `npm install`.

- **START.bat** — launch the app
- **BUILD.bat** — build a distributable installer for friends
- `npm run dev` — launch with DevTools open (debugging)

---

## Building an installer for friends

1. Double-click **BUILD.bat** in this folder
2. Wait 1–3 minutes while it packages everything
3. Find the installer at: `dist\Celery-Launcher-Setup-2.0.0.exe`
4. Share that single `.exe` file — that's all your friends need

### What your friends need to do

1. Download `Celery-Launcher-Setup-2.0.0.exe`
2. Double-click it
3. If Windows shows "Windows protected your PC" — click **More info**, then **Run anyway** (this happens because the app isn't code-signed — it's safe)
4. Click through the installer (choose install location if you want)
5. Celery Launcher opens automatically and creates a desktop shortcut
6. Sign in with their Microsoft account in the Accounts tab
7. Create an instance and launch

### What your friends do NOT need

- Node.js
- npm
- PowerShell
- Any technical knowledge

---

## Data location

All game files, instances, mods, and settings are stored in:
```
C:\Users\<name>\AppData\Roaming\CeleryLauncher\
```

Uninstalling the app does NOT delete this folder, so game data is safe.

---

## Requirements

- Windows 10 or 11 (64-bit)
- Java 21 (for Minecraft 1.21+) — download free from https://adoptium.net
- A valid Minecraft Java Edition account
