import path from 'path';

import type {
  IpcMain,
  App,
  Dialog,
  Shell,
  Screen,
  BrowserWindow,
  IpcMainInvokeEvent
} from 'electron';

import type {
  ComputeSectionsOptions,
  ComputeSectionsResult,
  FfmpegProgress,
  PickFolderOptions,
  ProjectCreateOptions,
  ProjectCreateResult,
  ProjectOpenResult,
  ProjectSavePayload,
  ProjectSaveResult,
  RecoveryTakePayload,
  RecoveryTakeResult,
  RecentProjectsResult,
  CleanupResult,
  RenderOptions,
  RenderDeps
} from '../../shared/types/services.js';

import type { MouseTrailEntry } from '../../shared/types/mouse-trail.js';

let lastPickedFolder: string | null = null;

interface DesktopCapturerLike {
  getSources(opts: {
    types: ('screen' | 'window')[];
    thumbnailSize: { width: number; height: number };
  }): Promise<Array<{ id: string; name: string }>>;
}

interface ProjectServiceLike {
  sanitizeProjectName(name: string): string;
  createProject(opts: ProjectCreateOptions): ProjectCreateResult;
  openProject(projectFolder: string): ProjectOpenResult;
  saveProject(payload: ProjectSavePayload): ProjectSaveResult;
  setRecoveryTake(payload: RecoveryTakePayload): RecoveryTakeResult;
  clearRecoveryByProject(projectFolder: string): boolean;
  completeRecoveryByProject(projectFolder: string): boolean;
  listRecentProjects(limit: number): RecentProjectsResult;
  loadLastProject(): ProjectOpenResult | null;
  setLastProject(projectFolder: string): boolean;
  saveVideo(buffer: Buffer | Uint8Array, folder: string, suffix?: string): string;
  stageTakeFiles(projectPath: string, filePaths: string[]): void;
  unstageTakeFiles(projectPath: string, fileNames: string[]): void;
  cleanupDeletedFolder(projectPath: string): void;
  cleanupUnusedTakes(projectPath: string): CleanupResult;
  importOverlayMedia(projectPath: string, sourcePath: string): string;
  stageOverlayFile(projectPath: string, mediaPath: string): void;
  unstageOverlayFile(projectPath: string, mediaPath: string): void;
  saveMouseTrail(projectPath: string, suffix: string, trailData: unknown): string;
}

interface ProxyServiceLike {
  deriveProxyPath(screenPath: string): string;
  generateProxy(opts: {
    screenPath: string;
    proxyPath: string;
    onProgress?: (progress: FfmpegProgress) => void;
  }): Promise<void>;
}

export interface RegisterIpcDeps {
  ipcMain: IpcMain;
  app: App;
  dialog: Dialog;
  desktopCapturer: DesktopCapturerLike;
  shell: Shell;
  getWindow: () => BrowserWindow | null;
  screen: Screen;
  projectService: ProjectServiceLike;
  renderComposite: (
    opts: Partial<RenderOptions>,
    deps: Partial<RenderDeps>
  ) => Promise<string>;
  computeSections: (opts: ComputeSectionsOptions) => ComputeSectionsResult;
  getScribeToken: () => Promise<string>;
  proxyService: ProxyServiceLike | null;
}

