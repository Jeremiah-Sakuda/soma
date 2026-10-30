const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('somaControls', {
  action: (action) => ipcRenderer.invoke('desktop:action', action),
  onPointEnabled: (callback) => {
    ipcRenderer.on('desktop:point-enabled', (_e, value) => callback(Boolean(value)));
  },
  onStatus: (callback) => {
    ipcRenderer.on('desktop:status', (_e, message) => callback(String(message)));
  },
});
