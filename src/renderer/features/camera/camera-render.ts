export interface CenteredSquareCropRect {
  sourceX: number;
  sourceY: number;
  size: number;
}

type MirrorDrawContext = Pick<
  CanvasRenderingContext2D,
  'drawImage' | 'restore' | 'save' | 'scale' | 'translate'
>;

export function getCenteredSquareCropRect(
  sourceWidth: number,
  sourceHeight: number
): CenteredSquareCropRect | null {
  if (
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0
  ) {
    return null;
  }

  const size = Math.min(sourceWidth, sourceHeight);
  return {
    sourceX: (sourceWidth - size) / 2,
    sourceY: (sourceHeight - size) / 2,
    size
  };
}

export function drawMirroredImage(
  targetCtx: MirrorDrawContext,
  source: CanvasImageSource,
  sourceX: number,
  sourceY: number,
  sourceWidth: number,
  sourceHeight: number,
  destX: number,
  destY: number,
  destWidth: number,
  destHeight: number
): void {
  drawCameraImage(
    targetCtx,
    source,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    destX,
    destY,
    destWidth,
    destHeight,
    true
  );
}

// Draws a camera frame, optionally mirrored horizontally (selfie view).
// When `mirror` is false, the frame is drawn natively so on-screen text on
// the presenter's side (e.g. a shirt logo) reads correctly. The save/restore
// pair is preserved in both paths so callers that set up clipping before
// calling this helper do not leak transform state.
export function drawCameraImage(
  targetCtx: MirrorDrawContext,
  source: CanvasImageSource,
  sourceX: number,
  sourceY: number,
  sourceWidth: number,
  sourceHeight: number,
  destX: number,
  destY: number,
  destWidth: number,
  destHeight: number,
  mirror: boolean
): void {
  targetCtx.save();
  if (mirror) {
    targetCtx.translate(destX + destWidth, destY);
    targetCtx.scale(-1, 1);
    targetCtx.drawImage(
      source,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      destWidth,
      destHeight
    );
  } else {
    targetCtx.drawImage(
      source,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      destX,
      destY,
      destWidth,
      destHeight
    );
  }
  targetCtx.restore();
}
