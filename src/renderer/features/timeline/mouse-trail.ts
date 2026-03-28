/**
 * Pure utility functions for mouse trail data -- lookup, smoothing, subsampling.
 * No DOM or Electron dependencies.
 */

import type { MouseTrailEntry, MousePosition, MouseFocus, TrailKeypoint } from '../../../shared/types/mouse-trail.js';

/**
 * Look up raw mouse position at a source time via linear interpolation.
 */
function lookupMouseAt(trail: MouseTrailEntry[], sourceTime: number): MousePosition {
  if (!trail || trail.length === 0) return { x: 0, y: 0 };
  if (trail.length === 1 || sourceTime <= trail[0]!.t) return { x: trail[0]!.x, y: trail[0]!.y };
  if (sourceTime >= trail[trail.length - 1]!.t) {
    const last = trail[trail.length - 1]!;
    return { x: last.x, y: last.y };
  }

  // Binary search for the interval
  let lo = 0;
  let hi = trail.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (trail[mid]!.t <= sourceTime) lo = mid;
    else hi = mid;
  }

  const a = trail[lo]!;
  const b = trail[hi]!;
  const dt = b.t - a.t;
  if (dt <= 0) return { x: a.x, y: a.y };
  const t = (sourceTime - a.t) / dt;
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t
  };
}

/**
 * Look up smoothed mouse position at a source time using exponential moving average.
 * Runs EMA from the start of the trail to sourceTime.
 */
function lookupSmoothedMouseAt(
  trail: MouseTrailEntry[],
  sourceTime: number,
  smoothing: number = 0.15,
  captureWidth: number = 1920,
  captureHeight: number = 1080
): MouseFocus {
  if (!trail || trail.length === 0) return { focusX: 0.5, focusY: 0.5 };

  const cw = captureWidth || 1920;
  const ch = captureHeight || 1080;
  const sm = Math.max(0.001, smoothing);

  // Start EMA from first point
  let smoothX = trail[0]!.x;
  let smoothY = trail[0]!.y;
  let prevT = trail[0]!.t;

  for (let i = 1; i < trail.length; i++) {
    const entry = trail[i]!;
    if (entry.t > sourceTime) {
      // Interpolate to exact sourceTime
      const dt = sourceTime - prevT;
      if (dt > 0) {
        const raw = lookupMouseAt(trail, sourceTime);
        const alpha = 1 - Math.exp(-dt / sm);
        smoothX += (raw.x - smoothX) * alpha;
        smoothY += (raw.y - smoothY) * alpha;
      }
      break;
    }
    const dt = entry.t - prevT;
    if (dt > 0) {
      const alpha = 1 - Math.exp(-dt / sm);
      smoothX += (entry.x - smoothX) * alpha;
      smoothY += (entry.y - smoothY) * alpha;
    }
    prevT = entry.t;
  }

  // If sourceTime is past the last entry, apply final step
  if (sourceTime >= trail[trail.length - 1]!.t) {
    const last = trail[trail.length - 1]!;
    const dt = sourceTime - prevT;
    if (dt > 0 && prevT < last.t) {
      const alpha = 1 - Math.exp(-dt / sm);
      smoothX += (last.x - smoothX) * alpha;
      smoothY += (last.y - smoothY) * alpha;
    }
  }

  return {
    focusX: Math.max(0, Math.min(1, smoothX / cw)),
    focusY: Math.max(0, Math.min(1, smoothY / ch))
  };
}

/**
 * Subsample a smoothed mouse trail to keypoints at a given rate.
 */
function subsampleTrail(
  trail: MouseTrailEntry[],
  smoothing: number = 0.15,
  captureWidth: number = 1920,
  captureHeight: number = 1080,
  startTime: number = 0,
  endTime: number = 10,
  rate: number = 2
): TrailKeypoint[] {
  if (!trail || trail.length === 0) return [];

  const interval = 1 / Math.max(0.1, rate);
  const keypoints: TrailKeypoint[] = [];

  for (let t = startTime; t <= endTime + 0.0001; t += interval) {
    const time = Math.min(t, endTime);
    const { focusX, focusY } = lookupSmoothedMouseAt(trail, time, smoothing, captureWidth, captureHeight);
    keypoints.push({ time, focusX, focusY });
  }

  // Ensure last point is at endTime
  if (keypoints.length > 0 && Math.abs(keypoints[keypoints.length - 1]!.time - endTime) > 0.01) {
    const { focusX, focusY } = lookupSmoothedMouseAt(trail, endTime, smoothing, captureWidth, captureHeight);
    keypoints.push({ time: endTime, focusX, focusY });
  }

  return keypoints;
}

export { lookupMouseAt, lookupSmoothedMouseAt, subsampleTrail };
