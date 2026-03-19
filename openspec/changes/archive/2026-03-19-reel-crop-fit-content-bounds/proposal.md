## Why

In reel (9:16) mode with `screenFitMode: 'fit'`, the source video may be narrower than the 1920px canvas, creating black bars on the sides. The crop region currently slides across the full 1920px canvas width, allowing the 608px reel strip to capture these black bars. The crop should be constrained to the actual video content edges so the reel output never contains black side bars.

## What Changes

- Crop boundary calculations in the editor preview (`reelCropXToPixelOffset`) will use the actual content width instead of `CANVAS_W` when in fit mode
- Drag interaction math will use content width for pixel-to-cropX conversion
- FFmpeg reel crop filters will account for fit-mode content width when calculating `maxOffset`
- When zoom-out and fit mode are combined, both constraints stack: `contentW * zoom` determines the crop range
- Top/bottom behavior in zoom-out remains unchanged (blurred/darkened fill continues to work as before)

## Capabilities

### New Capabilities
- `reel-fit-crop-bounds`: Constrain reel crop region to actual video content edges in fit mode, preventing black bars from appearing in the reel output

### Modified Capabilities
- `reel-mode`: Crop pixel offset calculation requirement changes to use content width instead of canvas width when fit mode is active
- `reel-zoom-out`: Zoom-out crop constraint changes to use `contentW * zoom` instead of `CANVAS_W * zoom` when fit mode is active

## Impact

- `src/renderer/app.js`: `reelCropXToPixelOffset()`, crop drag handler, crop overlay drawing
- `src/main/services/render-filter-service.js`: `buildScreenFilter()` reel crop calculations (standard, static zoom-out, animated zoom-out pipelines)
- No new dependencies, no API changes, no data model changes
