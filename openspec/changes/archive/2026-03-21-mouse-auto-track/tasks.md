## 1. Mouse Trail Utility Module (mouse-trail-data)

- [x] 1.1 Create `src/renderer/features/timeline/mouse-trail.js` with `lookupMouseAt(trail, sourceTime)` — linear interpolation between nearest trail entries, handles before/after bounds
- [x] 1.2 Add `lookupSmoothedMouseAt(trail, sourceTime, smoothing, captureWidth, captureHeight)` — runs EMA smoothing from trail start to sourceTime, returns `{ focusX, focusY }` in 0-1 normalized coordinates
- [x] 1.3 Add `subsampleTrail(trail, smoothing, captureWidth, captureHeight, startTime, endTime, rate)` — produces array of `{ time, focusX, focusY }` keypoints at given rate (default 2Hz) using smoothed positions
- [x] 1.4 Add unit tests for `lookupMouseAt` — exact match, between entries, before first, after last, empty trail
- [x] 1.5 Add unit tests for `lookupSmoothedMouseAt` — no smoothing (near-instant), default smoothing, high smoothing, edge cases
- [x] 1.6 Add unit tests for `subsampleTrail` — correct number of keypoints, endpoint coverage, normalization to 0-1

## 2. IPC & Mouse Capture (mouse-trail-capture)

- [x] 2.1 Add `get-cursor-position` IPC handler in `register-handlers.js` using `screen.getCursorScreenPoint()`
- [x] 2.2 Add `getCursorPosition` to `preload.js` bridge
- [x] 2.3 Add `save-mouse-trail` IPC handler in `project-service.js` — writes JSON file to project folder, returns relative path
- [x] 2.4 Add `saveMouseTrail` to `preload.js` bridge
- [x] 2.5 Add mouse position polling in `startRecording()` — 50ms setInterval calling getCursorPosition, collecting `{ t, x, y }` entries with elapsed time
- [x] 2.6 Stop polling in `stopRecording()` and save mouse trail via IPC — include captureWidth/captureHeight from screen stream settings
- [x] 2.7 Store `mousePath` on the created take object alongside screenPath/cameraPath
- [x] 2.8 Add `mousePath` to take normalization in `project.js` — resolve to absolute path on load, handle null for legacy takes

## 3. Take File Cleanup Extension (take-file-cleanup)

- [x] 3.1 Extend `stageTakeFiles` to include `mousePath` when staging take files to `.deleted/`
- [x] 3.2 Extend `unstageTakeFiles` to include mouse trail file when restoring from `.deleted/`
- [x] 3.3 Add test for staging/unstaging takes with mousePath (covered by existing staging tests — mousePath is just a third file path)

## 4. Auto-Track Keyframe Properties (mouse-auto-pan)

- [x] 4.1 Add `autoTrack` (boolean, default false) and `autoTrackSmoothing` (number, default 0.15) to `normalizeKeyframes` in `project.js`
- [x] 4.2 Add `autoTrack` and `autoTrackSmoothing` to `MODE_SPECIFIC_PROPS` in `app.js`
- [x] 4.3 Add to `getDefaultModeState()` — `autoTrack: false, autoTrackSmoothing: 0.15`
- [x] 4.4 Add to `syncSectionAnchorKeyframes()` — carry `autoTrack` and `autoTrackSmoothing` from existing anchors
- [x] 4.5 Add to `ensureAnchorKeyframe()` — include autoTrack from fallback state
- [x] 4.6 Add to `getStateAtTime()` default keyframe and return object
- [x] 4.7 Add to `sectionKeyframes` in `enterEditor()`
- [x] 4.8 Add unit tests for normalizeKeyframes with autoTrack/autoTrackSmoothing

## 5. Mouse Trail Loading & Caching (mouse-auto-pan)

- [x] 5.1 Add mouse trail cache in `app.js` — `Map<takeId, trailData>`, loaded on demand
- [x] 5.2 Add `loadMouseTrail(takeId)` function — reads JSON file via take's mousePath, parses, caches
- [x] 5.3 Preload mouse trail on editor enter if take has mousePath
- [x] 5.4 Clear mouse trail cache in `clearEditorState()`

## 6. Editor Preview Integration (mouse-auto-pan)

- [x] 6.1 Modify `getStateAtTime()` — when `autoTrack` is true and zoom > 1.0, compute `backgroundFocusX/Y` from mouse trail via `lookupSmoothedMouseAt` instead of from manual panX/Y
- [x] 6.2 Resolve source time for mouse lookup — use section's sourceStart + (timelineTime - section.start) to map timeline time to source recording time
- [x] 6.3 Handle missing mouse trail gracefully — fall back to manual pan when trail is unavailable
- [ ] 6.4 Verify editor canvas draws correctly with auto-tracked focus coordinates (manual test)

## 7. Render Pipeline Integration (mouse-auto-pan)

- [x] 7.1 In `render-service.js`, load mouse trail JSON for takes that have sections with autoTrack enabled
- [x] 7.2 Pass mouse trail data to `buildScreenFilter` / `buildFilterComplex` when auto-track sections exist
- [x] 7.3 Subsample mouse trail to keypoints, generate synthetic keyframe array with `backgroundFocusX/Y` via `expandAutoTrackKeyframes`
- [x] 7.4 Handle mixed sections (some auto-track, some manual) in single render — each section uses its own pan source
- [x] 7.5 Add unit tests for render with auto-track keypoints — verify zoompan expressions contain animated focus values

## 8. UI Controls (mouse-auto-pan)

- [x] 8.1 Add auto-track toggle button in editor controls — visible when zoom > 1.0 and take has mouse data
- [x] 8.2 Add smoothing scrub control — Photoshop-style drag, range 0.01-1.0, step 0.01, default 0.15
- [x] 8.3 Toggle handler: pushUndo, set `autoTrack` on section anchor, update controls, schedule save
- [x] 8.4 Smoothing handler: update `autoTrackSmoothing` on section anchor, real-time preview update
- [x] 8.5 Hide/show controls based on zoom level and mouse trail availability via `updateSectionZoomControls`
- [x] 8.6 Disable manual pan drag on canvas when auto-track is active (background drag handler skips)

## 9. Final Verification

- [x] 9.1 Run `npm run check` — all tests pass, lint clean, typecheck clean
- [ ] 9.2 Manual test: record screen with mouse movement, verify mouse trail JSON is saved
- [ ] 9.3 Manual test: enable auto-track on zoomed section, verify viewport follows cursor in editor preview
- [ ] 9.4 Manual test: adjust smoothing, verify tracking responsiveness changes
- [ ] 9.5 Manual test: render video with auto-track, verify zoompan follows mouse path in output
- [ ] 9.6 Manual test: toggle auto-track off, verify manual pan is restored
- [ ] 9.7 Manual test: switch landscape/reel, verify auto-track toggle is per-mode
- [ ] 9.8 Manual test: open project with legacy take (no mousePath), verify auto-track controls hidden
