import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { ensureDirectory, safeUnlink } from '../infra/file-system';

/**
 * Recording service: streams recorder chunks directly to temporary files on
 * disk so that a renderer crash, quit, or finalize failure cannot vaporize a
 * recording that has already been captured. Finalization is a rename, which is
 * atomic on the same filesystem.
 *
 * Lifecycle:
 *   begin({ takeId, suffix, folder }) -> returns { tempPath, finalPath }
 *   append({ takeId, suffix, data })  -> appends bytes to temp file
 *   finalize({ takeId, suffix })      -> fsync + rename -> final path
 *   cancel({ takeId, suffix })        -> close + delete temp file
 *
 * Temp files use a dotted ".part" extension so they are easy to identify in
 * the project folder for orphan recovery.
 */

export interface BeginRecordingOptions {
  takeId: string;
  suffix: string;
  folder: string;
  extension?: string;
}

export interface AppendChunkOptions {
  takeId: string;
  suffix: string;
  data: Buffer | Uint8Array | ArrayBuffer;
}

export interface FinalizeRecordingOptions {
  takeId: string;
  suffix: string;
}

export interface RecordingHandle {
  takeId: string;
  suffix: string;
  folder: string;
  tempPath: string;
  finalPath: string;
  fd: number;
  bytesWritten: number;
  closed: boolean;
}

export interface BeginRecordingResult {
  tempPath: string;
  finalPath: string;
}

export interface FinalizeRecordingResult {
  path: string;
  bytesWritten: number;
}

export interface AppendChunkResult {
  bytesWritten: number;
}

const handles = new Map<string, RecordingHandle>();

function handleKey(takeId: string, suffix: string): string {
  return `${takeId}::${suffix}`;
}

function sanitizeSegment(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

export function computeRecordingPaths(
  folder: string,
  takeId: string,
  suffix: string,
  extension = '.webm'
): { tempPath: string; finalPath: string } {
  const safeTakeId = sanitizeSegment(takeId, `take-${Date.now()}`);
  const safeSuffix = sanitizeSegment(suffix, 'recording');
  const safeExt = extension.startsWith('.') ? extension : `.${extension}`;
  const finalPath = path.join(folder, `recording-${safeTakeId}-${safeSuffix}${safeExt}`);
  // Include a random tag in the temp name so two crashes for the same take do
  // not reuse (and overwrite) a previous crash's partial bytes before the user
  // has had a chance to recover them.
  const rand = crypto.randomBytes(3).toString('hex');
  const tempPath = path.join(
    folder,
    `.recording-${safeTakeId}-${safeSuffix}-${rand}${safeExt}.part`
  );
  return { tempPath, finalPath };
}

function toBuffer(data: Buffer | Uint8Array | ArrayBuffer): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Uint8Array) return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  return Buffer.from(data);
}

export function beginRecording(opts: BeginRecordingOptions): BeginRecordingResult {
  const takeId = typeof opts.takeId === 'string' ? opts.takeId.trim() : '';
  const suffix = typeof opts.suffix === 'string' ? opts.suffix.trim() : '';
  const folder = typeof opts.folder === 'string' ? opts.folder.trim() : '';
  if (!takeId) throw new Error('Missing recording takeId');
  if (!suffix) throw new Error('Missing recording suffix');
  if (!folder) throw new Error('Missing recording folder');

  ensureDirectory(folder);

  const key = handleKey(takeId, suffix);
  if (handles.has(key)) {
    throw new Error(`Recording already in progress for ${key}`);
  }

  const { tempPath, finalPath } = computeRecordingPaths(
    folder,
    takeId,
    suffix,
    opts.extension || '.webm'
  );
  const fd = fs.openSync(tempPath, 'w');
  handles.set(key, {
    takeId,
    suffix,
    folder,
    tempPath,
    finalPath,
    fd,
    bytesWritten: 0,
    closed: false
  });
  return { tempPath, finalPath };
}

