const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlay', {
  getState:  ()     => ipcRenderer.invoke('overlay-get-state'),
  toggleMod: (opts) => ipcRenderer.invoke('overlay-toggle-mod', opts),
  close:     ()     => ipcRenderer.send('overlay-close'),
  onRefresh: (cb)   => ipcRenderer.on('overlay-refresh', () => cb()),
});
