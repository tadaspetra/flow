import type {
  ProjectCreateResult,
  ProjectOpenResult,
  ProjectSaveResult,
  RecoveryTakeResult,
  RecentProjectsResult,
  CleanupResult,
  DesktopSource,
  RenderProgress,
  ProxyProgressEvent,
  PickFolderOptions,
  ProjectCreateOptions,
  ProjectSavePayload,
  RecoveryTakePayload,
  RenderOptions,
  ProxyGenerateOptions,
  ComputeSectionsOptions,
  ComputeSectionsResult
} from './services.js';
import type { MouseTrailEntry, MouseTrailData } from './mouse-trail.js';

export interface ElectronAPI {
  saveVideo(buffer: ArrayBuffer, folder: string, suffix: string): Promise<string>;
  pickFolder(opts?: PickFolderOptions): Promise<string | null>;
  pickProjectLocation(opts?: { name?: string }): Promise<string | null>;
  pathToFileUrl(filePath: string): string;
  openFolder(folder: string): Promise<void>;
  projectCreate(opts?: ProjectCreateOptions): Promise<ProjectCreateResult>;
  projectOpen(projectFolder: string): Promise<ProjectOpenResult>;
  projectSave(payload: ProjectSavePayload): Promise<ProjectSaveResult>;
  projectSetRecoveryTake(payload: RecoveryTakePayload): Promise<RecoveryTakeResult>;
  projectClearRecoveryTake(projectFolder: string): Promise<boolean>;
  projectCompleteRecoveryTake(projectFolder: string): Promise<boolean>;
  projectListRecent(limit?: number): Promise<RecentProjectsResult>;
  projectLoadLast(): Promise<ProjectOpenResult | null>;
  projectSetLast(projectFolder: string): Promise<boolean>;
  setContentProtection(enabled: boolean): Promise<boolean>;
  getSources(): Promise<DesktopSource[]>;
  computeSections(opts: ComputeSectionsOptions): Promise<ComputeSectionsResult>;
  renderComposite(opts: RenderOptions): Promise<string>;
  onRenderProgress(listener: (update: RenderProgress) => void): () => void;
  getScribeToken(): Promise<string>;
  stageTakeFiles(projectPath: string, filePaths: (string | null)[]): Promise<void>;
  unstageTakeFiles(projectPath: string, fileNames: string[]): Promise<void>;
  cleanupDeleted(projectPath: string): Promise<void>;
  cleanupUnusedTakes(projectPath: string): Promise<CleanupResult>;
  importOverlayMedia(projectPath: string, sourcePath: string): Promise<string>;
  stageOverlayFile(projectPath: string, mediaPath: string): Promise<void>;
  unstageOverlayFile(projectPath: string, mediaPath: string): Promise<void>;
  getFilePathFromDrop(file: File): string | null;
  getCursorPosition(): Promise<{ x: number; y: number }>;
  startMouseTrail(): Promise<void>;
  stopMouseTrail(): Promise<MouseTrailEntry[]>;
  saveMouseTrail(projectPath: string, suffix: string, trailData: MouseTrailData): Promise<string>;
  generateProxy(opts: ProxyGenerateOptions): Promise<string | null>;
  onProxyProgress(listener: (update: ProxyProgressEvent) => void): () => void;
}
