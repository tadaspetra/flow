import type { ComputeSectionsOptions, ComputeSectionsResult } from '../../shared/types/services.js';

export function computeSections(opts: ComputeSectionsOptions = {}): ComputeSectionsResult {
  const segments = Array.isArray(opts.segments) ? opts.segments : [];
  const paddingSeconds = Number.isFinite(Number(opts.paddingSeconds))
    ? Math.max(0, Number(opts.paddingSeconds))
    : 0.15;

  if (segments.length === 0) {
    return { sections: [], trimmedDuration: 0 };
  }

  const padded = segments
    .map((segment) => ({
      start: Math.max(0, Number(segment.start) - paddingSeconds),
      end: Number(segment.end) + paddingSeconds
    }))
    .filter((segment) => Number.isFinite(segment.start) && Number.isFinite(segment.end))
    .filter((segment) => segment.end > segment.start)
    .sort((a, b) => a.start - b.start);

  if (padded.length === 0) {
    return { sections: [], trimmedDuration: 0 };
  }

  const merged: Array<{ start: number; end: number }> = [padded[0]!];
  for (let i = 1; i < padded.length; i += 1) {
    const last = merged[merged.length - 1]!;
    const current = padded[i]!;
    if (current.start < last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push(current);
    }
  }

  const remapped: ComputeSectionsResult['sections'] = [];
  let timelineCursor = 0;
  for (let i = 0; i < merged.length; i += 1) {
    const segment = merged[i]!;
    const sourceStart = Number(segment.start.toFixed(3));
    const sourceEnd = Number(segment.end.toFixed(3));
    const sectionDuration = Math.max(0, sourceEnd - sourceStart);
    const start = Number(timelineCursor.toFixed(3));
    const end = Number((timelineCursor + sectionDuration).toFixed(3));
    remapped.push({
      id: `section-${i + 1}`,
      index: i,
      sourceStart,
      sourceEnd,
      start,
      end,
      duration: Number(sectionDuration.toFixed(3))
    });
    timelineCursor += sectionDuration;
  }

  return {
    sections: remapped,
    trimmedDuration: remapped.length > 0 ? remapped[remapped.length - 1]!.end : 0
  };
}
