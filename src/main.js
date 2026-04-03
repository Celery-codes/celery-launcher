const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path  = require('path');
const fs    = require('fs');
const Store = require('electron-store');

const store = new Store();
const { authenticateMicrosoft, refreshToken, logout } = require('./auth/microsoft');
const { launchMinecraft }  = require('./launcher/launch');
const { downloadVersion }  = require('./launcher/downloader');
const { fetchMcVersions, fetchFabricVersions, fetchForgeVersions } = require('./api/versions');
const { searchModrinth }   = require('./api/modrinth');
const { searchCurseForge } = require('./api/curseforge');
const { installMod, removeMod, getInstalledMods, updateAllMods,
        toggleMod, toggleMods, checkMissingDependencies } = require('./launcher/mods');
const optionsModule = require('./launcher/options');
const { fetchSkinHead }    = require('./launcher/skin');

let mainWindow;
const isDev = process.argv.includes('--dev');

const DATA_DIR      = path.join(app.getPath('appData'), 'CeleryLauncher');
const INSTANCES_DIR = path.join(DATA_DIR, 'instances');
const VERSIONS_DIR  = path.join(DATA_DIR, 'versions');
const ASSETS_DIR    = path.join(DATA_DIR, 'assets');
const LIBRARIES_DIR = path.join(DATA_DIR, 'libraries');
const JAVA_DIR      = path.join(DATA_DIR, 'java');
const LOGS_DIR      = path.join(DATA_DIR, 'logs');

[DATA_DIR, INSTANCES_DIR, VERSIONS_DIR, ASSETS_DIR, LIBRARIES_DIR, LOGS_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

global.paths = { DATA_DIR, INSTANCES_DIR, VERSIONS_DIR, ASSETS_DIR, LIBRARIES_DIR, JAVA_DIR };

// ── Safe instance folder resolution ──────────────────────────────────────────
// Uses inst.folderName if set (new instances), falls back to inst.id (old ones)
function getInstanceDir(instanceId) {
  const inst = store.get('instances',[]).find(i => i.id === instanceId);
  const folderName = inst?.folderName || instanceId;
  const dir = path.join(INSTANCES_DIR, folderName);
  // If named folder doesn't exist but id-based does, use id-based (migration safety)
  if (!fs.existsSync(dir) && inst?.folderName) {
    const fallback = path.join(INSTANCES_DIR, instanceId);
    if (fs.existsSync(fallback)) return fallback;
  }
  return dir;
}

// ── Log session ───────────────────────────────────────────────────────────────
let currentLogStream = null;
function openLogSession(instanceName) {
  if (currentLogStream) { try { currentLogStream.end(); } catch {} currentLogStream = null; }
  const safe = (instanceName||'unknown').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,40);
  const date = new Date().toISOString().replace(/[:.]/g,'-').replace('T','_').slice(0,19);
  const logPath = path.join(LOGS_DIR, `${safe}_${date}.log`);
  currentLogStream = fs.createWriteStream(logPath, { flags: 'a' });
  currentLogStream.write(`=== ${instanceName} — ${new Date().toLocaleString()} ===\n`);
  return logPath;
}
function writeLog(text) { if (currentLogStream && !currentLogStream.destroyed) currentLogStream.write(text); }
function closeLogSession() {
  if (currentLogStream) { try { currentLogStream.end('\n=== Session ended ===\n'); } catch {} currentLogStream = null; }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width:1100, height:700, minWidth:900, minHeight:600,
    frame:false, backgroundColor:'#0d0f0e',
    webPreferences:{ preload:path.join(__dirname,'preload.js'), contextIsolation:true, nodeIntegration:false, webSecurity:false },
    icon: path.join(__dirname,'../assets/icon.ico')
  });
  mainWindow.loadFile(path.join(__dirname,'../renderer/index.html'));
  if (isDev) mainWindow.webContents.openDevTools();
  mainWindow.webContents.setWindowOpenHandler(({url}) => { shell.openExternal(url); return {action:'deny'}; });
}

