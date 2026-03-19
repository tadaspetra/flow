## ADDED Requirements

### Requirement: Saved mode slots on keyframes
Each keyframe SHALL support two optional sub-objects: `savedLandscape` and `savedReel`. These store the mode-specific visual properties when the user switches away from that mode. When null or absent, the mode has not been configured yet.

#### Scenario: Keyframe with no saved slots (new project)
- **WHEN** a keyframe is created in a new project
- **THEN** `savedLandscape` SHALL be null or absent
- **AND** `savedReel` SHALL be null or absent

#### Scenario: Keyframe after switching from reel to landscape
- **WHEN** the user switches from reel to landscape mode
- **THEN** each keyframe's `savedReel` SHALL contain the reel-mode values of `backgroundZoom`, `backgroundPanX`, `backgroundPanY`, `pipX`, `pipY`, `pipScale`, `pipVisible`, `cameraFullscreen`, and `reelCropX`

#### Scenario: Keyframe after switching from landscape to reel
- **WHEN** the user switches from landscape to reel mode
- **THEN** each keyframe's `savedLandscape` SHALL contain the landscape-mode values of `backgroundZoom`, `backgroundPanX`, `backgroundPanY`, `pipX`, `pipY`, `pipScale`, `pipVisible`, and `cameraFullscreen`

### Requirement: Save current state before mode switch
When `setOutputMode()` is called, the system SHALL save each keyframe's current mode-specific properties into the appropriate saved slot (`savedLandscape` or `savedReel`) BEFORE changing the active values.

#### Scenario: Saving reel state before switching to landscape
- **WHEN** the user is in reel mode with a section at zoom 0.7, pipX 400
- **AND** the user switches to landscape mode
- **THEN** each keyframe SHALL have `savedReel.backgroundZoom` = 0.7 and `savedReel.pipX` = 400
- **AND** the flat `backgroundZoom` and `pipX` SHALL be updated to landscape values

### Requirement: Restore saved state on mode switch
When switching to a mode that has a saved slot, the system SHALL restore the flat keyframe properties from the saved slot.

#### Scenario: Restoring reel state after round-trip
- **WHEN** the user was in reel mode with zoom 0.7
- **AND** switched to landscape (saving reel state)
- **AND** switches back to reel
- **THEN** `backgroundZoom` SHALL be restored to 0.7 from `savedReel`
- **AND** all other reel-mode properties SHALL be restored from `savedReel`

#### Scenario: Multiple round-trips preserve state
- **WHEN** the user toggles landscape → reel → landscape → reel
- **THEN** each mode's state SHALL be independently preserved through all toggles

### Requirement: Default values for first-time mode entry
When switching to a mode that has no saved slot (null or absent), the system SHALL apply default values for that mode's properties.

#### Scenario: First time entering reel mode
- **WHEN** a project has never been in reel mode (no `savedReel` slot)
- **AND** the user switches to reel mode
- **THEN** `backgroundZoom` SHALL be set to 1
- **AND** `backgroundPanX` and `backgroundPanY` SHALL be set to 0
- **AND** `pipX` and `pipY` SHALL be set to the default bottom-right position for reel canvas dimensions (608x1080)
- **AND** `pipScale` SHALL be set to DEFAULT_PIP_SCALE (0.22)
- **AND** `pipVisible` SHALL be set to true
- **AND** `cameraFullscreen` SHALL be set to false
- **AND** `reelCropX` SHALL be set to 0

#### Scenario: First time entering landscape mode from reel
- **WHEN** a project started in reel mode and has never been in landscape
- **AND** the user switches to landscape mode
- **THEN** default landscape values SHALL be applied (zoom 1, pan 0, default PIP position for 1920x1080)

### Requirement: Saved slots persisted through project save/load
The `savedLandscape` and `savedReel` sub-objects SHALL survive project serialization and deserialization.

#### Scenario: Save and reload preserves saved slots
- **WHEN** a project with keyframes containing `savedReel: { backgroundZoom: 0.7, ... }` is saved and reloaded
- **THEN** the loaded keyframes SHALL contain the same `savedReel` sub-object with all values intact

#### Scenario: Old projects without saved slots load correctly
- **WHEN** a project saved before this feature (no saved slots on keyframes) is loaded
- **THEN** `savedLandscape` and `savedReel` SHALL be null
- **AND** the first mode switch SHALL use defaults (existing behavior)

### Requirement: Section operations preserve saved slots
Section operations that create or copy keyframes SHALL include saved mode slots.

#### Scenario: Section split copies saved slots
- **WHEN** a section is split at the playhead
- **THEN** the new section's anchor keyframe SHALL inherit `savedLandscape` and `savedReel` from the parent section's anchor keyframe

#### Scenario: Apply to future copies saved slots
- **WHEN** the user clicks "Apply to Future"
- **THEN** all future sections' anchor keyframes SHALL receive the current section's `savedLandscape` and `savedReel` values
