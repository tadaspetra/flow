## Why

The current overlay system supports only a single overlay track with a hard no-overlap constraint — users can show at most one overlay media at any given moment. Users want to layer two overlays simultaneously (e.g., a diagram on the left and a video clip on the right), which requires multiple overlay tracks. Rather than duplicating the entire overlay system for a second track, we generalize the existing system to support N tracks using a `trackIndex` field, starting with two tracks.

## What Changes

- **`trackIndex` field on overlay segments** — each overlay segment gains a `trackIndex` (0 or 1) that identifies which track it belongs to. The no-overlap constraint is enforced per-track, not globally. Overlays on different tracks can overlap in time.
- **Per-track normalization** — `normalizeOverlays()` groups overlays by `trackIndex` and enforces no-overlap within each group independently, then merges back into a single sorted array.
- **Second overlay track row in timeline UI** — a second `<div>` row appears above the existing overlay track. Each track row renders only overlays with its `trackIndex`. Track 1 (index 1) is visually above Track 0 (index 0).
- **Multi-overlay canvas drawing** — the editor draw loop calls `getOverlayStateAtTime()` once per track, drawing Track 0 first (lower z-order) then Track 1 on top, both between screen and PIP.
- **Second overlay video element** — since two video overlays can now be active simultaneously, the editor maintains two reusable `<video>` elements, one per track.
- **Per-track selection** — `selectedOverlayId` continues to identify one selected overlay. Selection, split, trim, delete, and move operations apply to the selected overlay regardless of track. When an overlay is selected, the UI highlights which track it belongs to.
- **Per-track no-overlap in placement** — `placeOverlayAtTime()` filters by `trackIndex` when computing collisions, so overlays only collide with others on the same track.
- **Render pipeline: two-pass overlay compositing** — `buildOverlayFilter()` is called once with all overlays (sorted by track then time). Track 0 overlays are composited first, then Track 1 overlays on top, maintaining the z-order: screen → track 0 overlays → track 1 overlays → PIP.
- **Drop target: track selection** — when dropping media, the user drops onto a specific track row (or the canvas defaults to track 0). A UI affordance lets the user choose which track to add to.
- **Reference counting across all overlays** — file staging/unstaging checks the full `overlays` array regardless of `trackIndex`, since it's still a single array.
- **Undo/redo unchanged** — the snapshot already captures the full `overlays` array, so undo/redo works automatically.

## Capabilities

### New Capabilities

- `multi-overlay-track-data`: Extension of the overlay data model to support `trackIndex` — field addition, per-track normalization, per-track no-overlap enforcement, backward compatibility (overlays without `trackIndex` default to 0).
- `multi-overlay-track-timeline`: Timeline UI for multiple overlay track rows — rendering N track rows, per-track band rendering, per-track trim/move with track-scoped collision detection, drop target per track.
- `multi-overlay-track-canvas`: Canvas drawing and interaction for multiple simultaneous overlays — multi-overlay drawing per frame (one per track), z-order (track 0 below track 1), hit-testing across tracks (higher track wins), drag/resize applies to selected overlay's track.
- `multi-overlay-track-playback`: Editor playback with two simultaneous overlays — two reusable `<video>` elements (one per track), independent sync/seek per track, both drawn in draw loop.
- `multi-overlay-track-render`: Render pipeline for multi-track overlays — compositing track 0 then track 1 in the ffmpeg filter chain, handling simultaneous overlays from different tracks at the same time position.

### Modified Capabilities

- `media-overlay-data`: The overlay segment shape gains a `trackIndex` field. `normalizeOverlays()` must group by track before enforcing no-overlap. Default `trackIndex` is 0 for backward compatibility.
- `media-overlay-timeline`: The single overlay track DOM element becomes multiple track rows. `renderOverlayMarkers()` must filter by `trackIndex`. Selection remains global (one selected overlay across all tracks).
- `media-overlay-canvas`: `getOverlayStateAtTime()` is called per track. Canvas drawing draws multiple overlays per frame. Hit-testing checks higher tracks first.
- `media-overlay-playback`: A second `<video>` element is needed. Sync logic runs per track independently.
- `media-overlay-render`: `buildOverlayFilter()` must handle overlays that can overlap in time (from different tracks). Track ordering determines z-order in the filter chain.
- `media-overlay-files`: Reference counting already checks the full `overlays` array — no structural change, but the `beforeOverlayPaths`/`afterOverlayPaths` sets in undo/redo must remain correct (they already scan the full array, so no change needed).

## Impact

- **`src/shared/domain/project.js`** — `normalizeOverlays()` adds `trackIndex` field, groups by track for no-overlap enforcement. `DEFAULT_OVERLAY_POSITION` unchanged. No new exports needed.
- **`src/renderer/app.js`** — `enterEditor()` unchanged (overlays already loaded as array). `snapshotTimeline()` unchanged (captures full array). `renderOverlayMarkers()` splits into per-track rendering. `placeOverlayAtTime()` filters by `trackIndex`. Draw loop calls `getOverlayStateAtTime()` per track. Canvas interaction hit-tests both tracks. Second `<video>` element created. Drop handler supports track selection.
- **`src/renderer/features/timeline/overlay-utils.js`** — `getOverlayStateAtTime()` unchanged (caller filters overlays by track before calling).
- **`src/main/services/render-filter-service.js`** — `buildOverlayFilter()` handles overlays sorted by track then time. Overlays from different tracks at the same time get separate overlay filter nodes chained sequentially (track 0 first, track 1 on top).
- **`src/main/services/render-service.js`** — overlay integration unchanged structurally (still passes overlays array to `buildOverlayFilter`), but overlays are sorted by track before passing.
- **`src/index.html`** — second overlay track `<div>` added above the existing one.
- **No new dependencies** — uses existing infrastructure throughout.
