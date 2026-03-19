## Context

The reel (9:16) mode crops a 608px-wide strip from the 1920px canvas. The crop position is controlled by `reelCropX` (-1 to +1). Currently, crop boundary math uses `CANVAS_W` (1920) as the content width, which is correct in fill mode but incorrect in fit mode — where the actual video content may be narrower, with black bars on the sides.

The source video dimensions are already tracked in `editorState.sourceWidth` / `editorState.sourceHeight` and passed to the render pipeline as `opts.sourceWidth` / `opts.sourceHeight`.

## Goals / Non-Goals

**Goals:**
- Crop region in reel mode never captures black side bars from fit mode
- Crop boundaries clamp to actual video content edges
- Works correctly when fit mode and zoom-out are combined (constraints stack)
- Both editor preview and FFmpeg export produce identical results

**Non-Goals:**
- Changing top/bottom behavior in zoom-out (blurred fill at top/bottom remains as-is)
- Modifying fit/fill behavior in landscape mode
- Adding blur fill to the side black bars (they simply remain outside the crop's reachable area)

## Decisions

### Decision 1: Compute `contentW` from source dimensions and fit mode

The actual content width within the canvas in fit mode is:
```
fitScale = min(CANVAS_W / sourceW, CANVAS_H / sourceH)
contentW = sourceW * fitScale
```

In fill mode: `contentW = CANVAS_W` (unchanged).

**Rationale:** This directly uses the same math as `drawFit()` in app.js and the FFmpeg `force_original_aspect_ratio=decrease` + `pad` filter. No new state needed — source dimensions are already available.

**Alternative considered:** Store `contentW` as a separate property. Rejected because it's derivable and would need to stay in sync with source dimensions.

### Decision 2: Replace `CANVAS_W` with `contentW` in crop boundary functions

Three locations need the same substitution:

1. **`reelCropXToPixelOffset()`** (app.js) — preview crop position
2. **Drag handler** (app.js) — pixel-to-cropX conversion during drag
3. **`buildScreenFilter()`** (render-filter-service.js) — FFmpeg crop offset calculation

The formula changes from:
```
scaledW = CANVAS_W * zoom
scaledLeft = (CANVAS_W - scaledW) / 2
maxCropRange = max(0, scaledW - REEL_CANVAS_W)
```
To:
```
scaledW = contentW * zoom
contentLeft = (CANVAS_W - contentW) / 2
scaledLeft = contentLeft + (contentW - scaledW) / 2
maxCropRange = max(0, scaledW - REEL_CANVAS_W)
```

**Rationale:** Minimal change, same pattern as existing zoom-out constraint. The `contentLeft` offset ensures the crop is positioned correctly within the canvas when content doesn't start at x=0.

### Decision 3: Pass source dimensions and fit mode to render filter service

`buildScreenFilter()` already receives `screenFitMode`. It needs `sourceWidth` and `sourceHeight` to compute `contentW` for the FFmpeg crop expressions.

These are already available in the render pipeline (`opts.sourceWidth`, `opts.sourceHeight`) and just need to be passed through.

**Rationale:** No new data plumbing — just threading existing values one level deeper.

### Decision 4: Handle edge case where contentW < REEL_CANVAS_W

If the source video is extremely narrow (e.g., a vertical phone recording in fit mode), `contentW` could be less than 608px. In this case, `maxCropRange` becomes 0 and the crop is locked at center. The reel output would show the content centered with remaining black on the sides.

**Rationale:** This is an extreme edge case. Locking the crop at center is the most sensible behavior — the user chose fit mode specifically to avoid top/bottom cropping, and this narrow source simply can't fill the reel width.

## Risks / Trade-offs

- **[Risk] Source dimensions unavailable** → Default to `CANVAS_W` (existing behavior). `sourceWidth`/`sourceHeight` are set when video loads and persisted in project. If missing, the content width falls back to canvas width, which is the current behavior.
- **[Risk] Slight visual discontinuity when switching fit/fill** → Acceptable. Changing fit mode already causes a visual change; the crop position adjusting to new content bounds is expected.
- **[Trade-off] contentW < REEL_CANVAS_W locks crop** → Accepted. This is the correct behavior for very narrow sources in fit mode.
