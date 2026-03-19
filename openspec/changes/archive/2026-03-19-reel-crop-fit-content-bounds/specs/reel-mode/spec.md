## MODIFIED Requirements

### Requirement: Crop pixel offset calculation
The conversion from `reelCropX` (-1 to +1) to pixel X offset SHALL use the actual content width (accounting for fit mode) instead of the full canvas width. The formula SHALL be: `contentLeft = (CANVAS_W - contentW) / 2`, `pixelOffset = contentLeft + ((reelCropX + 1) / 2) * max(0, contentW - cropWidth)`, where `contentW` is the actual video content width within the canvas. In fill mode, `contentW = CANVAS_W` (preserving existing behavior). In fit mode, `contentW = sourceW * min(CANVAS_W / sourceW, CANVAS_H / sourceH)`.

#### Scenario: Center crop calculation in fill mode
- **WHEN** `reelCropX` is 0, `screenFitMode` is `'fill'`, and source is 1920x1080 with 608px crop
- **THEN** pixel offset SHALL be `((0 + 1) / 2) * (1920 - 608)` = 656

#### Scenario: Left edge crop calculation in fill mode
- **WHEN** `reelCropX` is -1 and `screenFitMode` is `'fill'`
- **THEN** pixel offset SHALL be 0

#### Scenario: Right edge crop calculation in fill mode
- **WHEN** `reelCropX` is 1 and `screenFitMode` is `'fill'`
- **THEN** pixel offset SHALL be 1312

#### Scenario: Center crop calculation in fit mode with 4:3 source
- **WHEN** `reelCropX` is 0, `screenFitMode` is `'fit'`, and source is 1440x1080
- **THEN** `contentW` = 1440, `contentLeft` = 240
- **AND** pixel offset SHALL be `240 + ((0 + 1) / 2) * (1440 - 608)` = 656

#### Scenario: Left edge crop in fit mode with 4:3 source
- **WHEN** `reelCropX` is -1, `screenFitMode` is `'fit'`, and source is 1440x1080
- **THEN** pixel offset SHALL be `240 + 0` = 240 (content left edge, not canvas left edge)

#### Scenario: Right edge crop in fit mode with 4:3 source
- **WHEN** `reelCropX` is 1, `screenFitMode` is `'fit'`, and source is 1440x1080
- **THEN** pixel offset SHALL be `240 + (1440 - 608)` = 1072 (content right edge)
