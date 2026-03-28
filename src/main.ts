import 'dotenv/config';
import electronReload from 'electron-reload';
electronReload(__dirname);

import { app, BrowserWindow, ipcMain, dialog, desktopCapturer, shell, screen } from 'electron';

import { createWindow } from './main/app/create-window.js';
import { registerIpcHandlers } from './main/ipc/register-handlers.js';
import { createProjectService } from './main/services/project-service.js';
import { renderComposite } from './main/services/render-service.js';
import { computeSections } from './main/services/sections-service.js';
import { getScribeToken } from './main/services/scribe-service.js';
import * as proxyService from './main/services/proxy-service.js';

let win: BrowserWindow | null = null;

const projectService = createProjectService({ app: app as { getPath: (name: string) => string } });

const { cleanupMouseTrailTimer } = registerIpcHandlers({
  ipcMain,
  app,
  dialog,
  desktopCapturer,
  shell,
  getWindow: () => win,
  screen,
  projectService,
  renderComposite,
  computeSections,
  getScribeToken,
  proxyService
});

// Defensive cleanup for stale timer state from a previous hot-reload
cleanupMouseTrailTimer();

app.on('before-quit', () => {
  cleanupMouseTrailTimer();
});

function createMainWindow(): void {
  win = createWindow({
    BrowserWindow,
    onConsoleMessage: ({ level, message, line, sourceId }) => {
      console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
    }
  });
  win.on('closed', () => {
    win = null;
  });
}

app.whenReady().then(createMainWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});
