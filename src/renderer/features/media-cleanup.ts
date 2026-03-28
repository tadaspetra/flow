/**
 * Centralised, synchronous, idempotent cleanup for all renderer media
 * resources.  Called from the `beforeunload` handler so every `.stop()` /
 * `.close()` must be non-blocking.
 *
 * Usage in app.js:
 *   import { cleanupAllMedia } from './features/media-cleanup.js';
 *   // pass the mutable refs bag that app.js owns
 *   cleanupAllMedia(refs);
 */

/** Mutable bag of media-resource references owned by the renderer bootstrap. */
export interface MediaRefs {
  recording?: boolean;
  screenStream?: MediaStream | null;
  cameraStream?: MediaStream | null;
  audioStream?: MediaStream | null;
  recorders?: MediaRecorder[];
  screenRecInterval?: ReturnType<typeof setInterval> | null;
  audioSendInterval?: ReturnType<typeof setInterval> | null;
  timerInterval?: ReturnType<typeof setInterval> | null;
  audioContext?: AudioContext | null;
  scribeWorkletNode?: AudioWorkletNode | null;
  scribeWs?: WebSocket | null;
  drawRAF?: number | null;
  meterRAF?: number | null;
  cancelEditorDrawLoop?: (() => void) | null;
  stopAudioMeter?: (() => void) | null;
}

/**
 * Stop every track on a MediaStream, then null-out the reference.
 * No-ops when the stream is already null / undefined.
 */
function stopStream(stream: MediaStream | null | undefined): void {
  if (!stream) return;
  try {
    stream.getTracks().forEach((t) => t.stop());
  } catch (_e) {
    /* already stopped or GC'd */
  }
}

/**
 * Idempotent cleanup of all media resources held in the refs bag.
 */
function cleanupAllMedia(refs: MediaRefs | null): void {
  if (!refs) return;

  // --- recording flag -------------------------------------------------------
  if (refs.recording) {
    refs.recording = false;
  }

  // --- intervals ------------------------------------------------------------
  if (refs.screenRecInterval) {
    clearInterval(refs.screenRecInterval);
    refs.screenRecInterval = null;
  }
  if (refs.audioSendInterval) {
    clearInterval(refs.audioSendInterval);
    refs.audioSendInterval = null;
  }
  if (refs.timerInterval) {
    clearInterval(refs.timerInterval);
    refs.timerInterval = null;
  }

  // --- MediaRecorders -------------------------------------------------------
  if (refs.recorders && refs.recorders.length) {
    refs.recorders.forEach((r) => {
      try {
        if (r.state !== 'inactive') r.stop();
      } catch (_e) {
        /* already stopped */
      }
    });
    refs.recorders = [];
  }

  // --- Scribe audio worklet -------------------------------------------------
  if (refs.scribeWorkletNode) {
    try {
      refs.scribeWorkletNode.disconnect();
    } catch (_e) {
      /* already disconnected */
    }
    refs.scribeWorkletNode = null;
  }

  // --- Scribe WebSocket -----------------------------------------------------
  if (refs.scribeWs) {
    try {
      refs.scribeWs.close();
    } catch (_e) {
      /* already closed */
    }
    refs.scribeWs = null;
  }

  // --- Audio meter / context ------------------------------------------------
  if (typeof refs.stopAudioMeter === 'function') {
    try {
      refs.stopAudioMeter();
    } catch (_e) {
      /* best-effort */
    }
  }

  // Close AudioContext if stopAudioMeter didn't already
  if (refs.audioContext) {
    try {
      refs.audioContext.close();
    } catch (_e) {
      /* already closed */
    }
    refs.audioContext = null;
  }

  // --- Animation frames -----------------------------------------------------
  if (refs.drawRAF) {
    cancelAnimationFrame(refs.drawRAF);
    refs.drawRAF = null;
  }
  if (refs.meterRAF) {
    cancelAnimationFrame(refs.meterRAF);
    refs.meterRAF = null;
  }
  if (typeof refs.cancelEditorDrawLoop === 'function') {
    try {
      refs.cancelEditorDrawLoop();
    } catch (_e) {
      /* best-effort */
    }
  }

  // --- Media streams (last -- stops ScreenCaptureKit sessions) ---------------
  stopStream(refs.screenStream);
  refs.screenStream = null;

  stopStream(refs.cameraStream);
  refs.cameraStream = null;

  stopStream(refs.audioStream);
  refs.audioStream = null;
}

export { cleanupAllMedia, stopStream };
