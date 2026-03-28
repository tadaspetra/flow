import path from 'path';
import fs from 'fs';
import { runFfmpeg } from './ffmpeg-runner.js';
import type { FfmpegProgress, ProxyDeps } from '../../shared/types/services.js';
import ffmpegStaticPath from 'ffmpeg-static';

const MAX_CONCURRENT = 2;

let activeCount = 0;
const queue: Array<() => Promise<void>> = [];

function drainQueue(): void {
  while (activeCount < MAX_CONCURRENT && queue.length > 0) {
    const next = queue.shift()!;
    activeCount += 1;
    next().finally(() => {
      activeCount -= 1;
      drainQueue();
    });
  }
}

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push(() => fn().then(resolve, reject) as Promise<void>);
    drainQueue();
  });
}

export interface GenerateProxyOptions {
  screenPath: string;
  proxyPath: string;
  ffmpegPath?: string;
  onProgress?: (progress: FfmpegProgress) => void;
}

/**
 * Generate a proxy MP4 for a screen recording.
 * Writes to a `.tmp` path first, then renames on success.
 * Deletes the `.tmp` file on failure.
 */
export function generateProxy(
  opts: GenerateProxyOptions,
  deps: Partial<ProxyDeps> = {}
): Promise<void> {
  const { screenPath, proxyPath, ffmpegPath: explicitPath, onProgress } = opts;
  const runFfmpegImpl = deps.runFfmpeg || runFfmpeg;
  const fsImpl = deps.fs || fs;
  const ffmpegPath = explicitPath || deps.ffmpegPath || ffmpegStaticPath || 'ffmpeg';

  return enqueue(async () => {
    const tmpPath = `${proxyPath}.tmp`;

    // Clean up any stale tmp from a previous failed attempt
    if (fsImpl.existsSync(tmpPath)) {
      try { fsImpl.unlinkSync(tmpPath); } catch (_) { /* ignore */ }
    }

    const args: string[] = [
      '-progress', 'pipe:1', '-nostats',
      '-r', '30',
      '-i', screenPath,
      '-vf', 'scale=960:540',
      '-c:v', 'libx264',
      '-crf', '23',
      '-preset', 'ultrafast',
      '-threads', '2',
      '-g', '15',
      '-c:a', 'aac',
      '-b:a', '64k',
      '-movflags', '+faststart',
      '-f', 'mp4',
      '-y',
      tmpPath
    ];

    try {
      await runFfmpegImpl({ ffmpegPath, args, onProgress });
      fsImpl.renameSync(tmpPath, proxyPath);
    } catch (err) {
      // Clean up partial tmp file on failure
      try { if (fsImpl.existsSync(tmpPath)) fsImpl.unlinkSync(tmpPath); } catch (_) { /* ignore */ }
      throw err;
    }
  });
}

/**
 * Derive the proxy output path from a source screen path.
 * recording-1710000000000-screen.webm -> recording-1710000000000-screen-proxy.mp4
 */
export function deriveProxyPath(screenPath: string): string {
  const dir = path.dirname(screenPath);
  const ext = path.extname(screenPath);
  const base = path.basename(screenPath, ext);
  return path.join(dir, `${base}-proxy.mp4`);
}
