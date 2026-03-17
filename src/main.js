const { app, BrowserWindow, ipcMain, shell, dialog, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');

const store = new Store();
const { authenticateMicrosoft, refreshToken, logout } = require('./auth/microsoft');
const { launchMinecraft } = require('./launcher/launch');
const { downloadVersion, getInstalledVersions } = require('./launcher/downloader');
const { fetchMcVersions, fetchFabricVersions, fetchForgeVersions } = require('./api/versions');
const { searchModrinth, getModrinthCategories } = require('./api/modrinth');
const { searchCurseForge } = require('./api/curseforge');
const { installMod, removeMod, getInstalledMods, updateAllMods } = require('./launcher/mods');

let mainWindow;
const isDev = process.argv.includes('--dev');

const DATA_DIR = path.join(app.getPath('appData'), 'CeleryLauncher');
const INSTANCES_DIR = path.join(DATA_DIR, 'instances');
const VERSIONS_DIR = path.join(DATA_DIR, 'versions');
const ASSETS_DIR = path.join(DATA_DIR, 'assets');
const LIBRARIES_DIR = path.join(DATA_DIR, 'libraries');
const JAVA_DIR = path.join(DATA_DIR, 'java');

[DATA_DIR, INSTANCES_DIR, VERSIONS_DIR, ASSETS_DIR, LIBRARIES_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

global.paths = { DATA_DIR, INSTANCES_DIR, VERSIONS_DIR, ASSETS_DIR, LIBRARIES_DIR, JAVA_DIR };

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0d0f0e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    },
    icon: path.join(__dirname, '../assets/icon.ico')
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  if (isDev) mainWindow.webContents.openDevTools();
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  const { session } = require('electron');
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self' 'unsafe-inline' https: data: blob:"]
      }
    });
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window-close', () => mainWindow.close());

