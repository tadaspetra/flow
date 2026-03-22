## Context

The Loop editor has a single-track overlay system where users can place images and videos on top of their screen recording at specific time ranges. The current system enforces a strict no-overlap constraint — only one overlay can be visible at any given moment. The data model uses `timeline.overlays[]` as a flat array sorted by `startTime`, and every layer of the system (normalization, timeline UI, canvas drawing, render pipeline) assumes non-overlapping segments.

Users want to show two overlays simultaneously — e.g., a diagram on the left and a video clip on the right. This requires introducing the concept of overlay tracks, where each track independently enforces no-overlap, but overlays on different tracks can occupy the same time range.

The existing system was designed with these patterns:
- **Flat sorted array** of overlay segments in `timeline.overlays[]`
- **No-overlap enforcement** in `normalizeOverlays()` (data level), `placeOverlayAtTime()` (interaction level)
- **Single active overlay per frame** via `getOverlayStateAtTime()` returning the first match
- **Sequential chaining** in `buildOverlayFilter()` — overlays are composited one after another, non-overlapping
- **Single reusable `<video>` element** for video overlay playback
- **Single DOM row** (`editorOverlayTrack`) for the timeline track
- **Single selection state** (`selectedOverlayId`) — only one overlay selected at a time

## Goals / Non-Goals

**Goals:**
- Support two overlay tracks (track 0 and track 1) where overlays on different tracks can overlap in time
- Track 1 overlays render on top of track 0 overlays (z-order: screen → track 0 → track 1 → PIP)
- Each track enforces no-overlap independently within itself
- Users can select, trim, split, delete, move overlays on either track
- Two video overlays can play simultaneously (one per track)
- The render pipeline correctly composites overlays from both tracks
- Backward-compatible: existing projects with `overlays[]` missing `trackIndex` default to track 0
- The system generalizes cleanly to N tracks (though UI is hardcoded to 2 for now)

**Non-Goals:**
- More than 2 overlay tracks (future work — the data model supports it, but UI only shows 2)
- Drag overlays between tracks (future work — would need track reassignment interaction)
- Track-level mute/solo controls (future work)
- Per-track volume/opacity controls (future work)

## Decisions

### 1. Add `trackIndex` field to overlay segments, keep single array

**Decision**: Add a `trackIndex: number` field (0 or 1) to each overlay segment. Keep all overlays in the single `timeline.overlays[]` array — do NOT split into separate arrays per track.

**Why single array over separate arrays**: The single array pattern is deeply embedded in the codebase — undo snapshots, project save/load, reference counting, and file staging all operate on `editorState.overlays`. Splitting into `overlays0[]` and `overlays1[]` would require touching every one of these systems. With `trackIndex` on a single array, most systems work unchanged (they scan the full array already).

**Overlay segment shape change**:
```javascript
{
  id: string,
  trackIndex: number,          // NEW — 0 or 1, defaults to 0
  mediaPath: string,
  mediaType: 'image' | 'video',
  startTime: number,
  endTime: number,
  sourceStart: number,
  sourceEnd: number,
  landscape: { x, y, width, height },
  reel: { x, y, width, height },
  saved: boolean
}
```

**Backward compatibility**: `normalizeOverlays()` sets `trackIndex = 0` for any segment missing the field. Existing projects load with all overlays on track 0.

### 2. Per-track no-overlap enforcement in `normalizeOverlays()`

**Decision**: Group overlays by `trackIndex`, enforce no-overlap within each group independently, then merge back into a single sorted array (sorted by `trackIndex` then `startTime`).

**Why not global no-overlap**: The entire point is to allow time-overlapping overlays on different tracks. The no-overlap constraint is per-track — two overlays on the same track cannot overlap, but overlays on different tracks can.

**Algorithm**:
```
1. Validate and normalize each overlay (same as before), add trackIndex default
2. Group by trackIndex: { 0: [...], 1: [...] }
3. For each group: sort by startTime, enforce no-overlap (same trimming logic)
4. Merge groups back: sort by [trackIndex, startTime]
```

**Sort order**: The final array is sorted by `trackIndex` first (track 0 before track 1), then by `startTime` within each track. This makes it easy to filter by track: `overlays.filter(o => o.trackIndex === t)`.

### 3. `placeOverlayAtTime()` filters by `trackIndex`

**Decision**: When computing collisions for placement/move, only consider overlays on the same track. The function receives the `trackIndex` of the overlay being placed.

**Current code**: `const others = editorState.overlays.filter(o => o.id !== movingId);`
**New code**: `const others = editorState.overlays.filter(o => o.id !== movingId && o.trackIndex === trackIndex);`

This is a one-line change. The rest of the collision resolution logic works unchanged.

### 4. Two overlay track rows in timeline UI

**Decision**: Add a second `<div>` row in the timeline. Track 1 row is visually above track 0 row (matching the z-order — higher track = higher in timeline = rendered on top).

**DOM structure**:
```html
<div id="editorOverlayTrack1" class="relative h-6 border-b border-neutral-700"
     style="background: rgba(99,102,241,0.08)"></div>
<div id="editorOverlayTrack0" class="relative h-6 border-b border-neutral-700"
     style="background: rgba(99,102,241,0.08)"></div>
<!-- existing section track below -->
```

**`renderOverlayMarkers()` change**: Filter overlays by `trackIndex` and render into the corresponding track element. The function is called once but renders into two containers.

