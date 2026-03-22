## Why

The app unconditionally initializes all media streams (screen, camera, audio) whenever a project is opened, even when the user navigates directly to the timeline editor — not the recording view. This wastes resources (ScreenCaptureKit sessions, camera access, audio capture) for 30 seconds until the idle timer fires. Additionally, if the app was force-closed (kill -9, crash, Ctrl+C during dev), stale main-process timers and renderer media state from the previous session are never cleaned up on relaunch, requiring a manual restart to recover.

## What Changes

- Remove the unconditional `ensureMediaInitialized()` call from `activateProject()` in the renderer. Media streams will only be acquired when the user actually enters the recording view (via the existing `setWorkspaceView('recording')` path which already calls `ensureMediaInitialized()`).
- Remove the unconditional `updatePreview()` call from `activateProject()` — it's only needed in recording view and `setWorkspaceView('recording')` already handles it.
- Add a startup cleanup pass in the renderer that calls `cleanupAllMedia()` once on app init to release any lingering tracks/resources from a previous forced close.
- Add a startup cleanup call in the main process to clear any stale `mouseTrailTimer` left over from a previous session (not just on quit).

## Capabilities

### New Capabilities

_(none — both fixes extend the existing `media-stream-lifecycle` capability)_

### Modified Capabilities

- `media-stream-lifecycle`: Adding two new requirements: (1) media streams SHALL NOT be initialized until the recording view is entered, and (2) on app launch, both renderer and main process SHALL clean up stale resources from a previous session.

## Impact

- **Renderer** (`src/renderer/app.js`): `activateProject()` no longer calls `ensureMediaInitialized()` or `updatePreview()`. Startup path gains a `cleanupAllMedia()` call.
- **Main process** (`src/main.js`): Gains a startup call to clear any stale mouse trail timer.
- **Main IPC** (`src/main/ipc/register-handlers.js`): `cleanupMouseTrailTimer()` may need to be callable at startup (already exported for `before-quit`).
- **Tests**: New tests for lazy init behavior and startup cleanup.
- **No breaking changes** to user-facing behavior — recording still works the same once user enters the recording view.
