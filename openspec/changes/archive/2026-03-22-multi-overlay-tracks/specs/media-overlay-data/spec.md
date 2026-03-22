## MODIFIED Requirements

### Requirement: Overlay segment data shape

Each overlay segment SHALL have the following structure:
- `id`: unique string identifier, format `overlay-{timestamp}-{counter}`
- `trackIndex`: number identifying which overlay track this segment belongs to (0 or 1). Defaults to 0 if missing.
- `mediaPath`: project-relative path to the media file (e.g., `overlay-media/image-123.png`)
- `mediaType`: either `'image'` or `'video'`
- `startTime`: number, position on rendered timeline in seconds (>= 0)
- `endTime`: number, end position on rendered timeline in seconds (> startTime)
- `sourceStart`: number, for video — source playback start in seconds (>= 0). For images, SHALL be 0.
- `sourceEnd`: number, for video — source playback end in seconds (> sourceStart). For images, SHALL equal `endTime - startTime`.
- `landscape`: object `{ x, y, width, height }` — position/size in landscape canvas coordinates (1920×1080 space)
- `reel`: object `{ x, y, width, height }` — position/size in reel canvas coordinates (608×1080 space)

All numeric position/size values are pixel values. Values MAY exceed canvas boundaries (overflow is allowed).

#### Scenario: Valid overlay segment with trackIndex
- **WHEN** an overlay segment is created with all required fields, valid values, and `trackIndex: 1`
- **THEN** the segment is accepted and stored in the overlays array with `trackIndex: 1`

#### Scenario: Overlay with overflow position
- **WHEN** an overlay segment has `landscape.x = -100` (partially off-screen left)
- **THEN** the segment is accepted — negative or oversized coordinates are valid

#### Scenario: Overlay without trackIndex (backward compatibility)
- **WHEN** an overlay segment from an older project has no `trackIndex` field
- **THEN** `trackIndex` defaults to 0

### Requirement: Overlay segment normalization

The system SHALL provide a `normalizeOverlays(rawOverlays)` function that:
- Returns an empty array for non-array input
- Filters out segments with invalid or missing `id`, `mediaPath`, or `mediaType`
- Sets `trackIndex` to 0 if missing, invalid, or not a non-negative integer
- Clamps `trackIndex` to the valid range (0 to `MAX_OVERLAY_TRACKS - 1`, currently 0-1)
- Clamps `startTime` and `endTime` to non-negative values
- Ensures `endTime > startTime` (removes segments with zero or negative duration)
- Ensures `sourceStart >= 0` and `sourceEnd > sourceStart` for video overlays
- Sets `sourceStart = 0` and `sourceEnd = endTime - startTime` for image overlays
- Validates `landscape` and `reel` objects have numeric `x, y, width, height` (defaults: `{ x: 0, y: 0, width: 400, height: 300 }`)
- Groups segments by `trackIndex`
- Within each group: sorts by `startTime` and removes overlapping segments (later segment is trimmed or discarded)
- Merges groups back into a single array sorted by `[trackIndex, startTime]`

#### Scenario: Normalize empty input
- **WHEN** `normalizeOverlays(null)` is called
- **THEN** an empty array is returned

#### Scenario: Normalize overlapping segments on same track
- **WHEN** two segments on track 0 overlap in time (segment A: 2-8s, segment B: 5-12s)
- **THEN** the later segment (B) has its `startTime` adjusted to 8s, or is discarded if that leaves zero duration

#### Scenario: Overlapping segments on different tracks are preserved
- **WHEN** segment A on track 0 spans 2-8s and segment B on track 1 spans 5-12s
- **THEN** both segments are preserved as-is — no-overlap is enforced per-track, not globally

#### Scenario: Normalize missing trackIndex
- **WHEN** an overlay segment has no `trackIndex` field
- **THEN** `trackIndex` is set to 0

#### Scenario: Normalize invalid trackIndex
- **WHEN** an overlay segment has `trackIndex: 5` (exceeds max)
- **THEN** `trackIndex` is clamped to `MAX_OVERLAY_TRACKS - 1` (currently 1)

#### Scenario: Normalize video segment with missing sourceStart
- **WHEN** a video overlay segment has no `sourceStart` field
- **THEN** `sourceStart` defaults to 0 and `sourceEnd` defaults to `endTime - startTime`

#### Scenario: Normalize image segment sourceStart/sourceEnd
- **WHEN** an image overlay segment is normalized
- **THEN** `sourceStart` is set to 0 and `sourceEnd` is set to `endTime - startTime` regardless of input values

#### Scenario: Output array sort order
- **WHEN** overlays exist on track 0 (at 5s, 10s) and track 1 (at 3s, 7s)
- **THEN** the normalized array is sorted as: [track0@5s, track0@10s, track1@3s, track1@7s]

### Requirement: No overlay time overlap

The overlays array SHALL NOT contain two segments on the same track whose time ranges overlap. When adding or trimming an overlay, the system SHALL enforce that no two segments on the same `trackIndex` occupy the same time position. Segments on different tracks MAY overlap in time.

#### Scenario: Attempt to add overlapping overlay on same track
- **WHEN** the user adds an overlay at 5-10s on track 0 and an existing overlay on track 0 occupies 7-12s
- **THEN** the system prevents the overlap (either adjusts timing or rejects the add)

#### Scenario: Overlapping overlays on different tracks allowed
- **WHEN** the user adds an overlay at 5-10s on track 1 and an existing overlay on track 0 occupies 7-12s
- **THEN** both overlays coexist — no collision since they are on different tracks

### Requirement: Overlay persistence in project timeline

Overlay segments SHALL be stored in `project.timeline.overlays` and persisted with the project. The `normalizeProjectData` function SHALL normalize the overlays array on project load, including setting default `trackIndex` values. The `getProjectTimelineSnapshot` function SHALL include overlays with their `trackIndex` in the saved payload.

#### Scenario: Project save includes overlays with trackIndex
- **WHEN** the project is saved with overlay segments on track 0 and track 1
- **THEN** the saved project JSON includes `timeline.overlays` with each segment's `trackIndex` preserved

#### Scenario: Project load restores overlays with backward compatibility
- **WHEN** a project from before multi-track support is loaded (overlays have no `trackIndex`)
- **THEN** all overlays are assigned `trackIndex: 0` and appear on track 0
