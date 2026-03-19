## ADDED Requirements

### Requirement: Zoom-out range in reel mode
The system SHALL allow `backgroundZoom` values between 0.5 and 3.0 (inclusive) when `outputMode` is `'reel'`. In landscape mode, the zoom range SHALL remain 1.0–3.0. When switching from reel mode to landscape mode, any zoom value below 1.0 SHALL be clamped to 1.0.

#### Scenario: Zoom slider min in reel mode
- **WHEN** the output mode is set to `'reel'`
- **THEN** the zoom slider's minimum value SHALL be 0.5

#### Scenario: Zoom slider min in landscape mode
- **WHEN** the output mode is set to `'landscape'`
- **THEN** the zoom slider's minimum value SHALL be 1.0

#### Scenario: Zoom clamping on mode switch
- **WHEN** a section has `backgroundZoom` of 0.7 and the user switches from reel to landscape mode
- **THEN** the section's `backgroundZoom` SHALL be clamped to 1.0

#### Scenario: Domain normalizer accepts reel zoom values
- **WHEN** `normalizeBackgroundZoom` is called with value 0.5 and mode `'reel'`
- **THEN** it SHALL return 0.5

#### Scenario: Domain normalizer clamps below reel minimum
- **WHEN** `normalizeBackgroundZoom` is called with value 0.3 and mode `'reel'`
- **THEN** it SHALL return 0.5

### Requirement: Darkened background fill for zoom-out
When `backgroundZoom` is less than 1.0 in reel mode, the system SHALL fill the vertical letterbox bars with a darkened, scaled-up copy of the crop region content. The background content SHALL be darkened to approximately 20–30% of original brightness.

#### Scenario: Editor preview with zoom-out
- **WHEN** reel mode is active and `backgroundZoom` is 0.7
- **THEN** the editor preview SHALL show the content centered vertically within the crop region, with darkened content filling the top and bottom bars

#### Scenario: FFmpeg render with zoom-out
- **WHEN** rendering in reel mode with `backgroundZoom` of 0.7
- **THEN** the output video SHALL show the content centered vertically within the 608x1080 frame, with darkened content filling the top and bottom bars

#### Scenario: Zoom at exactly 1.0
- **WHEN** reel mode is active and `backgroundZoom` is 1.0
- **THEN** no darkened background SHALL be drawn — the content fills the crop region completely (no letterbox bars)

### Requirement: Content scaling during zoom-out
When zoom < 1.0 in reel mode, the content SHALL be scaled uniformly from its actual content width (not canvas width). When `screenFitMode` is `'fit'`, the base content width SHALL be `contentW` (computed from source dimensions), and the scaled width SHALL be `contentW * zoom`. The crop region SHALL be constrained to this scaled content area. Top and bottom blurred/darkened fill behavior remains unchanged.

#### Scenario: Content dimensions at zoom 0.5 in fill mode
- **WHEN** reel mode is active with 1920x1080 source, `screenFitMode` is `'fill'`, and `backgroundZoom` is 0.5
- **THEN** the content SHALL occupy the full 608px width and approximately 342px height, centered vertically (unchanged behavior)

#### Scenario: Crop constraint at zoom 0.7 in fit mode with 4:3 source
- **WHEN** reel mode is active with 1440x1080 source, `screenFitMode` is `'fit'`, and `backgroundZoom` is 0.7
- **THEN** the effective content width for crop SHALL be `1440 * 0.7` = 1008
- **AND** `maxCropRange` SHALL be `1008 - 608` = 400
- **AND** the crop SHALL be constrained within the scaled content bounds, never entering the black bar area

#### Scenario: Crop constraint at zoom 0.7 in fill mode
- **WHEN** reel mode is active with 1920x1080 source, `screenFitMode` is `'fill'`, and `backgroundZoom` is 0.7
- **THEN** the effective content width for crop SHALL be `1920 * 0.7` = 1344
- **AND** `maxCropRange` SHALL be `1344 - 608` = 736 (unchanged behavior)

#### Scenario: FFmpeg zoom-out crop with fit mode
- **WHEN** rendering in reel mode with zoom < 1.0 and `screenFitMode` is `'fit'`
- **THEN** the FFmpeg crop X expression SHALL use `contentW * zoom` as the available width for crop sliding
- **AND** the crop offset SHALL include `contentLeft` to position correctly within the padded canvas

### Requirement: Pan disabled during zoom-out
When `backgroundZoom` is less than 1.0, background pan controls SHALL have no visual effect since the content is fully visible and smaller than the frame.

#### Scenario: Pan has no effect at zoom 0.7
- **WHEN** reel mode is active, `backgroundZoom` is 0.7, and `backgroundPanX` is set to 1.0
- **THEN** the content SHALL remain centered — pan values are ignored when zoom < 1.0

### Requirement: Smooth zoom transitions across 1.0 boundary
When zoom animates between a value below 1.0 and a value above 1.0 (crossing the boundary), the darkened background SHALL fade smoothly rather than appearing/disappearing abruptly.

#### Scenario: Animated zoom from 0.7 to 1.5
- **WHEN** a keyframe transition animates `backgroundZoom` from 0.7 to 1.5
- **THEN** the darkened background SHALL gradually fade out as zoom approaches 1.0, and the content SHALL scale smoothly throughout the transition

### Requirement: Backward compatibility
Existing projects with zoom values between 1.0 and 3.0 SHALL be completely unaffected. The zoom-out pipeline only activates when zoom < 1.0 in reel mode.

#### Scenario: Landscape render unchanged
- **WHEN** rendering in landscape mode with `backgroundZoom` of 2.0
- **THEN** the output SHALL be identical to the output before this change

#### Scenario: Reel render with zoom >= 1 unchanged
- **WHEN** rendering in reel mode with `backgroundZoom` of 1.5
- **THEN** the output SHALL be identical to the output before this change (zoom + crop, no darkened background)
