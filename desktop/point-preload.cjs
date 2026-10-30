const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('somaPointOverlay', {
  onDraw: (callback) => ipcRenderer.on('point:draw', (_event, payload) => callback(payload)),
});
