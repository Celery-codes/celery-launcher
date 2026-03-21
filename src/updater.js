// src/updater.js — handles in-app updates via GitHub releases
const { autoUpdater } = require('electron-updater');
const { ipcMain, app } = require('electron');

let mainWindow = null;

function initUpdater(win) {
  mainWindow = win;

  // Don't auto-download — just check and notify
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  // During dev, skip update checks
  if (process.argv.includes('--dev')) return;

  autoUpdater.on('checking-for-update', () => {
    send('update-status', { status: 'checking', message: 'Checking for updates...' });
  });

  autoUpdater.on('update-available', (info) => {
    send('update-status', {
      status: 'available',
      message: `Update available: v${info.version}`,
      version: info.version,
      releaseNotes: info.releaseNotes
    });
  });

  autoUpdater.on('update-not-available', () => {
    send('update-status', { status: 'latest', message: 'You are on the latest version.' });
  });

  autoUpdater.on('download-progress', (progress) => {
    send('update-status', {
      status: 'downloading',
      message: `Downloading update... ${Math.round(progress.percent)}%`,
      percent: Math.round(progress.percent)
    });
  });

  autoUpdater.on('update-downloaded', () => {
    send('update-status', { status: 'ready', message: 'Update ready — restart to apply.' });
  });

  autoUpdater.on('error', (err) => {
    send('update-status', { status: 'error', message: 'Update check failed: ' + err.message });
  });
}

function send(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

ipcMain.handle('update-check', async () => {
  try {
    await autoUpdater.checkForUpdates();
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('update-download', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('update-install', () => {
  autoUpdater.quitAndInstall(false, true);
});

module.exports = { initUpdater };
