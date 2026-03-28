## ADDED Requirements

### Requirement: AudioOverlay segment data shape

Each audio overlay segment SHALL have the following structure:
- `id`: unique string identifier, format `audio-overlay-{timestamp}-{counter}`
- `trackIndex`: number identifying which audio track this segment belongs to (0). Defaults to 0 if missing.
- `mediaPath`: project-relative path to the audio file (e.g., `audio-overlay-media/music-123.mp3`)
- `startTime`: number, position on rendered timeline in seconds (>= 0)
- `endTime`: number, end position on rendered timeline in seconds (> startTime)
- `sourceStart`: number, playback start within the source audio file in seconds (>= 0)
- `sourceEnd`: number, playback end within the source audio file in seconds (> sourceStart)
- `volume`: number, playback volume for this segment (0.0 to 1.0, default 1.0)
- `saved`: boolean, marks if the segment is favorited/saved

All numeric values SHALL be non-negative finite numbers.

#### Scenario: Valid audio overlay segment
- **WHEN** an audio overlay segment is created with all required fields and valid values
- **THEN** the segment is accepted and stored in the audioOverlays array

#### Scenario: Audio overlay with zero volume
- **WHEN** an audio overlay segment has `volume: 0`
- **THEN** the segment is accepted — zero volume is valid (muted but still present on timeline)

#### Scenario: Audio overlay with default volume
- **WHEN** an audio overlay segment is created without specifying volume
- **THEN** `volume` defaults to 1.0

### Requirement: AudioOverlay segment normalization

The system SHALL provide a `normalizeAudioOverlays(rawAudioOverlays)` function that:
- Returns an empty array for non-array input
- Filters out segments with invalid or missing `id` or `mediaPath`
- Sets `trackIndex` to 0 if missing, invalid, or not a non-negative integer
- Clamps `trackIndex` to the valid range (0 to `MAX_AUDIO_TRACKS - 1`, currently 0)
- Clamps `startTime` and `endTime` to non-negative values
- Ensures `endTime > startTime` (removes segments with zero or negative duration)
- Ensures `sourceStart >= 0` and `sourceEnd > sourceStart`
- Sets `sourceStart = 0` and `sourceEnd = endTime - startTime` if source values are missing or invalid
- Clamps `volume` to 0.0–1.0 range, defaults to 1.0 if missing or invalid
- Sets `saved` to false if missing
- Groups segments by `trackIndex`
- Within each group: sorts by `startTime` and removes overlapping segments (later segment is trimmed or discarded)
- Merges groups back into a single array sorted by `[trackIndex, startTime]`

#### Scenario: Normalize empty input
- **WHEN** `normalizeAudioOverlays(null)` is called
- **THEN** an empty array is returned

#### Scenario: Normalize overlapping segments on same track
- **WHEN** two audio segments on track 0 overlap in time (segment A: 2-8s, segment B: 5-12s)
- **THEN** the later segment (B) has its `startTime` adjusted to 8s, or is discarded if that leaves zero duration

#### Scenario: Normalize missing volume
- **WHEN** an audio overlay segment has no `volume` field
- **THEN** `volume` is set to 1.0

#### Scenario: Normalize volume out of range
- **WHEN** an audio overlay segment has `volume: 1.5`
- **THEN** `volume` is clamped to 1.0

#### Scenario: Normalize negative volume
- **WHEN** an audio overlay segment has `volume: -0.3`
- **THEN** `volume` is clamped to 0.0

#### Scenario: Normalize missing sourceStart/sourceEnd
- **WHEN** an audio overlay segment has startTime=5, endTime=15 and no sourceStart/sourceEnd fields
- **THEN** `sourceStart` is set to 0 and `sourceEnd` is set to 10 (endTime - startTime)

#### Scenario: Output array sort order
- **WHEN** audio overlays exist on track 0 at times 10s, 5s, 3s
- **THEN** the normalized array is sorted as: [track0@3s, track0@5s, track0@10s]

### Requirement: AudioOverlay ID generation

The system SHALL provide a `generateAudioOverlayId()` function that returns a unique string in the format `audio-overlay-{timestamp}-{counter}` where timestamp is `Date.now()` and counter is a monotonically increasing integer. No two calls SHALL return the same ID within a session.

#### Scenario: Generate unique audio overlay IDs
- **WHEN** `generateAudioOverlayId()` is called twice in rapid succession
- **THEN** two different IDs are returned

#### Scenario: Audio overlay ID format
- **WHEN** `generateAudioOverlayId()` is called
- **THEN** the returned string matches the pattern `audio-overlay-{number}-{number}`

### Requirement: No audio overlay time overlap

The audioOverlays array SHALL NOT contain two segments on the same track whose time ranges overlap. When adding or trimming an audio overlay, the system SHALL enforce that no two segments on the same `trackIndex` occupy the same time position.

#### Scenario: Attempt to add overlapping audio overlay on same track
- **WHEN** the user adds an audio overlay at 5-10s on track 0 and an existing audio overlay on track 0 occupies 7-12s
- **THEN** the system prevents the overlap (either adjusts timing or rejects the add)

### Requirement: AudioOverlay persistence in project timeline

Audio overlay segments SHALL be stored in `project.timeline.audioOverlays` and persisted with the project. Saved (removed) audio overlays SHALL be stored in `project.timeline.savedAudioOverlays`. The `normalizeProjectData` function SHALL normalize both arrays on project load. The `getProjectTimelineSnapshot` function SHALL include `audioOverlays` and `savedAudioOverlays` in the saved payload.

#### Scenario: Project save includes audio overlays
- **WHEN** the project is saved with audio overlay segments on the timeline
- **THEN** the saved project JSON includes `timeline.audioOverlays` with each segment's fields preserved

#### Scenario: Project load with no audio overlays (backward compatibility)
- **WHEN** a project from before audio overlay support is loaded (no `audioOverlays` field)
- **THEN** `audioOverlays` defaults to an empty array and `savedAudioOverlays` defaults to an empty array

#### Scenario: Project load restores saved audio overlays
- **WHEN** a project with saved+removed audio overlays is reopened
- **THEN** `savedAudioOverlays` is restored and appears in the sidebar

### Requirement: Audio overlay constants

The system SHALL define:
- `MAX_AUDIO_TRACKS = 1` — number of audio overlay tracks
- `AUDIO_OVERLAY_EXTENSIONS = ['.mp3', '.wav', '.aac', '.ogg', '.flac', '.m4a']` — supported audio file extensions
- `DEFAULT_AUDIO_VOLUME = 1.0` — default volume for new audio overlays and sections

#### Scenario: Audio file extension validation
- **WHEN** a file with extension `.mp3` is checked against AUDIO_OVERLAY_EXTENSIONS
- **THEN** it is recognized as a valid audio overlay file

#### Scenario: Unsupported audio extension
- **WHEN** a file with extension `.midi` is checked against AUDIO_OVERLAY_EXTENSIONS
- **THEN** it is NOT recognized as a valid audio overlay file
