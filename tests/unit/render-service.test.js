const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  normalizeSectionInput,
  assertFilePath,
  renderComposite
} = require('../../src/main/services/render-service');

describe('main/services/render-service', () => {
  test('normalizeSectionInput filters invalid sections', () => {
    const sections = normalizeSectionInput([
      { takeId: 'a', sourceStart: 0, sourceEnd: 1, backgroundZoom: 1.75, backgroundPanX: 0.5, backgroundPanY: -0.3 },
      { takeId: 'b', sourceStart: 2, sourceEnd: 1 },
      { takeId: 'c', sourceStart: 'x', sourceEnd: 3 },
      { takeId: 'd', sourceStart: 0, sourceEnd: 2, backgroundZoom: 10, backgroundPanX: -9, backgroundPanY: 8 }
    ]);

    expect(sections).toHaveLength(2);
    expect(sections[0].takeId).toBe('a');
    expect(sections[0].backgroundZoom).toBe(1.75);
    expect(sections[0].backgroundPanX).toBe(0.5);
    expect(sections[0].backgroundPanY).toBe(-0.3);
    expect(sections[1].backgroundZoom).toBe(3);
    expect(sections[1].backgroundPanX).toBe(-1);
    expect(sections[1].backgroundPanY).toBe(1);
  });

  test('normalizeSectionInput normalizes reelCropX on sections', () => {
    const sections = normalizeSectionInput([
      { takeId: 'a', sourceStart: 0, sourceEnd: 1, reelCropX: 0.5 },
      { takeId: 'b', sourceStart: 1, sourceEnd: 2, reelCropX: -3 },
      { takeId: 'c', sourceStart: 2, sourceEnd: 3 }
    ]);

    expect(sections).toHaveLength(3);
    expect(sections[0].reelCropX).toBe(0.5);
    expect(sections[1].reelCropX).toBe(-1);
    expect(sections[2].reelCropX).toBe(0);
  });

  test('assertFilePath throws for missing files and accepts existing file', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-render-test-'));
    const file = path.join(tmpDir, 'input.webm');
    fs.writeFileSync(file, 'x', 'utf8');

    expect(() => assertFilePath(file, 'Screen')).not.toThrow();
    expect(() => assertFilePath(path.join(tmpDir, 'missing.webm'), 'Screen')).toThrow(
      /Screen file not found/
    );
  });

  test('renderComposite validates required output and sections', async () => {
    await expect(renderComposite({ outputFolder: '', sections: [] })).rejects.toThrow(
      /Missing output folder/
    );
    await expect(renderComposite({ outputFolder: '/tmp', sections: [] })).rejects.toThrow(
      /No sections to render/
    );
  });

  test('renderComposite rejects unknown takes', async () => {
    await expect(
      renderComposite(
        {
          outputFolder: '/tmp',
          takes: [],
          sections: [{ takeId: 'missing', sourceStart: 0, sourceEnd: 1 }],
          keyframes: []
        },
        {
          ffmpegPath: '/usr/bin/ffmpeg',
          probeVideoFpsWithFfmpeg: async () => 30,
          runFfmpeg: async () => {}
        }
      )
    ).rejects.toThrow(/Take missing not found/);
  });

  test('renderComposite builds ffmpeg args and resolves output path', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-render-run-'));
    const outputDir = path.join(tmpDir, 'out');
    const screenPath = path.join(tmpDir, 'screen.webm');
    fs.writeFileSync(screenPath, 'screen', 'utf8');

    const execCalls = [];
    const output = await renderComposite(
      {
        outputFolder: outputDir,
        takes: [{ id: 'take-1', screenPath, cameraPath: null }],
        sections: [{ takeId: 'take-1', sourceStart: 0, sourceEnd: 1.25 }],
        keyframes: [{ time: 0, pipX: 10, pipY: 10, pipVisible: false, cameraFullscreen: false }],
        pipSize: 300,
        sourceWidth: 1920,
        sourceHeight: 1080,
        screenFitMode: 'fill'
      },
      {
        ffmpegPath: '/usr/bin/ffmpeg',
        now: () => 123,
        probeVideoFpsWithFfmpeg: async () => 29.97,
        runFfmpeg: async ({ ffmpegPath, args }) => {
          execCalls.push({ bin: ffmpegPath, args });
        }
      }
    );

    expect(output).toBe(path.join(outputDir, 'recording-123-edited.mp4'));
    expect(execCalls).toHaveLength(1);
    expect(execCalls[0].bin).toBe('/usr/bin/ffmpeg');
    expect(execCalls[0].args.join(' ')).toContain('-filter_complex');
    expect(execCalls[0].args.join(' ')).toContain('[audio_out]acompressor=');
    expect(execCalls[0].args.join(' ')).toContain('-map [audio_final]');
    expect(execCalls[0].args).toEqual(
      expect.arrayContaining([
        '-progress',
        'pipe:1',
        '-nostats',
        '-c:v',
        'libx264',
        '-crf',
        '12',
        '-preset',
        'slow',
        '-c:a',
        'aac',
        '-b:a',
        '192k'
      ])
    );
  });

  test('renderComposite keeps default audio mapping when export audio preset is off', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-render-audio-off-'));
    const outputDir = path.join(tmpDir, 'out');
    const screenPath = path.join(tmpDir, 'screen.webm');
    fs.writeFileSync(screenPath, 'screen', 'utf8');

    const execCalls = [];
    await renderComposite(
      {
        outputFolder: outputDir,
        takes: [{ id: 'take-1', screenPath, cameraPath: null }],
        sections: [{ takeId: 'take-1', sourceStart: 0, sourceEnd: 1.25 }],
        keyframes: [{ time: 0, pipX: 10, pipY: 10, pipVisible: false, cameraFullscreen: false }],
        pipSize: 300,
        sourceWidth: 1920,
        sourceHeight: 1080,
        screenFitMode: 'fill',
        exportAudioPreset: 'off'
      },
      {
        ffmpegPath: '/usr/bin/ffmpeg',
        now: () => 321,
        probeVideoFpsWithFfmpeg: async () => 30,
        runFfmpeg: async ({ ffmpegPath, args }) => {
          execCalls.push({ bin: ffmpegPath, args });
        }
      }
    );

    const argString = execCalls[0].args.join(' ');
    expect(argString).toContain('[screen_raw][audio_out]');
    expect(argString).toContain('-map [audio_out]');
    expect(argString).not.toContain('acompressor=');
    expect(argString).not.toContain('[audio_final]');
  });

  test('renderComposite applies compressor filter when export audio preset is compressed', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-render-audio-compressed-'));
    const outputDir = path.join(tmpDir, 'out');
    const screenPath = path.join(tmpDir, 'screen.webm');
    fs.writeFileSync(screenPath, 'screen', 'utf8');

    const execCalls = [];
    await renderComposite(
      {
        outputFolder: outputDir,
        takes: [{ id: 'take-1', screenPath, cameraPath: null }],
        sections: [{ takeId: 'take-1', sourceStart: 0, sourceEnd: 1.25 }],
        keyframes: [{ time: 0, pipX: 10, pipY: 10, pipVisible: false, cameraFullscreen: false }],
        pipSize: 300,
        sourceWidth: 1920,
        sourceHeight: 1080,
        screenFitMode: 'fill',
        exportAudioPreset: 'compressed'
      },
      {
        ffmpegPath: '/usr/bin/ffmpeg',
        now: () => 654,
        probeVideoFpsWithFfmpeg: async () => 30,
        runFfmpeg: async ({ ffmpegPath, args }) => {
          execCalls.push({ bin: ffmpegPath, args });
        }
      }
    );

    const argString = execCalls[0].args.join(' ');
    expect(argString).toContain('[audio_out]acompressor=');
    expect(argString).toContain('[audio_final]');
    expect(argString).toContain('-map [audio_final]');
  });

  test('renderComposite applies section zoom to background only', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-render-zoom-'));
    const outputDir = path.join(tmpDir, 'out');
    const screenPath = path.join(tmpDir, 'screen.webm');
    const cameraPath = path.join(tmpDir, 'camera.webm');
    fs.writeFileSync(screenPath, 'screen', 'utf8');
    fs.writeFileSync(cameraPath, 'camera', 'utf8');

    const execCalls = [];
    await renderComposite(
      {
        outputFolder: outputDir,
        takes: [{ id: 'take-1', screenPath, cameraPath }],
        sections: [{ takeId: 'take-1', sourceStart: 0, sourceEnd: 1.0, backgroundZoom: 2 }],
        keyframes: [{ time: 0, pipX: 10, pipY: 10, pipVisible: true, cameraFullscreen: false, backgroundZoom: 2, backgroundPanX: 0, backgroundPanY: 0 }],
        pipSize: 300,
        sourceWidth: 1920,
        sourceHeight: 1080,
        screenFitMode: 'fill'
      },
      {
        ffmpegPath: '/usr/bin/ffmpeg',
        now: () => 456,
        probeVideoFpsWithFfmpeg: async () => 30,
        runFfmpeg: async ({ ffmpegPath, args }) => {
          execCalls.push({ bin: ffmpegPath, args });
        }
      }
    );

    const argString = execCalls[0].args.join(' ');
    // Static zoom (single keyframe) uses crop+scale, not zoompan
    expect(argString).toContain('[screen_base]');
    expect(argString).toContain('crop=');
    expect(argString).toContain('[1:v]trim=start=0.000:end=1.000,setpts=PTS-STARTPTS,fps=fps=30[cv0]');
    expect(argString).not.toContain('zoompan');
  });

  test('renderComposite advances camera video when camera sync offset is positive', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-render-camera-sync-'));
    const outputDir = path.join(tmpDir, 'out');
    const screenPath = path.join(tmpDir, 'screen.webm');
    const cameraPath = path.join(tmpDir, 'camera.webm');
    fs.writeFileSync(screenPath, 'screen', 'utf8');
    fs.writeFileSync(cameraPath, 'camera', 'utf8');

    const execCalls = [];
    await renderComposite(
      {
        outputFolder: outputDir,
        takes: [{ id: 'take-1', screenPath, cameraPath }],
        sections: [{ takeId: 'take-1', sourceStart: 0, sourceEnd: 1.0 }],
        keyframes: [{ time: 0, pipX: 10, pipY: 10, pipVisible: true, cameraFullscreen: false }],
        pipSize: 300,
        sourceWidth: 1920,
        sourceHeight: 1080,
        screenFitMode: 'fill',
        cameraSyncOffsetMs: 120
      },
      {
        ffmpegPath: '/usr/bin/ffmpeg',
        now: () => 147,
        probeVideoFpsWithFfmpeg: async () => 30,
        runFfmpeg: async ({ ffmpegPath, args }) => {
          execCalls.push({ bin: ffmpegPath, args });
        }
      }
    );

    const argString = execCalls[0].args.join(' ');
    expect(argString).toContain('[1:v]trim=start=0.120:end=1.120,setpts=PTS-STARTPTS,tpad=start_mode=clone:start_duration=0.000:stop_mode=clone:stop_duration=0.120,trim=duration=1.000,setpts=PTS-STARTPTS,fps=fps=30[cv0]');
  });

  test('renderComposite applies clamped section pan to background crop', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-render-pan-'));
    const outputDir = path.join(tmpDir, 'out');
    const screenPath = path.join(tmpDir, 'screen.webm');
    fs.writeFileSync(screenPath, 'screen', 'utf8');

    const execCalls = [];
    await renderComposite(
      {
        outputFolder: outputDir,
        takes: [{ id: 'take-1', screenPath, cameraPath: null }],
        sections: [
          {
            takeId: 'take-1',
            sourceStart: 0,
            sourceEnd: 1.0,
            backgroundZoom: 2,
            backgroundPanX: 1,
            backgroundPanY: -1
          }
        ],
        keyframes: [{ time: 0, pipX: 10, pipY: 10, pipVisible: false, cameraFullscreen: false, backgroundZoom: 2, backgroundPanX: 1, backgroundPanY: -1 }],
        pipSize: 300,
        sourceWidth: 1920,
        sourceHeight: 1080,
        screenFitMode: 'fill'
      },
      {
        ffmpegPath: '/usr/bin/ffmpeg',
        now: () => 789,
        probeVideoFpsWithFfmpeg: async () => 30,
        runFfmpeg: async ({ ffmpegPath, args }) => {
          execCalls.push({ bin: ffmpegPath, args });
        }
      }
    );

    const argString = execCalls[0].args.join(' ');
    // Static zoom+pan (single keyframe) uses crop+scale with computed focus position
    expect(argString).toContain('crop=');
    expect(argString).toContain('scale=');
    expect(argString).not.toContain('zoompan');
  });

  test('renderComposite animates background zoom and pan through section boundaries', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-render-animated-bg-'));
    const outputDir = path.join(tmpDir, 'out');
    const screenPath = path.join(tmpDir, 'screen.webm');
    fs.writeFileSync(screenPath, 'screen', 'utf8');

    const execCalls = [];
    await renderComposite(
      {
        outputFolder: outputDir,
        takes: [{ id: 'take-1', screenPath, cameraPath: null }],
        sections: [
          { takeId: 'take-1', sourceStart: 0, sourceEnd: 1.0, backgroundZoom: 1, backgroundPanX: 0, backgroundPanY: 0 },
          { takeId: 'take-1', sourceStart: 1.0, sourceEnd: 2.0, backgroundZoom: 2, backgroundPanX: 1, backgroundPanY: -1 }
        ],
        keyframes: [
          { time: 0, pipX: 10, pipY: 10, pipVisible: false, cameraFullscreen: false, backgroundZoom: 1, backgroundPanX: 0, backgroundPanY: 0 },
          { time: 1, pipX: 10, pipY: 10, pipVisible: false, cameraFullscreen: false, backgroundZoom: 2, backgroundPanX: 1, backgroundPanY: -1 }
        ],
        pipSize: 300,
        sourceWidth: 1920,
        sourceHeight: 1080,
        screenFitMode: 'fill'
      },
      {
        ffmpegPath: '/usr/bin/ffmpeg',
        now: () => 999,
        probeVideoFpsWithFfmpeg: async () => 30,
        runFfmpeg: async ({ ffmpegPath, args }) => {
          execCalls.push({ bin: ffmpegPath, args });
        }
      }
    );

    const argString = execCalls[0].args.join(' ');
    expect(argString).toContain('if(gte(it,1.000),2.000');
    expect(argString).toContain('if(gte(it,0.700),1.000+1.000*(it-0.700)/0.300');
  });

  test('renderComposite reuses ffmpeg inputs for repeated sections from the same take', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-render-dedupe-'));
    const outputDir = path.join(tmpDir, 'out');
    const screenPath = path.join(tmpDir, 'screen.webm');
    const cameraPath = path.join(tmpDir, 'camera.webm');
    fs.writeFileSync(screenPath, 'screen', 'utf8');
    fs.writeFileSync(cameraPath, 'camera', 'utf8');

    const execCalls = [];
    await renderComposite(
      {
        outputFolder: outputDir,
        takes: [{ id: 'take-1', screenPath, cameraPath }],
        sections: [
          { takeId: 'take-1', sourceStart: 0, sourceEnd: 1.0 },
          { takeId: 'take-1', sourceStart: 1.0, sourceEnd: 2.0 }
        ],
        keyframes: [{ time: 0, pipX: 10, pipY: 10, pipVisible: true, cameraFullscreen: false }],
        pipSize: 300,
        sourceWidth: 1920,
        sourceHeight: 1080,
        screenFitMode: 'fill'
      },
      {
        ffmpegPath: '/usr/bin/ffmpeg',
        now: () => 222,
        probeVideoFpsWithFfmpeg: async () => 30,
        runFfmpeg: async ({ ffmpegPath, args }) => {
          execCalls.push({ bin: ffmpegPath, args });
        }
      }
    );

    const args = execCalls[0].args;
    expect(args.filter((value) => value === '-i')).toHaveLength(2);
    expect(args.filter((value) => value === screenPath)).toHaveLength(1);
    expect(args.filter((value) => value === cameraPath)).toHaveLength(1);

    const argString = args.join(' ');
    expect(argString).toContain('[0:v]trim=start=0.000:end=1.000,setpts=PTS-STARTPTS,fps=fps=30,setsar=1[sv0]');
    expect(argString).toContain('[0:v]trim=start=1.000:end=2.000,setpts=PTS-STARTPTS,fps=fps=30,setsar=1[sv1]');
    expect(argString).toContain('[1:v]trim=start=0.000:end=1.000,setpts=PTS-STARTPTS,fps=fps=30[cv0]');
    expect(argString).toContain('[1:v]trim=start=1.000:end=2.000,setpts=PTS-STARTPTS,fps=fps=30[cv1]');
  });

  test('renderComposite keeps reused input indexes stable across mixed take ordering', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-render-mixed-dedupe-'));
    const outputDir = path.join(tmpDir, 'out');
    const screenA = path.join(tmpDir, 'screen-a.webm');
    const cameraA = path.join(tmpDir, 'camera-a.webm');
    const screenB = path.join(tmpDir, 'screen-b.webm');
    const cameraB = path.join(tmpDir, 'camera-b.webm');
    fs.writeFileSync(screenA, 'screen-a', 'utf8');
    fs.writeFileSync(cameraA, 'camera-a', 'utf8');
    fs.writeFileSync(screenB, 'screen-b', 'utf8');
    fs.writeFileSync(cameraB, 'camera-b', 'utf8');

    const execCalls = [];
    await renderComposite(
      {
        outputFolder: outputDir,
        takes: [
          { id: 'take-a', screenPath: screenA, cameraPath: cameraA },
          { id: 'take-b', screenPath: screenB, cameraPath: cameraB }
        ],
        sections: [
          { takeId: 'take-a', sourceStart: 0, sourceEnd: 1.0 },
          { takeId: 'take-b', sourceStart: 1.0, sourceEnd: 2.0 },
          { takeId: 'take-a', sourceStart: 2.0, sourceEnd: 3.0 }
        ],
        keyframes: [{ time: 0, pipX: 10, pipY: 10, pipVisible: true, cameraFullscreen: false }],
        pipSize: 300,
        sourceWidth: 1920,
        sourceHeight: 1080,
        screenFitMode: 'fill'
      },
      {
        ffmpegPath: '/usr/bin/ffmpeg',
        now: () => 333,
        probeVideoFpsWithFfmpeg: async () => 30,
        runFfmpeg: async ({ ffmpegPath, args }) => {
          execCalls.push({ bin: ffmpegPath, args });
        }
      }
    );

    const argString = execCalls[0].args.join(' ');
    expect(execCalls[0].args.filter((value) => value === '-i')).toHaveLength(4);
    expect(argString).toContain('[0:v]trim=start=0.000:end=1.000,setpts=PTS-STARTPTS,fps=fps=30,setsar=1[sv0]');
    expect(argString).toContain('[2:v]trim=start=1.000:end=2.000,setpts=PTS-STARTPTS,fps=fps=30,setsar=1[sv1]');
    expect(argString).toContain('[0:v]trim=start=2.000:end=3.000,setpts=PTS-STARTPTS,fps=fps=30,setsar=1[sv2]');
    expect(argString).toContain('[1:v]trim=start=0.000:end=1.000,setpts=PTS-STARTPTS,fps=fps=30[cv0]');
    expect(argString).toContain('[3:v]trim=start=1.000:end=2.000,setpts=PTS-STARTPTS,fps=fps=30[cv1]');
    expect(argString).toContain('[1:v]trim=start=2.000:end=3.000,setpts=PTS-STARTPTS,fps=fps=30[cv2]');
  });

  test('renderComposite produces reel crop filter when outputMode is reel', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-render-reel-'));
    const outputDir = path.join(tmpDir, 'out');
    const screenPath = path.join(tmpDir, 'screen.webm');
    fs.writeFileSync(screenPath, 'screen', 'utf8');

    const execCalls = [];
    await renderComposite(
      {
        outputFolder: outputDir,
        takes: [{ id: 'take-1', screenPath, cameraPath: null }],
        sections: [{ takeId: 'take-1', sourceStart: 0, sourceEnd: 1.25, reelCropX: 0 }],
        keyframes: [{ time: 0, pipX: 10, pipY: 10, pipVisible: false, cameraFullscreen: false, reelCropX: 0 }],
        pipSize: 200,
        sourceWidth: 1920,
        sourceHeight: 1080,
        screenFitMode: 'fill',
        outputMode: 'reel'
      },
      {
        ffmpegPath: '/usr/bin/ffmpeg',
        now: () => 555,
        probeVideoFpsWithFfmpeg: async () => 30,
        runFfmpeg: async ({ ffmpegPath, args }) => {
          execCalls.push({ bin: ffmpegPath, args });
        }
      }
    );

    const argString = execCalls[0].args.join(' ');
    expect(argString).toContain('crop=608:1080:');
  });

  test('renderComposite forwards mapped progress updates from ffmpeg output time', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-render-progress-'));
    const outputDir = path.join(tmpDir, 'out');
    const screenPath = path.join(tmpDir, 'screen.webm');
    fs.writeFileSync(screenPath, 'screen', 'utf8');

    const updates = [];
    await renderComposite(
      {
        outputFolder: outputDir,
        takes: [{ id: 'take-1', screenPath, cameraPath: null }],
        sections: [{ takeId: 'take-1', sourceStart: 0, sourceEnd: 4.0 }],
        keyframes: [{ time: 0, pipX: 10, pipY: 10, pipVisible: false, cameraFullscreen: false }],
        pipSize: 300,
        sourceWidth: 1920,
        sourceHeight: 1080,
        screenFitMode: 'fill'
      },
      {
        ffmpegPath: '/usr/bin/ffmpeg',
        now: () => 444,
        probeVideoFpsWithFfmpeg: async () => 30,
        onProgress: (update) => updates.push(update),
        runFfmpeg: async ({ onProgress }) => {
          onProgress({ status: 'continue', outTimeSec: 2, frame: 48, speed: 1.1 });
          onProgress({ status: 'end', outTimeSec: 4, frame: 96, speed: 0.9 });
        }
      }
    );

    expect(updates[0]).toEqual(
      expect.objectContaining({
        phase: 'starting',
        percent: 0,
        status: 'Preparing render...'
      })
    );
    expect(updates[1]).toEqual(
      expect.objectContaining({
        phase: 'rendering',
        percent: 0.5,
        status: 'Rendering 50%',
        frame: 48,
        speed: 1.1
      })
    );
    expect(updates[2]).toEqual(
      expect.objectContaining({
        phase: 'finalizing',
        percent: 1,
        status: 'Finalizing export...'
      })
    );
  });

  test('renderComposite includes overlay media in filter chain', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-render-overlay-'));
    const screenPath = path.join(tmpDir, 'screen.webm');
    fs.writeFileSync(screenPath, 'screen', 'utf8');
    // Create overlay media file
    const overlayDir = path.join(tmpDir, 'overlay-media');
    fs.mkdirSync(overlayDir, { recursive: true });
    const imgPath = path.join(overlayDir, 'test.png');
    fs.writeFileSync(imgPath, 'fake-png', 'utf8');

    const execCalls = [];
    await renderComposite(
      {
        outputFolder: tmpDir,
        takes: [{ id: 'take-1', screenPath, cameraPath: null }],
        sections: [{ takeId: 'take-1', sourceStart: 0, sourceEnd: 10 }],
        keyframes: [{ time: 0, pipX: 10, pipY: 10, pipVisible: false, cameraFullscreen: false }],
        pipSize: 300,
        sourceWidth: 1920,
        sourceHeight: 1080,
        screenFitMode: 'fill',
        overlays: [{
          id: 'o1', mediaPath: 'overlay-media/test.png', mediaType: 'image',
          startTime: 2, endTime: 7, sourceStart: 0, sourceEnd: 5,
          landscape: { x: 200, y: 100, width: 400, height: 300 },
          reel: { x: 50, y: 50, width: 200, height: 150 }
        }]
      },
      {
        ffmpegPath: '/usr/bin/ffmpeg',
        now: () => 777,
        probeVideoFpsWithFfmpeg: async () => 30,
        runFfmpeg: async ({ args }) => {
          execCalls.push(args);
        }
      }
    );

    expect(execCalls).toHaveLength(1);
    const argsStr = execCalls[0].join(' ');
    // Should include overlay image input
    expect(argsStr).toContain('-loop 1');
    expect(argsStr).toContain('test.png');
    // Filter should contain overlay with enable expression
    expect(argsStr).toContain("enable='between(t,2.000,7.000)'");
    expect(argsStr).toContain('scale=400:300');
    // PIP output goes to intermediate label, then overlay chains to [out]
    // Overlay chains from [screen] to [out] (no camera in this test)
    expect(argsStr).toContain('[screen]');
    expect(argsStr).toContain('[out]');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('renderComposite includes multi-track overlay media in correct order', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-render-multitrack-'));
    const screenPath = path.join(tmpDir, 'screen.webm');
    fs.writeFileSync(screenPath, 'screen', 'utf8');
    const overlayDir = path.join(tmpDir, 'overlay-media');
    fs.mkdirSync(overlayDir, { recursive: true });
    fs.writeFileSync(path.join(overlayDir, 'a.png'), 'fake-png', 'utf8');
    fs.writeFileSync(path.join(overlayDir, 'b.png'), 'fake-png', 'utf8');

    const execCalls = [];
    await renderComposite(
      {
        outputFolder: tmpDir,
        takes: [{ id: 't1', screenPath, cameraPath: null }],
        sections: [{ takeId: 't1', sourceStart: 0, sourceEnd: 20 }],
        keyframes: [{ time: 0, pipX: 0, pipY: 0, pipVisible: false, cameraFullscreen: false }],
        pipSize: 300,
        sourceWidth: 1920,
        sourceHeight: 1080,
        screenFitMode: 'fill',
        overlays: [
          { id: 'o1', trackIndex: 0, mediaPath: 'overlay-media/a.png', mediaType: 'image',
            startTime: 2, endTime: 7, sourceStart: 0, sourceEnd: 5,
            landscape: { x: 100, y: 100, width: 400, height: 300 },
            reel: { x: 0, y: 0, width: 200, height: 150 } },
          { id: 'o2', trackIndex: 1, mediaPath: 'overlay-media/b.png', mediaType: 'image',
            startTime: 4, endTime: 9, sourceStart: 0, sourceEnd: 5,
            landscape: { x: 600, y: 200, width: 300, height: 200 },
            reel: { x: 50, y: 50, width: 150, height: 100 } }
        ]
      },
      {
        ffmpegPath: '/usr/bin/ffmpeg',
        now: () => 777,
        probeVideoFpsWithFfmpeg: async () => 30,
        runFfmpeg: async ({ args }) => {
          execCalls.push(args);
        }
      }
    );

    expect(execCalls).toHaveLength(1);
    const argsStr = execCalls[0].join(' ');
    // Both overlay images included as inputs
    expect(argsStr).toContain('a.png');
    expect(argsStr).toContain('b.png');
    // Both enable expressions present (track 0 at 2-7s, track 1 at 4-9s)
    expect(argsStr).toContain("enable='between(t,2.000,7.000)'");
    expect(argsStr).toContain("enable='between(t,4.000,9.000)'");

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('renderComposite uses auto-track mouse trail for zoompan expressions', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-render-autotrack-'));
    const screenPath = path.join(tmpDir, 'screen.webm');
    fs.writeFileSync(screenPath, 'screen', 'utf8');

    // Create mouse trail file
    const mouseTrail = {
      captureWidth: 1920,
      captureHeight: 1080,
      interval: 50,
      trail: [
        { t: 0, x: 100, y: 100 },
        { t: 0.5, x: 500, y: 300 },
        { t: 1.0, x: 900, y: 500 },
        { t: 1.5, x: 1400, y: 700 },
        { t: 2.0, x: 1800, y: 900 }
      ]
    };
    const mousePath = path.join(tmpDir, 'recording-mouse.json');
    fs.writeFileSync(mousePath, JSON.stringify(mouseTrail), 'utf8');

    const execCalls = [];
    await renderComposite(
      {
        outputFolder: tmpDir,
        takes: [{ id: 'take-1', screenPath, cameraPath: null, mousePath }],
        sections: [{ takeId: 'take-1', sourceStart: 0, sourceEnd: 2 }],
        keyframes: [{
          time: 0, pipX: 10, pipY: 10, pipVisible: false, cameraFullscreen: false,
          backgroundZoom: 2.0, backgroundPanX: 0, backgroundPanY: 0,
          autoTrack: true, autoTrackSmoothing: 0.15
        }],
        pipSize: 300,
        sourceWidth: 1920,
        sourceHeight: 1080,
        screenFitMode: 'fill'
      },
      {
        ffmpegPath: '/usr/bin/ffmpeg',
        now: () => 888,
        probeVideoFpsWithFfmpeg: async () => 30,
        runFfmpeg: async ({ args }) => {
          execCalls.push(args);
        }
      }
    );

    expect(execCalls).toHaveLength(1);
    const argsStr = execCalls[0].join(' ');
    // Should have zoompan with animated x/y from mouse trail keypoints
    expect(argsStr).toContain('zoompan');
    // Auto-track produces multiple keypoints, so the focus expressions should be animated (contain if/gte)
    expect(argsStr).toContain('if(gte(');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
