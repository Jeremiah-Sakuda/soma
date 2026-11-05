const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('somaPointOverlay', {
  onDraw: (callback) => ipcRenderer.on('point:draw', (_event, payload) => callback(payload)),
  hover: (active) => ipcRenderer.send('overlay:hover', active === true),
  toggleEdge: (edgeId) => ipcRenderer.send('overlay:toggle-edge', String(edgeId).slice(0, 48)),
  select: (objectId) => ipcRenderer.send('overlay:select', String(objectId).slice(0, 48)),
  // The 3D lift could not start (no WebGL); the 2D drawing stays.
  liftFailed: (reason) =>
    ipcRenderer.send('overlay:lift-failed', reason === 'sheet' ? 'sheet' : 'webgl'),
});
