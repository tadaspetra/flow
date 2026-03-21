## Context

The Loop editor has a zoom/pan system where `backgroundZoom` controls magnification (1-3x) and `backgroundPanX/Y` (-1 to 1) controls viewport position. These map to `backgroundFocusX/Y` (0-1 normalized screen coordinates) via `panToFocusCoord()`. The zoompan ffmpeg filter uses focus coordinates to position the viewport. Currently, pan is set manually per section.

The app records screen via `desktopCapturer` + MediaRecorder at up to 30fps. During recording, mouse position is not captured. Electron provides `screen.getCursorScreenPoint()` in the main process for global cursor position.

## Goals / Non-Goals

**Goals:**
- Capture mouse cursor position during recording at ~20Hz
- Store mouse trail as a lightweight JSON file per take
- Let users enable auto-track per section that automatically pans the zoomed viewport to follow the cursor
- Provide configurable smoothing for cinematic vs responsive tracking
- Render auto-tracked pan in ffmpeg output via existing zoompan expressions
- Per-mode (landscape/reel) auto-track toggle

**Non-Goals:**
- Mouse cursor rendering/drawing on the video (just viewport tracking)
- Click visualization or highlight effects
- Post-hoc mouse position extraction from video frames (we capture live)
- Auto-zoom (only auto-pan; zoom level is still manual)

## Decisions

### 1. Capture at 20Hz via IPC polling

**Decision**: Use `setInterval` at 50ms in the renderer during recording, calling `window.electronAPI.getCursorPosition()` which invokes `screen.getCursorScreenPoint()` in the main process. Store `{ t, x, y }` entries in an array.

**Why over renderer mousemove**: The recorder captures a screen/window, not the app's own window. `mousemove` only fires when the cursor is over the app. `getCursorScreenPoint()` gives global position regardless of which window is focused.

**Why 20Hz**: Fast enough for smooth interpolation with the smoothing algorithm. 60Hz would triple the data with negligible visual improvement. At 20Hz, a 5-minute recording produces ~6,000 entries (~120KB JSON) — small and fast to parse.

### 2. Store as separate JSON file per take

**Decision**: Save mouse trail as `recording-{timestamp}-mouse.json` alongside the screen/camera webm files. The take object gets a `mousePath` field. The file is managed by the same `.delete` staging system as other take files.

**Why not embed in project JSON**: The trail data can be tens of thousands of entries. Keeping it in a separate file avoids bloating the project save/load and the undo stack snapshots.

**File format**:
```json
{
  "captureWidth": 3024,
  "captureHeight": 1964,
  "interval": 50,
  "trail": [
    { "t": 0.000, "x": 450, "y": 320 },
    { "t": 0.050, "x": 455, "y": 318 },
    ...
  ]
}
```

### 3. Smoothing via exponential moving average

**Decision**: Apply smoothing when looking up mouse position. The smoothed position uses: `smoothX += (targetX - smoothX) * (1 - e^(-dt/smoothing))` where `smoothing` is configurable (default 0.15s).

**Why EMA over moving window average**: EMA is computationally simple (one multiply per step), handles variable time intervals naturally, and produces the characteristic "ease toward target" motion that feels cinematic. Moving window requires buffering and produces a less natural feel.

**Smoothing values**:
- 0.05s → near-instant, responsive
- 0.15s → default, slight cinematic lag
- 0.30s → smooth, dramatic follow
- 0.50s → very smooth, noticeable delay

### 4. Auto-track as per-section per-mode keyframe property

**Decision**: Add `autoTrack: boolean` and `autoTrackSmoothing: number` to keyframe anchors. These are part of `MODE_SPECIFIC_PROPS` so they're saved/restored per layout mode.

**Why per-section**: Different sections may need different tracking behavior. A talking-head section might want no tracking (zoom=1), while a demo section wants auto-track. Splitting a section preserves auto-track inheritance.

**Interaction with manual pan**: When `autoTrack` is on, `backgroundPanX/Y` are stored but ignored for display/render. Turning auto-track off restores the last manual pan position. This lets users toggle back and forth without losing their manual positioning.

### 5. Render via subsampled keypoints

**Decision**: For ffmpeg render, subsample the smoothed mouse trail to ~2 keypoints per second. Convert each keypoint to `backgroundFocusX/Y` values. Feed these as synthetic keyframes into `buildNumericExpr()` to generate piecewise-linear ffmpeg expressions.

**Why subsample**: Raw 20Hz data would produce 1200 nested `if(gte(t,...))` expressions for a 60-second section — too long for ffmpeg's expression parser. At 2Hz, a 60-second section produces ~120 keypoints, which `buildNumericExpr` handles well. The visual difference between 2Hz and 20Hz keypoints is negligible since ffmpeg interpolates linearly between them.

**Why not use the raw trail directly**: The smoothing algorithm must run before subsampling. The subsampled keypoints represent the already-smoothed path, so ffmpeg's linear interpolation between them closely matches the editor preview.

### 6. Auto-disable at zoom=1

**Decision**: Auto-track has no effect when `backgroundZoom <= 1.0`. The UI control is hidden/disabled at zoom=1. If the user reduces zoom to 1 on a section with auto-track on, the toggle stays on but has no visible effect — it re-activates when zoom is increased again.

**Why**: At zoom=1 the entire screen is visible. Panning has no effect (there's nothing to pan to). Auto-tracking at zoom=1 would compute values that are never used.

## Risks / Trade-offs

**[Risk] IPC polling at 20Hz during recording may add latency** → Mitigation: `getCursorScreenPoint()` is a synchronous Electron API, very fast (<1ms). The IPC round-trip is lightweight. 20Hz polling adds negligible CPU load.

**[Risk] Mouse trail file could be large for very long recordings** → Mitigation: At 20Hz, a 30-minute recording produces ~36,000 entries ≈ 700KB. Acceptable. For extreme cases (2+ hours), consider downsampling on save.

**[Risk] Subsampled render keypoints may not match editor preview perfectly** → Mitigation: Both use the same smoothing algorithm. The subsample rate (2Hz) is dense enough that linear interpolation closely approximates the smooth curve. Visual difference is sub-pixel.

**[Trade-off] Auto-track replaces manual pan entirely when on** → Users who want fine-grained control can turn it off per section. The manual pan values are preserved, so switching back is lossless.

**[Trade-off] Mouse trail only available for new recordings** → Existing recordings made before this feature have no mouse data. Auto-track will be unavailable for those takes. The UI should indicate "no mouse data" gracefully.
