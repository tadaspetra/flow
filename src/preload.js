const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  saveVideo: (buffer, folder, suffix) => ipcRenderer.invoke('save-video', buffer, folder, suffix),
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  openFolder: (folder) => ipcRenderer.invoke('open-folder', folder),
  setContentProtection: (enabled) => ipcRenderer.invoke('set-content-protection', enabled),
  getSources: () => ipcRenderer.invoke('get-sources'),
  renderComposite: (opts) => ipcRenderer.invoke('render-composite', opts),
  getScribeToken: () => ipcRenderer.invoke('get-scribe-token'),
  trimSilence: (opts) => ipcRenderer.invoke('trim-silence', opts)
})
