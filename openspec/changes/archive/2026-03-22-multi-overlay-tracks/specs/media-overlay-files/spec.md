## MODIFIED Requirements

### Requirement: Overlay media reference counting

The system SHALL track how many overlay segments reference each media file, across ALL tracks. A media file is "referenced" if any overlay segment's `mediaPath` points to it, regardless of `trackIndex`. The existing reference counting logic scans the full `overlays` array and does not need to filter by track.

#### Scenario: Same file referenced on two tracks
- **WHEN** a track 0 overlay and a track 1 overlay both reference `overlay-media/img.png`
- **THEN** the reference count for `img.png` is 2

#### Scenario: Delete overlay on track 0 with same file on track 1
- **WHEN** a track 0 overlay referencing `overlay-media/img.png` is deleted, but a track 1 overlay also references it
- **THEN** the file is NOT staged for deletion (still referenced by the track 1 overlay)

#### Scenario: Delete last reference across both tracks
- **WHEN** the only remaining overlay referencing `overlay-media/vid.mp4` (on any track) is deleted
- **THEN** `vid.mp4` is moved to `.deleted/` staging

### Requirement: Overlay media delete staging

When the last overlay segment referencing a media file is deleted (across all tracks), the media file SHALL be moved to the `.deleted/` staging folder. When an overlay delete is undone, the media file SHALL be unstaged. The undo system's `beforeOverlayPaths`/`afterOverlayPaths` sets SHALL scan the full `overlays` array (all tracks) to correctly detect reference changes.

#### Scenario: Undo restores overlay, file unstaged
- **WHEN** the user deletes the last overlay referencing a file (staging it), then undoes
- **THEN** the overlay is restored (with its `trackIndex` preserved) and the file is unstaged

### Requirement: Drop media onto specific track via timeline

When dropping media files onto a specific track row in the timeline UI, the imported overlay SHALL have its `trackIndex` set to the target track. When dropping onto the canvas, `trackIndex` defaults to 0. The file import IPC channel is unchanged — `trackIndex` is a renderer-side concern set after import.

#### Scenario: Drop onto track 1 timeline row
- **WHEN** the user drops an image onto the track 1 timeline row
- **THEN** the overlay is created with `trackIndex: 1` and placed at the playhead position on track 1

#### Scenario: Drop onto canvas defaults to track 0
- **WHEN** the user drops a video onto the editor canvas
- **THEN** the overlay is created with `trackIndex: 0`