app.whenReady().then(() => {
  const { session } = require('electron');
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders,
      'Content-Security-Policy':["default-src 'self' 'unsafe-inline' https: data: blob:"] }});
  });
  createWindow();

  // Background token refresh every 30 minutes
  setInterval(async () => {
    try {
      for (const account of store.get('accounts',[])) {
        try {
          const refreshed = await refreshToken(account);
          const all = store.get('accounts',[]);
          const idx = all.findIndex(a => a.uuid===refreshed.uuid);
          if (idx>=0) { all[idx]=refreshed; store.set('accounts',all); }
        } catch {}
      }
    } catch {}
  }, 30 * 60 * 1000);

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length===0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform!=='darwin') app.quit(); });

ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => { if(mainWindow.isMaximized()) mainWindow.unmaximize(); else mainWindow.maximize(); });
ipcMain.on('window-close',    () => mainWindow.close());
ipcMain.handle('get-app-version', () => app.getVersion());

// Auth
ipcMain.handle('auth-microsoft', async () => {
  try { const a=await authenticateMicrosoft(mainWindow); store.set('account',a); return {success:true,account:a}; }
  catch(e){return{success:false,error:e.message};}
});
ipcMain.handle('auth-logout', async (_,uuid) => {
  await logout(uuid);
  store.set('accounts', store.get('accounts',[]).filter(a=>a.uuid!==uuid));
  return {success:true};
});
ipcMain.handle('auth-get-accounts', () => store.get('accounts',[]));
ipcMain.handle('auth-set-active',   (_,uuid) => { store.set('activeAccount',uuid); return {success:true}; });
ipcMain.handle('auth-refresh', async (_,uuid) => {
  try {
    const accounts=store.get('accounts',[]);
    const account=accounts.find(a=>a.uuid===uuid);
    if (!account) throw new Error('Account not found');
    const refreshed=await refreshToken(account);
    store.set('accounts', accounts.map(a=>a.uuid===uuid?refreshed:a));
    return {success:true,account:refreshed};
  } catch(e){return{success:false,error:e.message};}
});

// Instances
ipcMain.handle('instances-get',  () => store.get('instances',[]));
ipcMain.handle('instances-save', (_,list) => { store.set('instances',list); return {success:true}; });
ipcMain.handle('instance-open-folder', (_,instanceId) => {
  const dir = getInstanceDir(instanceId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true});
  shell.openPath(dir);
  return {success:true};
});

// Versions
ipcMain.handle('versions-minecraft', async () => { try{return await fetchMcVersions();}catch(e){return{error:e.message};} });
ipcMain.handle('versions-fabric',    async (_,v) => { try{return await fetchFabricVersions(v);}catch(e){return{error:e.message};} });
ipcMain.handle('versions-forge',     async (_,v) => { try{return await fetchForgeVersions(v);}catch(e){return{error:e.message};} });

