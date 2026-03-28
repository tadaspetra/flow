## Context

Loop is an Electron video editor that renders composited video via FFmpeg filter graphs. The render pipeline (`render-service.ts`) constructs complex filter chains supporting screen zoom/pan, camera PIP overlay, media overlays (image/video), audio overlays, and reel (9:16) crop mode. All visual state is driven by keyframes with easeInOut interpolation.

Currently there is no way to export a single frame as an image. Users need thumbnail images to upload as custom covers on social platforms. The editor preview canvas shows the composited frame but at reduced resolution (canvas display size, not export resolution).

The renderer already has `resolveTimeToSource(timelineTime)` which maps any playhead time to the correct take and source timestamp, and `EditorState` holds all the data (keyframes, sections, overlays, output mode) needed to describe a frame.

## Goals / Non-Goals

**Goals:**
- Capture a full-quality PNG of the current playhead frame, identical to what the video render would produce at that instant
- Reuse existing FFmpeg filter graph construction for visual fidelity
- Support both landscape (1920x1080) and reel (608x1080) modes
- Allow accumulating multiple thumbnails per project
- Provide immediate UI feedback on capture

**Non-Goals:**
- Embedding thumbnails into MP4 container metadata (platforms ignore it)
- Thumbnail browsing/gallery UI in the editor
- Batch capture of multiple frames at once
- Canvas-based capture (insufficient resolution)
- Thumbnail deletion or management UI

## Decisions

### 1. New service (`thumbnail-service.ts`) rather than extending `renderComposite`

**Decision**: Create a dedicated `captureThumbnail()` function in a new `src/main/services/thumbnail-service.ts`.

**Rationale**: `renderComposite` is already 250+ lines handling multi-section concat, audio mixing, FPS probing, and progress reporting. A single-frame capture is fundamentally simpler -- one seek point, no audio, no concat, one output frame. Bolting a "single frame mode" onto `renderComposite` would add branching complexity to an already intricate function.

**Alternative considered**: Adding an `opts.singleFrame` flag to `renderComposite`. Rejected because it would require conditional logic throughout the function and couples unrelated concerns.

**What we reuse**: The filter graph construction functions from `render-filter-service.ts` (`buildScreenFilter`, `buildFilterComplex`, `buildOverlayFilter`, `resolveOutputSize`) are pure functions that accept keyframes and return filter strings. These are directly reusable.

### 2. Frozen keyframe approach for single-frame rendering

**Decision**: The renderer computes the interpolated keyframe state at the playhead time T, creates a single synthetic keyframe at `time: 0` with those values, and passes it to the service. The service builds the filter graph with that single keyframe.

**Rationale**: The existing filter builders generate FFmpeg time-based expressions (`if(lt(t,...),...)`) for interpolating between keyframes. With a single keyframe, these expressions collapse to constants, which is correct for a single frame. This avoids needing to modify the filter builders or replicate interpolation logic.

**The renderer already interpolates keyframes for canvas preview** -- the same logic produces the frozen state. The renderer passes:
- The interpolated keyframe values at time T (zoom, pan, PIP position, visibility, reel crop, etc.)
- Which section/take the playhead is in
- The source time within that take
- Overlays visible at time T

### 3. FFmpeg seek + single frame output

**Decision**: Use `-ss {sourceTime}` (input-level seek) + `-frames:v 1` + PNG output.

FFmpeg command shape:
```
ffmpeg
  -ss {screenSourceTime} -i screen.mp4
  [-ss {cameraSourceTime} -i camera.mp4]
  [-loop 1 -t 0.1 -i overlay1.png]    # if overlays visible at T
  -filter_complex "{filter graph}"
  -map [out] -frames:v 1 -update 1 output.png
```

**Rationale**: Input-level `-ss` does a fast keyframe seek, then `-frames:v 1` extracts exactly one frame after filtering. PNG output gives lossless quality. The `-update 1` flag tells FFmpeg to write a single image file rather than a sequence.

**Alternative considered**: Encoding a 1-frame MP4 then extracting the frame. Rejected as unnecessarily complex.

### 4. Camera sync offset applied at seek time

**Decision**: The camera seek time accounts for `cameraSyncOffsetMs` just like the render pipeline does: `cameraSourceTime = screenSourceTime + (cameraSyncOffsetMs / 1000)`.

### 5. File naming: `thumbnail-{timestamp}-{mode}.png`

**Decision**: Each capture produces `thumbnail-{Date.now()}-landscape.png` or `thumbnail-{Date.now()}-reel.png` in the project folder.

**Rationale**: Timestamp ensures uniqueness for multiple captures. Mode suffix makes it clear which aspect ratio the image is. Storing in the project folder follows the existing pattern for takes, overlays, and audio overlays.

### 6. IPC channel: `capture-thumbnail`

**Decision**: New `ipcMain.handle('capture-thumbnail', ...)` channel. The renderer sends a `ThumbnailCaptureOptions` payload, the main process runs FFmpeg and returns the output path.

**Type additions**:
```typescript
// services.ts
interface ThumbnailCaptureOptions {
  takes: Array<{ id: string; screenPath?: string | null; cameraPath?: string | null; mousePath?: string | null }>;
  keyframes: Keyframe[];           // Single frozen keyframe at time 0
  overlays: Overlay[];             // Only overlays visible at capture time
  sourceTime: number;              // Source time in the active take's video
  cameraSyncOffsetMs: number;
  sourceWidth: number;
  sourceHeight: number;
  outputMode: OutputMode;
  screenFitMode: ScreenFitMode;
  pipSize: number;
  projectFolder: string;           // Where to save the thumbnail
}

// ipc.ts - ElectronAPI addition
captureThumbnail(opts: ThumbnailCaptureOptions): Promise<string>;
```

### 7. UI toast: minimal CSS popup, auto-dismiss

**Decision**: Add a fixed-position toast element to the editor section of `index.html`. On capture, show "Thumbnail saved" with a brief fade-in/out animation, auto-dismiss after ~2 seconds.

**Implementation**: A `<div id="editorThumbnailToast">` with `hidden` class, toggled via JS. Styled with existing Tailwind utility classes. No toast library needed.

### 8. Ctrl+T shortcut in existing keydown handler

**Decision**: Add `e.code === 'KeyT' && (e.ctrlKey || e.metaKey)` to the editor keydown handler, right alongside the existing shortcuts. Guard: must have `editorState`, not rendering, active workspace view is `timeline`, and a project is open.

## Risks / Trade-offs

**[Risk] FFmpeg seek inaccuracy near keyframes** → For I-frame-only formats (like screen recordings), seek is exact. For compressed formats, FFmpeg may land on the nearest keyframe. Mitigation: input-level `-ss` with `-accurate_seek` (default on) combined with the trim filter ensures frame-accurate output.

**[Risk] Capture takes 1-3 seconds (not instant)** → FFmpeg must decode and filter one frame. Mitigation: The toast shows immediately ("Capturing..."), then updates to "Saved!" on completion. The shortcut is debounced so rapid presses don't queue multiple FFmpeg processes.

**[Risk] Filter graph complexity for edge cases** → The overlay filter builder assumes sequential overlay chaining. For a single frame, only visible overlays are passed, simplifying the graph. Mitigation: unit test various combinations (no overlays, image overlay, video overlay, camera off, reel mode).

**[Risk] Ctrl+T browser conflict** → Ctrl+T opens a new tab in browsers, but this is an Electron app with no tab bar. Electron's `globalShortcut` or the renderer keydown handler can safely intercept it. Mitigation: `e.preventDefault()` in the handler.
