import {
  normalizeAudioOverlays,
  generateAudioOverlayId,
  normalizeAudioVolume,
  normalizeSections,
  normalizeProjectData
} from '../../src/shared/domain/project.js';

describe('normalizeAudioVolume', () => {
  test('returns 1.0 for undefined/null', () => {
    expect(normalizeAudioVolume(undefined)).toBe(1.0);
    expect(normalizeAudioVolume(null)).toBe(1.0);
  });

  test('returns 1.0 for non-finite values', () => {
    expect(normalizeAudioVolume(NaN)).toBe(1.0);
    expect(normalizeAudioVolume(Infinity)).toBe(1.0);
    expect(normalizeAudioVolume('abc')).toBe(1.0);
  });

  test('clamps to 0.0–1.0 range', () => {
    expect(normalizeAudioVolume(-0.3)).toBe(0.0);
    expect(normalizeAudioVolume(1.5)).toBe(1.0);
    expect(normalizeAudioVolume(0)).toBe(0.0);
    expect(normalizeAudioVolume(1)).toBe(1.0);
  });

  test('preserves valid values', () => {
    expect(normalizeAudioVolume(0.5)).toBe(0.5);
    expect(normalizeAudioVolume(0.75)).toBe(0.75);
  });
});

describe('generateAudioOverlayId', () => {
  test('returns unique IDs', () => {
    const id1 = generateAudioOverlayId();
    const id2 = generateAudioOverlayId();
    expect(id1).not.toBe(id2);
  });

  test('matches expected format', () => {
    const id = generateAudioOverlayId();
    expect(id).toMatch(/^audio-overlay-\d+-\d+$/);
  });
});