// Launch
ipcMain.handle('launch-game', async (_,{instanceId,accountUuid}) => {
  try {
    const instances=store.get('instances',[]);
    const instance=instances.find(i=>i.id===instanceId);
    if (!instance) throw new Error('Instance not found');
    const accounts=store.get('accounts',[]);
    const account=accounts.find(a=>a.uuid===accountUuid);
    if (!account) throw new Error('No account selected');
    const settings=store.get('settings',{});

    mainWindow.webContents.send('launch-status',{status:'preparing',message:'Preparing launch...'});
    await downloadVersion(instance,settings,p=>mainWindow.webContents.send('launch-status',{status:'downloading',...p}));

    let freshAccount=account;
    try {
      freshAccount=await refreshToken(account);
      const all=store.get('accounts',[]);
      const ai=all.findIndex(a=>a.uuid===freshAccount.uuid);
      if(ai>=0){all[ai]=freshAccount;store.set('accounts',all);}
    } catch(e) {
      mainWindow.webContents.send('game-log','[Celery] Token refresh: '+e.message+'\n');
      if (Date.now()>(account.tokenExpiry||0)) {
        mainWindow.webContents.send('launch-status',{status:'error',message:'Session expired — please re-login'});
        return {success:false,error:'Session expired.'};
      }
    }

    mainWindow.webContents.send('launch-status',{status:'launching',message:'Starting Minecraft...'});
    const logPath=openLogSession(instance.name);
    mainWindow.webContents.send('log-file-path',logPath);
    let launchStart=null;

    await launchMinecraft(instance,freshAccount,settings,
      data => { if(!launchStart)launchStart=Date.now(); mainWindow.webContents.send('game-log',data); writeLog(data); },
      () => {
        if (launchStart) {
          const secs=Math.floor((Date.now()-launchStart)/1000);
          const all=store.get('instances',[]);
          const idx=all.findIndex(i=>i.id===instanceId);
          if(idx>=0){all[idx].playtimeSeconds=(all[idx].playtimeSeconds||0)+secs;all[idx].lastPlayed=new Date().toISOString();store.set('instances',all);}
          mainWindow.webContents.send('playtime-update',{instanceId,sessionSeconds:secs});
        }
        closeLogSession();
        mainWindow.webContents.send('game-closed');
        if(settings.closeOnLaunch)mainWindow.show();
      }
    );
    if(settings.closeOnLaunch)mainWindow.hide();
    mainWindow.webContents.send('launch-status',{status:'running',message:'Game is running'});
    return {success:true};
  } catch(e) {
    mainWindow.webContents.send('launch-status',{status:'error',message:e.message});
    return {success:false,error:e.message};
  }
});

// Mods
ipcMain.handle('mods-search-modrinth',  async (_,opts) => { try{return await searchModrinth(opts);}catch(e){return{error:e.message};} });
ipcMain.handle('mods-search-curseforge',async (_,opts) => { try{return await searchCurseForge({...opts,key:store.get('settings.curseforgeKey','')});}catch(e){return{error:e.message};} });
ipcMain.handle('mods-install', async (_,{instanceId,mod,source}) => {
  try{const r=await installMod(instanceId,mod,source,p=>mainWindow.webContents.send('mod-install-progress',{modId:mod.id,...p}));return{success:true,deps:r?.deps};}
  catch(e){return{success:false,error:e.message};}
});
ipcMain.handle('mods-remove',       async (_,{instanceId,modId}) => { try{await removeMod(instanceId,modId);return{success:true};}catch(e){return{success:false,error:e.message};} });
ipcMain.handle('mods-get-installed',async (_,id) => { try{return await getInstalledMods(id);}catch{return[];} });
ipcMain.handle('mods-update-all',   async (_,id) => { try{const r=await updateAllMods(id,p=>mainWindow.webContents.send('mod-update-progress',p));return{success:true,results:r};}catch(e){return{success:false,error:e.message};} });
ipcMain.handle('mods-toggle',       async (_,{instanceId,modId,enable}) => { try{return toggleMod(instanceId,modId,enable);}catch(e){return{success:false,error:e.message};} });
ipcMain.handle('mods-toggle-bulk',  async (_,{instanceId,modIds,enable}) => { try{return toggleMods(instanceId,modIds,enable);}catch(e){return{success:false,error:e.message};} });
ipcMain.handle('mods-check-deps',   async (_,id) => { try{return await checkMissingDependencies(id);}catch{return[];} });

// Settings
ipcMain.handle('settings-get', () => store.get('settings',{ram:4,javaPath:'',customJvmArgs:'',closeOnLaunch:false,pvpFlags:true,autoUpdateMods:false,curseforgeKey:''}));
ipcMain.handle('settings-save',(_,s) => { store.set('settings',s); return {success:true}; });

