import path from 'path';

import type {
  Section,
  Keyframe,
  Overlay,
  OverlayPosition,
  OutputMode,
  ExportAudioPreset,
  PipSnapPoint,
  OverlayMediaType,
  Project,
  Take,
  ProjectSettings,
  ProjectTimeline,
  SavedKeyframeState
} from '../types/domain.js';

// Re-export all types for consumers
export type {
  Section,
  Keyframe,
  Overlay,
  OverlayPosition,
  OutputMode,
  ExportAudioPreset,
  PipSnapPoint,
  OverlayMediaType,
  Project,
  Take,
  ProjectSettings,
  ProjectTimeline,
  SavedKeyframeState
};

// Re-export constants from types
export {
  MIN_BACKGROUND_ZOOM,
  MIN_REEL_BACKGROUND_ZOOM,
  MAX_BACKGROUND_ZOOM,
  MIN_BACKGROUND_PAN,
  MAX_BACKGROUND_PAN,
  MIN_CAMERA_SYNC_OFFSET_MS,
  MAX_CAMERA_SYNC_OFFSET_MS,
  MIN_REEL_CROP_X,
  MAX_REEL_CROP_X,
  MIN_PIP_SCALE,
  MAX_PIP_SCALE,
  DEFAULT_PIP_SCALE,
  MAX_OVERLAY_TRACKS,
  EXPORT_AUDIO_PRESET_OFF,
  EXPORT_AUDIO_PRESET_COMPRESSED,
  OUTPUT_MODE_LANDSCAPE,
  OUTPUT_MODE_REEL,
  VALID_PIP_SNAP_POINTS,
  DEFAULT_PIP_SNAP_POINT,
  VALID_OVERLAY_MEDIA_TYPES,
  OVERLAY_IMAGE_EXTENSIONS,
  OVERLAY_VIDEO_EXTENSIONS,
  DEFAULT_OVERLAY_POSITION
} from '../types/domain.js';

import {
  MIN_BACKGROUND_ZOOM,
  MIN_REEL_BACKGROUND_ZOOM,
  MAX_BACKGROUND_ZOOM,
  MIN_BACKGROUND_PAN,
  MAX_BACKGROUND_PAN,
  MIN_CAMERA_SYNC_OFFSET_MS,
  MAX_CAMERA_SYNC_OFFSET_MS,
  MIN_REEL_CROP_X,
  MAX_REEL_CROP_X,
  MIN_PIP_SCALE,
  MAX_PIP_SCALE,
  DEFAULT_PIP_SCALE,
  MAX_OVERLAY_TRACKS,
  EXPORT_AUDIO_PRESET_OFF,
  EXPORT_AUDIO_PRESET_COMPRESSED,
  OUTPUT_MODE_LANDSCAPE,
  OUTPUT_MODE_REEL,
  VALID_PIP_SNAP_POINTS,
  DEFAULT_PIP_SNAP_POINT,
  VALID_OVERLAY_MEDIA_TYPES,
  DEFAULT_OVERLAY_POSITION
} from '../types/domain.js';

// Internal helper to safely access properties on raw data
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawRecord = Record<string, any>;

let overlayIdCounter = 0;

