import type {
  Section,
  Keyframe,
  Overlay,
  AudioOverlay,
  OutputMode,
  ExportAudioPreset,
  ScreenFitMode,
  Project
} from './domain.js';

// ── Render service ───────────────────────────────────────────────────

export interface RenderSectionInput {
  takeId: string;
  sourceStart: number;
  sourceEnd: number;
  backgroundZoom: number;
  backgroundPanX: number;
  backgroundPanY: number;
  reelCropX: number;
  pipScale: number;
  volume: number;
}

export interface RenderOptions {
  takes?: Array<{ id: string; screenPath?: string | null; cameraPath?: string | null; mousePath?: string | null }>;
  sections?: unknown[];
  keyframes?: Keyframe[];
  overlays?: Overlay[];
  audioOverlays?: AudioOverlay[];
  pipSize?: number;
  screenFitMode?: ScreenFitMode;
  exportAudioPreset?: ExportAudioPreset;
  cameraSyncOffsetMs?: number;
  sourceWidth?: number;
  sourceHeight?: number;
  outputMode?: OutputMode;
  outputFolder?: string;
}

export interface RenderDeps {
  probeVideoFpsWithFfmpeg: (ffmpegPath: string, filePath: string) => Promise<number | null>;
  runFfmpeg: (opts: FfmpegRunOptions) => Promise<{ stderr: string }>;
  ffmpegPath: string;
  now: () => number;
  onProgress: (update: RenderProgress) => void;
}

export interface RenderProgress {
  phase: 'starting' | 'rendering' | 'finalizing';
  percent: number | null;
  status: string;
  outTimeSec?: number | null;
  durationSec: number;
  frame?: number | null;
  speed?: number | null;
}

// ── FFmpeg runner ────────────────────────────────────────────────────

export interface FfmpegProgress {
  status: string;
  frame: number | null;
  fps: number | null;
  speed: number | null;
  outTimeSec: number | null;
  raw: Record<string, string>;
}

export interface FfmpegRunOptions {
  ffmpegPath: string;
  args: string[];
  spawnImpl?: typeof import('child_process').spawn;
  onProgress?: (progress: FfmpegProgress) => void;
}

// ── Proxy service ────────────────────────────────────────────────────

export interface ProxyOptions {
  screenPath: string;
  proxyPath: string;
  ffmpegPath?: string;
  onProgress?: (progress: FfmpegProgress) => void;
}

export interface ProxyDeps {
  runFfmpeg: (opts: FfmpegRunOptions) => Promise<{ stderr: string }>;
  fs: {
    existsSync: (path: string) => boolean;
    unlinkSync: (path: string) => void;
    renameSync: (oldPath: string, newPath: string) => void;
  };
  ffmpegPath: string;
}

export interface ProxyGenerateOptions {
  takeId: string;
  screenPath: string;
  projectFolder: string;
  durationSec?: number;
}

export interface ProxyProgressEvent {
  takeId: string;
  status: 'started' | 'progress' | 'done' | 'error';
  percent?: number;
  proxyPath?: string;
  error?: string;
}

// ── Sections service ─────────────────────────────────────────────────

export interface ComputeSectionsOptions {
  segments?: Array<{ start: number; end: number }>;
  paddingSeconds?: number;
}

export interface ComputeSectionsResult {
  sections: Array<{
    id: string;
    index: number;
    sourceStart: number;
    sourceEnd: number;
    start: number;
    end: number;
    duration: number;
  }>;
  trimmedDuration: number;
}

// ── Project service ──────────────────────────────────────────────────

export interface ProjectCreateOptions {
  name?: string;
  projectPath?: string;
  parentFolder?: string;
}

export interface ProjectCreateResult {
  projectPath: string;
  project: Project;
}

export interface RecoveryTake {
  id: string;
  createdAt: string;
  screenPath: string;
  cameraPath: string | null;
  recordedDuration: number;
  sections: Section[];
  trimSegments: Array<{ start: number; end: number; text: string }>;
}

export interface ProjectOpenResult {
  projectPath: string;
  project: Project;
  recoveryTake: RecoveryTake | null;
}

export interface ProjectSavePayload {
  projectPath: string;
  project?: unknown;
}

export interface ProjectSaveResult {
  projectPath: string;
  project: Project;
}

export interface RecoveryTakePayload {
  projectPath: string;
  take?: unknown;
}

export interface RecoveryTakeResult {
  projectPath: string;
  recoveryTake: RecoveryTake;
}

export interface RecentProjectListEntry {
  projectPath: string;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecentProjectsResult {
  lastProjectPath: string | null;
  projects: RecentProjectListEntry[];
}

export interface DesktopSource {
  id: string;
  name: string;
}

export interface CleanupResult {
  removedCount: number;
}

export interface PickFolderOptions {
  title?: string;
  buttonLabel?: string;
}

// ── File system ──────────────────────────────────────────────────────

export interface OverlayFilterResult {
  inputs: string[][];
  filterParts: string[];
}
