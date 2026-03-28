import path from 'path';

import { buildFilterComplex, buildScreenFilter, buildOverlayFilter, resolveOutputSize } from './render-filter-service.js';
import { runFfmpeg } from './ffmpeg-runner.js';
import ffmpegStatic from 'ffmpeg-static';

import type { Keyframe, OutputMode, Overlay, ScreenFitMode } from '../../shared/types/domain.js';
import type { ThumbnailCaptureOptions, ThumbnailCaptureDeps } from '../../shared/types/services.js';

const TARGET_FPS = 30;

async function captureThumbnail(
  opts: Partial<ThumbnailCaptureOptions> = {},
  deps: Partial<ThumbnailCaptureDeps> = {}
): Promise<string> {
  const takes = Array.isArray(opts.takes) ? opts.takes : [];
  const keyframes: Keyframe[] = Array.isArray(opts.keyframes) ? opts.keyframes : [];
  const overlays: Overlay[] = Array.isArray(opts.overlays)
    ? opts.overlays
        .filter(o => o && o.mediaPath && o.mediaType)
        .sort((a, b) => (a.trackIndex || 0) - (b.trackIndex || 0) || a.startTime - b.startTime)
    : [];
  const sourceTime = Number.isFinite(Number(opts.sourceTime)) ? Number(opts.sourceTime) : 0;
  const cameraSyncOffsetMs = Number.isFinite(Number(opts.cameraSyncOffsetMs)) ? Number(opts.cameraSyncOffsetMs) : 0;
  const sourceWidth = Number.isFinite(Number(opts.sourceWidth)) ? Number(opts.sourceWidth) : 1920;
  const sourceHeight = Number.isFinite(Number(opts.sourceHeight)) ? Number(opts.sourceHeight) : 1080;
  const outputMode: OutputMode = opts.outputMode === 'reel' ? 'reel' : 'landscape';
  const screenFitMode: ScreenFitMode = opts.screenFitMode === 'fit' ? 'fit' : 'fill';
  const pipSize = Number.isFinite(Number(opts.pipSize)) ? Number(opts.pipSize) : 422;
  const projectFolder = typeof opts.projectFolder === 'string' ? opts.projectFolder : '';

  const runFfmpegProcess = deps.runFfmpeg || runFfmpeg;
  const ffmpegPath = typeof deps.ffmpegPath === 'string' ? deps.ffmpegPath : (ffmpegStatic || '');
  const now = typeof deps.now === 'function' ? deps.now : Date.now;

  if (!projectFolder) throw new Error('Missing project folder');
  if (!ffmpegPath) throw new Error('ffmpeg-static is unavailable on this platform');

  const take = takes.find(t => t && t.screenPath);
  if (!take || !take.screenPath) throw new Error('No take with screen path found');

  const screenPath = take.screenPath;
  const hasCamera = keyframes.some(kf => kf.pipVisible || kf.cameraFullscreen);
  const cameraPath = hasCamera && take.cameraPath ? take.cameraPath : null;

  const canvasH = 1080;
  const canvasW = outputMode === 'reel' ? Math.round(canvasH * 9 / 16) : 1920;

  const outputPath = path.join(projectFolder, `thumbnail-${now()}-${outputMode}.png`);

  const args: string[] = [];

  // Input 0: screen (seeked to source time)
  args.push('-ss', sourceTime.toFixed(3), '-i', screenPath);

  // Input 1: camera (seeked with sync offset), if needed
  if (cameraPath) {
    const cameraTime = sourceTime + (cameraSyncOffsetMs / 1000);
    args.push('-ss', Math.max(0, cameraTime).toFixed(3), '-i', cameraPath);
  }

  // Build filter graph
  const filterParts: string[] = [];

  if (cameraPath) {
    let complexFilter = buildFilterComplex(
      keyframes, pipSize, screenFitMode, sourceWidth, sourceHeight,
      canvasW, canvasH, true, TARGET_FPS, outputMode
    );

    if (overlays.length > 0) {
      complexFilter = complexFilter.replace(
        /\[screen\]\[cam\]overlay/,
        '[screen_ovl][cam]overlay'
      );
    }
    filterParts.push(complexFilter);
  } else {
    const outputLabel = overlays.length > 0 ? '[screen]' : '[out]';
    filterParts.push(
      buildScreenFilter(
        keyframes, screenFitMode, sourceWidth, sourceHeight,
        canvasW, canvasH, outputLabel, true, TARGET_FPS, outputMode
      )
    );
  }

  if (overlays.length > 0) {
    const { outW, outH } = resolveOutputSize(sourceWidth, sourceHeight, outputMode);
    let overlayInputOffset = 0;
    for (const a of args) { if (a === '-i') overlayInputOffset += 1; }

    const overlayResult = buildOverlayFilter(
      overlays, canvasW, canvasH, outW, outH,
      overlayInputOffset, 'screen', outputMode, 0.1
    );

    for (let i = 0; i < overlayResult.inputs.length; i++) {
      const inputArgs = overlayResult.inputs[i]!;
      const overlay = overlays[i]!;
      const mediaAbsPath = path.join(projectFolder, overlay.mediaPath);
      args.push(...inputArgs, mediaAbsPath);
    }

    for (const part of overlayResult.filterParts) {
      filterParts.push(part);
    }

    const finalLabel = cameraPath ? '[screen_ovl]' : '[out]';
    const lastIdx = filterParts.length - 1;
    if (lastIdx >= 0) {
      filterParts[lastIdx] = filterParts[lastIdx]!.replace(/\[ovl_\d+\]$/, finalLabel);
    }
  }

  args.push('-filter_complex', filterParts.join(';'));
  args.push('-map', '[out]');
  args.push('-frames:v', '1', '-update', '1');
  args.push(outputPath);

  console.log('[thumbnail-capture] ffmpeg args:', args.join(' '));

  try {
    await runFfmpegProcess({ ffmpegPath, args });
    return outputPath;
  } catch (error) {
    console.error('[thumbnail-capture] ffmpeg error:', (error as Error)?.message || error);
    throw error;
  }
}

export { captureThumbnail };
