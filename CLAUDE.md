# Celery Launcher — Claude Code Instructions

## Project Overview
Celery Launcher is a custom Minecraft launcher built with Electron (Node.js).
- **Stack:** Electron v33+, electron-store, node-fetch, extract-zip, uuid, axios, electron-updater
- **Node:** v22, npm v10
- **GitHub:** https://github.com/Celery-codes/celery-launcher

## Directory Structure
```
celery-launcher/
├── src/
│   ├── main.js                  — Electron main process, ALL IPC handlers
│   ├── preload.js               — contextBridge API (window.launcher.*)
│   ├── updater.js               — electron-updater in-app updates
│   ├── auth/microsoft.js        — Microsoft OAuth (embedded window)
│   ├── api/versions.js          — Mojang/Fabric/Forge version APIs
│   ├── api/modrinth.js          — Modrinth search API
│   ├── api/curseforge.js        — CurseForge search API
│   ├── launcher/launch.js       — Game launch, JVM flags, natives
│   ├── launcher/downloader.js   — MC JAR/assets/libraries/natives download
│   ├── launcher/mods.js         — Mod install/remove/update/toggle
│   ├── launcher/modpack.js      — .mrpack/.zip import
│   ├── launcher/options.js      — Options profiles (never throws)
│   ├── launcher/loaderapis.js   — Fabric API auto-install
│   └── launcher/skin.js         — Player skin head
├── renderer/
│   ├── index.html               — Main HTML
│   ├── app.js                   — Main renderer logic
│   ├── style.css                — Main CSS with CSS variables
│   └── panels/
│       ├── instance-detail.js   — Per-instance tabs, mod enable/disable
│       ├── mods.js              — Modrinth/CurseForge browser
│       ├── modpacks.js          — Modpack browser + import
│       ├── accounts.js          — Microsoft account management
│       ├── console.js           — Game log console panel
│       └── settings.js          — Settings + themes + Java dropdown
├── assets/icon.png/.ico
└── package.json                 — Current version
```

## Data Paths (Windows)
- Config: `%APPDATA%\celery-launcher\config.json`
- Game data: `%APPDATA%\CeleryLauncher\`
- Instances: `%APPDATA%\CeleryLauncher\instances\<folderName>\`
- Versions: `%APPDATA%\CeleryLauncher\versions\<mcVersion>\`
- Natives: `%APPDATA%\CeleryLauncher\versions\<mcVersion>\natives\`
- Option profiles: `%APPDATA%\CeleryLauncher\option-profiles\`
- Logs: `%APPDATA%\CeleryLauncher\logs\`

## Critical Rules

### Never Break These
- **Instance folders** use `inst.folderName || inst.id` — NEVER just `inst.id`. New instances store a sanitized `folderName` property. Existing instances fall back to `inst.id`.
- **options.js captureProfileFromInstance** must NEVER throw. Always save the profile even if options.txt doesn't exist (use `hasOptions: false` flag).
- **Natives** are extracted to `versions/<mcVersion>/natives/` during download, not at launch time. `launch.js` points `-Djava.library.path` there.
- **Token refresh** runs in background every 30 minutes in `main.js` via `setInterval`. Always refresh token before launch too.
- **preload.js** exposes everything via `contextBridge` as `window.launcher.*`. Any new IPC handler in `main.js` MUST have a corresponding entry in `preload.js`.

### IPC Pattern
Every feature requires 3 matching pieces:
1. `ipcMain.handle('channel-name', handler)` in `src/main.js`
2. `channelName: (opts) => ipcRenderer.invoke('channel-name', opts)` in `src/preload.js`
3. `window.launcher.channelName(opts)` call in renderer

### File Encoding
- Always write files as UTF-8
- Avoid special Unicode characters (em-dash `—`, ellipsis `…`, arrows `→`) in JS template literals — they corrupt when extracted from zips on Windows
- Use plain ASCII alternatives in code comments and strings

### Input Dialog Bug (FIXED)
The `show-input-dialog` handler uses a `resolved` flag to prevent the `win.on('closed')` event from firing before the IPC message arrives and returning `null`. Do not revert this fix.

## Workflow

### Making Changes
1. Read the relevant file(s) before editing — never assume content
2. Make the change
3. Run `node --check <file>` to syntax-check every JS file you touch
4. **Always run `npm start` in the background automatically after every change** — do not ask, just launch it
5. Look for related bugs — if changing IPC handlers, check preload.js; if changing folder paths, check all files that reference instance dirs

### Testing Checklist
Before committing any change, verify:
- [ ] `node --check` passes on all modified files
- [ ] `npm start` launches without errors in terminal
- [ ] The specific feature works end-to-end in the running app
- [ ] No existing features are broken (launch game, mod install, accounts)
- [ ] DevTools console (`Ctrl+Shift+I`) shows no errors

### Git Workflow
```bash
git add -A
git commit -m "vX.X.X - description of changes"
git push
```

Always bump the version in `package.json` before building a release:
- Patch (bug fixes): `2.4.4` → `2.4.5`
- Minor (new features): `2.4.4` → `2.5.0`
- Major (breaking changes): `2.4.4` → `3.0.0`

### Building & Installing
```powershell
npm run build
# Produces: dist\Celery-Launcher-Setup-X.X.X.exe
```
Uninstall old version via Add/Remove Programs, then run the new exe from `dist\`.

### Extracting Zip Patches (no encoding corruption)
```powershell
Expand-Archive -Path "$env:USERPROFILE\Downloads\patch.zip" -DestinationPath "C:\Users\Evan\Celery\celery-launcher\_tmp" -Force
```
Then drag files from `_tmp\` into the project. Never drag directly from the zip.

## Known Issues & Context

### Natives (RESOLVED for new downloads)
- `downloader.js` downloads native classifier jars AND extracts `.dll` files to `versions/<mcVersion>/natives/` during version download
- Existing versions (1.16.1, 1.21.11) needed manual extraction — already done
- `launch.js` sets `-Djava.library.path`, `-Dorg.lwjgl.librarypath`, `-Dnet.java.games.input.librarypath` all pointing to the natives dir

### Instance Folder Naming
- New instances: `folderName = name.replace(/[^a-zA-Z0-9 _-]/g,'').replace(/\s+/g,'_').slice(0,40)`
- `getInstanceDir(instanceId)` in `main.js`, `mods.js`, `options.js` resolves the correct path
- Old instances keep their ID-based folders — migration safety via fallback

### Token Refresh / Session
- Background refresh: `setInterval` every 30 min in `main.js` `app.whenReady()`
- Pre-launch refresh: token refreshed immediately before every game launch
- If refresh fails but token isn't expired yet, launch proceeds with existing token

### Options Profiles
- Profiles saved to `%APPDATA%\CeleryLauncher\option-profiles\<uuid>.json`
- `captureProfileFromInstance` never throws — saves with `hasOptions: false` if no options.txt
- UI in `instance-detail.js` `loadDetailOptions()` — save button uses `showInputDialog` then `captureOptionsProfile`

## Planned Features (not yet built)
1. In-game mod menu editor (similar to Lunar/Feather client)
2. Custom Celery Launcher cape visible to other launcher users
3. Skin management in launcher
4. Mod sync for SMP groups
5. Crash analyzer
6. Smart RAM allocation
7. Server status dashboard
