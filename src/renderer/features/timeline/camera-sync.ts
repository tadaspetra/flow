const MIN_CAMERA_SYNC_OFFSET_MS = -2000;
const MAX_CAMERA_SYNC_OFFSET_MS = 2000;

export function normalizeCameraSyncOffsetMs(value: unknown): number {
  const offset = Math.round(Number(value));
  if (!Number.isFinite(offset)) return 0;
  return Math.max(MIN_CAMERA_SYNC_OFFSET_MS, Math.min(MAX_CAMERA_SYNC_OFFSET_MS, offset));
}

export function resolveCameraPlaybackTargetTime(screenTime: unknown, cameraSyncOffsetMs: number = 0): number {
  const baseTime = Number(screenTime);
  if (!Number.isFinite(baseTime)) return 0;
  return Math.max(0, baseTime + normalizeCameraSyncOffsetMs(cameraSyncOffsetMs) / 1000);
}

export function computeCameraPlaybackDrift(screenTime: unknown, cameraTime: unknown, cameraSyncOffsetMs: number = 0): number {
  const targetTime = resolveCameraPlaybackTargetTime(screenTime, cameraSyncOffsetMs);
  const actualTime = Number(cameraTime);
  if (!Number.isFinite(actualTime)) return targetTime;
  return targetTime - actualTime;
}
