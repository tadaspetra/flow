const { contextBridge, ipcRenderer } = require('electron')
const url = require('node:url')

function toFileUrl(filePath) {
  const value = String(filePath || '')
  if (!value) return ''

  if (typeof url.pathToFileURL === 'function') {
    return url.pathToFileURL(value).toString()
  }

  const normalized = value.replace(/\\/g, '/')
  const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`
  return encodeURI(`file://${withLeadingSlash}`)
}

contextBridge.exposeInMainWorld('electronAPI', {
  saveVideo: (buffer, folder, suffix) => ipcRenderer.invoke('save-video', buffer, folder, suffix),
  pickFolder: (opts) => ipcRenderer.invoke('pick-folder', opts),
  pickProjectLocation: (opts) => ipcRenderer.invoke('pick-project-location', opts),
  pathToFileUrl: (filePath) => toFileUrl(filePath),
  openFolder: (folder) => ipcRenderer.invoke('open-folder', folder),
  projectCreate: (opts) => ipcRenderer.invoke('project-create', opts),
  projectOpen: (projectFolder) => ipcRenderer.invoke('project-open', projectFolder),
  projectSave: (payload) => ipcRenderer.invoke('project-save', payload),
  projectSetRecoveryTake: (payload) => ipcRenderer.invoke('project-set-recovery-take', payload),
  projectClearRecoveryTake: (projectFolder) => ipcRenderer.invoke('project-clear-recovery-take', projectFolder),
  projectCompleteRecoveryTake: (projectFolder) => ipcRenderer.invoke('project-complete-recovery-take', projectFolder),
  projectListRecent: (limit) => ipcRenderer.invoke('project-list-recent', limit),
  projectLoadLast: () => ipcRenderer.invoke('project-load-last'),
  projectSetLast: (projectFolder) => ipcRenderer.invoke('project-set-last', projectFolder),
  setContentProtection: (enabled) => ipcRenderer.invoke('set-content-protection', enabled),
  getSources: () => ipcRenderer.invoke('get-sources'),
  concatVideos: (opts) => ipcRenderer.invoke('concat-videos', opts),
  renderComposite: (opts) => ipcRenderer.invoke('render-composite', opts),
  getScribeToken: () => ipcRenderer.invoke('get-scribe-token'),
  trimSilence: (opts) => ipcRenderer.invoke('trim-silence', opts),
  onTrimSilenceProgress: (callback) => {
    if (typeof callback !== 'function') return () => {}
    const listener = (event, payload) => callback(payload)
    ipcRenderer.on('trim-silence-progress', listener)
    return () => ipcRenderer.removeListener('trim-silence-progress', listener)
  }
})
