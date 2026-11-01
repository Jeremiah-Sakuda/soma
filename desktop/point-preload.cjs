const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('somaPointOverlay', {
  onDraw: (callback) => ipcRenderer.on('point:draw', (_event, payload) => callback(payload)),
  hover: (active) => ipcRenderer.send('overlay:hover', active === true),
  toggleEdge: (edgeId) => ipcRenderer.send('overlay:toggle-edge', String(edgeId).slice(0, 48)),
});