// Scan installed Java versions
ipcMain.handle('java-find-all', () => {
  const { execSync } = require('child_process');
  const results = [{ label:'Auto-detect', value:'' }];
  const check = (p, label) => {
    if (!fs.existsSync(p)) return;
    try {
      const out = execSync(`"${p}" -version 2>&1`,{timeout:2000}).toString();
      const m = out.match(/version "([^"]+)"/);
      results.push({ label:`${label} (${m?.[1]||'?'})`, value:p });
    } catch { results.push({ label, value:p }); }
  };
  const adoptBase='C:\\Program Files\\Eclipse Adoptium';
  if (fs.existsSync(adoptBase)) {
    for (const d of fs.readdirSync(adoptBase)) check(path.join(adoptBase,d,'bin','java.exe'),`Adoptium ${d.split('-')[0]}`);
  }
  const msBase='C:\\Program Files\\Microsoft';
  if (fs.existsSync(msBase)) {
    for (const d of fs.readdirSync(msBase).filter(x=>x.startsWith('jdk'))) check(path.join(msBase,d,'bin','java.exe'),`Microsoft ${d}`);
  }
  const javaBase='C:\\Program Files\\Java';
  if (fs.existsSync(javaBase)) {
    for (const d of fs.readdirSync(javaBase)) check(path.join(javaBase,d,'bin','java.exe'),`Java ${d}`);
  }
  if (process.env.JAVA_HOME) check(path.join(process.env.JAVA_HOME,'bin','java.exe'),'JAVA_HOME');
  return results;
});

// Modpack
ipcMain.handle('modpack-import', async () => {
  const {filePaths}=await dialog.showOpenDialog(mainWindow,{title:'Import Modpack',filters:[{name:'Modpack',extensions:['mrpack','zip']}],properties:['openFile']});
  if (!filePaths.length) return {cancelled:true};
  try {
    const {importModpack}=require('./launcher/modpack');
    const instance=await importModpack(filePaths[0],p=>mainWindow.webContents.send('import-progress',p));
    const instances=store.get('instances',[]); instances.push(instance); store.set('instances',instances);
    return {success:true,instance};
  } catch(e){return{success:false,error:e.message};}
});
ipcMain.handle('modpack-import-modrinth', async (_,{slug}) => {
  try {
    const {importModpackFromModrinth}=require('./launcher/modpack');
    const instance=await importModpackFromModrinth(slug,null,p=>mainWindow.webContents.send('import-progress',p));
    const instances=store.get('instances',[]); instances.push(instance); store.set('instances',instances);
    return {success:true,instance};
  } catch(e){return{success:false,error:e.message};}
});
ipcMain.handle('modpack-import-url', async (_,{url}) => {
  try {
    const {importModpack}=require('./launcher/modpack');
    const instance=await importModpack(url,p=>mainWindow.webContents.send('import-progress',p));
    const instances=store.get('instances',[]); instances.push(instance); store.set('instances',instances);
    return {success:true,instance};
  } catch(e){return{success:false,error:e.message};}
});

// Loader API
ipcMain.handle('loader-api-install', async (_,{instanceId}) => {
  try {
    const instance=store.get('instances',[]).find(i=>i.id===instanceId);
    if (!instance) throw new Error('Instance not found');
    const {installLoaderApi}=require('./launcher/loaderapis');
    const result=await installLoaderApi(instanceId,instance,p=>mainWindow.webContents.send('loader-api-progress',p));
    const {syncModsWithFolder}=require('./launcher/mods');
    const mods=syncModsWithFolder(instanceId);
    const instances=store.get('instances',[]);
    const idx=instances.findIndex(i=>i.id===instanceId);
    if(idx>=0){instances[idx].mods=mods.length;store.set('instances',instances);}
    return {success:true,...result};
  } catch(e){return{success:false,error:e.message};}
});

