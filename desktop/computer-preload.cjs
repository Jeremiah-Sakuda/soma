const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('somaComputer', {
  command: (command, value) => ipcRenderer.invoke('computer:command', command, value),
  onState: (callback) => ipcRenderer.on('computer:state', (_event, value) => callback(value)),
});
