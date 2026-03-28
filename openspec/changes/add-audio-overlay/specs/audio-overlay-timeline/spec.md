## ADDED Requirements

### Requirement: Audio overlay track rendered between media overlay tracks and waveform

The timeline area SHALL render ONE audio overlay track row positioned BELOW the media overlay tracks and ABOVE the section waveform/marker area. The track row SHALL always be visible, even when empty (as a drop target area). The track row SHALL have a subtle visual differentiation (e.g., different background tint than media overlay tracks).

#### Scenario: Empty audio track visible
- **WHEN** the editor is active with no audio overlay segments
- **THEN** one empty audio overlay track row is visible between the media overlay tracks and the waveform

#### Scenario: Timeline layout order
- **WHEN** the timeline is rendered
- **THEN** the vertical order from top to bottom is: media overlay track 1, media overlay track 0, audio overlay track 0, waveform/section markers, playhead scrubber

### Requirement: Audio overlay segment rendering in timeline

Each audio overlay segment SHALL be rendered as a band in the audio track row. Positioning within the row uses `(startTime / duration) * 100%` with width `((endTime - startTime) / duration) * 100%`. The band SHALL display:
- A waveform thumbnail (pre-decoded audio peaks drawn on a mini canvas)
- A truncated filename label
- Visual distinction between selected and unselected segments (highlighted border/background for selected)

#### Scenario: Audio overlay band positioning
- **WHEN** an audio overlay spans 5-15s in a 30s timeline
- **THEN** the band appears at 16.67% left with 33.33% width

#### Scenario: Selected audio overlay visual feedback
- **WHEN** an audio overlay segment is selected
- **THEN** the segment band has a highlighted border/background distinct from unselected segments

#### Scenario: Waveform thumbnail in band
- **WHEN** an audio overlay segment is rendered in the timeline
- **THEN** a mini waveform (pre-decoded peaks) is drawn within the band area

### Requirement: Audio overlay segment selection

Clicking an audio overlay segment in the track row SHALL select it, setting `editorState.selectedAudioOverlayId` to the segment's ID. Only one item can be selected at a time across all track types (media overlays, audio overlays, sections). Selecting an audio overlay SHALL deselect any selected section or media overlay. Selecting a section or media overlay SHALL deselect any selected audio overlay.

#### Scenario: Select audio overlay deselects media overlay
- **WHEN** a media overlay is selected and the user clicks an audio overlay segment
- **THEN** `selectedAudioOverlayId` is set to the audio overlay's ID, `selectedOverlayId` is set to null

#### Scenario: Select audio overlay deselects section
- **WHEN** a section is selected and the user clicks an audio overlay segment
- **THEN** `selectedAudioOverlayId` is set to the audio overlay's ID, section selection is cleared

#### Scenario: Select section deselects audio overlay
- **WHEN** an audio overlay is selected and the user clicks a section
- **THEN** `selectedAudioOverlayId` is set to null, the section is selected normally

#### Scenario: Select media overlay deselects audio overlay
- **WHEN** an audio overlay is selected and the user clicks a media overlay
- **THEN** `selectedAudioOverlayId` is set to null, the media overlay is selected

### Requirement: Audio overlay trim handles

When an audio overlay segment is selected, trim handles SHALL appear on its left and right edges in the timeline track row. Dragging a trim handle SHALL adjust the overlay's `startTime` or `endTime` (and correspondingly adjust `sourceStart` or `sourceEnd` to maintain the mapping between timeline position and source audio). Trim clamping SHALL only consider other audio overlays on the same track. Trim SHALL respect a minimum duration (e.g., 0.1s).

#### Scenario: Trim right edge extends audio overlay
- **WHEN** the user drags the right trim handle of an audio overlay at 5-10s rightward to 12s
- **THEN** `endTime` becomes 12s and `sourceEnd` increases by 2s (if source has enough duration)

#### Scenario: Trim left edge shortens audio overlay
- **WHEN** the user drags the left trim handle of an audio overlay at 5-10s rightward to 7s
- **THEN** `startTime` becomes 7s and `sourceStart` increases by 2s