// Logs
ipcMain.handle('open-log-folder',  () => { shell.openPath(LOGS_DIR); return {success:true}; });
ipcMain.handle('clear-log-folder', () => {
  try {
    closeLogSession();
    const files=fs.readdirSync(LOGS_DIR).filter(f=>f.endsWith('.log'));
    for(const f of files)fs.unlinkSync(path.join(LOGS_DIR,f));
    return {success:true,cleared:files.length};
  } catch(e){return{success:false,error:e.message};}
});
ipcMain.handle('save-log-file', async (_,text) => {
  try {
    const {filePath}=await dialog.showSaveDialog(mainWindow,{title:'Save Log',defaultPath:path.join(app.getPath('downloads'),'celery-log-'+Date.now()+'.log'),filters:[{name:'Log',extensions:['log','txt']}]});
    if (!filePath) return {cancelled:true};
    fs.writeFileSync(filePath,text,'utf8'); return {success:true};
  } catch(e){return{success:false,error:e.message};}
});

// Options profiles
ipcMain.handle('options-list-profiles', () => optionsModule.listProfiles());
ipcMain.handle('options-capture', (_,{instanceId,name}) => {
  try { const p=optionsModule.captureProfileFromInstance(instanceId,name); return {success:true,profile:p}; }
  catch(e){ return {success:false,error:e.message}; }
});
ipcMain.handle('options-apply', (_,{instanceId,profileId}) => {
  try {
    const profile=optionsModule.listProfiles().find(p=>p.id===profileId);
    if (!profile) throw new Error('Profile not found');
    return optionsModule.applyProfileToInstance(instanceId,profile);
  } catch(e){return{success:false,error:e.message};}
});
ipcMain.handle('options-delete', (_,profileId) => optionsModule.deleteProfile(profileId));

// Instance folder ops — use getInstanceDir for named folders
ipcMain.handle('instance-list-folder', (_,{instanceId,folder}) => {
  try {
    const dir=path.join(getInstanceDir(instanceId),folder);
    if (!fs.existsSync(dir)) return {files:[]};
    return {files:fs.readdirSync(dir,{withFileTypes:true}).map(e=>{
      const full=path.join(dir,e.name); let size=0,modified=null;
      try{const st=fs.statSync(full);size=st.size;modified=st.mtime.toISOString();}catch{}
      return {name:e.name,isDir:e.isDirectory(),size,modified};
    })};
  } catch(e){return{files:[],error:e.message};}
});
ipcMain.handle('instance-open-subfolder', (_,{instanceId,folder}) => {
  const dir=path.join(getInstanceDir(instanceId),folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true});
  shell.openPath(dir); return {success:true};
});
ipcMain.handle('instance-delete-file', (_,{instanceId,folder,filename}) => {
  try {
    const fp=path.join(getInstanceDir(instanceId),folder,filename);
    if(fs.existsSync(fp)){const st=fs.statSync(fp);if(st.isDirectory())fs.rmSync(fp,{recursive:true});else fs.unlinkSync(fp);}
    return {success:true};
  } catch(e){return{success:false,error:e.message};}
});
ipcMain.handle('instance-read-servers', (_,instanceId) => {
  try {
    const f=path.join(getInstanceDir(instanceId),'servers.dat');
    if (!fs.existsSync(f)) return {servers:[]};
    const text=fs.readFileSync(f).toString('latin1');
    const readable=[]; let cur='';
    for(const c of text){if(c.charCodeAt(0)>=32&&c.charCodeAt(0)<127)cur+=c;else{if(cur.length>3)readable.push(cur);cur='';}}
    const servers=[];
    for(let j=0;j<readable.length-1;j++){const s=readable[j],next=readable[j+1];if(next.includes('.')||next.includes(':')||next==='localhost'){servers.push({name:s,ip:next});j++;}}
    return {servers:servers.slice(0,50)};
  } catch(e){return{servers:[],error:e.message};}
});
ipcMain.handle('instance-sync-mod-count', async (_,instanceId) => {
  try {
    const mods=await getInstalledMods(instanceId);
    const instances=store.get('instances',[]);
    const idx=instances.findIndex(i=>i.id===instanceId);
    if(idx>=0){instances[idx].mods=mods.length;store.set('instances',instances);}
    return {success:true,count:mods.length};
  } catch(e){return{success:false,error:e.message};}
});

