## ADDED Requirements

### Requirement: Lazy media initialization on project open
The renderer SHALL NOT initialize media streams (screen, camera, audio) when opening a project unless the user enters the recording view. Media streams SHALL only be acquired when the recording view is displayed.

#### Scenario: Open existing project with timeline sections
- **WHEN** the user opens a project that has existing timeline sections
- **THEN** the app navigates to the timeline view
- **AND** no media streams (screen, camera, audio) are acquired
- **AND** `ensureMediaInitialized()` is NOT called
- **AND** `mediaInitialized` remains `false`

#### Scenario: Open existing project and navigate to recording
- **WHEN** the user opens a project that has existing timeline sections
- **AND** the user navigates to the recording view
- **THEN** `ensureMediaInitialized()` is called
- **AND** screen, camera, and audio streams are acquired
- **AND** the live preview becomes available

#### Scenario: Open existing project with preferredView recording
- **WHEN** the user opens a project with `preferredView` set to `'recording'`
- **THEN** `enterEditor()` calls `setWorkspaceView('recording')`
- **AND** `ensureMediaInitialized()` is called via the recording view entry path
- **AND** media streams are acquired and preview is shown

#### Scenario: Create new project (no timeline sections)
- **WHEN** the user creates a new project that has no timeline sections
- **THEN** `activateProject()` calls `setWorkspaceView('recording')`
- **AND** `ensureMediaInitialized()` is called via the recording view entry path
- **AND** media streams are acquired and preview is shown

### Requirement: Renderer startup cleanup
On app launch, the renderer SHALL call `cleanupAllMedia()` once during initialization to release any lingering media resources from a previous session. This cleanup SHALL complete before any user interaction.

#### Scenario: Clean app launch (no stale resources)
- **WHEN** the app launches fresh with no stale media resources
- **THEN** `cleanupAllMedia()` is called with all-null references
- **AND** the call completes without error (idempotent no-op)
- **AND** app initialization proceeds normally

#### Scenario: App launch after force-close during dev hot-reload
- **WHEN** the app relaunches after a force-close or hot-reload
- **AND** the renderer context may retain stale media state
- **THEN** `cleanupAllMedia()` releases any lingering tracks, intervals, or contexts
- **AND** `mediaInitialized` remains `false` for a clean start

### Requirement: Main process startup cleanup
On app launch, the main process SHALL call `cleanupMouseTrailTimer()` immediately after IPC handler registration to clear any stale timer state from a previous session (e.g., hot-reload in dev).

#### Scenario: Clean main process launch
- **WHEN** the main process starts fresh
- **THEN** `cleanupMouseTrailTimer()` is called after `registerIpcHandlers()` returns
- **AND** the call completes without error (no timer is running)

#### Scenario: Main process hot-reload in dev
- **WHEN** the main process is re-evaluated via `electron-reload` without full process termination
- **AND** a stale `mouseTrailTimer` may exist in the module closure
- **THEN** `cleanupMouseTrailTimer()` clears the stale timer
- **AND** the samples array is released
