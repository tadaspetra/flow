const path = require('path');

function createWindow({ BrowserWindow, onConsoleMessage }) {
  const win = new BrowserWindow({
    width: 960,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '..', '..', 'preload.js')
    }
  });

  win.setContentProtection(true);
  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (typeof onConsoleMessage === 'function') {
      onConsoleMessage({ event, level, message, line, sourceId });
      return;
    }
    console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
  });

  win.loadFile(path.join(__dirname, '..', '..', 'index.html'));
  return win;
}

module.exports = {
  createWindow
};
