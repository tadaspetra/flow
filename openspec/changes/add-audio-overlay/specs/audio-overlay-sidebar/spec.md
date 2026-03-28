## ADDED Requirements

### Requirement: Audio overlay items in Overlays sidebar tab

The Overlays sidebar tab SHALL display audio overlay items in a separate section below the media overlay items. The section SHALL have a header label "Audio" to distinguish it from media overlays. Audio overlay items SHALL be sorted by `startTime`. Both active and saved+removed audio overlays SHALL appear (saved ones at reduced opacity with a re-add button).

#### Scenario: Overlays tab with both media and audio overlays
- **WHEN** the Overlays tab is active and both media overlays and audio overlays exist
- **THEN** media overlays are listed first, followed by an "Audio" section header, then audio overlay items

#### Scenario: Overlays tab with only audio overlays
- **WHEN** no media overlays exist but audio overlays do
- **THEN** the media overlay section is empty/hidden, and the audio overlay section shows items

#### Scenario: Audio overlay item display
- **WHEN** an audio overlay exists with mediaPath `audio-overlay-media/music-123.mp3`, startTime=5, endTime=35, volume=0.7
- **THEN** the item shows: filename ("music-123.mp3"), time range ("00:05 – 00:35"), volume control (🔊 0.70), and heart icon

### Requirement: Audio overlay selection from sidebar

Clicking an audio overlay item in the sidebar SHALL select it (setting `selectedAudioOverlayId`), seek the playhead to the overlay's `startTime`, and highlight the corresponding band in the audio timeline track. Only one item can be selected at a time (across sections, media overlays, and audio overlays).

#### Scenario: Click audio overlay in sidebar
- **WHEN** the user clicks an audio overlay item in the sidebar
- **THEN** `selectedAudioOverlayId` is set to the overlay's ID, playhead moves to startTime, the timeline band is highlighted

#### Scenario: Click audio overlay deselects section
- **WHEN** a section is selected and the user clicks an audio overlay in the sidebar
- **THEN** the section is deselected and the audio overlay is selected

### Requirement: Audio overlay save/unsave (heart toggle)

Each audio overlay item in the sidebar SHALL display a heart icon. Clicking the heart SHALL toggle the overlay's `saved` state. Outline heart = unsaved, filled heart = saved. The toggle SHALL push an undo point before changing state.

#### Scenario: Save audio overlay
- **WHEN** the user clicks the heart icon on an active audio overlay
- **THEN** the heart becomes filled and `saved` is set to true

#### Scenario: Unsave active audio overlay
- **WHEN** the user clicks the filled heart on an active saved audio overlay
- **THEN** the heart becomes outline and `saved` is set to false

### Requirement: Saved+removed audio overlay display

When an audio overlay with `saved: true` is deleted, it SHALL be moved to `savedAudioOverlays` and appear in the sidebar at reduced opacity with a [+] re-add button. Clicking [+] SHALL re-add it to the timeline at its original position (or nearest available gap).

#### Scenario: Delete saved audio overlay
- **WHEN** the user deletes an audio overlay with `saved: true`
- **THEN** the overlay moves to `savedAudioOverlays` and appears grayed out in the sidebar with [+]

#### Scenario: Re-add saved audio overlay
- **WHEN** the user clicks [+] on a saved+removed audio overlay
- **THEN** the overlay returns to `audioOverlays` at its original time position, appears at full opacity

#### Scenario: Unsave removed audio overlay
- **WHEN** the user clicks the filled heart on a saved+removed audio overlay
- **THEN** the overlay is removed from `savedAudioOverlays` entirely, disappears from the sidebar

### Requirement: Volume drag control on audio overlay sidebar items

Each audio overlay item in the sidebar SHALL display a volume icon (🔊/🔉/🔇 based on level) and a volume value. The icon and value SHALL be wrapped in a scrub-drag interaction (using the same `initScrubDrag()` pattern as the zoom control). Dragging left/right SHALL adjust the overlay's `volume` from 0.0 to 1.0.

**Interaction parameters:**
- Hidden range input: `min=0, max=1, step=0.01`
- Sensitivity: `1 / 200 = 0.005` per pixel (drag 200px = full range)
- Cursor: `ew-resize` during drag
- Display format: volume value with 2 decimal places (e.g., "0.70")
- `pushUndo()` SHALL be called on mousedown (before the first value change)
- History is NOT pushed during drag (debounced to single undo entry)

#### Scenario: Drag volume from 1.0 to 0.5
- **WHEN** the user drags the volume control leftward by 100 pixels (starting at 1.0)
- **THEN** volume decreases to 0.5 (100 × 0.005 = 0.5 reduction)

#### Scenario: Drag volume to zero
- **WHEN** the user drags the volume control fully left (>200px leftward from 1.0)
- **THEN** volume clamps to 0.0 and the icon changes to 🔇

#### Scenario: Volume icon updates based on level
- **WHEN** volume is > 0.5, the icon shows 🔊
- **WHEN** volume is > 0 and <= 0.5, the icon shows 🔉
- **WHEN** volume is 0, the icon shows 🔇

### Requirement: Volume drag control on section sidebar items

Each section item in the Segments sidebar tab SHALL display a volume icon and value, using the same scrub-drag interaction as audio overlay volume. This controls the section's `volume` field (screen recording audio volume for that section).

**Interaction parameters:** Same as audio overlay volume (min=0, max=1, step=0.01, sensitivity 0.005/px).

#### Scenario: Adjust section volume
- **WHEN** the user drags the volume control on a section item from 1.0 to 0.7
- **THEN** the section's `volume` field updates to 0.7

#### Scenario: Mute section
- **WHEN** the user drags the section volume to 0.0
- **THEN** the section's `volume` is 0.0, the icon shows 🔇, and the screen audio for that section will be muted in render

#### Scenario: Default section volume display
- **WHEN** a section has no custom volume (default 1.0)
- **THEN** the volume control shows 🔊 1.00

#### Scenario: Section volume undo
- **WHEN** the user changes a section's volume from 1.0 to 0.3 and presses undo
- **THEN** the section's volume returns to 1.0 and the display updates

### Requirement: Volume controls visible in appropriate tabs

Volume controls for sections SHALL be visible in the Segments tab. Volume controls for audio overlays SHALL be visible in the Overlays tab. Both use the same interaction pattern and visual style.

#### Scenario: Switch from Segments to Overlays tab
- **WHEN** the user switches from the Segments tab to the Overlays tab
- **THEN** section volume controls are hidden, audio overlay volume controls are visible

#### Scenario: Switch from Overlays to Segments tab
- **WHEN** the user switches from the Overlays tab to the Segments tab
- **THEN** audio overlay volume controls are hidden, section volume controls are visible
