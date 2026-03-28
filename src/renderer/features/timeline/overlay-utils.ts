import type { Overlay, OutputMode, OverlayMediaType } from '../../../shared/types/domain.js';

const TRANSITION_DURATION = 0.3;

/** Returned when the playhead is inside an overlay's time span. */
export interface OverlayStateActive {
  active: true;
  overlayId: string;
  mediaPath: string;
  mediaType: OverlayMediaType;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  sourceTime: number;
}

/** Returned when no overlay is active at the given time. */
export interface OverlayStateInactive {
  active: false;
}

/** Discriminated union for overlay state at a point in time. */
export type OverlayState = OverlayStateActive | OverlayStateInactive;

/**
 * Compute the overlay visual state at a given timeline time.
 * Pure function -- no DOM dependencies.
 */
function getOverlayStateAtTime(
  time: number,
  overlays: Overlay[],
  outputMode: OutputMode,
  timelineDuration?: number
): OverlayState {
  if (!Array.isArray(overlays) || overlays.length === 0) {
    return { active: false };
  }
  const mode: 'reel' | 'landscape' = outputMode === 'reel' ? 'reel' : 'landscape';
  const FADE = TRANSITION_DURATION;

  for (let i = 0; i < overlays.length; i++) {
    const o = overlays[i]!;
    if (time < o.startTime - 0.001 || time > o.endTime + 0.001) continue;

    const pos = o[mode] || { x: 0, y: 0, width: 400, height: 300 };
    let x = pos.x, y = pos.y, width = pos.width, height = pos.height;

    // Skip fade-in if overlay starts at the beginning of the video
    const atVideoStart = o.startTime < 0.01;
    // Skip fade-out if overlay ends at or past the end of the video
    const atVideoEnd = timelineDuration != null && o.endTime >= timelineDuration - 0.01;

    // Fade in/out
    let opacity = 1;
    if (!atVideoStart && time < o.startTime + FADE) {
      opacity = Math.max(0, (time - o.startTime) / FADE);
    }
    if (!atVideoEnd && time > o.endTime - FADE) {
      opacity = Math.min(opacity, Math.max(0, (o.endTime - time) / FADE));
    }

    // Position interpolation with adjacent same-media segment
    // Only ONE side handles the transition to avoid double-animation:
    // The SECOND segment handles the full interpolation from prev->current during its FADE window.
    // The FIRST segment does NOT interpolate toward next -- it stays at its own position.
    const prev: Overlay | undefined = i > 0 ? overlays[i - 1] : undefined;
    if (prev && prev.mediaPath === o.mediaPath && Math.abs(o.startTime - prev.endTime) < 0.01) {
      const elapsed = time - o.startTime;
      if (elapsed >= 0 && elapsed < FADE) {
        const t = elapsed / FADE;
        const prevPos = prev[mode] || { x: 0, y: 0, width: 400, height: 300 };
        x = prevPos.x + (x - prevPos.x) * t;
        y = prevPos.y + (y - prevPos.y) * t;
        width = prevPos.width + (width - prevPos.width) * t;
        height = prevPos.height + (height - prevPos.height) * t;
        opacity = 1;
      }
    } else {
      // Only suppress fade-out if next segment is same media (transition handled by next)
      const next: Overlay | undefined = i < overlays.length - 1 ? overlays[i + 1] : undefined;
      if (next && next.mediaPath === o.mediaPath && Math.abs(next.startTime - o.endTime) < 0.01) {
        opacity = 1; // no fade-out, next segment will handle the transition
      }
    }

    const sourceTime = o.mediaType === 'video' ? o.sourceStart + (time - o.startTime) : 0;

    return {
      active: true,
      overlayId: o.id,
      mediaPath: o.mediaPath,
      mediaType: o.mediaType,
      x, y, width, height,
      opacity,
      sourceTime
    };
  }
  return { active: false };
}

export { getOverlayStateAtTime, TRANSITION_DURATION };