export function createProjectId(): string {
  return `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function generateOverlayId(): string {
  overlayIdCounter += 1;
  return `overlay-${Date.now()}-${overlayIdCounter}`;
}

export function sanitizeProjectName(name: unknown): string {
  const fallback = 'Untitled Project';
  if (typeof name !== 'string') return fallback;

  const stripped = name
    .trim()
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 80);
  const cleaned = Array.from(stripped)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 0x20 && code !== 0x7f;
    })
    .join('');
  return cleaned || fallback;
}

export function toProjectAbsolutePath(projectFolder: string, value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  return path.isAbsolute(value) ? value : path.join(projectFolder, value);
}

export function toProjectRelativePath(projectFolder: string, value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  if (!path.isAbsolute(value)) return value;

  const relative = path.relative(projectFolder, value);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return value;
  return relative;
}

export function normalizeSections(rawSections: unknown = []): Section[] {
  if (!Array.isArray(rawSections)) return [];
  return (rawSections as RawRecord[])
    .map((section, index) => {
      const start = Number(section.start);
      const end = Number(section.end);
      const sourceStart = Number.isFinite(Number(section.sourceStart))
        ? Number(section.sourceStart)
        : start;
      const sourceEnd = Number.isFinite(Number(section.sourceEnd))
        ? Number(section.sourceEnd)
        : end;
      const transcript = String(
        typeof section.transcript === 'string'
          ? section.transcript
          : typeof section.text === 'string'
            ? section.text
            : ''
      )
        .replace(/\s+/g, ' ')
        .trim();

      return {
        id: typeof section.id === 'string' && section.id ? section.id : `section-${index + 1}`,
        index: Number.isFinite(Number(section.index)) ? Number(section.index) : index,
        label: typeof section.label === 'string' ? section.label : `Section ${index + 1}`,
        start: Number.isFinite(start) ? start : 0,
        end: Number.isFinite(end) ? end : 0,
        duration: Number.isFinite(Number(section.duration))
          ? Number(section.duration)
          : Math.max(0, (Number.isFinite(end) ? end : 0) - (Number.isFinite(start) ? start : 0)),
        sourceStart: Number.isFinite(sourceStart) ? sourceStart : 0,
        sourceEnd: Number.isFinite(sourceEnd) ? sourceEnd : 0,
        takeId: typeof section.takeId === 'string' && section.takeId ? section.takeId : null,
        transcript,
        saved: !!section.saved
      };
    })
    .filter((section) => section.end - section.start > 0.0001)
    .sort((a, b) => a.start - b.start);
}

export function normalizeSavedSections(rawSavedSections: unknown = []): Section[] {
  if (!Array.isArray(rawSavedSections)) return [];
  return normalizeSections(rawSavedSections).map(section => ({
    ...section,
    saved: true
  }));
}

export function normalizeBackgroundZoom(value: unknown, outputMode?: unknown): number {
  const minZoom = outputMode === OUTPUT_MODE_REEL ? MIN_REEL_BACKGROUND_ZOOM : MIN_BACKGROUND_ZOOM;
  const zoom = Number(value);
  if (!Number.isFinite(zoom)) return minZoom;
  return Math.max(minZoom, Math.min(MAX_BACKGROUND_ZOOM, zoom));
}

export function normalizeBackgroundPan(value: unknown): number {
  const pan = Number(value);
  if (!Number.isFinite(pan)) return 0;
  return Math.max(MIN_BACKGROUND_PAN, Math.min(MAX_BACKGROUND_PAN, pan));
}

export function normalizeReelCropX(value: unknown): number {
  const v = Number(value);
  if (!Number.isFinite(v)) return 0;
  return Math.max(MIN_REEL_CROP_X, Math.min(MAX_REEL_CROP_X, v));
}

export function normalizeOutputMode(value: unknown): OutputMode {
  return value === OUTPUT_MODE_REEL ? OUTPUT_MODE_REEL : OUTPUT_MODE_LANDSCAPE;
}

export function normalizePipScale(value: unknown): number {
  if (value === null || value === undefined) return DEFAULT_PIP_SCALE;
  const v = Number(value);
  if (!Number.isFinite(v)) return DEFAULT_PIP_SCALE;
  return Math.max(MIN_PIP_SCALE, Math.min(MAX_PIP_SCALE, v));
}

export function normalizePipSnapPoint(value: unknown): PipSnapPoint {
  return (VALID_PIP_SNAP_POINTS as readonly string[]).includes(value as string)
    ? value as PipSnapPoint
    : DEFAULT_PIP_SNAP_POINT;
}

export function normalizeExportAudioPreset(value: unknown): ExportAudioPreset {
  return value === EXPORT_AUDIO_PRESET_OFF
    ? EXPORT_AUDIO_PRESET_OFF
    : EXPORT_AUDIO_PRESET_COMPRESSED;
}

export function normalizeCameraSyncOffsetMs(value: unknown): number {
  const offset = Math.round(Number(value));
  if (!Number.isFinite(offset)) return 0;
  return Math.max(MIN_CAMERA_SYNC_OFFSET_MS, Math.min(MAX_CAMERA_SYNC_OFFSET_MS, offset));
}

export function normalizeOverlayPosition(pos: unknown): OverlayPosition {
  if (!pos || typeof pos !== 'object') return { ...DEFAULT_OVERLAY_POSITION };
  const p = pos as RawRecord;
  return {
    x: Number.isFinite(Number(p.x)) ? Number(p.x) : 0,
    y: Number.isFinite(Number(p.y)) ? Number(p.y) : 0,
    width: Number.isFinite(Number(p.width)) && Number(p.width) > 0 ? Number(p.width) : DEFAULT_OVERLAY_POSITION.width,
    height: Number.isFinite(Number(p.height)) && Number(p.height) > 0 ? Number(p.height) : DEFAULT_OVERLAY_POSITION.height
  };
}

export function normalizeKeyframes(rawKeyframes: unknown = []): Keyframe[] {
  if (!Array.isArray(rawKeyframes)) return [];
  return (rawKeyframes as RawRecord[])
    .map((keyframe) => ({
      time: Number.isFinite(Number(keyframe.time)) ? Number(keyframe.time) : 0,
      pipX: Number.isFinite(Number(keyframe.pipX)) ? Number(keyframe.pipX) : 0,
      pipY: Number.isFinite(Number(keyframe.pipY)) ? Number(keyframe.pipY) : 0,
      pipVisible: keyframe.pipVisible !== false,
      cameraFullscreen: !!keyframe.cameraFullscreen,
      backgroundZoom: normalizeBackgroundZoom(keyframe.backgroundZoom, OUTPUT_MODE_REEL),
      backgroundPanX: normalizeBackgroundPan(keyframe.backgroundPanX),
      backgroundPanY: normalizeBackgroundPan(keyframe.backgroundPanY),
      reelCropX: normalizeReelCropX(keyframe.reelCropX),
      pipScale: normalizePipScale(keyframe.pipScale),
      pipSnapPoint: normalizePipSnapPoint(keyframe.pipSnapPoint),
      autoTrack: !!keyframe.autoTrack,
      autoTrackSmoothing: Number.isFinite(Number(keyframe.autoTrackSmoothing))
        ? Math.max(0.01, Math.min(1.0, Number(keyframe.autoTrackSmoothing)))
        : 0.15,
      sectionId: typeof keyframe.sectionId === 'string' ? keyframe.sectionId : null,
      autoSection: !!keyframe.autoSection,
      savedLandscape: keyframe.savedLandscape && typeof keyframe.savedLandscape === 'object'
        ? { ...keyframe.savedLandscape } as SavedKeyframeState
        : null,
      savedReel: keyframe.savedReel && typeof keyframe.savedReel === 'object'
        ? { ...keyframe.savedReel } as SavedKeyframeState
        : null
    }))
    .sort((a, b) => a.time - b.time);
}

export function normalizeOverlays(rawOverlays: unknown): Overlay[] {
  if (!Array.isArray(rawOverlays)) return [];
  const valid = (rawOverlays as RawRecord[])
    .filter((overlay): overlay is RawRecord => {
      if (!overlay || typeof overlay !== 'object') return false;
      if (typeof overlay.id !== 'string' || !overlay.id) return false;
      if (typeof overlay.mediaPath !== 'string' || !overlay.mediaPath) return false;
      if (!(VALID_OVERLAY_MEDIA_TYPES as readonly string[]).includes(overlay.mediaType as string)) return false;
      const start = Number(overlay.startTime);
      const end = Number(overlay.endTime);
      if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
      if (end <= start) return false;
      return true;
    })
    .map((overlay) => {
      const startTime = Math.max(0, Number(overlay.startTime));
      const endTime = Math.max(startTime + 0.001, Number(overlay.endTime));
      const duration = endTime - startTime;
      const isVideo = overlay.mediaType === 'video';
      let sourceStart = isVideo && Number.isFinite(Number(overlay.sourceStart)) ? Math.max(0, Number(overlay.sourceStart)) : 0;
      let sourceEnd = isVideo && Number.isFinite(Number(overlay.sourceEnd)) && Number(overlay.sourceEnd) > sourceStart
        ? Number(overlay.sourceEnd)
        : sourceStart + duration;
      if (!isVideo) {
        sourceStart = 0;
        sourceEnd = duration;
      }
      const rawTrack = Number(overlay.trackIndex);
      const trackIndex = Number.isFinite(rawTrack) && rawTrack >= 0
        ? Math.min(Math.floor(rawTrack), MAX_OVERLAY_TRACKS - 1)
        : 0;
      return {
        id: overlay.id as string,
        trackIndex,
        mediaPath: overlay.mediaPath as string,
        mediaType: overlay.mediaType as OverlayMediaType,
        startTime,
        endTime,
        sourceStart,
        sourceEnd,
        landscape: normalizeOverlayPosition(overlay.landscape),
        reel: normalizeOverlayPosition(overlay.reel),
        saved: !!overlay.saved
      };
    });

  // Group by trackIndex, enforce no-overlap within each track
  const tracks: Record<number, Overlay[]> = {};
  for (const o of valid) {
    if (!tracks[o.trackIndex]) tracks[o.trackIndex] = [];
    tracks[o.trackIndex]!.push(o);
  }
  const result: Overlay[] = [];
  for (const trackIdx of Object.keys(tracks).sort((a, b) => Number(a) - Number(b))) {
    const group = tracks[Number(trackIdx)]!.sort((a, b) => a.startTime - b.startTime);
    for (let i = 1; i < group.length; i += 1) {
      const prev = group[i - 1]!;
      if (group[i]!.startTime < prev.endTime) {
        const shift = prev.endTime - group[i]!.startTime;
        group[i]!.startTime = prev.endTime;
        if (group[i]!.mediaType === 'video') {
          group[i]!.sourceStart += shift;
        }
      }
      if (group[i]!.endTime <= group[i]!.startTime) {
        group.splice(i, 1);
        i -= 1;
      }
    }
    result.push(...group);
  }

  return result;
}

export function createDefaultProject(name = 'Untitled Project'): Project {
  const now = new Date().toISOString();
  return {
    id: createProjectId(),
    name: sanitizeProjectName(name),
    createdAt: now,
    updatedAt: now,
    settings: {
      screenFitMode: 'fill',
      hideFromRecording: true,
      exportAudioPreset: EXPORT_AUDIO_PRESET_COMPRESSED,
      cameraSyncOffsetMs: 0,
      outputMode: OUTPUT_MODE_LANDSCAPE,
      pipScale: DEFAULT_PIP_SCALE
    },
    takes: [],
    timeline: {
      duration: 0,
      sections: [],
      savedSections: [],
      keyframes: [],
      selectedSectionId: null,
      hasCamera: false,
      sourceWidth: null,
      sourceHeight: null,
      overlays: [],
      savedOverlays: []
    }
  };
}

export function normalizeProjectData(rawProject: unknown, projectFolder?: string): Project {
  const raw = rawProject as RawRecord | null | undefined;
  const base = createDefaultProject(raw?.name);
  const project: RawRecord = raw && typeof raw === 'object' ? raw : {};
  const rawSettings: RawRecord = project.settings && typeof project.settings === 'object' ? project.settings as RawRecord : {};
  const rawTimeline: RawRecord = project.timeline && typeof project.timeline === 'object' ? project.timeline as RawRecord : {};
  const rawTakes: RawRecord[] = Array.isArray(project.takes) ? project.takes as RawRecord[] : [];
  const now = new Date().toISOString();

  return {
    id: typeof project.id === 'string' && project.id ? project.id : base.id,
    name:
      typeof project.name === 'string' && (project.name as string).trim()
        ? sanitizeProjectName(project.name)
        : base.name,
    createdAt: typeof project.createdAt === 'string' ? project.createdAt : now,
    updatedAt: typeof project.updatedAt === 'string' ? project.updatedAt : now,
    settings: {
      screenFitMode: rawSettings.screenFitMode === 'fit' ? 'fit' : 'fill',
      hideFromRecording: rawSettings.hideFromRecording !== false,
      exportAudioPreset: normalizeExportAudioPreset(rawSettings.exportAudioPreset),
      cameraSyncOffsetMs: normalizeCameraSyncOffsetMs(rawSettings.cameraSyncOffsetMs),
      outputMode: normalizeOutputMode(rawSettings.outputMode),
      pipScale: normalizePipScale(rawSettings.pipScale)
    } as ProjectSettings,
    takes: rawTakes.map((take, index): Take => ({
      id: typeof take?.id === 'string' && take.id ? take.id : `take-${index + 1}-${Date.now()}`,
      createdAt: typeof take?.createdAt === 'string' ? take.createdAt : now,
      duration: Number.isFinite(Number(take?.duration)) ? Number(take.duration) : 0,
      screenPath: projectFolder
        ? toProjectAbsolutePath(projectFolder, take?.screenPath)
        : (take?.screenPath as string) || null,
      cameraPath: projectFolder
        ? toProjectAbsolutePath(projectFolder, take?.cameraPath)
        : (take?.cameraPath as string) || null,
      mousePath: projectFolder
        ? toProjectAbsolutePath(projectFolder, take?.mousePath)
        : (take?.mousePath as string) || null,
      proxyPath: projectFolder
        ? toProjectAbsolutePath(projectFolder, take?.proxyPath)
        : (take?.proxyPath as string) || null,
      sections: normalizeSections(take?.sections)
    })),
    timeline: {
      duration: Number.isFinite(Number(rawTimeline.duration)) ? Number(rawTimeline.duration) : 0,
      sections: normalizeSections(rawTimeline.sections),
      savedSections: normalizeSavedSections(rawTimeline.savedSections),
      keyframes: normalizeKeyframes(rawTimeline.keyframes),
      selectedSectionId:
        typeof rawTimeline.selectedSectionId === 'string' ? rawTimeline.selectedSectionId : null,
      hasCamera: !!rawTimeline.hasCamera,
      sourceWidth: Number.isFinite(Number(rawTimeline.sourceWidth))
        ? Number(rawTimeline.sourceWidth)
        : null,
      sourceHeight: Number.isFinite(Number(rawTimeline.sourceHeight))
        ? Number(rawTimeline.sourceHeight)
        : null,
      overlays: normalizeOverlays(rawTimeline.overlays),
      savedOverlays: normalizeOverlays(rawTimeline.savedOverlays)
    } as ProjectTimeline
  };
}
