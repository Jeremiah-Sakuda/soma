const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('somaControls', {
  action: (action) => ipcRenderer.invoke('desktop:action', action),
  onSurface: (callback) => ipcRenderer.on('desktop:surface', (_e, state) => callback(state)),
  onMenuAction: (callback) => ipcRenderer.on('desktop:menu-action', (_e, action) => {
    if (['point', 'reload', 'settings'].includes(action)) callback(action);
  }),
  onPointEnabled: (callback) => {
    ipcRenderer.on('desktop:point-enabled', (_e, value) => callback(Boolean(value)));
  },
  onStatus: (callback) => {
    ipcRenderer.on('desktop:status', (_e, message) => callback(String(message)));
  },
});
