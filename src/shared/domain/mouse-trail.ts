import type { MouseTrailEntry, MousePosition, MouseFocus, TrailKeypoint } from '../types/mouse-trail.js';

export type { MouseTrailEntry, MousePosition, MouseFocus, TrailKeypoint };

export function lookupMouseAt(trail: MouseTrailEntry[], sourceTime: number): MousePosition {
  if (!trail || trail.length === 0) return { x: 0, y: 0 };
  if (trail.length === 1 || sourceTime <= trail[0]!.t) return { x: trail[0]!.x, y: trail[0]!.y };
  if (sourceTime >= trail[trail.length - 1]!.t) {
    const last = trail[trail.length - 1]!;
    return { x: last.x, y: last.y };
  }
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
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function lookupSmoothedMouseAt(
  trail: MouseTrailEntry[],
  sourceTime: number,
  smoothing = 0.15,
  captureWidth = 1920,
  captureHeight = 1080
): MouseFocus {
  if (!trail || trail.length === 0) return { focusX: 0.5, focusY: 0.5 };
  const cw = captureWidth || 1920;
  const ch = captureHeight || 1080;
  const sm = Math.max(0.001, smoothing);
  let smoothX = trail[0]!.x;
  let smoothY = trail[0]!.y;
  let prevT = trail[0]!.t;
  for (let i = 1; i < trail.length; i++) {
    const entry = trail[i]!;
    if (entry.t > sourceTime) {
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

export function subsampleTrail(
  trail: MouseTrailEntry[],
  smoothing = 0.15,
  captureWidth = 1920,
  captureHeight = 1080,
  startTime = 0,
  endTime = 10,
  rate = 2
): TrailKeypoint[] {
  if (!trail || trail.length === 0) return [];
  const interval = 1 / Math.max(0.1, rate);
  const keypoints: TrailKeypoint[] = [];
  for (let t = startTime; t <= endTime + 0.0001; t += interval) {
    const time = Math.min(t, endTime);
    const { focusX, focusY } = lookupSmoothedMouseAt(trail, time, smoothing, captureWidth, captureHeight);
    keypoints.push({ time, focusX, focusY });
  }
  if (keypoints.length > 0 && Math.abs(keypoints[keypoints.length - 1]!.time - endTime) > 0.01) {
    const { focusX, focusY } = lookupSmoothedMouseAt(trail, endTime, smoothing, captureWidth, captureHeight);
    keypoints.push({ time: endTime, focusX, focusY });
  }
  return keypoints;
}
