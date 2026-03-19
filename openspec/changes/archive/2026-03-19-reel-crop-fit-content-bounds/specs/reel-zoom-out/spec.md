## MODIFIED Requirements

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
