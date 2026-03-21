## ADDED Requirements

### Requirement: IPC channel for cursor position

The main process SHALL expose an IPC handler `get-cursor-position` that returns the current global cursor screen coordinates `{ x, y }` using Electron's `screen.getCursorScreenPoint()`. The preload bridge SHALL expose this as `window.electronAPI.getCursorPosition()`.

#### Scenario: Get cursor position
- **WHEN** the renderer calls `getCursorPosition()`
- **THEN** the main process returns `{ x, y }` representing the cursor's current screen position in pixels

### Requirement: Mouse position capture during recording

During screen recording, the system SHALL capture the global cursor position at approximately 20Hz (every 50ms) using a `setInterval` timer. Each sample SHALL be stored as `{ t, x, y }` where `t` is the elapsed recording time in seconds, and `x`/`y` are screen pixel coordinates.

#### Scenario: Start capturing mouse position
- **WHEN** screen recording starts
- **THEN** a 50ms interval begins polling cursor position via IPC

#### Scenario: Stop capturing mouse position
- **WHEN** screen recording stops
- **THEN** the interval is cleared and the collected samples are available for saving

### Requirement: Mouse trail file storage

When recording stops, the mouse trail data SHALL be saved as a JSON file at `recording-{timestamp}-mouse.json` in the project folder, alongside the screen and camera webm files. The file SHALL contain `{ captureWidth, captureHeight, interval, trail: [{ t, x, y }, ...] }` where `captureWidth`/`captureHeight` are the source screen dimensions.

#### Scenario: Save mouse trail after recording
- **WHEN** recording completes and mouse samples have been collected
- **THEN** a JSON file is written with the trail data and the file path is stored in the take

#### Scenario: No mouse data (e.g., API unavailable)
- **WHEN** cursor position capture fails or returns no data
- **THEN** `mousePath` is set to null on the take and auto-track is unavailable

### Requirement: Take data model extension

The take object SHALL include an optional `mousePath` field containing the project-relative path to the mouse trail JSON file. This field SHALL be normalized in `normalizeProjectData` — resolved to absolute path on load, stored as relative path on save.

#### Scenario: Take with mouse trail
- **WHEN** a take is created with mouse recording
- **THEN** `take.mousePath` contains the path to the mouse JSON file

#### Scenario: Legacy take without mouse trail
- **WHEN** a take from a previous version has no `mousePath`
- **THEN** `take.mousePath` is null and auto-track is unavailable for sections using this take

### Requirement: Mouse trail IPC for saving

A new IPC channel `save-mouse-trail` SHALL accept the project folder path, a timestamp suffix, and the trail data object. It SHALL write the JSON file and return the project-relative file path.

#### Scenario: Save mouse trail via IPC
- **WHEN** the renderer sends `save-mouse-trail` with trail data
- **THEN** the main process writes the JSON file and returns `recording-{timestamp}-mouse.json`
