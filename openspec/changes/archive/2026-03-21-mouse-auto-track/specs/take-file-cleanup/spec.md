## MODIFIED Requirements

### Requirement: Stage unreferenced take files to .deleted/

When a take becomes unreferenced (last section deleted or unsaved), the system SHALL move its files (screenPath, cameraPath, **and mousePath if present**) to a `.deleted/` subfolder inside the project directory via IPC. The take SHALL be removed from `project.takes`.

#### Scenario: Take with mouse trail file
- **WHEN** an unreferenced take has screenPath, cameraPath, and mousePath
- **THEN** all three files are moved to `.deleted/`

#### Scenario: Take without mouse trail (legacy)
- **WHEN** an unreferenced take has screenPath and cameraPath but no mousePath
- **THEN** only screen and camera files are moved (no error for missing mousePath)

### Requirement: Unstage take files on undo

When an undo operation restores a section that was the last reference to a take, the system SHALL move the take's files back from `.deleted/` to the project directory. **This includes the mouse trail file if it was staged.**

#### Scenario: Undo restores take with mouse trail
- **WHEN** user undoes a section delete that had triggered file staging for a take with mousePath
- **THEN** the screen, camera, and mouse trail files are all restored from `.deleted/`
