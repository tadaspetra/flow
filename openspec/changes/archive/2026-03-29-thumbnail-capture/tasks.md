## 1. Types & Interfaces

- [x] 1.1 Add `ThumbnailCaptureOptions` interface to `src/shared/types/services.ts` with fields: `takes`, `keyframes` (single frozen keyframe), `overlays` (visible at capture time), `sourceTime`, `cameraSyncOffsetMs`, `sourceWidth`, `sourceHeight`, `outputMode`, `screenFitMode`, `pipSize`, `projectFolder`
- [x] 1.2 Add `captureThumbnail(opts: ThumbnailCaptureOptions): Promise<string>` to the `ElectronAPI` interface in `src/shared/types/ipc.ts`

## 2. Thumbnail Service (main process)

- [x] 2.1 Create `src/main/services/thumbnail-service.ts` with a `captureThumbnail(opts, deps?)` function that: resolves output dimensions via `resolveOutputSize`, builds the FFmpeg filter graph using `buildScreenFilter`/`buildFilterComplex`/`buildOverlayFilter` from `render-filter-service.ts`, constructs the FFmpeg args with `-ss {sourceTime}` input seek, `-frames:v 1 -update 1` single-frame output, and PNG output path `thumbnail-{timestamp}-{mode}.png`
- [x] 2.2 Handle camera input: include camera `-ss` seek (with `cameraSyncOffsetMs` offset) only when the frozen keyframe has `pipVisible: true` or `cameraFullscreen: true`; skip camera input entirely otherwise
- [x] 2.3 Handle overlay inputs: for each visible overlay, add the appropriate FFmpeg input flags (image: `-loop 1 -t 0.1 -i`; video: `-ss {overlaySourceTime} -i`) and include overlay filter parts from `buildOverlayFilter`
- [x] 2.4 Return the absolute path of the saved PNG file

## 3. Thumbnail Service Tests

- [x] 3.1 Add unit tests in `tests/unit/thumbnail-service.test.ts` covering: landscape-only capture (no camera, no overlays) produces correct FFmpeg args with `-frames:v 1`, correct output path pattern, and correct filter graph
- [x] 3.2 Add unit tests for camera PIP capture: when frozen keyframe has `pipVisible: true`, camera input is included with correct seek time; when `cameraFullscreen: true`, camera fills frame
- [x] 3.3 Add unit tests for camera hidden: when frozen keyframe has `pipVisible: false` and `cameraFullscreen: false`, no camera input in FFmpeg args
- [x] 3.4 Add unit tests for camera sync offset: camera seek time = screenSourceTime + cameraSyncOffsetMs/1000
- [x] 3.5 Add unit tests for reel mode: output dimensions match `resolveOutputSize` for reel, filter graph uses reel parameters
- [x] 3.6 Add unit tests for overlay inclusion: image overlay produces `-loop 1 -t 0.1 -i` input, overlay filter parts included in filter graph
- [x] 3.7 Add unit tests for output path: filename matches `thumbnail-{timestamp}-{mode}.png` pattern, file is placed in `projectFolder`

## 4. IPC & Preload Bridge

- [x] 4.1 Register `ipcMain.handle('capture-thumbnail', ...)` in `src/main/ipc/register-handlers.ts` that calls the `captureThumbnail` service function and returns the output path
- [x] 4.2 Add `captureThumbnail` entry to the preload API object in `src/preload.ts`: `captureThumbnail: (opts) => ipcRenderer.invoke('capture-thumbnail', opts)`

## 5. Renderer: Shortcut & Capture Logic

- [x] 5.1 Add Ctrl+T / Cmd+T handler to the `keydown` listener in `src/renderer/app.ts` (after the existing `editorState` / `activeWorkspaceView` / rendering guards): check `e.code === 'KeyT' && (e.ctrlKey || e.metaKey)`, call `e.preventDefault()`, invoke the capture function
- [x] 5.2 Implement the renderer-side `captureThumbnail()` function that: resolves playhead time to source time via `resolveTimeToSource`, computes the interpolated keyframe state at the playhead time, filters overlays visible at the playhead time, gathers take info, and calls `window.electronAPI.captureThumbnail(opts)`
- [x] 5.3 Add a `capturingThumbnail` boolean flag for debounce: set true before calling IPC, set false on completion or error, ignore Ctrl+T when flag is true

## 6. UI: Toast Notification

- [x] 6.1 Add a `<div id="editorThumbnailToast">` element to the editor section in `src/index.html`, styled with Tailwind (fixed position, rounded, dark background, white text, hidden by default)
- [x] 6.2 Implement `showThumbnailToast(message: string)` in `src/renderer/app.ts` that removes the `hidden` class, sets the text, and uses `setTimeout` (~2 seconds) to re-add `hidden`
- [x] 6.3 Call `showThumbnailToast` with "Capturing..." when capture starts, then update to "Thumbnail saved" on success, or "Capture failed" on error

## 7. Keyboard Help Text

- [x] 7.1 Update the keyboard shortcut help text in the editor UI (if present in `index.html`) to include `Ctrl+T` for thumbnail capture

## 8. Verification

- [x] 8.1 Run `npm run check` (typecheck + lint + tests) and ensure all pass
- [x] 8.2 Manual smoke test: open a project, seek to a frame, press Ctrl+T, verify PNG appears in project folder at correct resolution and visual content
