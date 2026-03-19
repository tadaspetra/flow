## MODIFIED Requirements

### Requirement: Output mode toggle UI
The editor controls SHALL include a toggle button group allowing the user to switch between 16:9 (landscape) and 9:16 (reel) output modes. The toggle SHALL be placed in the editor playback controls bar alongside existing controls.

#### Scenario: Toggling to reel mode
- **WHEN** the user clicks the 9:16 toggle button
- **THEN** the editor SHALL set `outputMode` to `'reel'`
- **AND** the current landscape-mode properties SHALL be saved into each keyframe's `savedLandscape` slot
- **AND** reel-mode properties SHALL be restored from each keyframe's `savedReel` slot (or defaults if first time)
- **AND** the crop overlay SHALL appear on the preview canvas
- **AND** the PIP size SHALL be recalculated for the narrower canvas
- **AND** a project save SHALL be scheduled

#### Scenario: Toggling to landscape mode
- **WHEN** the user clicks the 16:9 toggle button while in reel mode
- **THEN** the editor SHALL set `outputMode` to `'landscape'`
- **AND** the current reel-mode properties SHALL be saved into each keyframe's `savedReel` slot
- **AND** landscape-mode properties SHALL be restored from each keyframe's `savedLandscape` slot (or defaults if first time)
- **AND** the crop overlay SHALL disappear
- **AND** a project save SHALL be scheduled

#### Scenario: Toggle is undoable
- **WHEN** the user toggles the output mode
- **THEN** the change SHALL be pushed to the undo stack
- **AND** pressing undo SHALL restore the previous output mode and all keyframe properties including saved slots
