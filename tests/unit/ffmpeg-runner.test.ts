import { EventEmitter } from 'node:events';

import { describe, expect, test, vi } from 'vitest';

import {
  FfmpegAbortError,
  parseFfmpegProgress,
  runFfmpeg,
  type FfmpegProgress
} from '../../src/main/services/ffmpeg-runner';

function createFakeChildProcess() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: (signal?: NodeJS.Signals | number) => boolean;
    exitCode: number | null;
    signalCode: NodeJS.Signals | null;
    killed: boolean;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.exitCode = null;
  child.signalCode = null;
  child.killed = false;
  child.kill = ((signal?: NodeJS.Signals | number) => {
    child.killed = true;
    child.signalCode = (signal || 'SIGTERM') as NodeJS.Signals;
    return true;
  }) as (signal?: NodeJS.Signals | number) => boolean;
  return child;
}

describe('main/services/ffmpeg-runner', () => {
  test('parseFfmpegProgress parses machine-readable ffmpeg updates', () => {
    const progress = parseFfmpegProgress({
      frame: '42',
      fps: '23.98',
      out_time: '00:00:02.500000',
      speed: '1.25x',
      progress: 'continue'
    });

    expect(progress).toEqual(
      expect.objectContaining({
        status: 'continue',
        frame: 42,
        fps: 23.98,
        outTimeSec: 2.5,
        speed: 1.25
      })
    );
  });

  test('runFfmpeg streams progress blocks and resolves on success', async () => {
    const child = createFakeChildProcess();
    const spawnImpl = vi.fn(() => child) as unknown as typeof import('node:child_process').spawn;
    const updates: unknown[] = [];

    const promise = runFfmpeg({
      ffmpegPath: '/usr/bin/ffmpeg',
      args: ['-progress', 'pipe:1'],
      spawnImpl,
      onProgress: (update: FfmpegProgress) => updates.push(update)
    });

    child.stdout.emit(
      'data',
      Buffer.from('frame=1\nout_time=00:00:01.000000\nprogress=continue\n')
    );
    child.stdout.emit('data', Buffer.from('frame=2\nout_time=00:00:02.000000\nprogress=end\n'));
    child.stderr.emit('data', Buffer.from('encoding...\n'));
    child.emit('close', 0);

    await expect(promise).resolves.toEqual(
      expect.objectContaining({
        stderr: 'encoding...\n'
      })
    );
    expect(spawnImpl).toHaveBeenCalledWith('/usr/bin/ffmpeg', ['-progress', 'pipe:1'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    expect(updates).toHaveLength(2);
    expect(updates[0]).toEqual(expect.objectContaining({ status: 'continue', outTimeSec: 1 }));
    expect(updates[1]).toEqual(expect.objectContaining({ status: 'end', outTimeSec: 2 }));
  });

  test('runFfmpeg kills the child and rejects with FfmpegAbortError when signal aborts mid-run', async () => {
    const child = createFakeChildProcess();
    const spawnImpl = vi.fn(() => child) as unknown as typeof import('node:child_process').spawn;
    const controller = new AbortController();

    const promise = runFfmpeg({
      ffmpegPath: '/usr/bin/ffmpeg',
      args: [],
      spawnImpl,
      signal: controller.signal
    });

    controller.abort();
    expect(child.killed).toBe(true);
    expect(child.signalCode).toBe('SIGINT');
    // Simulate the child actually exiting in response to SIGINT.
    child.emit('close', 130);

    await expect(promise).rejects.toBeInstanceOf(FfmpegAbortError);
  });

  test('runFfmpeg rejects immediately if signal is already aborted', async () => {
    const spawnImpl = vi.fn(() =>
      createFakeChildProcess()
    ) as unknown as typeof import('node:child_process').spawn;
    const controller = new AbortController();
    controller.abort();

    await expect(
      runFfmpeg({ ffmpegPath: '/usr/bin/ffmpeg', args: [], spawnImpl, signal: controller.signal })
    ).rejects.toBeInstanceOf(FfmpegAbortError);
    expect(spawnImpl).not.toHaveBeenCalled();
  });

  test('runFfmpeg rejects with stderr output when ffmpeg exits non-zero', async () => {
    const child = createFakeChildProcess();
    const spawnImpl = vi.fn(() => child) as unknown as typeof import('node:child_process').spawn;

    const promise = runFfmpeg({
      ffmpegPath: '/usr/bin/ffmpeg',
      args: ['-progress', 'pipe:1'],
      spawnImpl
    });

    child.stderr.emit('data', Buffer.from('ffmpeg failed badly'));
    child.emit('close', 1);

    await expect(promise).rejects.toThrow(/ffmpeg failed badly/);
  });
});
