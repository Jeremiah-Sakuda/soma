const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('somaControls', {
 action: action => ipcRenderer.invoke('desktop:action',action),
 onStatus: callback => {ipcRenderer.on('desktop:status',(_e,message)=>callback(String(message)));}
});
