import { describe, expect, test } from 'vitest';
import {
  RECORDER_MIME_CANDIDATES,
  RECORDER_TIMESLICE_MS,
  PREVIEW_FPS_IDLE,
  PREVIEW_FPS_RECORDING,
  getSupportedRecorderMimeType,
  getRecorderOptions,
  getRecorderTimesliceMs,
  shouldRenderPreviewFrame,
  createCameraRecordingStream
} from '../../src/renderer/features/recording/recorder-utils.js';

describe('recorder-utils', () => {
  test('prefers vp8 recorder support before heavier codecs', () => {
    const mediaRecorderCtor = {
      isTypeSupported: (mimeType) =>
        mimeType === 'video/webm; codecs=vp8' || mimeType === 'video/webm; codecs=vp9'
    };

    expect(RECORDER_MIME_CANDIDATES[0]).toBe('video/webm; codecs=vp8');
    expect(getSupportedRecorderMimeType(mediaRecorderCtor)).toBe('video/webm; codecs=vp8');
  });

  test('falls back to empty mime type when MediaRecorder support is unavailable', () => {
    expect(getSupportedRecorderMimeType(undefined)).toBe('');
  });

  test('omits audio bitrate for camera recordings without audio tracks', () => {
    expect(getRecorderOptions({ suffix: 'camera', hasAudio: false }, undefined)).toEqual({
      videoBitsPerSecond: 10000000
    });
  });

  test('keeps screen audio bitrate when screen recording includes audio', () => {
    expect(getRecorderOptions({ suffix: 'screen', hasAudio: true }, undefined)).toEqual({
      videoBitsPerSecond: 30000000,
      audioBitsPerSecond: 192000
    });
  });

  test('flushes recorder data on a steady interval during capture', () => {
    expect(RECORDER_TIMESLICE_MS).toBe(1000);
    expect(getRecorderTimesliceMs()).toBe(1000);
  });

  test('throttles preview updates more aggressively while recording', () => {
    expect(PREVIEW_FPS_IDLE).toBe(30);
    expect(PREVIEW_FPS_RECORDING).toBe(12);
    expect(shouldRenderPreviewFrame(0, 0, true)).toBe(true);
    expect(shouldRenderPreviewFrame(40, 0, false)).toBe(true);
    expect(shouldRenderPreviewFrame(40, 20, false)).toBe(false);
    expect(shouldRenderPreviewFrame(110, 20, true)).toBe(true);
    expect(shouldRenderPreviewFrame(90, 20, true)).toBe(false);
  });

  test('creates a camera-only recording stream with video tracks only', () => {
    const videoTracks = [{ id: 'cam-video-1' }, { id: 'cam-video-2' }];
    const cameraStream = {
      getVideoTracks: () => videoTracks,
      getAudioTracks: () => [{ id: 'cam-audio' }]
    };

    class FakeMediaStream {
      constructor(tracks) {
        this.tracks = tracks;
      }
    }

    const recordingStream = createCameraRecordingStream(cameraStream, FakeMediaStream);
    expect(recordingStream).toBeInstanceOf(FakeMediaStream);
    expect(recordingStream.tracks).toEqual(videoTracks);
  });
});
