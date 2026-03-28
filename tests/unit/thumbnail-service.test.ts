import { captureThumbnail } from '../../src/main/services/thumbnail-service.js';

import type { Keyframe, Overlay } from '../../src/shared/types/domain.js';
import type { ThumbnailCaptureOptions, ThumbnailCaptureDeps } from '../../src/shared/types/services.js';

// ── Helpers ──────────────────────────────────────────────────────────

function makeKeyframe(overrides: Partial<Keyframe> = {}): Keyframe {
  return {
    time: 0,
    pipX: 100,
    pipY: 50,
    pipVisible: false,
    cameraFullscreen: false,
    backgroundZoom: 1,
    backgroundPanX: 0,
    backgroundPanY: 0,
    reelCropX: 0,
    pipScale: 0.22,
    pipSnapPoint: 'br',
    autoTrack: false,
    autoTrackSmoothing: 0.5,
    sectionId: null,
    autoSection: false,
    savedLandscape: null,
    savedReel: null,
    ...overrides
  };
}

function makeOverlay(overrides: Partial<Overlay> = {}): Overlay {
  return {
    id: 'ovl-1',
    trackIndex: 0,
    mediaPath: 'overlays/image.png',
    mediaType: 'image',
    startTime: 0,
    endTime: 0.1,
    sourceStart: 0,
    sourceEnd: 0.1,
    landscape: { x: 100, y: 100, width: 400, height: 300 },
    reel: { x: 50, y: 50, width: 200, height: 150 },
    saved: false,
    ...overrides
  };
}

function makeBaseDeps(): ThumbnailCaptureDeps {
  return {
    runFfmpeg: async () => ({ stderr: '' }),
    ffmpegPath: '/usr/bin/ffmpeg',
    now: () => 1711700000000
  };
}

