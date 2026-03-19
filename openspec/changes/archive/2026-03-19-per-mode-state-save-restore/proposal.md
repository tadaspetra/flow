## Why

When toggling between 9:16 (reel) and 16:9 (landscape) output modes, per-section visual parameters (zoom, pan, PIP position/scale, camera fullscreen) are destructively modified. Switching to landscape clamps zoom to 1.0 and re-snaps PIP positions. Switching back to reel does not restore the previous reel state — the values are lost. Users expect each mode to remember its own settings independently.

## What Changes

- `setOutputMode()` will save the current mode's per-keyframe visual properties into a `savedLandscape` or `savedReel` slot before switching, and restore from the target mode's slot (or use defaults if first time in that mode)
- `normalizeKeyframes()` will preserve `savedLandscape` and `savedReel` sub-objects through serialization round-trips
- `getProjectTimelineSnapshot()` already spreads `...kf` so saved slots are serialized automatically
- No changes to how properties are read/written during normal editing — flat structure is preserved
- The destructive clamping and re-snapping in `setOutputMode()` is removed (replaced by save/restore)

## Capabilities

### New Capabilities
- `per-mode-keyframe-state`: Save and restore per-keyframe visual properties independently for landscape and reel output modes

### Modified Capabilities
- `reel-mode`: Output mode toggle behavior changes from destructive clamping to save/restore

## Impact

- `src/renderer/app.js`: `setOutputMode()` rewritten with save/restore logic
- `src/shared/domain/project.js`: `normalizeKeyframes()` preserves saved mode slots
- `src/renderer/features/timeline/keyframe-ops.js`: section split / "apply to future" must copy saved slots
- No changes to render pipeline, FFmpeg filters, or existing property read/write patterns
