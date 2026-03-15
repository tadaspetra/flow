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
      { takeId: 'a', sourceStart: 0, sourceEnd: 1 },
      { takeId: 'b', sourceStart: 2, sourceEnd: 1 },
      { takeId: 'c', sourceStart: 'x', sourceEnd: 3 }
    ]);

    expect(sections).toHaveLength(1);
    expect(sections[0].takeId).toBe('a');
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
          execFile: (_bin, _args, _opts, cb) => cb(null, '', '')
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
        execFile: (bin, args, opts, cb) => {
          execCalls.push({ bin, args, opts });
          cb(null, '', '');
        }
      }
    );

    expect(output).toBe(path.join(outputDir, 'recording-123-edited.mp4'));
    expect(execCalls).toHaveLength(1);
    expect(execCalls[0].bin).toBe('/usr/bin/ffmpeg');
    expect(execCalls[0].args.join(' ')).toContain('-filter_complex');
  });
});
