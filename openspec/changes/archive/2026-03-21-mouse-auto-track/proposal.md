## Why

When users zoom into their screen recording, the viewport is statically positioned — the user manually sets a pan position per section. But during the actual recording, the mouse cursor moves across the screen, and the most interesting content is usually where the cursor is. Users of tools like Screen Studio expect the zoomed viewport to automatically follow the cursor. Adding mouse position recording during capture and auto-pan during editing lets users enable "follow cursor" mode that automatically keeps the mouse centered in the zoomed viewport, with smooth cinematic tracking.

## What Changes

- **Mouse position recording during screen capture** — during recording, capture the global cursor position at ~20Hz and store as a JSON file alongside the screen/camera webm files. Each take gets a `mousePath` referencing this file.
- **Mouse trail data model** — a new data structure for storing, normalizing, and looking up mouse positions at any source timestamp, with configurable smoothing (exponential moving average).
- **Auto-track toggle per section per mode** — each section anchor keyframe gets `autoTrack: boolean` and `autoTrackSmoothing: number` properties, saved per layout mode (landscape/reel) via `MODE_SPECIFIC_PROPS`. When enabled, the manual `backgroundPanX/Y` is overridden by pan values computed from the mouse trail.
- **Editor preview with auto-track** — `getStateAtTime()` computes `backgroundFocusX/Y` from the mouse trail when auto-track is on, replacing manual pan values. The existing `drawEditorScreenWithZoom()` renders using these focus coordinates unchanged.
- **FFmpeg render with auto-track** — the mouse trail is subsampled to keypoints (~1-2 per second), converted to `backgroundFocusX/Y` values, and fed through the existing `buildNumericExpr()` to generate animated zoompan expressions in the ffmpeg filter chain.
- **UI controls** — auto-track toggle button and smoothing scrub control, visible when a section has zoom > 1.0. Auto-track auto-disables when zoom is 1.0 (full screen visible, no panning needed).
- **IPC for cursor position** — new IPC channel exposing Electron's `screen.getCursorScreenPoint()` for global mouse position capture from the main process.

## Capabilities

### New Capabilities

- `mouse-trail-capture`: Recording mouse cursor position during screen capture — IPC for cursor position, capture interval, storage as JSON file alongside take files, take data model extension with `mousePath`.
- `mouse-trail-data`: Mouse trail data structure — normalization, lookup by source time, smoothing algorithm (exponential moving average), subsampling for render keypoints.
- `mouse-auto-pan`: Auto-track mode for zoom/pan — per-section per-mode toggle, focus coordinate computation from mouse trail, editor preview integration, ffmpeg render integration, UI controls.

### Modified Capabilities

- `take-file-cleanup`: Take files now include an optional `mousePath` JSON file. The `.delete` staging system must track and clean up mouse trail files alongside screen/camera webm files.

## Impact

- **`src/renderer/app.js`** — mouse position capture during recording (setInterval + IPC), auto-track properties in keyframe anchors and `MODE_SPECIFIC_PROPS`, `getStateAtTime()` override for focus coords, UI controls for toggle + smoothing.
- **`src/main/services/render-filter-service.js`** — `buildScreenFilter()` modified to accept mouse trail data and generate per-frame focus expressions via `buildNumericExpr()` when auto-track is on.
- **`src/main/services/render-service.js`** — load mouse trail JSON, pass to filter builder when auto-track sections exist.
- **`src/shared/domain/project.js`** — take schema extension (`mousePath`), keyframe normalization for `autoTrack`/`autoTrackSmoothing`, `MODE_SPECIFIC_PROPS` update.
- **`src/main/ipc/register-handlers.js`** — new IPC handler for `getCursorScreenPoint`.
- **`src/preload.js`** — bridge for cursor position IPC.
- **`src/main/services/project-service.js`** — mouse trail file staging/unstaging alongside take files.
- **New module: `src/renderer/features/timeline/mouse-trail.js`** — pure utility for trail lookup, smoothing, subsampling.
