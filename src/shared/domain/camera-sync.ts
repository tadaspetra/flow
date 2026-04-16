/**
 * Camera-sync offset normalization. Kept in its own module (no node:path
 * imports) so the renderer bundle does not pull in filesystem helpers from
 * project.ts. The renderer and main process share a single clamp rule.
 */

export const MIN_CAMERA_SYNC_OFFSET_MS = -2000;
export const MAX_CAMERA_SYNC_OFFSET_MS = 2000;

export function normalizeCameraSyncOffsetMs(value: unknown): number {
  const offset = Math.round(Number(value));
  if (!Number.isFinite(offset)) return 0;
  return Math.max(MIN_CAMERA_SYNC_OFFSET_MS, Math.min(MAX_CAMERA_SYNC_OFFSET_MS, offset));
}
