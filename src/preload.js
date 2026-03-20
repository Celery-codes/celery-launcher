const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcher', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  loginMicrosoft: () => ipcRenderer.invoke('auth-microsoft'),
  logout: (uuid) => ipcRenderer.invoke('auth-logout', uuid),
  getAccounts: () => ipcRenderer.invoke('auth-get-accounts'),
  setActiveAccount: (uuid) => ipcRenderer.invoke('auth-set-active', uuid),
  refreshAccount: (uuid) => ipcRenderer.invoke('auth-refresh', uuid),
  onDeviceCode: (cb) => ipcRenderer.on('auth-device-code', (_, code) => cb(code)),

  getInstances: () => ipcRenderer.invoke('instances-get'),
  saveInstances: (instances) => ipcRenderer.invoke('instances-save', instances),
  openInstanceFolder: (id) => ipcRenderer.invoke('instance-open-folder', id),

  getMcVersions: () => ipcRenderer.invoke('versions-minecraft'),
  getFabricVersions: (mcVer) => ipcRenderer.invoke('versions-fabric', mcVer),
  getForgeVersions: (mcVer) => ipcRenderer.invoke('versions-forge', mcVer),

  launch: (opts) => ipcRenderer.invoke('launch-game', opts),
  onLaunchStatus: (cb) => ipcRenderer.on('launch-status', (_, d) => cb(d)),
  onGameLog: (cb) => ipcRenderer.on('game-log', (_, d) => cb(d)),
  onGameClosed: (cb) => ipcRenderer.on('game-closed', () => cb()),

  searchModrinth: (opts) => ipcRenderer.invoke('mods-search-modrinth', opts),
  searchCurseForge: (opts) => ipcRenderer.invoke('mods-search-curseforge', opts),
  installMod: (opts) => ipcRenderer.invoke('mods-install', opts),
  removeMod: (opts) => ipcRenderer.invoke('mods-remove', opts),
  getInstalledMods: (id) => ipcRenderer.invoke('mods-get-installed', id),
  updateAllMods: (id) => ipcRenderer.invoke('mods-update-all', id),
  toggleMod: (opts) => ipcRenderer.invoke('mods-toggle', opts),
  toggleMods: (opts) => ipcRenderer.invoke('mods-toggle-bulk', opts),
  checkMissingDeps: (id) => ipcRenderer.invoke('mods-check-deps', id),
  onModInstallProgress: (cb) => ipcRenderer.on('mod-install-progress', (_, d) => cb(d)),
  onModUpdateProgress: (cb) => ipcRenderer.on('mod-update-progress', (_, d) => cb(d)),

  getSettings: () => ipcRenderer.invoke('settings-get'),
  saveSettings: (s) => ipcRenderer.invoke('settings-save', s),

  importModpack: () => ipcRenderer.invoke('modpack-import'),
  onImportProgress: (cb) => ipcRenderer.on('import-progress', (_, d) => cb(d)),

  listOptionProfiles: () => ipcRenderer.invoke('options-list-profiles'),
  captureOptionsProfile: (opts) => ipcRenderer.invoke('options-capture', opts),
  applyOptionsProfile: (opts) => ipcRenderer.invoke('options-apply', opts),
  deleteOptionsProfile: (id) => ipcRenderer.invoke('options-delete', id),

  listInstanceFolder: (opts) => ipcRenderer.invoke('instance-list-folder', opts),
  openInstanceSubfolder: (opts) => ipcRenderer.invoke('instance-open-subfolder', opts),
  deleteInstanceFile: (opts) => ipcRenderer.invoke('instance-delete-file', opts),
  readServersDat: (id) => ipcRenderer.invoke('instance-read-servers', id),
  syncModCount: (id) => ipcRenderer.invoke('instance-sync-mod-count', id),
  createShortcut: () => ipcRenderer.invoke('create-shortcut'),
  showInputDialog: (opts) => ipcRenderer.invoke('show-input-dialog', opts),
  getSkinHead: (opts) => ipcRenderer.invoke('skin-get-head', opts),
  setSkinWindowIcon: (opts) => ipcRenderer.invoke('skin-set-window-icon', opts),

  saveLogFile: (text) => ipcRenderer.invoke('save-log-file', text),
  openLogFolder: () => ipcRenderer.invoke('open-log-folder'),
  clearLogFolder: () => ipcRenderer.invoke('clear-log-folder'),
  onLogFilePath: (cb) => ipcRenderer.on('log-file-path', (_, p) => cb(p)),

  onPlaytimeUpdate: (cb) => ipcRenderer.on('playtime-update', (_, d) => cb(d)),

  installLoaderApi: (opts) => ipcRenderer.invoke('loader-api-install', opts),
  onLoaderApiProgress: (cb) => ipcRenderer.on('loader-api-progress', (_, d) => cb(d)),
});