export function registerIpcHandlers({
  ipcMain,
  app,
  dialog,
  desktopCapturer,
  shell,
  getWindow,
  screen,
  projectService,
  renderComposite,
  computeSections,
  getScribeToken,
  proxyService
}: RegisterIpcDeps): { cleanupMouseTrailTimer: () => void } {
  ipcMain.handle('set-content-protection', async (_event: IpcMainInvokeEvent, enabled: boolean) => {
    const win = getWindow();
    if (!win || win.isDestroyed()) return false;
    win.setContentProtection(Boolean(enabled));
    return true;
  });

  ipcMain.handle('get-sources', async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 0, height: 0 }
      });
      return sources.map((source) => ({ id: source.id, name: source.name }));
    } catch (error) {
      console.error('desktopCapturer error:', error);
      return [];
    }
  });

  ipcMain.handle('pick-folder', async (_event: IpcMainInvokeEvent, opts: PickFolderOptions = {}) => {
    const win = getWindow();
    const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
      title: typeof opts.title === 'string' && opts.title ? opts.title : 'Choose Folder',
      buttonLabel:
        typeof opts.buttonLabel === 'string' && opts.buttonLabel ? opts.buttonLabel : 'Use Folder',
      defaultPath: lastPickedFolder || app.getPath('documents') || app.getPath('home'),
      properties: ['openDirectory', 'createDirectory']
    });
    if (canceled || !filePaths.length) return null;
    lastPickedFolder = filePaths[0]!;
    return filePaths[0]!;
  });

  ipcMain.handle('pick-project-location', async (_event: IpcMainInvokeEvent, opts: { name?: string } = {}) => {
    const win = getWindow();
    const projectName = projectService.sanitizeProjectName(opts.name || 'Untitled Project');
    const defaultBasePath = lastPickedFolder || app.getPath('documents') || app.getPath('home');

    if (process.platform === 'win32') {
      const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
        title: `Choose where to create "${projectName}"`,
        buttonLabel: 'Create Project Here',
        defaultPath: defaultBasePath,
        properties: ['openDirectory']
      });
      if (canceled || !filePaths.length) return null;
      lastPickedFolder = filePaths[0]!;
      return path.join(filePaths[0]!, projectName);
    }

    const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
      title: `Choose where to create "${projectName}"`,
      buttonLabel: 'Create Project Here',
      defaultPath: defaultBasePath,
      properties: ['openDirectory', 'createDirectory']
    });
    if (canceled || !filePaths.length) return null;
    lastPickedFolder = filePaths[0]!;
    return path.join(filePaths[0]!, projectName);
  });

  ipcMain.handle('open-folder', async (_event: IpcMainInvokeEvent, folder: string) => {
    shell.openPath(folder);
  });

  ipcMain.handle('project-create', async (_event: IpcMainInvokeEvent, opts: ProjectCreateOptions = {}) => {
    return projectService.createProject(opts);
  });

  ipcMain.handle('project-open', async (_event: IpcMainInvokeEvent, projectFolder: string) => {
    return projectService.openProject(projectFolder);
  });

  ipcMain.handle('project-save', async (_event: IpcMainInvokeEvent, payload: ProjectSavePayload = { projectPath: '' }) => {
    return projectService.saveProject(payload);
  });

  ipcMain.handle('project-set-recovery-take', async (_event: IpcMainInvokeEvent, payload: RecoveryTakePayload = { projectPath: '' }) => {
    return projectService.setRecoveryTake(payload);
  });

  ipcMain.handle('project-clear-recovery-take', async (_event: IpcMainInvokeEvent, projectFolder: string) => {
    return projectService.clearRecoveryByProject(projectFolder);
  });

  ipcMain.handle('project-complete-recovery-take', async (_event: IpcMainInvokeEvent, projectFolder: string) => {
    return projectService.completeRecoveryByProject(projectFolder);
  });

  ipcMain.handle('project-list-recent', async (_event: IpcMainInvokeEvent, limit: number = 10) => {
    return projectService.listRecentProjects(limit);
  });

  ipcMain.handle('project-load-last', async () => {
    return projectService.loadLastProject();
  });

  ipcMain.handle('project-set-last', async (_event: IpcMainInvokeEvent, projectFolder: string) => {
    return projectService.setLastProject(projectFolder);
  });

  ipcMain.handle('save-video', async (_event: IpcMainInvokeEvent, buffer: Buffer, folder: string, suffix: string) => {
    return projectService.saveVideo(buffer, folder, suffix);
  });

  ipcMain.handle('render-composite', async (event: IpcMainInvokeEvent, opts: Partial<RenderOptions>) => {
    return renderComposite(opts, {
      onProgress: (progress) => {
        event.sender.send('render-composite-progress', progress);
      }
    });
  });

  ipcMain.handle('get-scribe-token', async () => {
    try {
      return await getScribeToken();
    } catch (error) {
      console.error('Failed to get Scribe token:', error);
      throw error;
    }
  });

  ipcMain.handle('compute-sections', async (_event: IpcMainInvokeEvent, opts: ComputeSectionsOptions) => {
    return computeSections(opts);
  });

  ipcMain.handle('project:stageTakeFiles', async (_event: IpcMainInvokeEvent, projectPath: string, filePaths: string[]) => {
    return projectService.stageTakeFiles(projectPath, filePaths);
  });

  ipcMain.handle('project:unstageTakeFiles', async (_event: IpcMainInvokeEvent, projectPath: string, fileNames: string[]) => {
    return projectService.unstageTakeFiles(projectPath, fileNames);
  });

  ipcMain.handle('project:cleanupDeleted', async (_event: IpcMainInvokeEvent, projectPath: string) => {
    return projectService.cleanupDeletedFolder(projectPath);
  });

  ipcMain.handle('project:cleanupUnusedTakes', async (_event: IpcMainInvokeEvent, projectPath: string) => {
    return projectService.cleanupUnusedTakes(projectPath);
  });

  ipcMain.handle('project:importOverlayMedia', async (_event: IpcMainInvokeEvent, projectPath: string, sourcePath: string) => {
    return projectService.importOverlayMedia(projectPath, sourcePath);
  });

  ipcMain.handle('project:stageOverlayFile', async (_event: IpcMainInvokeEvent, projectPath: string, mediaPath: string) => {
    return projectService.stageOverlayFile(projectPath, mediaPath);
  });

  ipcMain.handle('project:unstageOverlayFile', async (_event: IpcMainInvokeEvent, projectPath: string, mediaPath: string) => {
    return projectService.unstageOverlayFile(projectPath, mediaPath);
  });

  ipcMain.handle('get-cursor-position', () => {
    if (!screen) return { x: 0, y: 0 };
    return screen.getCursorScreenPoint();
  });

  // Mouse trail capture runs entirely in main process — no IPC during recording
  let mouseTrailTimer: ReturnType<typeof setInterval> | null = null;
  let mouseTrailSamples: MouseTrailEntry[] = [];
  let mouseTrailStartTime: number = 0;

  ipcMain.handle('start-mouse-trail', () => {
    mouseTrailSamples = [];
    mouseTrailStartTime = Date.now();
    if (mouseTrailTimer) clearInterval(mouseTrailTimer);
    mouseTrailTimer = setInterval(() => {
      if (!screen) return;
      const pos = screen.getCursorScreenPoint();
      const elapsed = (Date.now() - mouseTrailStartTime) / 1000;
      mouseTrailSamples.push({ t: Number(elapsed.toFixed(3)), x: pos.x, y: pos.y });
    }, 100);
  });

  ipcMain.handle('stop-mouse-trail', () => {
    if (mouseTrailTimer) {
      clearInterval(mouseTrailTimer);
      mouseTrailTimer = null;
    }
    const samples = mouseTrailSamples;
    mouseTrailSamples = [];
    return samples;
  });

  ipcMain.handle('save-mouse-trail', async (_event: IpcMainInvokeEvent, projectPath: string, suffix: string, trailData: unknown) => {
    return projectService.saveMouseTrail(projectPath, suffix, trailData);
  });

  ipcMain.handle('proxy:generate', (event: IpcMainInvokeEvent, { takeId, screenPath, projectFolder, durationSec }: { takeId: string; screenPath: string; projectFolder: string; durationSec?: number }) => {
    if (!proxyService || !screenPath || !projectFolder) return null;
    const proxyPath = proxyService.deriveProxyPath(screenPath);
    const totalDuration = Number.isFinite(durationSec) && durationSec! > 0 ? durationSec! : 0;

    event.sender.send('proxy:progress', { takeId, status: 'started', percent: 0 });

    const onProgress = totalDuration > 0 ? (progress: FfmpegProgress) => {
      if (event.sender.isDestroyed()) return;
      const outSec = progress?.outTimeSec;
      if (Number.isFinite(outSec) && outSec !== null && outSec >= 0) {
        const percent = Math.max(0, Math.min(1, outSec / totalDuration));
        event.sender.send('proxy:progress', { takeId, status: 'progress', percent });
      }
    } : undefined;

    proxyService.generateProxy({ screenPath, proxyPath, onProgress }).then(() => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('proxy:progress', { takeId, status: 'done', proxyPath });
      }
    }).catch((err: unknown) => {
      if (!event.sender.isDestroyed()) {
        const message = err instanceof Error ? err.message : String(err);
        event.sender.send('proxy:progress', { takeId, status: 'error', error: message });
      }
    });

    return proxyPath;
  });

  function cleanupMouseTrailTimer(): void {
    if (mouseTrailTimer) {
      clearInterval(mouseTrailTimer);
      mouseTrailTimer = null;
    }
    mouseTrailSamples = [];
  }

  return { cleanupMouseTrailTimer };
}
