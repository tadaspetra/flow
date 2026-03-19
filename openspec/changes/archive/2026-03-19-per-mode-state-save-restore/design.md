## Context

Keyframes store visual properties as flat fields (`backgroundZoom`, `pipX`, etc.). When `setOutputMode()` is called, it destructively modifies these fields (clamping zoom, re-snapping PIP positions), losing the previous mode's state. The user wants each mode to independently remember its settings.

The codebase has ~266 source and ~346 test occurrences of these properties. A full restructure (nested objects per mode) would require changing all of them. Instead, we use a save/restore pattern that adds two optional sub-objects per keyframe while keeping the flat property structure intact.

## Goals / Non-Goals

**Goals:**
- Toggling 9:16 ↔ 16:9 preserves each mode's visual parameters independently
- First time entering a mode uses defaults (not inherited from the other mode)
- Saved state persists through project save/load
- Section operations (split, apply-to-future) carry saved slots forward
- Zero changes to how properties are read or written during normal editing

**Non-Goals:**
- Restructuring keyframe data model (nested objects per mode)
- Changing the render pipeline or FFmpeg filter logic
- Adding per-mode state for non-keyframe properties (section boundaries, duration, etc.)

## Decisions

### Decision 1: Save/restore slots on keyframe objects

Each keyframe gains two optional sub-objects: `savedLandscape` and `savedReel`. These store the full set of mode-specific properties when switching away from that mode.

```
keyframe = {
  // Shared (unchanged)
  time, sectionId, autoSection,

  // Active flat values (whichever mode is current)
  backgroundZoom, backgroundPanX, backgroundPanY,
  pipX, pipY, pipScale, pipVisible, cameraFullscreen,
  reelCropX,

  // Saved slots (populated when switching away)
  savedLandscape: { backgroundZoom, backgroundPanX, backgroundPanY,
                    pipX, pipY, pipScale, pipVisible, cameraFullscreen } | null,
  savedReel:      { backgroundZoom, backgroundPanX, backgroundPanY,
                    pipX, pipY, pipScale, pipVisible, cameraFullscreen,
                    reelCropX } | null
}
```

**Rationale:** All existing code reads/writes flat properties unchanged. Only `setOutputMode()`, serialization, and section operations need awareness of saved slots. ~20 changes vs ~612.

### Decision 2: Mode-specific default values

When entering a mode for the first time (no saved slot exists), defaults are applied:

| Property | Landscape Default | Reel Default |
|---|---|---|
| backgroundZoom | 1 | 1 |
| backgroundPanX | 0 | 0 |
| backgroundPanY | 0 | 0 |
| pipX | w - pipSize - margin | w - pipSize - margin |
| pipY | h - pipSize - margin | h - pipSize - margin |
| pipScale | DEFAULT_PIP_SCALE (0.22) | DEFAULT_PIP_SCALE (0.22) |
| pipVisible | true | true |
| cameraFullscreen | false | false |
| reelCropX | (n/a) | 0 |

PIP defaults use the target mode's effective canvas dimensions (1920x1080 for landscape, 608x1080 for reel).

**Rationale:** User explicitly requested defaults rather than inheriting from the other mode's values.

### Decision 3: Properties included in saved slots

The MODE_SPECIFIC_PROPS list:
- `backgroundZoom`, `backgroundPanX`, `backgroundPanY`
- `pipX`, `pipY`, `pipScale`, `pipVisible`
- `cameraFullscreen`
- `reelCropX` (saved in reel slot only, but harmless to always include)

Properties NOT saved (shared across modes):
- `time`, `sectionId`, `autoSection`

### Decision 4: Serialization passthrough

`getProjectTimelineSnapshot()` already uses `...kf` spread, so saved slots are automatically included in the serialized output. `normalizeKeyframes()` in project.js must be updated to preserve `savedLandscape` and `savedReel` fields — currently it constructs a new object with only known fields, dropping everything else.

### Decision 5: Section operations copy saved slots

`buildSplitAnchorKeyframe()` in keyframe-ops.js must copy `savedLandscape` and `savedReel` from the parent keyframe to the new anchor, so split sections inherit the full dual-mode state.

Similarly, "Apply to Future" must propagate saved slots alongside flat properties.

## Risks / Trade-offs

- **[Risk] Undo stack contains keyframes with saved slots** → No issue. The undo system already deep-copies state via `pushUndo()`.
- **[Risk] Old projects without saved slots** → Gracefully handled. Missing slots = null, meaning "use defaults on first switch." Exact same behavior as current code for the first toggle.
- **[Trade-off] Saved slots duplicates data** → Accepted. The storage cost is negligible (a few extra fields per keyframe) and the implementation simplicity is worth it.
