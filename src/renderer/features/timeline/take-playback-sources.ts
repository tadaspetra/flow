type TakePlaybackSource = {
  screenPath?: string | null;
  cameraPath?: string | null;
  proxyPath?: string | null;
  cameraProxyPath?: string | null;
};

export function getTakePlaybackSources(take: TakePlaybackSource | null | undefined): {
  screenVideoPath: string | null;
  cameraVideoPath: string | null;
  audioPath: string | null;
} {
  if (!take) {
    return {
      screenVideoPath: null,
      cameraVideoPath: null,
      audioPath: null
    };
  }

  return {
    screenVideoPath: take.proxyPath || take.screenPath || null,
    cameraVideoPath: take.cameraProxyPath || take.cameraPath || null,
    audioPath: take.cameraPath || null
  };
}