// Auth
ipcMain.handle('auth-microsoft', async () => {
  try { const account = await authenticateMicrosoft(mainWindow); store.set('account', account); return { success: true, account }; }
  catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('auth-logout', async (_, uuid) => {
  await logout(uuid);
  const accounts = store.get('accounts', []);
  store.set('accounts', accounts.filter(a => a.uuid !== uuid));
  return { success: true };
});
ipcMain.handle('auth-get-accounts', () => store.get('accounts', []));
ipcMain.handle('auth-set-active', (_, uuid) => { store.set('activeAccount', uuid); return { success: true }; });
ipcMain.handle('auth-refresh', async (_, uuid) => {
  try {
    const accounts = store.get('accounts', []);
    const account = accounts.find(a => a.uuid === uuid);
    if (!account) throw new Error('Account not found');
    const refreshed = await refreshToken(account);
    store.set('accounts', accounts.map(a => a.uuid === uuid ? refreshed : a));
    return { success: true, account: refreshed };
  } catch (e) { return { success: false, error: e.message }; }
});

// Instances
ipcMain.handle('instances-get', () => store.get('instances', []));
ipcMain.handle('instances-save', (_, instances) => { store.set('instances', instances); return { success: true }; });
ipcMain.handle('instance-open-folder', (_, instanceId) => {
  const instanceDir = path.join(INSTANCES_DIR, instanceId);
  if (!fs.existsSync(instanceDir)) fs.mkdirSync(instanceDir, { recursive: true });
  shell.openPath(instanceDir);
  return { success: true };
});

// Versions
ipcMain.handle('versions-minecraft', async () => { try { return await fetchMcVersions(); } catch (e) { return { error: e.message }; } });
ipcMain.handle('versions-fabric', async (_, mcVersion) => { try { return await fetchFabricVersions(mcVersion); } catch (e) { return { error: e.message }; } });
ipcMain.handle('versions-forge', async (_, mcVersion) => { try { return await fetchForgeVersions(mcVersion); } catch (e) { return { error: e.message }; } });

//Persistent log files
const LOGS_DIR = path.join(DATA_DIR, 'logs');
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

let currentLogStream = null;
let currentLogPath = null;

function openNewLogSession(instanceName) {
  // Close previous stream if open
  if (currentLogStream) {
    currentLogStream.end('\n--- Session ended ---\n');
    currentLogStream = null;
  }
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const safeName = (instanceName || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
  currentLogPath = path.join(LOGS_DIR, `${safeName}_${dateStr}.log`);
  currentLogStream = fs.createWriteStream(currentLogPath, { flags: 'a' });
  currentLogStream.write(`=== Celery Launcher Session: ${instanceName} — ${now.toLocaleString()} ===\n`);
  return currentLogPath;
}

function writeToLog(text) {
  if (currentLogStream && !currentLogStream.destroyed) {
    currentLogStream.write(text);
  }
}

ipcMain.handle('open-log-folder', () => {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
  shell.openPath(LOGS_DIR);
  return { success: true };
});

ipcMain.handle('clear-log-folder', () => {
  try {
    if (currentLogStream) { currentLogStream.end(); currentLogStream = null; }
    const files = fs.readdirSync(LOGS_DIR).filter(f => f.endsWith('.log'));
    for (const f of files) fs.unlinkSync(path.join(LOGS_DIR, f));
    return { success: true, cleared: files.length };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('save-log-file', async (_, text) => {
  try {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Game Log',
      defaultPath: path.join(app.getPath('downloads'), 'celery-log-' + Date.now() + '.log'),
      filters: [{ name: 'Log files', extensions: ['log', 'txt'] }]
    });
    if (!filePath) return { cancelled: true };
    fs.writeFileSync(filePath, text, 'utf8');
    return { success: true, path: filePath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Launch
ipcMain.handle('launch-game', async (_, { instanceId, accountUuid }) => {
  try {
    const instances = store.get('instances', []);
    const instance = instances.find(i => i.id === instanceId);
    if (!instance) throw new Error('Instance not found');

    const accounts = store.get('accounts', []);
    const account = accounts.find(a => a.uuid === accountUuid);
    if (!account) throw new Error('No account selected');

    const settings = store.get('settings', {});

    mainWindow.webContents.send('launch-status', { status: 'preparing', message: 'Preparing launch...' });

    await downloadVersion(instance, settings, (progress) => {
      mainWindow.webContents.send('launch-status', { status: 'downloading', ...progress });
    });

    mainWindow.webContents.send('launch-status', { status: 'launching', message: 'Starting Minecraft...' });

    // Open a new persistent log session for this launch
    const logPath = openNewLogSession(instance.name);
    mainWindow.webContents.send('log-file-path', logPath);

    // Record launch time for playtime tracking
    const launchStartTime = Date.now();

    await launchMinecraft(instance, account, settings,
      (data) => {
        mainWindow.webContents.send('game-log', data);
        writeToLog(data);
      },
      () => {
        // Game closed — calculate and save playtime
        const sessionSeconds = Math.floor((Date.now() - launchStartTime) / 1000);
        const allInstances = store.get('instances', []);
        const idx = allInstances.findIndex(i => i.id === instanceId);
        if (idx >= 0) {
          allInstances[idx].playtimeSeconds = (allInstances[idx].playtimeSeconds || 0) + sessionSeconds;
          allInstances[idx].lastPlayed = new Date().toISOString();
          store.set('instances', allInstances);
        }
        // Notify renderer of playtime update
        mainWindow.webContents.send('playtime-update', { instanceId, sessionSeconds });
        // Close log stream
        if (currentLogStream) {
          currentLogStream.end('\n--- Session ended ---\n');
          currentLogStream = null;
        }
        mainWindow.webContents.send('game-closed');
        if (settings.closeOnLaunch) mainWindow.show();
      }
    );

    if (settings.closeOnLaunch) mainWindow.hide();
    mainWindow.webContents.send('launch-status', { status: 'running', message: 'Game is running' });
    return { success: true };
  } catch (e) {
    mainWindow.webContents.send('launch-status', { status: 'error', message: e.message });
    return { success: false, error: e.message };
  }
});

// Mods
ipcMain.handle('mods-search-modrinth', async (_, opts) => { try { return await searchModrinth(opts); } catch (e) { return { error: e.message }; } });
ipcMain.handle('mods-search-curseforge', async (_, opts) => {
  try { const key = store.get('settings.curseforgeKey', ''); return await searchCurseForge({ ...opts, key }); }
  catch (e) { return { error: e.message }; }
});
ipcMain.handle('mods-install', async (_, { instanceId, mod, source }) => {
  try {
    await installMod(instanceId, mod, source, (progress) => {
      mainWindow.webContents.send('mod-install-progress', { modId: mod.id, ...progress });
    });
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('mods-remove', async (_, { instanceId, modId }) => {
  try { await removeMod(instanceId, modId); return { success: true }; }
  catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('mods-get-installed', async (_, instanceId) => {
  try { return await getInstalledMods(instanceId); } catch (e) { return []; }
});
ipcMain.handle('mods-update-all', async (_, instanceId) => {
  try {
    const results = await updateAllMods(instanceId, (progress) => {
      mainWindow.webContents.send('mod-update-progress', progress);
    });
    return { success: true, results };
  } catch (e) { return { success: false, error: e.message }; }
});

// Settings
ipcMain.handle('settings-get', () => {
  return store.get('settings', { ram: 4, javaPath: '', customJvmArgs: '', closeOnLaunch: true, pvpFlags: true, autoUpdateMods: false, curseforgeKey: '' });
});
ipcMain.handle('settings-save', (_, settings) => { store.set('settings', settings); return { success: true }; });

// Modpack import
ipcMain.handle('modpack-import', async () => {
  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Modpack',
    filters: [{ name: 'Modpack', extensions: ['mrpack', 'zip'] }],
    properties: ['openFile']
  });
  if (!filePaths.length) return { cancelled: true };
  try {
    const { importModpack } = require('./launcher/modpack');
    const instance = await importModpack(filePaths[0], (progress) => {
      mainWindow.webContents.send('import-progress', progress);
    });
    const instances = store.get('instances', []);
    instances.push(instance);
    store.set('instances', instances);
    return { success: true, instance };
  } catch (e) { return { success: false, error: e.message }; }
});

// Loader API auto-install
ipcMain.handle('loader-api-install', async (_, { instanceId }) => {
  try {
    const s2 = new Store();
    const instance = s2.get('instances', []).find(i => i.id === instanceId);
    if (!instance) throw new Error('Instance not found');
    const { installLoaderApi } = require('./launcher/loaderapis');
    const result = await installLoaderApi(instanceId, instance, (progress) => {
      mainWindow.webContents.send('loader-api-progress', progress);
    });
    const { syncModsWithFolder } = require('./launcher/mods');
    const mods = syncModsWithFolder(instanceId);
    const instances = s2.get('instances', []);
    const idx = instances.findIndex(i => i.id === instanceId);
    if (idx >= 0) { instances[idx].mods = mods.length; s2.set('instances', instances); }
    return { success: true, ...result };
  } catch (e) { return { success: false, error: e.message }; }
});

// Desktop shortcut
ipcMain.handle('create-shortcut', async () => {
  try {
    const shortcutPath = path.join(require('os').homedir(), 'Desktop', 'Celery Launcher.lnk');
    const created = shell.writeShortcutLink(shortcutPath, {
      target: process.execPath,
      args: app.getAppPath(),
      description: 'Celery Launcher — Minecraft Launcher',
      icon: path.join(app.getAppPath(), 'assets', 'icon.ico'),
      iconIndex: 0
    });
    if (created) return { success: true };
    const batPath = path.join(require('os').homedir(), 'Desktop', 'Celery Launcher.bat');
    fs.writeFileSync(batPath, `@echo off\ncd /d "${app.getAppPath()}"\nnpm start\n`);
    return { success: true };
  } catch (e) {
    try {
      const batPath = path.join(require('os').homedir(), 'Desktop', 'Celery Launcher.bat');
      fs.writeFileSync(batPath, `@echo off\ncd /d "${app.getAppPath()}"\nnpm start\n`);
      return { success: true };
    } catch (e2) { return { success: false, error: e2.message }; }
  }
});

// Skin
const { fetchSkinHead } = require('./launcher/skin');
ipcMain.handle('skin-get-head', async (_, { uuid, username }) => {
  try {
    const filePath = await fetchSkinHead(uuid, username);
    if (!filePath) return { success: false };
    const data = fs.readFileSync(filePath);
    return { success: true, dataUrl: 'data:image/png;base64,' + data.toString('base64'), filePath };
  } catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('skin-set-window-icon', async (_, { uuid, username }) => {
  try {
    const filePath = await fetchSkinHead(uuid, username);
    if (!filePath || !mainWindow) return { success: false };
    const { nativeImage } = require('electron');
    const img = nativeImage.createFromPath(filePath);
    if (!img.isEmpty()) mainWindow.setIcon(img);
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

// ── Input dialog — unique channel per call fixes instant-close bug ────────────
ipcMain.handle('show-input-dialog', async (_, { title, label, placeholder }) => {
  const { BrowserWindow: BW } = require('electron');
  // Unique channel prevents concurrent calls from stealing each other's result
  const channel = 'input-result-' + Date.now() + '-' + Math.random().toString(36).slice(2);

  return new Promise((resolve) => {
    const win = new BW({
      width: 400, height: 200,
      parent: mainWindow, modal: true,
      resizable: false, minimizable: false, maximizable: false,
      frame: false,
      backgroundColor: '#131614',
      webPreferences: { nodeIntegration: true, contextIsolation: false }
    });

    const safeTitle = (title || 'Enter value').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const safeLabel = (label || '').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const safePlaceholder = (placeholder || '').replace(/"/g, '&quot;');

    const html = `<!DOCTYPE html>
<html><head><style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:system-ui,sans-serif;background:#131614;color:#e8ede9;padding:22px;display:flex;flex-direction:column;height:100vh;justify-content:center;}
.title{font-size:14px;font-weight:500;margin-bottom:14px;}
.label{font-size:10px;color:#9aa89b;margin-bottom:6px;text-transform:uppercase;letter-spacing:.9px;}
input{width:100%;background:#191c1a;border:1px solid rgba(255,255,255,0.12);border-radius:6px;padding:8px 10px;color:#e8ede9;font-size:13px;font-family:inherit;outline:none;}
input:focus{border-color:rgba(74,222,128,0.4);}
.btns{display:flex;gap:8px;justify-content:flex-end;margin-top:14px;}
button{padding:7px 18px;border-radius:6px;font-size:12px;font-family:inherit;cursor:pointer;border:1px solid rgba(255,255,255,0.12);background:#1f2320;color:#9aa89b;}
.ok{background:rgba(74,222,128,0.15);border-color:rgba(74,222,128,0.35);color:#4ade80;font-weight:500;}
</style></head>
<body>
<div class="title">${safeTitle}</div>
<div class="label">${safeLabel}</div>
<input id="v" placeholder="${safePlaceholder}" autofocus>
<div class="btns">
  <button onclick="send(null)">Cancel</button>
  <button class="ok" onclick="send()">Save Profile</button>
</div>
<script>
const {ipcRenderer}=require('electron');
const CH=${JSON.stringify(channel)};
let sent=false;
function send(override){
  if(sent)return; sent=true;
  const val = override===null ? null : (document.getElementById('v').value.trim()||null);
  ipcRenderer.send(CH, val);
}
document.getElementById('v').addEventListener('keydown',e=>{
  if(e.key==='Enter') send();
  if(e.key==='Escape') send(null);
});
setTimeout(()=>document.getElementById('v').focus(),60);
</script></body></html>`;

    win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

    let resolved = false;
    const handler = (_, val) => {
      if (resolved) return;
      resolved = true;
      ipcMain.removeListener(channel, handler);
      try { win.destroy(); } catch {}
      resolve(val);
    };
    ipcMain.once(channel, handler);
    win.on('closed', () => {
      if (!resolved) { resolved = true; ipcMain.removeListener(channel, handler); resolve(null); }
    });
  });
});

// ── Options profiles ──────────────────────────────────────────────────────────
const optionsModule = require('./launcher/options');
ipcMain.handle('options-list-profiles', () => optionsModule.listProfiles());
ipcMain.handle('options-capture', (_, { instanceId, name }) => {
  try { return { success: true, profile: optionsModule.captureProfileFromInstance(instanceId, name) }; }
  catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('options-apply', (_, { instanceId, profileId }) => {
  try {
    const profile = optionsModule.listProfiles().find(p => p.id === profileId);
    if (!profile) throw new Error('Profile not found');
    return optionsModule.applyProfileToInstance(instanceId, profile);
  } catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('options-delete', (_, profileId) => optionsModule.deleteProfile(profileId));

// ── Instance folder listing ───────────────────────────────────────────────────
ipcMain.handle('instance-list-folder', (_, { instanceId, folder }) => {
  try {
    const dir = path.join(INSTANCES_DIR, instanceId, folder);
    if (!fs.existsSync(dir)) return { files: [] };
    const files = fs.readdirSync(dir, { withFileTypes: true }).map(e => {
      const full = path.join(dir, e.name);
      let size = 0, modified = null;
      try { const st = fs.statSync(full); size = st.size; modified = st.mtime.toISOString(); } catch {}
      return { name: e.name, isDir: e.isDirectory(), size, modified };
    });
    return { files };
  } catch (e) { return { files: [], error: e.message }; }
});
ipcMain.handle('instance-open-subfolder', (_, { instanceId, folder }) => {
  const dir = path.join(INSTANCES_DIR, instanceId, folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  shell.openPath(dir);
  return { success: true };
});
ipcMain.handle('instance-delete-file', (_, { instanceId, folder, filename }) => {
  try {
    const filePath = path.join(INSTANCES_DIR, instanceId, folder, filename);
    if (fs.existsSync(filePath)) {
      if (fs.statSync(filePath).isDirectory()) fs.rmSync(filePath, { recursive: true });
      else fs.unlinkSync(filePath);
    }
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

// servers.dat reader
ipcMain.handle('instance-read-servers', (_, instanceId) => {
  try {
    const serversFile = path.join(INSTANCES_DIR, instanceId, 'servers.dat');
    if (!fs.existsSync(serversFile)) return { servers: [] };
    const text = fs.readFileSync(serversFile).toString('latin1');
    const readable = [];
    let cur = '';
    for (const c of text) {
      if (c.charCodeAt(0) >= 32 && c.charCodeAt(0) < 127) cur += c;
      else { if (cur.length > 3) readable.push(cur); cur = ''; }
    }
    if (cur.length > 3) readable.push(cur);
    const servers = [];
    for (let j = 0; j < readable.length - 1; j++) {
      const s = readable[j], next = readable[j+1];
      if (next.includes('.') || next.includes(':') || next === 'localhost') {
        servers.push({ name: s, ip: next }); j++;
      }
    }
    return { servers: servers.slice(0, 50) };
  } catch (e) { return { servers: [], error: e.message }; }
});

// Mod count sync
ipcMain.handle('instance-sync-mod-count', async (_, instanceId) => {
  try {
    const mods = await getInstalledMods(instanceId);
    const instances = store.get('instances', []);
    const idx = instances.findIndex(i => i.id === instanceId);
    if (idx >= 0) { instances[idx].mods = mods.length; store.set('instances', instances); }
    return { success: true, count: mods.length };
  } catch (e) { return { success: false, error: e.message }; }
});
