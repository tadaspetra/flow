import { spawn } from 'node:child_process';

interface FfmpegProgressFields {
  [key: string]: string | undefined;
}

export interface FfmpegProgress {
  status: string;
  frame: number | null;
  fps: number | null;
  speed: number | null;
  outTimeSec: number | null;
  raw: FfmpegProgressFields;
}

export function parseTimeToSeconds(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;

  const parts = value.trim().split(':');
  if (parts.length !== 3) return null;

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  const seconds = Number(parts[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return null;
  }

  return hours * 3600 + minutes * 60 + seconds;
}

function parseNumericField(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSpeedField(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  return parseNumericField(value.replace(/x$/i, ''));
}

export function parseFfmpegProgress(
  fields: FfmpegProgressFields | null | undefined
): FfmpegProgress | null {
  if (!fields || typeof fields !== 'object') return null;
  const status = typeof fields.progress === 'string' ? fields.progress : null;
  if (!status) return null;

  const outTimeSec = parseTimeToSeconds(fields.out_time);
  return {
    status,
    frame: parseNumericField(fields.frame),
    fps: parseNumericField(fields.fps),
    speed: parseSpeedField(fields.speed),
    outTimeSec,
    raw: { ...fields }
  };
}

export class FfmpegAbortError extends Error {
  readonly code = 'FFMPEG_ABORTED';

  constructor(message = 'ffmpeg render aborted') {
    super(message);
    this.name = 'FfmpegAbortError';
  }
}

export function runFfmpeg({
  ffmpegPath,
  args,
  spawnImpl = spawn,
  onProgress,
  signal
}: {
  ffmpegPath?: string;
  args?: string[];
  spawnImpl?: typeof spawn;
  onProgress?: (progress: FfmpegProgress) => void;
  signal?: AbortSignal;
} = {}): Promise<{ stderr: string }> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new FfmpegAbortError());
      return;
    }

    const child = spawnImpl(ffmpegPath as string, Array.isArray(args) ? args : [], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdoutBuffer = '';
    let stderr = '';
    let currentProgress: FfmpegProgressFields = {};
    let settled = false;
    let abortedByCaller = false;

    function resolveOnce(value: { stderr: string }) {
      if (settled) return;
      settled = true;
      detachAbort();
      resolve(value);
    }

    function rejectOnce(error: Error) {
      if (settled) return;
      settled = true;
      detachAbort();
      reject(error);
    }

    function processStdoutChunk(chunk: Buffer | string) {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        const separatorIndex = line.indexOf('=');
        if (separatorIndex <= 0) continue;

        const key = line.slice(0, separatorIndex);
        const value = line.slice(separatorIndex + 1);
        currentProgress[key] = value;

        if (key === 'progress') {
          const parsed = parseFfmpegProgress(currentProgress);
          if (parsed && typeof onProgress === 'function') {
            try {
              onProgress(parsed);
            } catch (error) {
              // Never let a progress listener crash ffmpeg draining.
              console.warn('[ffmpeg-runner] onProgress listener threw:', error);
            }
          }
          currentProgress = {};
        }
      }
    }

    function onAbort() {
      if (settled) return;
      abortedByCaller = true;
      // Try graceful shutdown first (ffmpeg flushes the muxer on SIGINT);
      // fall back to SIGKILL if the child is still alive shortly after.
      try {
        child.kill('SIGINT');
      } catch (error) {
        console.warn('[ffmpeg-runner] SIGINT failed:', error);
      }
      setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) {
          try {
            child.kill('SIGKILL');
          } catch (error) {
            console.warn('[ffmpeg-runner] SIGKILL failed:', error);
          }
        }
      }, 2000);
    }

    function detachAbort() {
      if (signal) signal.removeEventListener('abort', onAbort);
    }

    if (signal) signal.addEventListener('abort', onAbort, { once: true });

    child.stdout.on('data', processStdoutChunk);
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.once('error', (error) => {
      rejectOnce(error);
    });

    child.once('close', (code) => {
      if (stdoutBuffer.trim()) processStdoutChunk('\n');
      if (abortedByCaller) {
        rejectOnce(new FfmpegAbortError());
        return;
      }
      if (code === 0) {
        resolveOnce({ stderr });
        return;
      }

      rejectOnce(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
    });
  });
}