export async function appendRecordingChunk(opts: AppendChunkOptions): Promise<AppendChunkResult> {
  const takeId = typeof opts.takeId === 'string' ? opts.takeId.trim() : '';
  const suffix = typeof opts.suffix === 'string' ? opts.suffix.trim() : '';
  if (!takeId || !suffix) throw new Error('Missing recording identifiers');
  const key = handleKey(takeId, suffix);
  const handle = handles.get(key);
  if (!handle) throw new Error(`No active recording for ${key}`);
  if (handle.closed) throw new Error(`Recording already finalized for ${key}`);
  const buffer = toBuffer(opts.data);
  if (buffer.length === 0) return { bytesWritten: handle.bytesWritten };

  await new Promise<void>((resolve, reject) => {
    fs.write(handle.fd, buffer, 0, buffer.length, null, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  handle.bytesWritten += buffer.length;
  return { bytesWritten: handle.bytesWritten };
}

export function finalizeRecording(opts: FinalizeRecordingOptions): FinalizeRecordingResult {
  const takeId = typeof opts.takeId === 'string' ? opts.takeId.trim() : '';
  const suffix = typeof opts.suffix === 'string' ? opts.suffix.trim() : '';
  if (!takeId || !suffix) throw new Error('Missing recording identifiers');
  const key = handleKey(takeId, suffix);
  const handle = handles.get(key);
  if (!handle) throw new Error(`No active recording for ${key}`);
  if (handle.closed) {
    // Idempotent: if we already finalized, just return the final path.
    return { path: handle.finalPath, bytesWritten: handle.bytesWritten };
  }

  try {
    // Flush buffers to disk before rename so a crash immediately after the
    // rename cannot leave us with a zero-length final file.
    try {
      fs.fsyncSync(handle.fd);
    } catch (error) {
      console.warn(`[recording] fsync failed for ${key}:`, error);
    }
    fs.closeSync(handle.fd);
  } catch (error) {
    console.warn(`[recording] close failed for ${key}:`, error);
  }
  handle.closed = true;

  if (handle.bytesWritten <= 0) {
    // No bytes captured. Remove the empty temp file and surface a clear error;
    // callers treat a zero-byte recording as a failure rather than pretending
    // we wrote a usable file.
    safeUnlink(handle.tempPath);
    handles.delete(key);
    throw new Error(`Recording produced no data for ${suffix}`);
  }

  fs.renameSync(handle.tempPath, handle.finalPath);
  const result: FinalizeRecordingResult = {
    path: handle.finalPath,
    bytesWritten: handle.bytesWritten
  };
  handles.delete(key);
  return result;
}

export function cancelRecording(opts: FinalizeRecordingOptions): { cancelled: boolean } {
  const takeId = typeof opts.takeId === 'string' ? opts.takeId.trim() : '';
  const suffix = typeof opts.suffix === 'string' ? opts.suffix.trim() : '';
  if (!takeId || !suffix) return { cancelled: false };
  const key = handleKey(takeId, suffix);
  const handle = handles.get(key);
  if (!handle) return { cancelled: false };
  if (!handle.closed) {
    try {
      fs.closeSync(handle.fd);
    } catch {
      // Already closed; ignore.
    }
    handle.closed = true;
  }
  safeUnlink(handle.tempPath);
  handles.delete(key);
  return { cancelled: true };
}

export function listActiveRecordings(): RecordingHandle[] {
  return Array.from(handles.values());
}

export function getActiveRecordingCount(): number {
  return handles.size;
}

/**
 * Scan a project folder for orphan .part files. These are left behind when
 * the app crashed mid-recording and could not finalize. The caller decides
 * whether to attempt recovery (by renaming the .part file to a playable name)
 * or to delete them.
 */
export function findOrphanRecordingParts(folder: string): string[] {
  try {
    if (!fs.existsSync(folder)) return [];
    return fs
      .readdirSync(folder)
      .filter((name) => name.startsWith('.recording-') && name.endsWith('.part'))
      .map((name) => path.join(folder, name));
  } catch (error) {
    console.warn(`[recording] Failed to scan ${folder} for orphan parts:`, error);
    return [];
  }
}

/**
 * Reset service state. Test-only helper; in production, finalize/cancel own
 * every handle.
 */
export function _resetForTests(): void {
  for (const handle of handles.values()) {
    if (!handle.closed) {
      try {
        fs.closeSync(handle.fd);
      } catch {
        // ignore
      }
    }
    safeUnlink(handle.tempPath);
  }
  handles.clear();
}
