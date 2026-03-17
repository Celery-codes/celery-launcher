# Celery Launcher

A fast, minimal Minecraft launcher built for PvP and SMP performance.

## First-time setup

```
npm install
npm start
```

Or double-click **START.bat** if you've already run `npm install` once.

## Running

- **START.bat** — launch the app directly (after first `npm install`)
- `npm start` — same thing via PowerShell
- `npm run dev` — launch with DevTools open (for debugging)
- `npm run build` — build a distributable Windows installer into `dist/`

## Creating a desktop shortcut

Open the launcher → Settings → "Create shortcut" — this writes a shortcut
to your desktop so you never need to open PowerShell again.

## Data location

All game files, instances, and settings are stored in:
`%APPDATA%\CeleryLauncher\`
