// ── String literal unions ────────────────────────────────────────────

export type OutputMode = 'landscape' | 'reel';
export type ExportAudioPreset = 'off' | 'compressed';
export type ScreenFitMode = 'fit' | 'fill';
export type PipSnapPoint = 'tl' | 'tc' | 'tr' | 'ml' | 'center' | 'mr' | 'bl' | 'bc' | 'br';
export type OverlayMediaType = 'image' | 'video';

// ── Numeric constraint constants ─────────────────────────────────────

export const MIN_BACKGROUND_ZOOM = 1 as const;
export const MIN_REEL_BACKGROUND_ZOOM = 0.5 as const;
export const MAX_BACKGROUND_ZOOM = 3 as const;
export const MIN_BACKGROUND_PAN = -1 as const;
export const MAX_BACKGROUND_PAN = 1 as const;
export const MIN_CAMERA_SYNC_OFFSET_MS = -2000 as const;
export const MAX_CAMERA_SYNC_OFFSET_MS = 2000 as const;
export const MIN_REEL_CROP_X = -1 as const;
export const MAX_REEL_CROP_X = 1 as const;
export const MIN_PIP_SCALE = 0.15 as const;
export const MAX_PIP_SCALE = 0.50 as const;
export const DEFAULT_PIP_SCALE = 0.22 as const;
export const MAX_OVERLAY_TRACKS = 2 as const;

export const EXPORT_AUDIO_PRESET_OFF = 'off' as const;
export const EXPORT_AUDIO_PRESET_COMPRESSED = 'compressed' as const;
export const OUTPUT_MODE_LANDSCAPE = 'landscape' as const;
export const OUTPUT_MODE_REEL = 'reel' as const;

export const VALID_PIP_SNAP_POINTS = ['tl', 'tc', 'tr', 'ml', 'center', 'mr', 'bl', 'bc', 'br'] as const;
export const DEFAULT_PIP_SNAP_POINT: PipSnapPoint = 'br';
export const VALID_OVERLAY_MEDIA_TYPES = ['image', 'video'] as const;
export const OVERLAY_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'] as const;
export const OVERLAY_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov'] as const;
export const DEFAULT_OVERLAY_POSITION: OverlayPosition = { x: 0, y: 0, width: 400, height: 300 };

// ── Domain interfaces ────────────────────────────────────────────────

export interface Section {
  id: string;
  index: number;
  label: string;
  start: number;
  end: number;
  duration: number;
  sourceStart: number;
  sourceEnd: number;
  takeId: string | null;
  transcript: string;
  saved: boolean;
}

export interface SavedKeyframeState {
  pipX?: number;
  pipY?: number;
  pipVisible?: boolean;
  cameraFullscreen?: boolean;
  backgroundZoom?: number;
  backgroundPanX?: number;
  backgroundPanY?: number;
  reelCropX?: number;
  pipScale?: number;
  pipSnapPoint?: PipSnapPoint;
  autoTrack?: boolean;
  autoTrackSmoothing?: number;
}

export interface Keyframe {
  time: number;
  pipX: number;
  pipY: number;
  pipVisible: boolean;
  cameraFullscreen: boolean;
  backgroundZoom: number;
  backgroundPanX: number;
  backgroundPanY: number;
  reelCropX: number;
  pipScale: number;
  pipSnapPoint: PipSnapPoint;
  autoTrack: boolean;
  autoTrackSmoothing: number;
  sectionId: string | null;
  autoSection: boolean;
  savedLandscape: SavedKeyframeState | null;
  savedReel: SavedKeyframeState | null;
  backgroundFocusX?: number;
  backgroundFocusY?: number;
}

export interface OverlayPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Overlay {
  id: string;
  trackIndex: number;
  mediaPath: string;
  mediaType: OverlayMediaType;
  startTime: number;
  endTime: number;
  sourceStart: number;
  sourceEnd: number;
  landscape: OverlayPosition;
  reel: OverlayPosition;
  saved: boolean;
}

export interface Take {
  id: string;
  createdAt: string;
  duration: number;
  screenPath: string | null;
  cameraPath: string | null;
  mousePath: string | null;
  proxyPath: string | null;
  sections: Section[];
}

export interface ProjectSettings {
  screenFitMode: ScreenFitMode;
  hideFromRecording: boolean;
  exportAudioPreset: ExportAudioPreset;
  cameraSyncOffsetMs: number;
  outputMode: OutputMode;
  pipScale: number;
}

export interface ProjectTimeline {
  duration: number;
  sections: Section[];
  savedSections: Section[];
  keyframes: Keyframe[];
  selectedSectionId: string | null;
  hasCamera: boolean;
  sourceWidth: number | null;
  sourceHeight: number | null;
  overlays: Overlay[];
  savedOverlays: Overlay[];
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  settings: ProjectSettings;
  takes: Take[];
  timeline: ProjectTimeline;
}