// Skin
ipcMain.handle('skin-get-head', async (_,{uuid,username}) => {
  try {
    const fp=await fetchSkinHead(uuid,username);
    if (!fp) return {success:false};
    return {success:true,dataUrl:'data:image/png;base64,'+fs.readFileSync(fp).toString('base64'),filePath:fp};
  } catch(e){return{success:false,error:e.message};}
});
ipcMain.handle('skin-set-window-icon', async (_,{uuid,username}) => {
  try {
    const fp=await fetchSkinHead(uuid,username);
    if (!fp||!mainWindow) return {success:false};
    const {nativeImage}=require('electron');
    const img=nativeImage.createFromPath(fp);
    if (!img.isEmpty()) mainWindow.setIcon(img);
    return {success:true};
  } catch(e){return{success:false,error:e.message};}
});

// Shortcut
ipcMain.handle('create-shortcut', async () => {
  try {
    const sp=path.join(require('os').homedir(),'Desktop','Celery Launcher.lnk');
    const ok=shell.writeShortcutLink(sp,{target:process.execPath,args:app.getAppPath(),description:'Celery Launcher',icon:path.join(app.getAppPath(),'assets','icon.ico'),iconIndex:0});
    if (ok) return {success:true};
    const bat=path.join(require('os').homedir(),'Desktop','Celery Launcher.bat');
    fs.writeFileSync(bat,`@echo off\ncd /d "${app.getAppPath()}"\nnpm start\n`);
    return {success:true};
  } catch(e){return{success:false,error:e.message};}
});

// Input dialog
ipcMain.handle('show-input-dialog', async (_,{title,label,placeholder}) => {
  const {BrowserWindow:BW}=require('electron');
  return new Promise(resolve=>{
    const win=new BW({width:380,height:180,parent:mainWindow,modal:true,resizable:false,minimizable:false,maximizable:false,frame:false,backgroundColor:'#131614',webPreferences:{nodeIntegration:true,contextIsolation:false}});
    const html=`<!DOCTYPE html><html><head><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Outfit',sans-serif;background:#131614;color:#e8ede9;padding:20px;user-select:none;}.title{font-size:14px;font-weight:500;margin-bottom:4px;}.label{font-size:11px;color:#9aa89b;margin-bottom:8px;text-transform:uppercase;letter-spacing:.8px;}input{width:100%;background:#191c1a;border:1px solid rgba(255,255,255,0.12);border-radius:6px;padding:8px 10px;color:#e8ede9;font-size:13px;font-family:inherit;outline:none;}input:focus{border-color:rgba(74,222,128,0.4);}.btns{display:flex;gap:8px;justify-content:flex-end;margin-top:12px;}button{padding:6px 16px;border-radius:6px;font-size:12px;font-family:inherit;cursor:pointer;border:1px solid rgba(255,255,255,0.12);background:#1f2320;color:#9aa89b;}button.ok{background:rgba(74,222,128,0.15);border-color:rgba(74,222,128,0.35);color:#4ade80;font-weight:500;}</style></head><body><div class="title">${title||'Enter value'}</div><div class="label">${label||''}</div><input id="inp" placeholder="${placeholder||''}" autofocus><div class="btns"><button onclick="cancel()">Cancel</button><button class="ok" onclick="ok()">Save</button></div><script>const {ipcRenderer}=require('electron');document.getElementById('inp').addEventListener('keydown',e=>{if(e.key==='Enter')ok();if(e.key==='Escape')cancel();});function ok(){ipcRenderer.send('input-dialog-result',document.getElementById('inp').value.trim());}function cancel(){ipcRenderer.send('input-dialog-result',null);}</script></body></html>`;
    win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));
    const {ipcMain:ipc2}=require('electron');
    const handler=(_,val)=>{ipc2.removeListener('input-dialog-result',handler);win.destroy();resolve(val);};
    ipc2.once('input-dialog-result',handler);
    win.on('closed',()=>{ipc2.removeListener('input-dialog-result',handler);resolve(null);});
  });
});
