## MODIFIED Requirements

### Requirement: Overlay track rendered above section track

The timeline area SHALL render TWO overlay track rows positioned ABOVE the section track. Track 1 (higher z-order) SHALL be above track 0 in the timeline. Both track rows SHALL always be visible, even when empty (as drop target areas). Each track row SHALL display a subtle track label or visual differentiation.

#### Scenario: Empty overlay tracks visible
- **WHEN** the editor is active with no overlay segments
- **THEN** two empty overlay track rows are visible above the section track in the timeline area

#### Scenario: Overlay tracks with items on both tracks
- **WHEN** overlay segments exist on track 0 and track 1
- **THEN** each track row renders only the overlay bands belonging to its track index

#### Scenario: Single track has items
- **WHEN** overlay segments exist only on track 0
- **THEN** track 0 row shows the overlay bands, track 1 row remains empty but visible

### Requirement: Overlay segment rendering in timeline

Each overlay segment SHALL be rendered as a band in its corresponding track row (determined by `trackIndex`). Positioning within the row uses `(startTime / duration) * 100%` with width `((endTime - startTime) / duration) * 100%`. The band SHALL display:
- A thumbnail or icon indicating the media type (image icon for images, video icon for videos)
- A truncated filename label
- Visual distinction between selected and unselected segments

#### Scenario: Overlay band on track 1
- **WHEN** an overlay segment with `trackIndex: 1` spans 2-8s in a 20s timeline
- **THEN** the band appears in the track 1 row at 10% left with 30% width

#### Scenario: Selected overlay visual feedback
- **WHEN** an overlay segment is selected (clicked)
- **THEN** the segment band has a highlighted border/background distinct from unselected segments, regardless of which track it is on

### Requirement: Overlay segment selection

Clicking an overlay segment in either track row SHALL select it, setting `editorState.selectedOverlayId` to the segment's ID. Only one overlay can be selected at a time across all tracks. Selecting an overlay SHALL deselect any selected section. Clicking a section SHALL deselect any selected overlay.

#### Scenario: Select overlay on track 1 deselects overlay on track 0
- **WHEN** an overlay on track 0 is selected and the user clicks an overlay on track 1
- **THEN** `selectedOverlayId` changes to the track 1 overlay's ID

#### Scenario: Select overlay deselects section
- **WHEN** section 2 is selected and the user clicks an overlay segment on either track
- **THEN** `selectedOverlayId` is set to the overlay's ID, the overlay is highlighted, and the section selection is dimmed

#### Scenario: Select section deselects overlay
- **WHEN** an overlay is selected and the user clicks a section in the section track
- **THEN** `selectedOverlayId` is set to null and the section is selected normally

### Requirement: Overlay trim handles

When an overlay segment is selected, trim handles SHALL appear on its left and right edges in the timeline, within the track row corresponding to its `trackIndex`. Dragging a trim handle SHALL adjust the overlay's `startTime` or `endTime`. Trim clamping SHALL only consider other overlays on the same track (not overlays on different tracks).

#### Scenario: Trim overlay right edge with neighbor on same track
- **WHEN** the user drags the right trim handle of a track 0 overlay at 5-10s, and another track 0 overlay starts at 12s
- **THEN** the overlay's `endTime` can extend up to 12s (clamped by same-track neighbor)

#### Scenario: Trim overlay right edge with neighbor on different track
- **WHEN** the user drags the right trim handle of a track 0 overlay at 5-10s, and a track 1 overlay starts at 8s
- **THEN** the track 1 overlay does NOT constrain the trim — they are on different tracks

### Requirement: No overlay overlap enforcement

When adding, trimming, or moving an overlay, the system SHALL prevent time overlap with other overlay segments on the SAME track. Overlays on different tracks SHALL NOT affect each other's collision detection. If an operation would cause same-track overlap, the system SHALL clamp the values to avoid it.

#### Scenario: Move overlay collides with same-track neighbor
- **WHEN** the user moves a track 0 overlay to overlap with another track 0 overlay
- **THEN** the collision is resolved (push or clamp) within track 0 only

#### Scenario: Move overlay does not collide with different-track overlay
- **WHEN** the user moves a track 0 overlay to a time position occupied by a track 1 overlay
- **THEN** no collision — the move succeeds without adjustment

### Requirement: Drop media onto specific track

When dropping media files onto the editor, the target track SHALL be determined by:
- If dropped onto a specific track row in the timeline, the overlay is added to that track's `trackIndex`
- If dropped onto the canvas area, the overlay defaults to track 0

#### Scenario: Drop image onto track 1 row
- **WHEN** the user drops an image file onto the track 1 timeline row
- **THEN** an overlay segment is created with `trackIndex: 1`

#### Scenario: Drop video onto canvas
- **WHEN** the user drops a video file onto the editor canvas
- **THEN** an overlay segment is created with `trackIndex: 0` (default)

#### Scenario: Drop onto track 0 row
- **WHEN** the user drops a media file onto the track 0 timeline row
- **THEN** an overlay segment is created with `trackIndex: 0`
