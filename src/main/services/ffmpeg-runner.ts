import { spawn } from 'child_process';
import type { FfmpegProgress, FfmpegRunOptions } from '../../shared/types/services.js';

function parseTimeToSeconds(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;

  const parts = value.trim().split(':');
  if (parts.length !== 3) return null;

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  const seconds = Number(parts[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;

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

export function parseFfmpegProgress(fields: Record<string, string> | null): FfmpegProgress | null {
  if (!fields || typeof fields !== 'object') return null;
  const status = typeof fields['progress'] === 'string' ? fields['progress'] : null;
  if (!status) return null;

  const outTimeSec = parseTimeToSeconds(fields['out_time']);
  return {
    status,
    frame: parseNumericField(fields['frame']),
    fps: parseNumericField(fields['fps']),
    speed: parseSpeedField(fields['speed']),
    outTimeSec,
    raw: { ...fields }
  };
}

export function runFfmpeg(opts: FfmpegRunOptions): Promise<{ stderr: string }> {
  const { ffmpegPath, args, spawnImpl = spawn, onProgress } = opts;

  return new Promise((resolve, reject) => {
    const child = spawnImpl(ffmpegPath, Array.isArray(args) ? args : [], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdoutBuffer = '';
    let stderr = '';
    let currentProgress: Record<string, string> = {};
    let settled = false;

    function resolveOnce(value: { stderr: string }): void {
      if (settled) return;
      settled = true;
      resolve(value);
    }

    function rejectOnce(error: Error): void {
      if (settled) return;
      settled = true;
      reject(error);
    }

    function processStdoutChunk(chunk: Buffer | string): void {
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
          if (parsed && typeof onProgress === 'function') onProgress(parsed);
          currentProgress = {};
        }
      }
    }

    child.stdout!.on('data', processStdoutChunk);
    child.stderr!.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.once('error', (error: Error) => {
      rejectOnce(error);
    });

    child.once('close', (code: number | null) => {
      if (stdoutBuffer.trim()) processStdoutChunk('\n');
      if (code === 0) {
        resolveOnce({ stderr });
        return;
      }

      rejectOnce(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
    });
  });
}
