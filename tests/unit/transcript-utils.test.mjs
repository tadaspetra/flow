import { describe, test, expect } from 'vitest';
import {
  normalizeTranscriptText,
  stripNonSpeechAnnotations,
  extractSpokenWordTokens
} from '../../src/renderer/features/transcript/transcript-utils.js';

describe('transcript-utils', () => {
  describe('normalizeTranscriptText', () => {
    test('collapses whitespace and trims', () => {
      expect(normalizeTranscriptText('  hello   world  ')).toBe('hello world');
    });
    test('handles null/undefined as empty string', () => {
      expect(normalizeTranscriptText(null)).toBe('');
      expect(normalizeTranscriptText(undefined)).toBe('');
    });
    test('handles empty string', () => {
      expect(normalizeTranscriptText('')).toBe('');
    });
    test('preserves single spaces between words', () => {
      expect(normalizeTranscriptText('one two three')).toBe('one two three');
    });
  });

  describe('stripNonSpeechAnnotations', () => {
    test('removes bracketed content', () => {
      expect(stripNonSpeechAnnotations('hello [pause] world')).toBe('hello world');
    });
    test('removes parenthesized content', () => {
      expect(stripNonSpeechAnnotations('hello (um) world')).toBe('hello world');
    });
    test('fixes punctuation spacing', () => {
      expect(stripNonSpeechAnnotations('hello , world .')).toBe('hello, world.');
    });
    test('handles trailing unclosed brackets', () => {
      expect(stripNonSpeechAnnotations('hello [unclosed')).toMatch(/hello/);
    });
    test('handles null/undefined', () => {
      expect(stripNonSpeechAnnotations(null)).toBe('');
      expect(stripNonSpeechAnnotations(undefined)).toBe('');
    });
  });

  describe('extractSpokenWordTokens', () => {
    test('extracts word tokens only', () => {
      const tokens = [
        { type: 'word', text: 'hello' },
        { type: 'punctuation', text: ',' },
        { type: 'word', text: 'world' }
      ];
      const result = extractSpokenWordTokens(tokens);
      expect(result).toHaveLength(2);
      expect(result[0].text).toBe('hello');
      expect(result[1].text).toBe('world');
    });
    test('excludes tokens inside parentheses', () => {
      const tokens = [
        { type: 'word', text: 'hello' },
        { type: 'word', text: '(um)' },
        { type: 'word', text: 'world' }
      ];
      const result = extractSpokenWordTokens(tokens);
      expect(result.map(t => t.text)).toEqual(['hello', 'world']);
    });
    test('handles empty or non-array input', () => {
      expect(extractSpokenWordTokens([])).toEqual([]);
      expect(extractSpokenWordTokens(null)).toEqual([]);
    });
    test('preserves start/end on word tokens', () => {
      const tokens = [{ type: 'word', text: 'hi', start: 0.5, end: 0.7 }];
      const result = extractSpokenWordTokens(tokens);
      expect(result[0].start).toBe(0.5);
      expect(result[0].end).toBe(0.7);
    });
  });
});
