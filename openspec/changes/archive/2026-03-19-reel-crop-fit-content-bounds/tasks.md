## 1. Content Width Helper

- [x] 1.1 Add `getContentWidth(sourceW, sourceH, fitMode)` helper in `app.js` that returns `contentW` based on fit/fill mode and source dimensions. Returns `CANVAS_W` for fill mode or missing source dimensions.
- [x] 1.2 Add equivalent `getContentWidth` logic in `render-filter-service.js` (or a shared utility) for FFmpeg filter calculations.

## 2. Editor Preview Crop Bounds

- [x] 2.1 Update `reelCropXToPixelOffset()` in `app.js` to accept `contentW` parameter and use it instead of `CANVAS_W`. Compute `contentLeft = (CANVAS_W - contentW) / 2` and offset the crop within content bounds.
- [x] 2.2 Update all call sites of `reelCropXToPixelOffset()` to pass `contentW` derived from `editorState.sourceWidth`, `editorState.sourceHeight`, and `editorState.screenFitMode`.

## 3. Drag Interaction

- [x] 3.1 Update crop drag handler to use `contentW` instead of `CANVAS_W` when converting pixel deltas to `reelCropX` values (`maxCropRange = max(0, scaledW - REEL_CANVAS_W)` where `scaledW = contentW * zoom`).

## 4. FFmpeg Render Pipeline

- [x] 4.1 Pass `sourceWidth` and `sourceHeight` to `buildScreenFilter()` in `render-filter-service.js`. (Already passed by both call sites.)
- [x] 4.2 Update standard reel crop (no zoom-out) to use `contentW` for `maxOffset` and add `contentLeft` to crop X offset.
- [x] 4.3 Update static zoom-out reel crop to use `contentW * zoom` for `maxCropRange` and adjust `scaledLeft` to account for `contentLeft`.
- [x] 4.4 Update animated zoom-out reel crop expressions to use `contentW` and `contentLeft` in the dynamic crop X formula.

## 5. Verification

- [ ] 5.1 Manual test: editor preview — fit mode + reel with a non-16:9 source — crop should stop at content edges, no black bars visible in crop region.
- [ ] 5.2 Manual test: editor preview — fit mode + reel + zoom-out — crop should stop at `contentW * zoom` bounds.
- [ ] 5.3 Manual test: FFmpeg render — fit mode + reel — exported video should have no black side bars.
- [ ] 5.4 Manual test: fill mode + reel — behavior should be identical to current (no regression).
