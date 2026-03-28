## ADDED Requirements

### Requirement: Audio file import via drag-and-drop

The user SHALL be able to import audio overlay media by dropping an audio file onto the audio track row in the timeline or onto a designated drop zone. Supported formats: MP3, WAV, AAC, OGG, FLAC, M4A (extensions: `.mp3`, `.wav`, `.aac`, `.ogg`, `.flac`, `.m4a`). The file SHALL be copied to `{projectFolder}/audio-overlay-media/` with a unique filename: `{originalName}-{timestamp}.{ext}`.

#### Scenario: Drop MP3 file onto audio track
- **WHEN** the user drags an MP3 file from their filesystem and drops it on the audio track row
- **THEN** the file is copied to `audio-overlay-media/`, an audio overlay segment is created, and the overlay appears on the audio track at the playhead position

#### Scenario: Drop WAV file onto audio track
- **WHEN** the user drags a WAV file and drops it on the audio track row
- **THEN** the file is copied to `audio-overlay-media/`, an audio overlay segment is created with sourceStart=0, sourceEnd=audio duration (or remaining timeline, whichever is shorter)

#### Scenario: Drop unsupported file type onto audio track
- **WHEN** the user drops a .txt or .png file on the audio track
- **THEN** the drop is ignored (no audio overlay created, no file copied)

### Requirement: Audio overlay media stored in project folder

Imported audio overlay files SHALL be copied to `{projectFolder}/audio-overlay-media/` directory. The directory SHALL be created on first import if it does not exist. The `mediaPath` stored in audio overlay segments SHALL be the project-relative path (e.g., `audio-overlay-media/music-1711234567.mp3`).

#### Scenario: First audio import creates directory
- **WHEN** the user imports the first audio overlay and `audio-overlay-media/` does not exist
- **THEN** the directory is created and the file is copied into it

#### Scenario: Media path is project-relative
- **WHEN** an audio overlay segment is created for file `background-music.mp3`
- **THEN** `mediaPath` is stored as `audio-overlay-media/background-music-1711234567.mp3` (not an absolute path)

### Requirement: Duplicate audio file detection

When importing a file that already exists in `audio-overlay-media/` (same original name), the system SHALL reuse the existing file path rather than creating a duplicate copy. The new audio overlay segment SHALL reference the same `mediaPath`.

#### Scenario: Import same audio file twice
- **WHEN** the user drops `music.mp3` onto the audio track, and `audio-overlay-media/music-1711234567.mp3` already exists with identical content
- **THEN** the new audio overlay segment references the existing `audio-overlay-media/music-1711234567.mp3` without creating a new copy

#### Scenario: Import different file with same name
- **WHEN** the user drops a different `music.mp3` (different content) onto the audio track
- **THEN** a new copy is created with a different timestamp: `audio-overlay-media/music-1711234999.mp3`

### Requirement: Audio overlay media reference counting

The system SHALL track how many audio overlay segments reference each media file. A media file is "referenced" if any audio overlay segment's `mediaPath` points to it. The reference counting scans the full `audioOverlays` array.

#### Scenario: Same audio file used in two overlays
- **WHEN** two audio overlay segments reference `audio-overlay-media/music.mp3` (e.g., after a split)
- **THEN** the reference count for `music.mp3` is 2

#### Scenario: Delete one overlay with shared audio file
- **WHEN** one of two audio overlays referencing `audio-overlay-media/music.mp3` is deleted
- **THEN** the file is NOT staged for deletion (still referenced by the other overlay)

#### Scenario: Delete last reference to audio file
- **WHEN** the only remaining audio overlay referencing `audio-overlay-media/music.mp3` is deleted
- **THEN** `music.mp3` is moved to `.deleted/` staging

### Requirement: Audio overlay media delete staging

When the last audio overlay segment referencing a media file is deleted, the media file SHALL be moved to the `.deleted/` staging folder. When an audio overlay delete is undone, the media file SHALL be unstaged. The undo system's `beforeAudioOverlayPaths`/`afterAudioOverlayPaths` sets SHALL scan the full `audioOverlays` array to correctly detect reference changes.

#### Scenario: Undo restores audio overlay, file unstaged
- **WHEN** the user deletes the last audio overlay referencing a file (staging it), then undoes
- **THEN** the audio overlay is restored and the file is unstaged

### Requirement: Audio overlay media cleanup on project cleanup

When the project cleanup operation runs (removing `.deleted/` contents), staged audio overlay media files SHALL be permanently deleted along with staged take files and visual overlay media files.

#### Scenario: Project cleanup removes staged audio files
- **WHEN** the user triggers project cleanup and `.deleted/` contains audio overlay media files
- **THEN** the audio overlay media files are permanently removed

### Requirement: IPC channel for audio overlay file import

A new IPC channel `import-audio-overlay-media` SHALL be provided that accepts a source file path, copies it to the project's `audio-overlay-media/` directory, and returns the project-relative `mediaPath`. The main process handles the file copy to ensure proper file system access. Additionally, the IPC response SHALL include the audio file's duration in seconds (probed via ffprobe or Web Audio API).

#### Scenario: Import audio via IPC
- **WHEN** the renderer sends `import-audio-overlay-media` with source path `/Users/me/Desktop/music.mp3`
- **THEN** the main process copies the file to `{projectFolder}/audio-overlay-media/music-{timestamp}.mp3` and returns `{ mediaPath: 'audio-overlay-media/music-{timestamp}.mp3', duration: 180.5 }`

#### Scenario: Import audio file with special characters in name
- **WHEN** the renderer sends `import-audio-overlay-media` with a file named `my song (remix).mp3`
- **THEN** the file is copied with the original name sanitized and a timestamp appended
