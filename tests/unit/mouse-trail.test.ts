import { describe, test, expect } from 'vitest';
import { lookupMouseAt, lookupSmoothedMouseAt, subsampleTrail } from '../../src/renderer/features/timeline/mouse-trail.ts';

interface TrailPoint {
  t: number;
  x: number;
  y: number;
}

const sampleTrail: TrailPoint[] = [
  { t: 0.0, x: 100, y: 200 },
  { t: 0.5, x: 200, y: 300 },
  { t: 1.0, x: 400, y: 400 },
  { t: 1.5, x: 600, y: 500 },
  { t: 2.0, x: 800, y: 600 }
];

describe('mouse-trail', () => {
  describe('lookupMouseAt', () => {
    test('returns (0,0) for empty trail', () => {
      expect(lookupMouseAt([], 1)).toEqual({ x: 0, y: 0 });
      expect(lookupMouseAt(null, 1)).toEqual({ x: 0, y: 0 });
    });

    test('exact match returns entry values', () => {
      const result = lookupMouseAt(sampleTrail, 1.0);
      expect(result.x).toBe(400);
      expect(result.y).toBe(400);
    });

    test('interpolates between entries', () => {
      const result = lookupMouseAt(sampleTrail, 0.25);
      expect(result.x).toBeCloseTo(150, 0);
      expect(result.y).toBeCloseTo(250, 0);
    });

    test('clamps to first entry before start', () => {
      const result = lookupMouseAt(sampleTrail, -1);
      expect(result.x).toBe(100);
      expect(result.y).toBe(200);
    });

    test('clamps to last entry after end', () => {
      const result = lookupMouseAt(sampleTrail, 5);
      expect(result.x).toBe(800);
      expect(result.y).toBe(600);
    });

    test('handles single-entry trail', () => {
      const result = lookupMouseAt([{ t: 0, x: 50, y: 75 }], 1);
      expect(result.x).toBe(50);
      expect(result.y).toBe(75);
    });
  });

  describe('lookupSmoothedMouseAt', () => {
    test('returns center for empty trail', () => {
      expect(lookupSmoothedMouseAt([], 1)).toEqual({ focusX: 0.5, focusY: 0.5 });
    });

    test('near-zero smoothing tracks closely to raw position', () => {
      const result = lookupSmoothedMouseAt(sampleTrail, 1.0, 0.01, 1000, 1000);
      // With very low smoothing, should be close to raw (400, 400) / 1000 = (0.4, 0.4)
      expect(result.focusX).toBeCloseTo(0.4, 1);
      expect(result.focusY).toBeCloseTo(0.4, 1);
    });

    test('high smoothing lags behind raw position', () => {
      const raw = lookupMouseAt(sampleTrail, 2.0); // (800, 600)
      const smoothed = lookupSmoothedMouseAt(sampleTrail, 2.0, 0.5, 1000, 1000);
      // Smoothed should lag -- focusX should be less than 0.8
      expect(smoothed.focusX).toBeLessThan(raw.x / 1000);
    });

    test('returns normalized 0-1 coordinates', () => {
      const result = lookupSmoothedMouseAt(sampleTrail, 1.0, 0.15, 1920, 1080);
      expect(result.focusX).toBeGreaterThanOrEqual(0);
      expect(result.focusX).toBeLessThanOrEqual(1);
      expect(result.focusY).toBeGreaterThanOrEqual(0);
      expect(result.focusY).toBeLessThanOrEqual(1);
    });
  });

  describe('subsampleTrail', () => {
    test('returns empty for empty trail', () => {
      expect(subsampleTrail([], 0.15, 1920, 1080, 0, 5)).toEqual([]);
    });

    test('produces correct number of keypoints at 2Hz', () => {
      const result = subsampleTrail(sampleTrail, 0.15, 1000, 1000, 0, 2, 2);
      // 2Hz over 2 seconds = 5 points (0, 0.5, 1.0, 1.5, 2.0)
      expect(result.length).toBe(5);
    });

    test('first keypoint is at startTime', () => {
      const result = subsampleTrail(sampleTrail, 0.15, 1000, 1000, 0.5, 1.5, 2);
      expect(result[0].time).toBeCloseTo(0.5, 2);
    });

    test('last keypoint is at or near endTime', () => {
      const result = subsampleTrail(sampleTrail, 0.15, 1000, 1000, 0, 2, 2);
      expect(result[result.length - 1].time).toBeCloseTo(2.0, 2);
    });

    test('keypoints have focusX/focusY in 0-1 range', () => {
      const result = subsampleTrail(sampleTrail, 0.15, 1000, 1000, 0, 2, 2);
      for (const kp of result) {
        expect(kp.focusX).toBeGreaterThanOrEqual(0);
        expect(kp.focusX).toBeLessThanOrEqual(1);
        expect(kp.focusY).toBeGreaterThanOrEqual(0);
        expect(kp.focusY).toBeLessThanOrEqual(1);
      }
    });
  });
});
