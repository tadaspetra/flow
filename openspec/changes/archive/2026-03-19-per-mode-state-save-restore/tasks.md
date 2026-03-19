## 1. Define mode-specific property list and helpers

- [x] 1.1 Add a `MODE_SPECIFIC_PROPS` constant array in `app.js` listing the properties to save/restore: `backgroundZoom`, `backgroundPanX`, `backgroundPanY`, `pipX`, `pipY`, `pipScale`, `pipVisible`, `cameraFullscreen`, `reelCropX`.
- [x] 1.2 Add a `saveModeState(kf, mode)` helper that copies the listed properties from the flat keyframe into `kf.savedLandscape` or `kf.savedReel`.
- [x] 1.3 Add a `restoreModeState(kf, mode, defaults)` helper that restores flat properties from `kf.savedLandscape` or `kf.savedReel`, or applies defaults if the slot is null/absent.
- [x] 1.4 Add a `getDefaultModeState(mode)` helper that returns the default property values for a given mode (using the correct effective canvas dimensions for PIP positioning).

## 2. Rewrite setOutputMode()

- [x] 2.1 Replace the destructive clamping/snapping logic in `setOutputMode()` with save/restore: save current mode's state, then restore or default the target mode's state for all keyframes.
- [x] 2.2 Remove the zoom clamping (`if (newMode === 'landscape' && kf.backgroundZoom < 1)`) and PIP re-snapping logic.
- [x] 2.3 Ensure `editorState.defaultPipX/Y` and `editorState.pipSize` are still updated for the new mode's dimensions.

## 3. Serialization round-trip

- [x] 3.1 Update `normalizeKeyframes()` in `project.js` to preserve `savedLandscape` and `savedReel` sub-objects (currently dropped because it constructs a new object with only known fields).
- [x] 3.2 Verify `getProjectTimelineSnapshot()` in `app.js` already passes saved slots through via `...kf` spread (should work, just confirm).

## 4. Section operations

- [x] 4.1 Update `buildSplitAnchorKeyframe()` in `keyframe-ops.js` to copy `savedLandscape` and `savedReel` from the parent keyframe.
- [x] 4.2 Update "Apply to Future" logic in `app.js` to propagate `savedLandscape` and `savedReel` alongside other properties.

## 5. Edge cases

- [x] 5.1 Ensure `getSectionAnchorKeyframe()` fallback creation (when no anchor exists) initializes `savedLandscape` and `savedReel` as null.
- [x] 5.2 Verify undo/redo correctly restores saved slots (pushUndo already deep-copies state — just confirm).

## 6. Verification

- [ ] 6.1 Manual test (requires app): toggle landscape → reel → landscape → reel — all mode-specific properties should be preserved through round-trips.
- [ ] 6.2 Manual test (requires app): first-time mode entry uses defaults (not inherited from other mode).
- [ ] 6.3 Manual test (requires app): split a section while in reel mode, switch to landscape — both sections should have their saved reel state.
- [ ] 6.4 Manual test (requires app): save project in reel mode, reload — saved slots should persist, toggling to landscape and back should restore reel state.
