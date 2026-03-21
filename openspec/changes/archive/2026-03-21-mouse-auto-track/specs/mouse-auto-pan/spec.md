## ADDED Requirements

### Requirement: Auto-track keyframe properties

Each section anchor keyframe SHALL support `autoTrack: boolean` (default false) and `autoTrackSmoothing: number` (default 0.15, range 0.01-1.0). These properties SHALL be included in `MODE_SPECIFIC_PROPS` so they are saved/restored per layout mode (landscape/reel). They SHALL be normalized in `normalizeKeyframes`.

#### Scenario: Default values
- **WHEN** a keyframe has no autoTrack property
- **THEN** `autoTrack` defaults to false and `autoTrackSmoothing` defaults to 0.15

#### Scenario: Per-mode persistence
- **WHEN** the user enables auto-track in landscape mode and switches to reel mode
- **THEN** the landscape auto-track state is preserved via savedLandscape

### Requirement: Editor preview with auto-track

When `autoTrack` is true on the active section and `backgroundZoom > 1.0`, `getStateAtTime()` SHALL compute `backgroundFocusX` and `backgroundFocusY` from the mouse trail at the current source time instead of from `backgroundPanX/Y`. The existing `drawEditorScreenWithZoom()` uses these focus coordinates unchanged.

#### Scenario: Auto-track active with zoom
- **WHEN** playback is at time 5s, auto-track is on, zoom is 2.0, and the mouse was at screen center at source time 5s
- **THEN** `backgroundFocusX` and `backgroundFocusY` are approximately 0.5 (centered)

#### Scenario: Auto-track active but zoom is 1.0
- **WHEN** auto-track is on but zoom is 1.0
- **THEN** auto-track has no visual effect (full screen visible, no panning)

#### Scenario: Auto-track inactive
- **WHEN** auto-track is off
- **THEN** `backgroundFocusX/Y` are computed from manual `backgroundPanX/Y` as before

#### Scenario: No mouse trail available
- **WHEN** auto-track is on but the take has no `mousePath` (legacy recording)
- **THEN** auto-track falls back to manual pan values (same as off)

### Requirement: FFmpeg render with auto-track

When rendering a section with `autoTrack` enabled and `backgroundZoom > 1.0`, the render pipeline SHALL:
1. Load the mouse trail JSON for the take
2. Compute the smoothed trail for the section's source time range
3. Subsample to ~2 keypoints per second
4. Generate animated `backgroundFocusX/Y` expressions via `buildNumericExpr()`
5. Use these in the zoompan filter's `x` and `y` parameters

#### Scenario: Render auto-tracked section
- **WHEN** a section has auto-track on, zoom=2.0, and mouse trail data exists
- **THEN** the ffmpeg zoompan filter uses animated x/y expressions that follow the smoothed mouse path

#### Scenario: Render section without mouse data
- **WHEN** a section has auto-track on but no mouse trail file exists
- **THEN** rendering falls back to static pan position (same as auto-track off)

#### Scenario: Multiple sections with different auto-track settings
- **WHEN** section 1 has auto-track on and section 2 has it off
- **THEN** section 1 renders with animated pan from mouse trail, section 2 renders with static pan

### Requirement: Manual pan preserved when auto-track is on

When auto-track is enabled, the manual `backgroundPanX/Y` values SHALL be stored but not used for display or render. When auto-track is disabled, the manual pan values SHALL be restored for immediate use.

#### Scenario: Toggle auto-track off restores manual pan
- **WHEN** the user had manual pan at (0.3, -0.2) before enabling auto-track, then disables it
- **THEN** the viewport returns to pan position (0.3, -0.2)

### Requirement: Auto-track UI controls

The editor controls SHALL show an auto-track toggle button and a smoothing scrub control when the selected section has `backgroundZoom > 1.0` and the active take has mouse trail data. The controls SHALL be hidden otherwise.

#### Scenario: Show auto-track controls
- **WHEN** the selected section has zoom=2.0 and the take has a mouse trail
- **THEN** the auto-track toggle and smoothing scrub are visible

#### Scenario: Hide controls at zoom=1
- **WHEN** the section zoom is 1.0
- **THEN** the auto-track controls are hidden

#### Scenario: Hide controls without mouse data
- **WHEN** the take has no `mousePath`
- **THEN** the auto-track controls are hidden

#### Scenario: Toggle auto-track via UI
- **WHEN** the user clicks the auto-track toggle
- **THEN** `autoTrack` is toggled on the section anchor keyframe, pushUndo is called, and the viewport updates

#### Scenario: Adjust smoothing via scrub
- **WHEN** the user drags the smoothing scrub control
- **THEN** `autoTrackSmoothing` is updated on the section anchor keyframe and the viewport tracking responsiveness changes in real-time

### Requirement: Mouse trail loading and caching

When entering the editor with a take that has a `mousePath`, the system SHALL load the mouse trail JSON once and cache it in memory for the session. The cache SHALL be cleared in `clearEditorState()`.

#### Scenario: Load trail on editor enter
- **WHEN** the editor opens with a take that has `mousePath`
- **THEN** the mouse trail is loaded and cached

#### Scenario: Cache cleared on project switch
- **WHEN** the user switches projects
- **THEN** the cached mouse trail is cleared
