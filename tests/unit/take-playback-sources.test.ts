import { describe, expect, test } from 'vitest';

import { getTakePlaybackSources } from '../../src/renderer/features/timeline/take-playback-sources';

describe('take-playback-sources', () => {
  test('routes editor audio to the camera asset when face cam media exists', () => {
    expect(
      getTakePlaybackSources({
        screenPath: '/tmp/screen.webm',
        cameraPath: '/tmp/camera.webm',
        proxyPath: '/tmp/proxy.webm',
        cameraProxyPath: '/tmp/camera-proxy.mp4'
      })
    ).toEqual({
      screenVideoPath: '/tmp/proxy.webm',
      cameraVideoPath: '/tmp/camera-proxy.mp4',
      audioPath: '/tmp/camera.webm'
    });
  });

  test('leaves editor audio empty when there is no face cam asset', () => {
    expect(
      getTakePlaybackSources({
        screenPath: '/tmp/screen.webm',
        cameraPath: null,
        proxyPath: null,
        cameraProxyPath: null
      })
    ).toEqual({
      screenVideoPath: '/tmp/screen.webm',
      cameraVideoPath: null,
      audioPath: null
    });
  });
});
