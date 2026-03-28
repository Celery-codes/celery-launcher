const { autoUpdater } = require('electron-updater');
const { ipcMain, app }  = require('electron');

let mainWindow = null;

function initUpdater(win) {
  mainWindow = win;

  autoUpdater.autoDownload        = false;
  autoUpdater.autoInstallOnAppQuit = false;

  // In dev mode skip update checks entirely
  if (process.argv.includes('--dev')) return;

  autoUpdater.on('checking-for-update', () =>
    send('update-status', { status: 'checking', message: 'Checking for updates...' }));

  autoUpdater.on('update-available', info =>
    send('update-status', {
      status: 'available',
      message: `Update available: v${info.version}`,
      version: info.version,
      releaseNotes: info.releaseNotes || ''
    }));

  autoUpdater.on('update-not-available', () =>
    send('update-status', { status: 'latest', message: 'You\'re on the latest version.' }));

  autoUpdater.on('download-progress', p =>
    send('update-status', {
      status: 'downloading',
      message: `Downloading update... ${Math.round(p.percent)}%`,
      percent: Math.round(p.percent),
      bytesPerSecond: p.bytesPerSecond,
      transferred: p.transferred,
      total: p.total
    }));

  autoUpdater.on('update-downloaded', () =>
    send('update-status', { status: 'ready', message: 'Update downloaded — ready to install.' }));

  autoUpdater.on('error', err =>
    send('update-status', { status: 'error', message: 'Update error: ' + err.message }));
}

function send(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed())
    mainWindow.webContents.send(channel, data);
}

// Check for updates
ipcMain.handle('update-check', async () => {
  try {
    if (process.argv.includes('--dev'))
      return { success: false, error: 'Updates disabled in dev mode' };
    await autoUpdater.checkForUpdates();
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

// Start download
ipcMain.handle('update-download', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

// Quit and install — closes launcher, installs update, relaunches
ipcMain.handle('update-install', () => {
  autoUpdater.quitAndInstall(false, true); // isSilent=false, isForceRunAfter=true
});

module.exports = { initUpdater };
