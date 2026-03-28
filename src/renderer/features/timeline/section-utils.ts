/**
 * Section normalization and remap helpers for the timeline.
 */

import type { Section } from '../../../shared/types/domain.js';
import { normalizeTranscriptText } from '../transcript/transcript-utils.js';

export const TRIM_PADDING = 0.15;

/** Section shape produced by the renderer — may lack `label` / `saved` before full normalization. */
export type RendererSection = Omit<Section, 'label' | 'saved'> & {
  label?: string;
  saved?: boolean;
};

/** Input segment shape accepted by buildRemappedSectionsFromSegments. */
interface SpeechSegment {
  start: number;
  end: number;
  text?: string;
}

/** Raw section input accepted by normalizeSections. */
interface RawSection {
  id?: string;
  start: unknown;
  end: unknown;
  sourceStart?: unknown;
  sourceEnd?: unknown;
  takeId?: string;
  transcript?: string;
  text?: string;
  saved?: boolean;
}

/** Padded segment after initial processing. */
interface PaddedSegment {
  start: number;
  end: number;
  transcript: string;
}

/** Merged segment with collected transcripts. */
interface MergedSegment {
  start: number;
  end: number;
  transcripts: string[];
}

/**
 * Rounds a numeric value to 3 decimal places (millisecond precision).
 */
export function roundMs(value: number): number {
  return Number(value.toFixed(3));
}

/**
 * Builds remapped sections from speech segments (padding, merge, timeline mapping).
 */
export function buildRemappedSectionsFromSegments(segments: SpeechSegment[]): RendererSection[] {
  if (!Array.isArray(segments) || segments.length === 0) return [];

  const padded: PaddedSegment[] = segments
    .map((segment): PaddedSegment | null => {
      const rawStart = Number(segment.start);
      const rawEnd = Number(segment.end);
      if (!Number.isFinite(rawStart) || !Number.isFinite(rawEnd)) return null;
      const start = Math.max(0, rawStart - TRIM_PADDING);
      const end = Math.max(start, rawEnd + TRIM_PADDING);
      return {
        start,
        end,
        transcript: normalizeTranscriptText(segment.text)
      };
    })
    .filter((s): s is PaddedSegment => s !== null)
    .sort((a, b) => a.start - b.start);

  if (padded.length === 0) return [];

  const first = padded[0]!;
  const merged: MergedSegment[] = [{
    start: first.start,
    end: first.end,
    transcripts: first.transcript ? [first.transcript] : []
  }];
  for (let i = 1; i < padded.length; i++) {
    const current = padded[i]!;
    const last = merged[merged.length - 1]!;
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
      if (current.transcript) last.transcripts.push(current.transcript);
    } else {
      merged.push({
        start: current.start,
        end: current.end,
        transcripts: current.transcript ? [current.transcript] : []
      });
    }
  }

  const remapped: RendererSection[] = [];
  let timelineCursor = 0;
  for (let i = 0; i < merged.length; i++) {
    const segment = merged[i]!;
    const sourceStart = roundMs(segment.start);
    const sourceEnd = roundMs(segment.end);
    const duration = Math.max(0, sourceEnd - sourceStart);
    const start = roundMs(timelineCursor);
    const end = roundMs(timelineCursor + duration);
    remapped.push({
      id: `section-${i + 1}`,
      index: i,
      sourceStart,
      sourceEnd,
      start,
      end,
      duration: roundMs(duration),
      transcript: normalizeTranscriptText(segment.transcripts.join(' ')),
      takeId: null,
      volume: 1.0
    });
    timelineCursor += duration;
  }

  return remapped;
}

/**
 * Normalizes raw sections: validates times, clamps to duration, adds index/label/duration.
 */
