## ADDED Requirements

### Requirement: Drag-and-drop media import

The user SHALL be able to import overlay media by dropping an image or video file onto the editor canvas. Supported formats: images (PNG, JPG, JPEG, GIF, WebP), videos (MP4, WebM, MOV). The file SHALL be copied to `{projectFolder}/overlay-media/` with a unique filename: `{originalName}-{timestamp}.{ext}`.

#### Scenario: Drop image file onto canvas
- **WHEN** the user drags a PNG file from their filesystem and drops it on the editor canvas
- **THEN** the file is copied to `overlay-media/`, an overlay segment is created with `mediaType: 'image'`, and the overlay appears on the canvas at the default position

#### Scenario: Drop video file onto canvas
- **WHEN** the user drags an MP4 file and drops it on the editor canvas
- **THEN** the file is copied to `overlay-media/`, an overlay segment is created with `mediaType: 'video'`, sourceStart=0, sourceEnd=video duration (or remaining timeline, whichever is shorter)

#### Scenario: Drop unsupported file type
- **WHEN** the user drops a .txt or .pdf file on the canvas
- **THEN** the drop is ignored (no overlay created, no file copied)

### Requirement: Overlay media stored in project folder

Imported overlay media files SHALL be copied to `{projectFolder}/overlay-media/` directory. The directory SHALL be created on first import if it does not exist. The `mediaPath` stored in overlay segments SHALL be the project-relative path (e.g., `overlay-media/screenshot-1711234567.png`).

#### Scenario: First media import creates directory
- **WHEN** the user imports the first overlay media and `overlay-media/` does not exist
- **THEN** the directory is created and the file is copied into it

#### Scenario: Media path is project-relative
- **WHEN** an overlay segment is created for file `screenshot.png`
- **THEN** `mediaPath` is stored as `overlay-media/screenshot-1711234567.png` (not an absolute path)

### Requirement: Duplicate media file detection

When importing a file that already exists in `overlay-media/` (same original name), the system SHALL reuse the existing file path rather than creating a duplicate copy. The new overlay segment SHALL reference the same `mediaPath`.

#### Scenario: Import same file twice
- **WHEN** the user drops `diagram.png` onto the canvas, and `overlay-media/diagram-1711234567.png` already exists with identical content
- **THEN** the new overlay segment references the existing `overlay-media/diagram-1711234567.png` without creating a new copy

#### Scenario: Import different file with same name
- **WHEN** the user drops a different `diagram.png` (different content) onto the canvas
- **THEN** a new copy is created with a different timestamp: `overlay-media/diagram-1711234999.png`

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

### Requirement: Overlay media cleanup on project cleanup

When the project cleanup operation runs (removing `.deleted/` contents), staged overlay media files SHALL be permanently deleted along with staged take files.

#### Scenario: Project cleanup removes staged overlay files
- **WHEN** the user triggers project cleanup and `.deleted/` contains overlay media files
- **THEN** the overlay media files are permanently removed

### Requirement: IPC channel for overlay file import

A new IPC channel `import-overlay-media` SHALL be provided that accepts a source file path, copies it to the project's `overlay-media/` directory, and returns the project-relative `mediaPath`. The main process handles the file copy to ensure proper file system access.

#### Scenario: Import overlay via IPC
- **WHEN** the renderer sends `import-overlay-media` with source path `/Users/me/Desktop/diagram.png`
- **THEN** the main process copies the file to `{projectFolder}/overlay-media/diagram-{timestamp}.png` and returns `overlay-media/diagram-{timestamp}.png`

### Requirement: Drop media onto specific track via timeline

When dropping media files onto a specific track row in the timeline UI, the imported overlay SHALL have its `trackIndex` set to the target track. When dropping onto the canvas, `trackIndex` defaults to 0. The file import IPC channel is unchanged — `trackIndex` is a renderer-side concern set after import.

#### Scenario: Drop onto track 1 timeline row
- **WHEN** the user drops an image onto the track 1 timeline row
- **THEN** the overlay is created with `trackIndex: 1` and placed at the playhead position on track 1

#### Scenario: Drop onto canvas defaults to track 0
- **WHEN** the user drops a video onto the editor canvas
- **THEN** the overlay is created with `trackIndex: 0`