#### Scenario: Trim clamped by same-track neighbor
- **WHEN** the user drags the right trim handle of a track 0 audio overlay at 5-10s, and another track 0 audio overlay starts at 12s
- **THEN** `endTime` can extend up to 12s (clamped by same-track neighbor)

#### Scenario: Trim clamped by minimum duration
- **WHEN** the user drags the left trim handle so close to endTime that duration would be < 0.1s
- **THEN** the trim is clamped to maintain at least 0.1s duration

### Requirement: Audio overlay split at playhead

When an audio overlay segment is selected and the user triggers split, the overlay SHALL be split at the current playhead position into two segments. Both segments reference the same `mediaPath` and inherit the parent's `volume`. The `sourceEnd` of the first segment and `sourceStart` of the second segment are adjusted to the split point in source time.

#### Scenario: Split audio overlay
- **WHEN** an audio overlay (3-12s, sourceStart=0, sourceEnd=9, volume=0.7) is selected and playhead is at 7s
- **THEN** segment 1: [3-7s, sourceStart=0, sourceEnd=4, volume=0.7], segment 2: [7-12s, sourceStart=4, sourceEnd=9, volume=0.7]

#### Scenario: Split preserves volume
- **WHEN** an audio overlay with `volume: 0.5` is split
- **THEN** both resulting segments have `volume: 0.5`

#### Scenario: Split fails when playhead outside audio overlay
- **WHEN** an audio overlay (5-10s) is selected but playhead is at 3s
- **THEN** split does nothing (playhead not within overlay time range)

### Requirement: Audio overlay delete

When an audio overlay segment is selected and the user triggers delete, the segment SHALL be removed from the audioOverlays array. The associated media file SHALL be staged for deletion only if no other audio overlay segments reference the same `mediaPath`. Undo SHALL restore the deleted segment.

#### Scenario: Delete audio overlay with unique media
- **WHEN** the only audio overlay referencing `audio-overlay-media/music.mp3` is deleted
- **THEN** the segment is removed and `music.mp3` is staged to `.deleted/`

#### Scenario: Delete audio overlay with shared media
- **WHEN** an audio overlay referencing `audio-overlay-media/music.mp3` is deleted, but another audio overlay also references it
- **THEN** the segment is removed but `music.mp3` is NOT staged (still referenced)

#### Scenario: Undo audio overlay delete
- **WHEN** an audio overlay delete is undone
- **THEN** the segment is restored and the media file is unstaged from `.deleted/` if it was staged

### Requirement: Audio overlay undo/redo support

All audio overlay operations (add, delete, trim, split, volume change, save/unsave) SHALL be undoable and redoable. The undo snapshot SHALL include `audioOverlays` and `savedAudioOverlays` arrays. `pushUndo()` SHALL be called before any mutation.

#### Scenario: Undo audio overlay add
- **WHEN** the user adds an audio overlay and then presses undo
- **THEN** the audio overlay is removed from the timeline

#### Scenario: Undo volume change
- **WHEN** the user changes an audio overlay's volume from 1.0 to 0.5 and presses undo
- **THEN** the volume returns to 1.0

#### Scenario: Redo after undo
- **WHEN** the user undoes an audio overlay split and then presses redo
- **THEN** the split is reapplied

### Requirement: Drop audio onto audio track row

When dropping audio files onto the audio track row in the timeline UI, the imported audio overlay SHALL be created on track 0 with `startTime` at the playhead position. If the drop position conflicts with an existing audio overlay, the new overlay SHALL be placed at the next available gap after the playhead. The overlay's `endTime` SHALL be `startTime + sourceDuration` (or clamped to timeline end / next overlay start).

#### Scenario: Drop audio file onto audio track
- **WHEN** the user drops an MP3 file onto the audio overlay track row with the playhead at 5s
- **THEN** an audio overlay is created with `trackIndex: 0`, `startTime: 5`, and `endTime` based on the audio file's duration

#### Scenario: Drop audio onto occupied position
- **WHEN** the user drops an audio file at playhead position 5s, but an existing audio overlay occupies 3-8s on track 0
- **THEN** the new audio overlay is placed starting at 8s (first available gap)

#### Scenario: Drop non-audio file onto audio track
- **WHEN** the user drops a PNG file onto the audio overlay track row
- **THEN** the drop is ignored (only audio extensions accepted)
