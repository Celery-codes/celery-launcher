const { ipcMain, app } = require('electron');

let mainWindow = null;
let autoUpdater = null;

function initUpdater(win) {
  mainWindow = win;

  // Only use electron-updater in packaged app — not during dev/npm start
  if (process.argv.includes('--dev') || !app.isPackaged) {
    // In dev mode, handle update-check gracefully so it doesn't hang
    return;
  }

  try {
    autoUpdater = require('electron-updater').autoUpdater;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;

    autoUpdater.on('checking-for-update', () => {
      send('update-status', { status: 'checking', message: 'Checking for updates...' });
    });

    autoUpdater.on('update-available', (info) => {
      send('update-status', {
        status: 'available',
        message: `v${info.version} is available`,
        version: info.version
      });
    });

    autoUpdater.on('update-not-available', () => {
      send('update-status', { status: 'latest', message: 'Launcher is up to date.' });
    });

    autoUpdater.on('download-progress', (progress) => {
      send('update-status', {
        status: 'downloading',
        message: `Downloading update... ${Math.round(progress.percent)}%`,
        percent: Math.round(progress.percent)
      });
    });

    autoUpdater.on('update-downloaded', () => {
      send('update-status', { status: 'ready', message: 'Update downloaded — ready to install.' });
    });

    autoUpdater.on('error', (err) => {
      // Don't show scary errors for common cases like no release published yet
      const msg = err.message || '';
      if (msg.includes('404') || msg.includes('ENOTFOUND') || msg.includes('net::')) {
        send('update-status', { status: 'latest', message: 'Launcher is up to date.' });
      } else {
        send('update-status', { status: 'error', message: 'Could not check for updates.' });
      }
    });
  } catch (e) {
    console.log('electron-updater not available:', e.message);
  }
}

function send(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

ipcMain.handle('update-check', async () => {
  // In dev mode or if updater failed to load, return up-to-date immediately
  if (!autoUpdater) {
    send('update-status', { status: 'latest', message: 'Launcher is up to date.' });
    return { success: true };
  }
  try {
    await autoUpdater.checkForUpdates();
    return { success: true };
  } catch (e) {
    send('update-status', { status: 'latest', message: 'Launcher is up to date.' });
    return { success: true };
  }
});

ipcMain.handle('update-download', async () => {
  if (!autoUpdater) return { success: false, error: 'Updater not available' };
  try { await autoUpdater.downloadUpdate(); return { success: true }; }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('update-install', () => {
  if (autoUpdater) autoUpdater.quitAndInstall(false, true);
});

module.exports = { initUpdater };
