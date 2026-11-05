const { contextBridge, ipcRenderer } = require('electron');
// The compact ask bar is a local page; it can only send a typed question or a control,
// and receive status and the exploration's one-line state.
contextBridge.exposeInMainWorld('somaCompact', {
  ask: (text, mode) =>
    ipcRenderer.invoke('compact:ask', { text: String(text).slice(0, 1000), mode: String(mode) }),
  control: (action) => ipcRenderer.invoke('compact:control', String(action)),
  onStatus: (callback) =>
    ipcRenderer.on('compact:status', (_e, message) => callback(String(message))),
  onState: (callback) => ipcRenderer.on('compact:state', (_e, state) => callback(state)),
  onFocus: (callback) => ipcRenderer.on('compact:focus', () => callback()),
});