describe('normalizeAudioOverlays', () => {
  test('returns empty array for non-array input', () => {
    expect(normalizeAudioOverlays(null)).toEqual([]);
    expect(normalizeAudioOverlays(undefined)).toEqual([]);
    expect(normalizeAudioOverlays('string')).toEqual([]);
  });

  test('filters out segments with missing id or mediaPath', () => {
    const result = normalizeAudioOverlays([
      { id: '', mediaPath: 'a.mp3', startTime: 0, endTime: 5 },
      { mediaPath: 'b.mp3', startTime: 0, endTime: 5 },
      { id: 'valid', startTime: 0, endTime: 5 },
      { id: 'ok', mediaPath: 'c.mp3', startTime: 0, endTime: 5 }
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('ok');
  });

  test('filters out segments with invalid time range', () => {
    const result = normalizeAudioOverlays([
      { id: 'a', mediaPath: 'a.mp3', startTime: 5, endTime: 3 },
      { id: 'b', mediaPath: 'b.mp3', startTime: 5, endTime: 5 },
      { id: 'c', mediaPath: 'c.mp3', startTime: 2, endTime: 8 }
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('c');
  });

  test('clamps volume to 0.0–1.0', () => {
    const result = normalizeAudioOverlays([
      { id: 'a', mediaPath: 'a.mp3', startTime: 0, endTime: 5, volume: 1.5 },
      { id: 'b', mediaPath: 'b.mp3', startTime: 6, endTime: 10, volume: -0.3 }
    ]);
    expect(result[0]!.volume).toBe(1.0);
    expect(result[1]!.volume).toBe(0.0);
  });

  test('defaults volume to 1.0 when missing', () => {
    const result = normalizeAudioOverlays([
      { id: 'a', mediaPath: 'a.mp3', startTime: 0, endTime: 5 }
    ]);
    expect(result[0]!.volume).toBe(1.0);
  });

  test('defaults sourceStart/sourceEnd when missing', () => {
    const result = normalizeAudioOverlays([
      { id: 'a', mediaPath: 'a.mp3', startTime: 5, endTime: 15 }
    ]);
    expect(result[0]!.sourceStart).toBe(0);
    expect(result[0]!.sourceEnd).toBe(10);
  });

  test('preserves valid sourceStart/sourceEnd', () => {
    const result = normalizeAudioOverlays([
      { id: 'a', mediaPath: 'a.mp3', startTime: 0, endTime: 10, sourceStart: 5, sourceEnd: 15 }
    ]);
    expect(result[0]!.sourceStart).toBe(5);
    expect(result[0]!.sourceEnd).toBe(15);
  });

  test('resolves overlapping segments on same track', () => {
    const result = normalizeAudioOverlays([
      { id: 'a', mediaPath: 'a.mp3', startTime: 2, endTime: 8, trackIndex: 0 },
      { id: 'b', mediaPath: 'b.mp3', startTime: 5, endTime: 12, trackIndex: 0 }
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe('a');
    expect(result[1]!.startTime).toBe(8);
  });

  test('discards segment if overlap resolution leaves zero duration', () => {
    const result = normalizeAudioOverlays([
      { id: 'a', mediaPath: 'a.mp3', startTime: 2, endTime: 10, trackIndex: 0 },
      { id: 'b', mediaPath: 'b.mp3', startTime: 5, endTime: 10, trackIndex: 0 }
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('a');
  });

  test('sorts by trackIndex then startTime', () => {
    const result = normalizeAudioOverlays([
      { id: 'c', mediaPath: 'c.mp3', startTime: 10, endTime: 15, trackIndex: 0 },
      { id: 'a', mediaPath: 'a.mp3', startTime: 3, endTime: 7, trackIndex: 0 },
      { id: 'b', mediaPath: 'b.mp3', startTime: 5, endTime: 10, trackIndex: 0 }
    ]);
    expect(result.map(o => o.id)).toEqual(['a', 'b', 'c']);
  });

  test('clamps trackIndex to MAX_AUDIO_TRACKS - 1', () => {
    const result = normalizeAudioOverlays([
      { id: 'a', mediaPath: 'a.mp3', startTime: 0, endTime: 5, trackIndex: 5 }
    ]);
    expect(result[0]!.trackIndex).toBe(0);
  });

  test('defaults trackIndex to 0 when missing', () => {
    const result = normalizeAudioOverlays([
      { id: 'a', mediaPath: 'a.mp3', startTime: 0, endTime: 5 }
    ]);
    expect(result[0]!.trackIndex).toBe(0);
  });

  test('defaults saved to false', () => {
    const result = normalizeAudioOverlays([
      { id: 'a', mediaPath: 'a.mp3', startTime: 0, endTime: 5 }
    ]);
    expect(result[0]!.saved).toBe(false);
  });
});

describe('Section volume normalization', () => {
  test('sections default volume to 1.0', () => {
    const sections = normalizeSections([
      { start: 0, end: 5 }
    ]);
    expect(sections[0]!.volume).toBe(1.0);
  });

  test('sections preserve valid volume', () => {
    const sections = normalizeSections([
      { start: 0, end: 5, volume: 0.5 }
    ]);
    expect(sections[0]!.volume).toBe(0.5);
  });

  test('sections clamp out-of-range volume', () => {
    const sections = normalizeSections([
      { start: 0, end: 5, volume: 2.5 },
      { start: 6, end: 10, volume: -0.5 }
    ]);
    expect(sections[0]!.volume).toBe(1.0);
    expect(sections[1]!.volume).toBe(0.0);
  });
});

describe('normalizeProjectData with audio overlays', () => {
  test('defaults audioOverlays and savedAudioOverlays to empty arrays', () => {
    const project = normalizeProjectData({});
    expect(project.timeline.audioOverlays).toEqual([]);
    expect(project.timeline.savedAudioOverlays).toEqual([]);
  });

  test('normalizes audioOverlays from raw data', () => {
    const project = normalizeProjectData({
      timeline: {
        audioOverlays: [
          { id: 'ao1', mediaPath: 'audio.mp3', startTime: 0, endTime: 10, volume: 0.8 }
        ],
        savedAudioOverlays: [
          { id: 'ao2', mediaPath: 'music.wav', startTime: 5, endTime: 15, volume: 0.5, saved: true }
        ]
      }
    });
    expect(project.timeline.audioOverlays).toHaveLength(1);
    expect(project.timeline.audioOverlays[0]!.id).toBe('ao1');
    expect(project.timeline.audioOverlays[0]!.volume).toBe(0.8);
    expect(project.timeline.savedAudioOverlays).toHaveLength(1);
    expect(project.timeline.savedAudioOverlays[0]!.volume).toBe(0.5);
  });

  test('section volume is preserved through normalizeProjectData', () => {
    const project = normalizeProjectData({
      timeline: {
        sections: [
          { id: 's1', start: 0, end: 5, sourceStart: 0, sourceEnd: 5, volume: 0.7 }
        ]
      }
    });
    expect(project.timeline.sections[0]!.volume).toBe(0.7);
  });
});
