## ADDED Requirements

### Requirement: Content width calculation for fit mode in reel
The system SHALL compute the actual video content width within the canvas based on `screenFitMode` and source video dimensions. In fit mode, `contentW = sourceW * min(CANVAS_W / sourceW, CANVAS_H / sourceH)`. In fill mode, `contentW = CANVAS_W`. This content width SHALL be used as the basis for all reel crop boundary calculations instead of `CANVAS_W`.

#### Scenario: Content width for 4:3 source in fit mode
- **WHEN** the source video is 1440x1080 and `screenFitMode` is `'fit'`
- **THEN** `contentW` SHALL be `1440 * min(1920/1440, 1080/1080)` = `1440 * 1` = 1440

#### Scenario: Content width for 16:9 source in fit mode
- **WHEN** the source video is 1920x1080 and `screenFitMode` is `'fit'`
- **THEN** `contentW` SHALL be 1920 (no black bars, video fills canvas exactly)

#### Scenario: Content width for narrow vertical source in fit mode
- **WHEN** the source video is 608x1080 and `screenFitMode` is `'fit'`
- **THEN** `contentW` SHALL be 608

#### Scenario: Content width in fill mode
- **WHEN** `screenFitMode` is `'fill'` regardless of source dimensions
- **THEN** `contentW` SHALL be `CANVAS_W` (1920)

#### Scenario: Content width when source dimensions unavailable
- **WHEN** `sourceWidth` or `sourceHeight` is null, undefined, or zero
- **THEN** `contentW` SHALL default to `CANVAS_W` (1920), preserving existing behavior

### Requirement: Crop boundaries constrained to content edges
In reel mode, the crop region SHALL NOT extend beyond the actual video content edges. The crop pixel offset SHALL be calculated using `contentW` instead of `CANVAS_W`, ensuring the 608px reel strip stays within the content area.

#### Scenario: Crop at left edge with 4:3 source in fit mode
- **WHEN** `reelCropX` is -1, source is 1440x1080, and `screenFitMode` is `'fit'`
- **THEN** the crop pixel offset SHALL be `(1920 - 1440) / 2` = 240 (aligned to content left edge, not canvas left edge)

#### Scenario: Crop at right edge with 4:3 source in fit mode
- **WHEN** `reelCropX` is 1, source is 1440x1080, and `screenFitMode` is `'fit'`
- **THEN** the crop pixel offset SHALL be `240 + (1440 - 608)` = 1072 (aligned to content right edge)

#### Scenario: Crop at center with 4:3 source in fit mode
- **WHEN** `reelCropX` is 0, source is 1440x1080, and `screenFitMode` is `'fit'`
- **THEN** the crop pixel offset SHALL be `240 + (1440 - 608) / 2` = 656 (centered within content)

#### Scenario: Crop in fill mode unchanged
- **WHEN** `screenFitMode` is `'fill'` and `reelCropX` is -1
- **THEN** the crop pixel offset SHALL be 0 (same as current behavior, `contentW` = `CANVAS_W`)

#### Scenario: Content narrower than reel width locks crop at center
- **WHEN** the source is very narrow such that `contentW` < `REEL_CANVAS_W` (608)
- **THEN** `maxCropRange` SHALL be 0 and the crop SHALL be centered within the content

### Requirement: Drag interaction respects content bounds
When the user drags the crop region in reel mode, the drag-to-cropX conversion SHALL use `contentW` instead of `CANVAS_W` to map pixel deltas to `reelCropX` values.

#### Scenario: Dragging in fit mode with narrower content
- **WHEN** the user drags the crop region in fit mode with a 4:3 source
- **THEN** the drag sensitivity SHALL be based on `contentW` (1440), not `CANVAS_W` (1920)
- **AND** the crop SHALL stop at the content edges, never entering the black bar area

### Requirement: FFmpeg reel crop uses content width
The `buildScreenFilter()` function SHALL use `contentW` instead of `landscapeW` when calculating `maxOffset` for the reel crop in the FFmpeg filter chain. This applies to all three reel pipelines: standard, static zoom-out, and animated zoom-out.

#### Scenario: FFmpeg crop with 4:3 source in fit mode
- **WHEN** rendering in reel mode with a 1440x1080 source in fit mode
- **THEN** `maxOffset` SHALL be `1440 - 608` = 832 (not `1920 - 608` = 1312)
- **AND** the crop X offset SHALL be shifted by `contentLeft` = `(1920 - 1440) / 2` = 240

#### Scenario: FFmpeg crop in fill mode unchanged
- **WHEN** rendering in reel mode with fill mode
- **THEN** `maxOffset` SHALL be `landscapeW - finalW` (unchanged from current behavior)

#### Scenario: FFmpeg crop with animated reelCropX in fit mode
- **WHEN** rendering in reel mode with animated crop and fit mode
- **THEN** the dynamic crop X expression SHALL use `contentW` and `contentLeft` to constrain the crop within content bounds