### 5. Per-track canvas drawing with `getOverlayStateAtTime()`

**Decision**: Call `getOverlayStateAtTime()` twice in the draw loop — once with track 0 overlays, once with track 1 overlays. Draw track 0 result first (lower z), then track 1 (higher z), both before PIP.

**Current code**:
```javascript
const overlayState = getOverlayStateAtTime(editorState.currentTime);
if (overlayState.active) { /* draw */ }
```

**New code**:
```javascript
const track0Overlays = editorState.overlays.filter(o => o.trackIndex === 0);
const track1Overlays = editorState.overlays.filter(o => o.trackIndex === 1);
const ovlState0 = _getOverlayStateAtTime(time, track0Overlays, outputMode);
const ovlState1 = _getOverlayStateAtTime(time, track1Overlays, outputMode);
if (ovlState0.active) { /* draw track 0 overlay */ }
if (ovlState1.active) { /* draw track 1 overlay */ }
```

**`getOverlayStateAtTime()` itself is unchanged** — it already operates on a passed-in array. The caller filters by track.

### 6. Two reusable `<video>` elements for overlay playback

**Decision**: Create two reusable `<video>` elements, one per track. Each tracks its own currently-loaded source and sync state.

**Why two elements**: Two video overlays can now be active simultaneously (one per track). A single shared element would need to be swapped between sources on every frame, which is impractical.

**Naming**: `overlayVideoEl0` and `overlayVideoEl1`, managed independently. Each has its own `currentOverlaySrc` tracking variable.

### 7. Hit-testing priority: track 1 before track 0

**Decision**: When clicking on the canvas, check track 1 overlay bounds first, then track 0 overlay bounds, then PIP. Higher tracks have higher z-order and win clicks.

**Why**: Track 1 is drawn on top of track 0. If they visually overlap on canvas, the user sees track 1 on top, so clicking should interact with track 1.

**Implementation**: In the `mousedown` handler, check `ovlState1` first, then `ovlState0`. The existing `selectedOverlayId` remains a single value — clicking a track 1 overlay selects it (and any track 0 overlay selection is cleared, since `selectedOverlayId` is singular).

### 8. Render pipeline: sort by track, chain sequentially

**Decision**: Before passing overlays to `buildOverlayFilter()`, sort them by `[trackIndex, startTime]`. The filter builder processes them in order: all track 0 overlays first, then all track 1 overlays. Since track 1 overlays are composited after track 0, they render on top.

**Filter chain**:
```
[screen] → ovl_0_0 → ovl_0_1 → ... → ovl_1_0 → ovl_1_1 → ... → [screen_ovl]
            ───── track 0 ─────        ───── track 1 ─────
```

**Cross-track time overlap handling**: Two overlays from different tracks CAN have overlapping `enable='between(t,...)'` windows. This is fine — they're composited sequentially. At time T where both are active, track 0's overlay is drawn first, then track 1's overlay is drawn on top. FFmpeg handles this correctly since each overlay filter has its own enable window.

**`buildOverlayFilter()` changes**: Minimal. The function already chains overlays sequentially. The only change is that same-media transition detection must also check `trackIndex` — position interpolation only applies between adjacent segments on the **same track**.

### 9. Drop target: default to track 0, option to select track

**Decision**: When dropping media onto the canvas, the overlay is added to track 0 by default. When dropping onto a specific track row in the timeline, the overlay is added to that track.

**Why default to track 0**: Most users will start with track 0. Adding a track selection UI on every drop would add friction. Users who want track 1 can drop onto the track 1 row or move the overlay to track 1 later.

**Timeline drop**: Each track row is a drop target. Dropping on `editorOverlayTrack1` sets `trackIndex: 1`, dropping on `editorOverlayTrack0` sets `trackIndex: 0`.

### 10. Selection model unchanged — single `selectedOverlayId`

**Decision**: Keep the existing single `selectedOverlayId`. When an overlay is selected (from either track), its ID is stored. Operations (split, trim, delete, move) apply to the selected overlay, which has a `trackIndex` that determines which track's constraints apply.

**Why not per-track selection**: Multi-selection adds complexity (which overlay receives keyboard shortcuts? which track gets the split?). A single selection model is simpler and matches the user mental model of "click something, then act on it."

## Risks / Trade-offs

**[Risk] Performance of per-frame track filtering** → The draw loop calls `.filter()` on the overlays array twice per frame (once per track). For typical overlay counts (< 20), this is negligible. If it becomes an issue, the filter results can be cached and invalidated on overlay mutation.

**[Risk] Same-media transition detection across tracks** → The existing transition detection (`prev.mediaPath === o.mediaPath`) could false-positive if the same media file is used on both tracks. The fix is to also check `prev.trackIndex === o.trackIndex`. Must be done in both `getOverlayStateAtTime()` (editor) and `buildOverlayFilter()` (render).

**[Risk] Undo/redo with two video elements** → Undo might restore overlays that change which tracks have active videos. The video sync logic already re-evaluates on seek/restore, so this should work. Test carefully.

**[Trade-off] Only 2 tracks, not N** → The data model supports N tracks, but UI is hardcoded to 2 rows. This is intentional — keeps UI simple. Adding track 3 later requires only adding a DOM element and adjusting the filter/draw loops.

**[Trade-off] No drag between tracks** → Users cannot drag an overlay from track 0 to track 1. They would need to delete and re-add. This can be added later as a right-click menu option or modifier-key drag. For now, the simplest interaction model.
