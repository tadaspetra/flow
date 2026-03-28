## Why

Users need a fast way to export a polished thumbnail image for their video content. Social platforms (X, Instagram, YouTube, TikTok) let users upload custom cover images but ignore embedded MP4 metadata thumbnails. Currently there is no way to capture a frame from the editor as a standalone image. By letting the user press Ctrl+T at any playhead position, we produce a full-quality PNG of exactly what the final render would look like at that moment -- including camera PIP, overlays, zoom/pan state, and reel crop -- ready to upload alongside the exported video.

## What Changes

- Add a **Ctrl+T** keyboard shortcut in the editor timeline view that triggers a single-frame FFmpeg render at the current playhead position.
- Render the frame at full export resolution (1920x1080 for landscape, 608x1080 for reel) using the same filter graph as the video render pipeline, producing a PNG image.
- Capture whichever output mode is currently active (landscape or reel) -- one image per capture, matching the current mode.
- Allow **multiple captures** per project with no limit. Each press of Ctrl+T appends a new thumbnail file; previous captures are never deleted.
- Store captured thumbnails in the project folder with timestamped filenames (e.g., `thumbnail-{timestamp}-{mode}.png`).
- Show a brief **popup toast** in the editor UI confirming the capture was saved.
- Add a new IPC channel (`capture-thumbnail`) bridging the renderer request to the main-process FFmpeg execution.
- Add a new `captureThumbnail` service function in main process that reuses the existing render pipeline logic for filter graph construction but outputs a single frame as PNG instead of a full video.

## Capabilities

### New Capabilities
- `thumbnail-capture`: Keyboard-triggered single-frame FFmpeg render that produces a full-quality PNG thumbnail at the current playhead position, supporting both landscape and reel output modes, with timestamped file storage in the project folder and a UI toast confirmation.

### Modified Capabilities
<!-- No existing spec requirements change. The render pipeline is reused internally but
     no existing spec-level behavior is modified. -->

## Impact

- **Renderer (`src/renderer/app.ts`)**: New Ctrl+T handler in the keydown listener, new toast popup element and show/hide logic.
- **HTML (`src/index.html`)**: New toast/popup element for capture feedback.
- **IPC (`src/main/ipc/register-handlers.ts`)**: New `capture-thumbnail` IPC channel.
- **Preload (`src/preload.ts`)**: Expose `captureThumbnail` method on `ElectronAPI`.
- **Types (`src/shared/types/`)**: New `ThumbnailCaptureOptions` interface in `services.ts`, new method in `ipc.ts` `ElectronAPI`.
- **Main services**: New `src/main/services/thumbnail-service.ts` containing the single-frame render logic, reusing `render-filter-service` functions and `ffmpeg-runner`.
- **Tests**: Unit tests for the thumbnail service (filter construction, output path generation), integration tests for the IPC round-trip.
- **No breaking changes** to existing functionality.
- **No new dependencies** -- uses existing FFmpeg infrastructure.
