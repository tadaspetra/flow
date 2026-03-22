## MODIFIED Requirements

### Requirement: Video overlay playback sync

When the playhead is within a video overlay's time range, the system SHALL display the video frame corresponding to `sourceStart + (playheadTime - startTime)`. The system SHALL maintain TWO reusable `<video>` elements for overlay video playback — one per track. Each video element is managed independently and tracks its own currently-loaded source.

#### Scenario: Seek into video overlay on track 0
- **WHEN** the user seeks to 7s and a video overlay on track 0 exists at 5-12s with sourceStart=2
- **THEN** the track 0 overlay video element displays the frame at source time 4s (2 + (7-5))

#### Scenario: Two simultaneous video overlays
- **WHEN** playback is at 7s, a track 0 video overlay exists at 5-12s, and a track 1 video overlay exists at 6-10s
- **THEN** both video elements are active, each displaying their respective source frames independently

#### Scenario: Video overlay source time boundary
- **WHEN** an overlay video reaches sourceEnd during playback
- **THEN** the video frame freezes at the last frame (does not loop)

### Requirement: Image overlay display at playhead

When the playhead is within an image overlay's time range, the system SHALL draw the image on the editor canvas at the overlay's current-mode position and size. Images are loaded once and cached. Multiple image overlays from different tracks can be displayed simultaneously.

#### Scenario: Two simultaneous image overlays
- **WHEN** playhead is at 6s, a track 0 image overlay exists at 5-10s, and a track 1 image overlay exists at 4-8s
- **THEN** both images are drawn on the canvas at their respective positions (track 0 behind track 1)

### Requirement: Overlay fade transitions

Overlays SHALL fade in over `TRANSITION_DURATION` (0.3s) at their `startTime` and fade out over `TRANSITION_DURATION` at their `endTime`. Each track's overlay fades independently. Two overlays from different tracks can both be mid-fade simultaneously.

#### Scenario: Track 0 overlay fading out while track 1 fading in
- **WHEN** track 0 overlay ends at 8s and track 1 overlay starts at 7.5s
- **THEN** at time 7.85s, track 0 is at ~50% opacity (fading out) and track 1 is at ~100% opacity (fade-in complete). Both are drawn.

### Requirement: Position interpolation between consecutive same-media segments

When two adjacent overlay segments reference the same `mediaPath` AND are on the same `trackIndex`, with the time gap between them being 0, the system SHALL interpolate position and size over `TRANSITION_DURATION`. Position interpolation SHALL NOT occur between segments on different tracks, even if they share the same `mediaPath`.

#### Scenario: Smooth position transition between split segments on same track
- **WHEN** segment A (track 0, 5-10s, position 100,100) and segment B (track 0, 10-15s, position 500,300) share the same mediaPath
- **THEN** at time 9.85s, the overlay position is interpolated 50% between A and B

#### Scenario: No interpolation for same media on different tracks
- **WHEN** segment A (track 0, 5-10s, image1.png) and segment B (track 1, 10-15s, image1.png) share mediaPath but are on different tracks
- **THEN** segment A fades out at 10s and segment B fades in at 10s — no position interpolation

### Requirement: Overlay state computation function

The system SHALL provide a function `getOverlayStateAtTime(time, overlays, outputMode)` that returns the current overlay state for a given set of overlays. The caller SHALL filter overlays by `trackIndex` before calling. The function is called once per track in the draw loop. The function itself is unchanged — it operates on whatever array is passed in.

#### Scenario: Called with track 0 overlays only
- **WHEN** `getOverlayStateAtTime(6, track0Overlays, 'landscape')` is called
- **THEN** it returns the state of the active track 0 overlay at time 6, or `{ active: false }` if none

#### Scenario: Called with track 1 overlays only
- **WHEN** `getOverlayStateAtTime(6, track1Overlays, 'landscape')` is called
- **THEN** it returns the state of the active track 1 overlay at time 6, independent of track 0
