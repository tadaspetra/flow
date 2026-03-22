## MODIFIED Requirements

### Requirement: Overlay drawn between screen and PIP in z-order

When the playhead is within overlay segments' time ranges, ALL active overlays (one per track maximum) SHALL be drawn on the editor canvas AFTER the screen recording and BEFORE the PIP camera. Z-order from back to front: screen → track 0 overlay → track 1 overlay → PIP. Up to two overlays can be visible simultaneously.

#### Scenario: Both tracks have active overlays
- **WHEN** playhead is at 6s, a track 0 overlay exists at 5-10s, and a track 1 overlay exists at 4-8s
- **THEN** both overlays are drawn. Track 0 overlay is drawn first (behind), track 1 overlay is drawn second (in front), both behind PIP.

#### Scenario: Only one track has active overlay
- **WHEN** playhead is at 6s and only a track 0 overlay exists at 5-10s
- **THEN** the track 0 overlay is drawn between screen and PIP (same as current single-track behavior)

#### Scenario: No overlay active
- **WHEN** playhead is at 3s and no overlay on either track covers this time
- **THEN** no overlay is drawn on the canvas

### Requirement: Overlay position and size reflect current mode

Each active overlay SHALL be drawn at the position and size stored in the current output mode's slot. In landscape mode, `overlay.landscape.{x, y, width, height}` is used. In reel mode, `overlay.reel.{x, y, width, height}` is used, offset by the reel crop position. This applies independently for each track's active overlay.

#### Scenario: Landscape mode with two overlays
- **WHEN** output mode is landscape, track 0 overlay has `landscape: { x: 100, y: 50, width: 400, height: 300 }`, and track 1 overlay has `landscape: { x: 800, y: 200, width: 300, height: 200 }`
- **THEN** both overlays are drawn at their respective positions on the 1920×1080 canvas

### Requirement: Overlay hit-testing priority

When the user clicks on the editor canvas, hit-testing SHALL check track 1 overlay bounds FIRST, then track 0 overlay bounds, then PIP bounds. Higher track index has higher priority. Only the currently-selected overlay segment's canvas region responds to drag/resize.

#### Scenario: Click on overlapping track 0 and track 1 overlays
- **WHEN** a track 0 overlay and track 1 overlay occupy the same canvas area and the user clicks that area
- **THEN** the track 1 overlay is selected (higher z-order wins)

#### Scenario: Click on track 0 overlay with no track 1 overlay
- **WHEN** only a track 0 overlay is at the click position
- **THEN** the track 0 overlay interaction starts

#### Scenario: Click on overlay that is not selected
- **WHEN** the user clicks on an overlay's canvas region but that overlay segment is not selected in the timeline
- **THEN** the click does NOT start overlay drag (falls through to next layer in priority)

### Requirement: Overlay free-placement drag

When the user clicks on a visible overlay on the canvas (and the overlay's segment is selected in the timeline), mouse drag SHALL move the overlay freely. The position is stored in the current mode's slot. This works identically for overlays on either track. `pushUndo()` SHALL be called before the first position change.

#### Scenario: Drag overlay on track 1
- **WHEN** a selected track 1 overlay is dragged from (200, 100) to (500, 300) in landscape mode
- **THEN** `overlay.landscape.x` = 500, `overlay.landscape.y` = 300 — same behavior as track 0

### Requirement: Overlay corner resize with aspect ratio lock

When the user clicks near a corner of a visible selected overlay (within 20px hit area), mouse drag SHALL resize the overlay from that corner while maintaining the original aspect ratio. Works identically for overlays on either track. The opposite corner stays anchored. Minimum size SHALL be 50×50 pixels.

#### Scenario: Resize overlay on track 0
- **WHEN** the user drags the bottom-right corner of a track 0 overlay
- **THEN** the overlay resizes with aspect ratio maintained, same as before

### Requirement: Visual selection handles for active overlays

When an overlay is selected and visible on the canvas, corner resize handles (small squares) SHALL be drawn at the overlay's corners. For non-selected overlays that are visible on canvas, no handles are drawn. If two overlays from different tracks are both visible, only the selected one shows handles.

#### Scenario: Two visible overlays, one selected
- **WHEN** track 0 and track 1 overlays are both visible, and the track 0 overlay is selected
- **THEN** the track 0 overlay shows corner handles, the track 1 overlay does not