function makeBaseOpts(overrides: Partial<ThumbnailCaptureOptions> = {}): ThumbnailCaptureOptions {
  return {
    takes: [{ id: 'take-1', screenPath: '/project/screen.webm', cameraPath: '/project/camera.webm' }],
    keyframes: [makeKeyframe()],
    overlays: [],
    sourceTime: 5.0,
    cameraSyncOffsetMs: 0,
    sourceWidth: 1920,
    sourceHeight: 1080,
    outputMode: 'landscape',
    screenFitMode: 'fill',
    pipSize: 422,
    projectFolder: '/project',
    ...overrides
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('main/services/thumbnail-service', () => {
  // 3.1 Landscape-only capture
  describe('landscape capture (no camera, no overlays)', () => {
    test('produces correct FFmpeg args with -frames:v 1', async () => {
      let capturedArgs: string[] = [];
      const deps = makeBaseDeps();
      deps.runFfmpeg = async (opts) => {
        capturedArgs = opts.args;
        return { stderr: '' };
      };

      await captureThumbnail(makeBaseOpts(), deps);

      expect(capturedArgs).toContain('-frames:v');
      expect(capturedArgs[capturedArgs.indexOf('-frames:v') + 1]).toBe('1');
      expect(capturedArgs).toContain('-update');
      expect(capturedArgs[capturedArgs.indexOf('-update') + 1]).toBe('1');
    });

    test('output path follows thumbnail-{timestamp}-landscape.png pattern', async () => {
      const deps = makeBaseDeps();
      const result = await captureThumbnail(makeBaseOpts(), deps);

      expect(result).toBe('/project/thumbnail-1711700000000-landscape.png');
    });

    test('includes -filter_complex with screen filter', async () => {
      let capturedArgs: string[] = [];
      const deps = makeBaseDeps();
      deps.runFfmpeg = async (opts) => {
        capturedArgs = opts.args;
        return { stderr: '' };
      };

      await captureThumbnail(makeBaseOpts(), deps);

      expect(capturedArgs).toContain('-filter_complex');
      const filterIdx = capturedArgs.indexOf('-filter_complex');
      const filterGraph = capturedArgs[filterIdx + 1]!;
      expect(filterGraph).toContain('[out]');
    });

    test('seeks to correct source time', async () => {
      let capturedArgs: string[] = [];
      const deps = makeBaseDeps();
      deps.runFfmpeg = async (opts) => {
        capturedArgs = opts.args;
        return { stderr: '' };
      };

      await captureThumbnail(makeBaseOpts({ sourceTime: 7.5 }), deps);

      const ssIdx = capturedArgs.indexOf('-ss');
      expect(ssIdx).toBeGreaterThanOrEqual(0);
      expect(capturedArgs[ssIdx + 1]).toBe('7.500');
    });

    test('does not include camera input when keyframe has pipVisible=false', async () => {
      let capturedArgs: string[] = [];
      const deps = makeBaseDeps();
      deps.runFfmpeg = async (opts) => {
        capturedArgs = opts.args;
        return { stderr: '' };
      };

      await captureThumbnail(makeBaseOpts(), deps);

      // Count -i flags — should be exactly 1 (screen only)
      const iCount = capturedArgs.filter(a => a === '-i').length;
      expect(iCount).toBe(1);
    });

    test('maps [out] for final output', async () => {
      let capturedArgs: string[] = [];
      const deps = makeBaseDeps();
      deps.runFfmpeg = async (opts) => {
        capturedArgs = opts.args;
        return { stderr: '' };
      };

      await captureThumbnail(makeBaseOpts(), deps);

      const mapIdx = capturedArgs.indexOf('-map');
      expect(capturedArgs[mapIdx + 1]).toBe('[out]');
    });

    test('output file ends with .png', async () => {
      const deps = makeBaseDeps();
      const result = await captureThumbnail(makeBaseOpts(), deps);
      expect(result).toMatch(/\.png$/);
    });
  });

  // 3.2 Camera PIP capture
  describe('camera PIP capture', () => {
    test('includes camera input when pipVisible is true', async () => {
      let capturedArgs: string[] = [];
      const deps = makeBaseDeps();
      deps.runFfmpeg = async (opts) => {
        capturedArgs = opts.args;
        return { stderr: '' };
      };

      const opts = makeBaseOpts({
        keyframes: [makeKeyframe({ pipVisible: true })]
      });
      await captureThumbnail(opts, deps);

      const iCount = capturedArgs.filter(a => a === '-i').length;
      expect(iCount).toBe(2);
      expect(capturedArgs).toContain('/project/camera.webm');
    });

    test('includes camera input when cameraFullscreen is true', async () => {
      let capturedArgs: string[] = [];
      const deps = makeBaseDeps();
      deps.runFfmpeg = async (opts) => {
        capturedArgs = opts.args;
        return { stderr: '' };
      };

      const opts = makeBaseOpts({
        keyframes: [makeKeyframe({ cameraFullscreen: true, pipVisible: true })]
      });
      await captureThumbnail(opts, deps);

      const iCount = capturedArgs.filter(a => a === '-i').length;
      expect(iCount).toBe(2);
    });

    test('uses buildFilterComplex filter graph with PIP overlay', async () => {
      let capturedArgs: string[] = [];
      const deps = makeBaseDeps();
      deps.runFfmpeg = async (opts) => {
        capturedArgs = opts.args;
        return { stderr: '' };
      };

      const opts = makeBaseOpts({
        keyframes: [makeKeyframe({ pipVisible: true })]
      });
      await captureThumbnail(opts, deps);

      const filterIdx = capturedArgs.indexOf('-filter_complex');
      const filterGraph = capturedArgs[filterIdx + 1]!;
      // buildFilterComplex produces overlay filter with [cam]
      expect(filterGraph).toContain('[cam]');
      expect(filterGraph).toContain('[out]');
    });
  });

  // 3.3 Camera hidden
  describe('camera hidden', () => {
    test('no camera input when pipVisible=false and cameraFullscreen=false', async () => {
      let capturedArgs: string[] = [];
      const deps = makeBaseDeps();
      deps.runFfmpeg = async (opts) => {
        capturedArgs = opts.args;
        return { stderr: '' };
      };

      const opts = makeBaseOpts({
        keyframes: [makeKeyframe({ pipVisible: false, cameraFullscreen: false })]
      });
      await captureThumbnail(opts, deps);

      const iCount = capturedArgs.filter(a => a === '-i').length;
      expect(iCount).toBe(1);
      expect(capturedArgs).not.toContain('/project/camera.webm');
    });
  });

  // 3.4 Camera sync offset
  describe('camera sync offset', () => {
    test('camera seek time = screenSourceTime + cameraSyncOffsetMs/1000', async () => {
      let capturedArgs: string[] = [];
      const deps = makeBaseDeps();
      deps.runFfmpeg = async (opts) => {
        capturedArgs = opts.args;
        return { stderr: '' };
      };

      const opts = makeBaseOpts({
        sourceTime: 5.0,
        cameraSyncOffsetMs: 200,
        keyframes: [makeKeyframe({ pipVisible: true })]
      });
      await captureThumbnail(opts, deps);

      // First -ss is screen (5.0), second -ss is camera (5.2)
      const ssIndices: number[] = [];
      capturedArgs.forEach((a, i) => { if (a === '-ss') ssIndices.push(i); });
      expect(ssIndices).toHaveLength(2);
      expect(capturedArgs[ssIndices[0]! + 1]).toBe('5.000');
      expect(capturedArgs[ssIndices[1]! + 1]).toBe('5.200');
    });

    test('negative offset clamps camera seek to 0', async () => {
      let capturedArgs: string[] = [];
      const deps = makeBaseDeps();
      deps.runFfmpeg = async (opts) => {
        capturedArgs = opts.args;
        return { stderr: '' };
      };

      const opts = makeBaseOpts({
        sourceTime: 0.1,
        cameraSyncOffsetMs: -300,
        keyframes: [makeKeyframe({ pipVisible: true })]
      });
      await captureThumbnail(opts, deps);

      const ssIndices: number[] = [];
      capturedArgs.forEach((a, i) => { if (a === '-ss') ssIndices.push(i); });
      expect(ssIndices).toHaveLength(2);
      expect(capturedArgs[ssIndices[1]! + 1]).toBe('0.000');
    });

    test('zero offset gives same seek time as screen', async () => {
      let capturedArgs: string[] = [];
      const deps = makeBaseDeps();
      deps.runFfmpeg = async (opts) => {
        capturedArgs = opts.args;
        return { stderr: '' };
      };

      const opts = makeBaseOpts({
        sourceTime: 5.0,
        cameraSyncOffsetMs: 0,
        keyframes: [makeKeyframe({ pipVisible: true })]
      });
      await captureThumbnail(opts, deps);

      const ssIndices: number[] = [];
      capturedArgs.forEach((a, i) => { if (a === '-ss') ssIndices.push(i); });
      expect(ssIndices).toHaveLength(2);
      expect(capturedArgs[ssIndices[0]! + 1]).toBe('5.000');
      expect(capturedArgs[ssIndices[1]! + 1]).toBe('5.000');
    });
  });

  // 3.5 Reel mode
  describe('reel mode', () => {
    test('output path includes reel in filename', async () => {
      const deps = makeBaseDeps();
      const result = await captureThumbnail(
        makeBaseOpts({ outputMode: 'reel' }),
        deps
      );

      expect(result).toBe('/project/thumbnail-1711700000000-reel.png');
    });

    test('filter graph uses reel-mode parameters', async () => {
      let capturedArgs: string[] = [];
      const deps = makeBaseDeps();
      deps.runFfmpeg = async (opts) => {
        capturedArgs = opts.args;
        return { stderr: '' };
      };

      await captureThumbnail(
        makeBaseOpts({ outputMode: 'reel' }),
        deps
      );

      const filterIdx = capturedArgs.indexOf('-filter_complex');
      const filterGraph = capturedArgs[filterIdx + 1]!;
      // Reel mode should include a crop filter for 9:16 aspect
      expect(filterGraph).toContain('crop=');
    });
  });

  // 3.6 Overlay inclusion
  describe('overlay inclusion', () => {
    test('image overlay produces -loop 1 -t input', async () => {
      let capturedArgs: string[] = [];
      const deps = makeBaseDeps();
      deps.runFfmpeg = async (opts) => {
        capturedArgs = opts.args;
        return { stderr: '' };
      };

      const overlay = makeOverlay({ mediaType: 'image', mediaPath: 'overlays/img.png' });
      await captureThumbnail(
        makeBaseOpts({ overlays: [overlay] }),
        deps
      );

      expect(capturedArgs).toContain('-loop');
      const loopIdx = capturedArgs.indexOf('-loop');
      expect(capturedArgs[loopIdx + 1]).toBe('1');
      expect(capturedArgs[loopIdx + 2]).toBe('-t');
    });

    test('overlay filter parts included in filter graph', async () => {
      let capturedArgs: string[] = [];
      const deps = makeBaseDeps();
      deps.runFfmpeg = async (opts) => {
        capturedArgs = opts.args;
        return { stderr: '' };
      };

      const overlay = makeOverlay();
      await captureThumbnail(
        makeBaseOpts({ overlays: [overlay] }),
        deps
      );

      const filterIdx = capturedArgs.indexOf('-filter_complex');
      const filterGraph = capturedArgs[filterIdx + 1]!;
      expect(filterGraph).toContain('overlay=');
      expect(filterGraph).toContain('[out]');
    });

    test('overlay media path resolved relative to project folder', async () => {
      let capturedArgs: string[] = [];
      const deps = makeBaseDeps();
      deps.runFfmpeg = async (opts) => {
        capturedArgs = opts.args;
        return { stderr: '' };
      };

      const overlay = makeOverlay({ mediaPath: 'overlays/test.png' });
      await captureThumbnail(
        makeBaseOpts({ overlays: [overlay] }),
        deps
      );

      expect(capturedArgs).toContain('/project/overlays/test.png');
    });

    test('video overlay uses standard -i input', async () => {
      let capturedArgs: string[] = [];
      const deps = makeBaseDeps();
      deps.runFfmpeg = async (opts) => {
        capturedArgs = opts.args;
        return { stderr: '' };
      };

      const overlay = makeOverlay({
        mediaType: 'video',
        mediaPath: 'overlays/clip.mp4',
        sourceStart: 2.0,
        sourceEnd: 2.1
      });
      await captureThumbnail(
        makeBaseOpts({ overlays: [overlay] }),
        deps
      );

      // Video overlays use plain -i (not -loop)
      expect(capturedArgs).toContain('/project/overlays/clip.mp4');
      // The filter should include trim for video overlays
      const filterIdx = capturedArgs.indexOf('-filter_complex');
      const filterGraph = capturedArgs[filterIdx + 1]!;
      expect(filterGraph).toContain('trim=');
    });
  });

  // 3.7 Output path
  describe('output path', () => {
    test('filename matches thumbnail-{timestamp}-{mode}.png', async () => {
      const deps = makeBaseDeps();
      deps.now = () => 9999999999999;

      const result = await captureThumbnail(makeBaseOpts(), deps);
      expect(result).toBe('/project/thumbnail-9999999999999-landscape.png');
    });

    test('file placed in projectFolder', async () => {
      const deps = makeBaseDeps();
      const result = await captureThumbnail(
        makeBaseOpts({ projectFolder: '/path/to/my-project' }),
        deps
      );

      expect(result).toMatch(/^\/path\/to\/my-project\//);
    });

    test('reel mode uses reel suffix', async () => {
      const deps = makeBaseDeps();
      const result = await captureThumbnail(
        makeBaseOpts({ outputMode: 'reel' }),
        deps
      );

      expect(result).toContain('-reel.png');
    });
  });

  // Validation
  describe('validation', () => {
    test('throws for missing project folder', async () => {
      await expect(
        captureThumbnail({ projectFolder: '' }, makeBaseDeps())
      ).rejects.toThrow(/Missing project folder/);
    });

    test('throws for no take with screen path', async () => {
      await expect(
        captureThumbnail(
          makeBaseOpts({ takes: [{ id: 'take-1', screenPath: null }] }),
          makeBaseDeps()
        )
      ).rejects.toThrow(/No take with screen path/);
    });

    test('throws for missing ffmpeg', async () => {
      await expect(
        captureThumbnail(
          makeBaseOpts(),
          { ...makeBaseDeps(), ffmpegPath: '' }
        )
      ).rejects.toThrow(/ffmpeg-static is unavailable/);
    });

    test('propagates FFmpeg errors', async () => {
      const deps = makeBaseDeps();
      deps.runFfmpeg = async () => { throw new Error('ffmpeg crashed'); };

      await expect(
        captureThumbnail(makeBaseOpts(), deps)
      ).rejects.toThrow(/ffmpeg crashed/);
    });
  });
});
