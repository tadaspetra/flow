## MODIFIED Requirements

### Requirement: Overlay included in ffmpeg filter chain

When overlay segments exist in the render data, the ffmpeg filter chain SHALL composite overlay media between the screen base and the PIP camera overlay. Overlays SHALL be sorted by `[trackIndex, startTime]` before processing. Track 0 overlays are composited first, then track 1 overlays on top. The compositing order SHALL be: screen_base → track 0 overlays → track 1 overlays → PIP camera.

#### Scenario: Render with overlays on both tracks
- **WHEN** rendering a project with a track 0 overlay at 5-10s and a track 1 overlay at 7-12s
- **THEN** the ffmpeg filter chain composites the track 0 overlay first, then the track 1 overlay on top. At time 8s (where both are active), track 1 appears in front of track 0.

#### Scenario: Render with overlays on single track
- **WHEN** rendering a project with overlays only on track 0
- **THEN** the filter chain works identically to the existing single-track behavior

#### Scenario: Render with no overlays
- **WHEN** rendering a project with no overlay segments
- **THEN** the ffmpeg filter chain is unchanged from the existing screen + PIP pipeline

### Requirement: Position interpolation between segments in render

When two adjacent overlay segments share the same `mediaPath` with no time gap AND are on the same `trackIndex`, the overlay position and size SHALL be interpolated over `TRANSITION_DURATION` (0.3s). Position interpolation SHALL NOT occur between segments on different tracks.

#### Scenario: Smooth movement between split segments on same track
- **WHEN** segment A (track 0, 5-10s, position 100,100) and segment B (track 0, 10-15s, position 500,300) share the same mediaPath
- **THEN** the overlay filter uses animated position expressions during t=9.7 to t=10.0

#### Scenario: No interpolation between segments on different tracks
- **WHEN** segment A (track 0, 5-10s, image.png) and segment B (track 1, 10-15s, image.png) share mediaPath
- **THEN** no position interpolation — each overlay has independent fade in/out

### Requirement: Multiple overlays in single render

When overlay segments exist on multiple tracks, the render pipeline SHALL handle them correctly. Overlays are processed in track order (track 0 first, track 1 second). Within each track, overlays are processed by startTime. The sequential chaining produces the correct z-order: later overlays in the chain are composited on top.

#### Scenario: Simultaneous overlays from different tracks
- **WHEN** a track 0 overlay exists at 5-10s and a track 1 overlay exists at 7-12s
- **THEN** the filter chain processes track 0's overlay first, then track 1's overlay. At time 8s, both enable expressions are true, and track 1 renders on top of track 0.

#### Scenario: Multiple overlays on same track with gap
- **WHEN** track 0 has overlays at 2-5s and 8-12s
- **THEN** the filter chain handles them sequentially with separate enable windows, same as current behavior

### Requirement: Build overlay filter function

The `buildOverlayFilter()` function SHALL accept overlays sorted by `[trackIndex, startTime]`. It SHALL process them sequentially, chaining each overlay's output as the next overlay's input. The function SHALL check `trackIndex` equality (in addition to `mediaPath` equality) when detecting same-media transitions for position interpolation.

#### Scenario: No overlays
- **WHEN** `buildOverlayFilter` is called with an empty overlays array
- **THEN** an empty result is returned (no filter modification)

#### Scenario: Overlays on both tracks
- **WHEN** called with track 0 overlays [A@2s, B@8s] and track 1 overlays [C@5s, D@12s]
- **THEN** the filter processes A, B, C, D in order, chaining: `[screen] → [ovl_0] → [ovl_1] → [ovl_2] → [ovl_3]`

### Requirement: Reel mode overlay rendering

In reel mode, overlays from all tracks SHALL use their `reel.{x, y, width, height}` values, scaled to the reel output resolution. Track 0 overlays are composited before track 1 overlays, same as landscape mode.

#### Scenario: Reel render with two-track overlays
- **WHEN** rendering in reel mode with overlays on both tracks
- **THEN** each overlay uses its reel position slot, and track ordering is preserved (track 0 below track 1)
