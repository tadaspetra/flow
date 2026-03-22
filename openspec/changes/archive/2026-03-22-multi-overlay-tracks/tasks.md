## 1. Data Model (media-overlay-data)

- [x] 1.1 Add `MAX_OVERLAY_TRACKS = 2` constant to `src/shared/domain/project.js`
- [x] 1.2 Add `trackIndex` field to overlay segment normalization in `normalizeOverlays()` — default to 0 if missing, clamp to 0..MAX_OVERLAY_TRACKS-1
- [x] 1.3 Modify no-overlap enforcement in `normalizeOverlays()` — group overlays by `trackIndex`, enforce no-overlap within each group, then merge back sorted by `[trackIndex, startTime]`
- [x] 1.4 Add unit tests for `normalizeOverlays` with `trackIndex` — missing trackIndex defaults to 0, invalid trackIndex clamped, per-track no-overlap, cross-track overlap preserved, output sort order
- [x] 1.5 Verify `normalizeProjectData()` passes `trackIndex` through (no changes needed — it calls `normalizeOverlays` which handles it)
- [x] 1.6 Verify `getProjectTimelineSnapshot()` in `app.js` preserves `trackIndex` in overlay deep-copy (the `{ ...o }` spread already copies it)

## 2. Timeline UI (media-overlay-timeline)

- [x] 2.1 Add second overlay track `<div>` in `src/index.html` — `editorOverlayTrack1` above `editorOverlayTrack0`, both above section track
- [x] 2.2 Update `renderOverlayMarkers()` in `app.js` — render overlays into their respective track row based on `trackIndex`. Clear both track containers, filter overlays by trackIndex for each.
- [x] 2.3 Update overlay segment click handlers to work on both track rows — event listeners on both `editorOverlayTrack0` and `editorOverlayTrack1`
- [x] 2.4 Update overlay trim drag handlers to identify which track the trimmed overlay belongs to — trim clamping only considers same-track overlays
- [x] 2.5 Update overlay move drag on timeline — `placeOverlayAtTime()` receives `trackIndex` parameter, filters collision candidates by same track
- [x] 2.6 Add drop event listeners on both track rows — dropping media onto `editorOverlayTrack1` sets `trackIndex: 1`, onto `editorOverlayTrack0` sets `trackIndex: 0`

## 3. Canvas Drawing (media-overlay-canvas)

- [x] 3.1 Update the `getOverlayStateAtTime(time)` wrapper in `app.js` — split into two calls, one per track: filter `editorState.overlays` by `trackIndex`, call `_getOverlayStateAtTime` for each
- [x] 3.2 Update draw loop — draw track 0 overlay state first, then track 1 overlay state, both before PIP. Selection handles only shown on the overlay matching `selectedOverlayId`.
- [x] 3.3 Update overflow visualization — apply the same in-bounds/out-of-bounds alpha drawing for both track overlays independently

## 4. Canvas Interaction (media-overlay-canvas)

- [x] 4.1 Update canvas hit-testing in mousedown — check track 1 overlay bounds first, then track 0, then PIP. The first matching active overlay that is selected starts drag/resize.
- [x] 4.2 Update overlay drag handler — determine which track the selected overlay is on from its `trackIndex`, apply position to correct mode slot (no change needed — already uses `selectedOverlayId` to find the overlay)
- [x] 4.3 Update overlay resize handler — same as drag, no structural change needed since it operates on the selected overlay object

## 5. Playback (media-overlay-playback)

- [x] 5.1 Create second reusable `<video>` element for overlay playback — `overlayVideoEl0` and `overlayVideoEl1`, each with independent source tracking
- [x] 5.2 Update overlay video sync on seek — for each track, compute overlay state, sync the corresponding video element if the active overlay is a video
- [x] 5.3 Update overlay video sync during playback — start/pause each track's video element independently as playhead enters/exits overlay ranges
- [x] 5.4 Update draw loop to use correct video element per track — track 0 overlay draws from `overlayVideoEl0`, track 1 from `overlayVideoEl1`

## 6. Editor State & Operations (media-overlay-data + media-overlay-timeline)

- [x] 6.1 Update `enterEditor()` — no structural change (overlays already loaded as array with `trackIndex` preserved from normalization)
- [x] 6.2 Update `snapshotTimeline()` — no structural change (spread copy `{ ...o }` preserves `trackIndex`)
- [x] 6.3 Update `restoreSnapshot()` — verify `beforeOverlayPaths`/`afterOverlayPaths` scan full array (already do — no change needed)
- [x] 6.4 Update `splitOverlayAtPlayhead()` — new segment inherits `trackIndex` from the parent overlay
- [x] 6.5 Update `deleteSelectedOverlay()` — no structural change (reference counting already scans full array)
- [x] 6.6 Update canvas drop handler — set `trackIndex: 0` as default on new overlay segments created from canvas drop

## 7. Render Pipeline (media-overlay-render)

- [x] 7.1 Update `buildOverlayFilter()` in `render-filter-service.js` — add `trackIndex` check to same-media transition detection: `prev.trackIndex === o.trackIndex && prev.mediaPath === o.mediaPath`
- [x] 7.2 Update overlay integration in `render-service.js` — sort overlays by `[trackIndex, startTime]` before passing to `buildOverlayFilter()`
- [x] 7.3 Add unit tests for `buildOverlayFilter` with multi-track overlays — two tracks with time-overlapping overlays produce correct filter chain, same-media transition only within same track
- [x] 7.4 Add integration test — render with overlays on both tracks, verify ffmpeg args include correct input order and filter chain

## 8. File Management (media-overlay-files)

- [x] 8.1 Verify `stageOverlayFile`/`unstageOverlayFile` in `project-service.js` — no changes needed (operates on file path, not track)
- [x] 8.2 Verify undo/redo overlay path staging — `beforeOverlayPaths`/`afterOverlayPaths` already scan full array, works correctly with `trackIndex`

## 9. Final Verification

- [x] 9.1 Run `npm run check` — all tests pass, lint clean
- [ ] 9.2 Manual test: drop image onto canvas → appears on track 0
- [ ] 9.3 Manual test: drop image onto track 1 timeline row → appears on track 1
- [ ] 9.4 Manual test: place overlays on both tracks at same time → both visible on canvas with correct z-order
- [ ] 9.5 Manual test: select, drag, resize overlays on each track independently
- [ ] 9.6 Manual test: split, trim, delete overlays on each track
- [ ] 9.7 Manual test: render with overlays on both tracks → correct compositing order
- [ ] 9.8 Manual test: save project, close, reopen → overlays on both tracks persist with correct trackIndex
- [ ] 9.9 Manual test: open old project (no trackIndex) → all overlays appear on track 0