export function normalizeSections(rawSections: unknown, duration: unknown): Section[] {
  const safeDuration = Math.max(0, Number(duration) || 0);
  const input = Array.isArray(rawSections) ? rawSections as RawSection[] : [];
  const baseSections: RawSection[] = input.length > 0
    ? input
    : (safeDuration > 0 ? [{ id: 'section-1', start: 0, end: safeDuration }] : []);

  const normalized = baseSections
    .map((section, idx) => {
      let start = Number(section.start);
      let end = Number(section.end);
      if (!Number.isFinite(start)) start = 0;
      if (!Number.isFinite(end)) end = start;
      const transcript = normalizeTranscriptText(
        typeof section.transcript === 'string'
          ? section.transcript
          : (typeof section.text === 'string' ? section.text : '')
      );
      start = Math.max(0, start);
      end = Math.max(start, end);

      if (safeDuration > 0) {
        start = Math.min(start, safeDuration);
        end = Math.min(end, safeDuration);
      }

      return {
        id: section.id || `section-${idx + 1}`,
        index: 0,
        label: '',
        sourceStart: Number.isFinite(Number(section.sourceStart)) ? Number(section.sourceStart) : start,
        sourceEnd: Number.isFinite(Number(section.sourceEnd)) ? Number(section.sourceEnd) : end,
        start: roundMs(start),
        end: roundMs(end),
        duration: 0,
        takeId: typeof section.takeId === 'string' && section.takeId ? section.takeId : null,
        transcript,
        saved: !!section.saved,
        volume: 1.0
      };
    })
    .filter(section => section.end - section.start > 0.0001)
    .sort((a, b) => a.start - b.start);

  if (normalized.length === 0) return [];

  if (safeDuration > 0) {
    const last = normalized[normalized.length - 1]!;
    const drift = Math.abs(safeDuration - last.end);
    if (drift <= 0.2) {
      last.end = roundMs(safeDuration);
    }
  }

  for (let i = 0; i < normalized.length; i++) {
    const section = normalized[i]!;
    section.index = i;
    section.label = `Section ${i + 1}`;
    section.duration = roundMs(Math.max(0, section.end - section.start));
  }

  return normalized;
}

/**
 * Builds a single default section spanning the full duration.
 */
export function buildDefaultSectionsForDuration(duration: unknown): Section[] {
  const safeDuration = Math.max(0, Number(duration) || 0);
  if (safeDuration <= 0) return [];
  return [{
    id: 'section-1',
    index: 0,
    label: 'Section 1',
    sourceStart: 0,
    sourceEnd: roundMs(safeDuration),
    start: 0,
    end: roundMs(safeDuration),
    duration: roundMs(safeDuration),
    transcript: '',
    takeId: null,
    saved: false,
    volume: 1.0
  }];
}

/**
 * Normalizes sections or falls back to a single default section.
 */
export function normalizeTakeSections(rawSections: unknown, duration: unknown): Section[] {
  const normalized = normalizeSections(rawSections, duration);
  if (normalized.length > 0) return normalized;
  return buildDefaultSectionsForDuration(duration);
}

/** Transcript-bearing section candidate used for attachment. */
interface TranscriptCandidate {
  sourceStart?: unknown;
  sourceEnd?: unknown;
  transcript?: string;
  text?: string;
}

/** Input section shape for attachSectionTranscripts. */
interface AttachableSection {
  sourceStart?: unknown;
  sourceEnd?: unknown;
  transcript?: string;
  text?: string;
  [key: string]: unknown;
}

/**
 * Attaches transcript text to sections by index or source time overlap.
 */
export function attachSectionTranscripts(
  sections: unknown,
  transcriptSections: unknown
): AttachableSection[] {
  const baseSections = Array.isArray(sections) ? sections as AttachableSection[] : [];
  const transcriptSource = Array.isArray(transcriptSections) ? transcriptSections as TranscriptCandidate[] : [];

  return baseSections.map((section, index) => {
    const existing = normalizeTranscriptText(
      typeof section.transcript === 'string'
        ? section.transcript
        : (typeof section.text === 'string' ? section.text : '')
    );
    if (existing) {
      return { ...section, transcript: existing };
    }

    const byIndex = transcriptSource[index];
    let transcript = normalizeTranscriptText(byIndex?.transcript || byIndex?.text || '');

    if (!transcript) {
      const sourceStart = Number(section.sourceStart);
      const sourceEnd = Number(section.sourceEnd);
      if (Number.isFinite(sourceStart) && Number.isFinite(sourceEnd)) {
        const bySource = transcriptSource.find((candidate) => {
          const candidateStart = Number(candidate?.sourceStart);
          const candidateEnd = Number(candidate?.sourceEnd);
          return Number.isFinite(candidateStart)
            && Number.isFinite(candidateEnd)
            && Math.abs(candidateStart - sourceStart) <= 0.05
            && Math.abs(candidateEnd - sourceEnd) <= 0.05;
        });
        transcript = normalizeTranscriptText(bySource?.transcript || bySource?.text || '');
      }
    }

    return { ...section, transcript };
  });
}
