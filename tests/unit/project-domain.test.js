const path = require('path');

const {
  sanitizeProjectName,
  toProjectAbsolutePath,
  toProjectRelativePath,
  normalizeSections,
  normalizeKeyframes,
  createDefaultProject,
  normalizeProjectData
} = require('../../src/shared/domain/project');

describe('shared/domain/project', () => {
  test('sanitizeProjectName strips invalid characters and collapses whitespace', () => {
    const value = sanitizeProjectName('  Bad<>:/Name   with   spaces  ');
    expect(value).toBe('BadName with spaces');
  });

  test('toProjectAbsolutePath and toProjectRelativePath convert paths safely', () => {
    const projectFolder = path.join('/tmp', 'project');
    const rel = 'takes/screen.webm';
    const abs = toProjectAbsolutePath(projectFolder, rel);
    expect(abs).toBe(path.join(projectFolder, rel));
    expect(toProjectRelativePath(projectFolder, abs)).toBe(rel);
  });

  test('normalizeSections sorts, filters invalid durations, and normalizes transcript', () => {
    const sections = normalizeSections([
      { start: 5, end: 6, text: '  world ' },
      { start: 0, end: 0, text: 'drop' },
      { start: 1, end: 2, transcript: 'hello    there' }
    ]);

    expect(sections).toHaveLength(2);
    expect(sections[0].start).toBe(1);
    expect(sections[0].transcript).toBe('hello there');
    expect(sections[1].start).toBe(5);
    expect(sections[1].transcript).toBe('world');
  });

  test('normalizeKeyframes returns ordered numeric values', () => {
    const keyframes = normalizeKeyframes([
      { time: 2, pipX: '50', pipY: '60', pipVisible: false, cameraFullscreen: true },
      { time: 1, pipX: 10, pipY: 20 }
    ]);
    expect(keyframes[0].time).toBe(1);
    expect(keyframes[1].pipX).toBe(50);
    expect(keyframes[1].pipVisible).toBe(false);
    expect(keyframes[1].cameraFullscreen).toBe(true);
  });

  test('normalizeProjectData hydrates defaults and timeline metadata', () => {
    const base = createDefaultProject('Demo');
    const project = normalizeProjectData(
      {
        id: base.id,
        name: '  demo<>name ',
        timeline: {
          sections: [{ start: 0, end: 2 }]
        }
      },
      '/tmp/my-project'
    );

    expect(project.name).toBe('demoname');
    expect(project.timeline.sections).toHaveLength(1);
    expect(project.settings.screenFitMode).toBe('fill');
    expect(project.settings.hideFromRecording).toBe(true);
  });
});
