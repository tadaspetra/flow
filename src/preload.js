const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  saveVideo: (buffer, folder) => ipcRenderer.invoke('save-video', buffer, folder),
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  openFolder: (folder) => ipcRenderer.invoke('open-folder', folder),
  getSources: () => ipcRenderer.invoke('get-sources')
})
