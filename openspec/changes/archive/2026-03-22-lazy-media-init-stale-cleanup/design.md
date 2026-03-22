## Context

The app has a `media-stream-lifecycle` system implemented in a prior change (`2026-03-21-media-stream-cleanup`). That change added:
- `cleanupAllMedia()` — synchronous, idempotent cleanup of all renderer media resources
- `beforeunload` handler that calls `cleanupAllMedia()` on window close
- `before-quit` handler in the main process that calls `cleanupMouseTrailTimer()`
- 30-second idle timer that cleans up streams when user leaves the recording view

**Current problem 1 — eager initialization:** `activateProject()` (line 1249 of `app.js`) unconditionally calls `ensureMediaInitialized()` after setting up the project, even when `enterEditor()` has already navigated the user to the timeline view. This means opening any existing project with timeline sections immediately acquires screen, camera, and audio — all of which sit idle until the 30-second timer fires.

**Current problem 2 — no startup cleanup:** If the app was force-closed (kill -9, crash, Ctrl+C), the main process's `before-quit` handler never runs, leaving the `mouseTrailTimer` interval active until the process dies. On relaunch, the renderer starts fresh (all vars are `null`), but there is no explicit cleanup pass to catch any edge cases where Chromium/Electron preserves state across rapid restarts (e.g., hot-reload in dev).

**Current architecture:**
```
activateProject()
  ├── enterEditor() → setWorkspaceView('timeline')   ← idle timer starts after 30s
  │                                                      BUT streams already acquired
  └── ensureMediaInitialized()                        ← UNCONDITIONAL, wasteful
      ├── updateScreenStream()
      ├── updateCameraStream()
      └── updateAudioStream()
```

`setWorkspaceView('recording')` already has its own `ensureMediaInitialized()` call (line 736-738), making the one in `activateProject()` redundant for the recording case and harmful for the timeline case.

## Goals / Non-Goals

**Goals:**
- Media streams are only acquired when the user enters the recording view (lazy init)
- On app launch, both renderer and main process clean up any stale resources from a previous session
- No regression: entering the recording view still initializes streams immediately

**Non-Goals:**
- Changing the idle timeout value (30s stays)
- Adding `stopCapture`/pause semantics instead of full teardown (full teardown is clean and fast enough)
- Handling CMSampleBuffer retention (not applicable to Electron/canvas pipeline)
- Enumerating native ScreenCaptureKit sessions at OS level (Chromium manages these)

## Decisions

### 1. Remove `ensureMediaInitialized()` and `updatePreview()` from `activateProject()`

**Decision:** Delete lines 1249-1250 from `activateProject()`. Media init is fully handled by `setWorkspaceView('recording')` which already calls `ensureMediaInitialized()` (line 736-738) and `updatePreview()` (line 739).

**Why over alternatives:**
- Alternative: Add a conditional `if (activeWorkspaceView === 'recording')` guard → redundant with `setWorkspaceView` logic
- Alternative: Move the call into `enterEditor()` → wrong; `enterEditor()` is for timeline setup, not media
- Removing is the simplest and most correct approach — the lazy path already exists

**After this change:**
```
activateProject()
  ├── enterEditor() → setWorkspaceView('timeline')   ← NO streams acquired
  │                     (or 'recording' if initialView is 'recording')
  │                                                      ↓ (only if recording)
  │                                             ensureMediaInitialized()
  └── (no media init call)

New project (no timeline):
  activateProject()
  └── setWorkspaceView('recording')
      └── ensureMediaInitialized()                    ← still works
```

Note: `enterEditor()` passes `opts.initialView` to `setWorkspaceView()` (line 3606-3607). If `preferredView` is `'recording'`, `enterEditor()` calls `setWorkspaceView('recording')` which triggers `ensureMediaInitialized()`. So the recording path is fully covered.

### 2. Renderer startup cleanup via `cleanupAllMedia()`

**Decision:** Call `cleanupAllMedia()` once at the end of the renderer init block (near line 5559, after `setWorkspaceView('home')`), passing the current (null/default) refs bag. This is a defensive no-op on clean starts but catches any edge cases on hot-reload or rapid restart.

**Why over alternatives:**
- Alternative: Don't do it — the refs are all `null` on fresh start → true, but `cleanupAllMedia` is idempotent and the cost is zero. Defensive cleanup is cheap insurance.
- Alternative: Enumerate `navigator.mediaDevices` for active tracks → over-engineered for the problem; Chromium releases tracks when the process dies.

### 3. Main process startup cleanup via `cleanupMouseTrailTimer()`

**Decision:** Call `cleanupMouseTrailTimer()` immediately after `registerIpcHandlers()` returns (line 29 of `main.js`), before `app.whenReady()`. This clears any stale timer state left in the module closure from a previous hot-reload.

**Why:** In production, a fresh process launch means the module closure starts clean. But during dev (`electron-reload` at line 2), the main process module may be re-evaluated without a full process restart. Calling cleanup on init ensures a clean slate regardless.

## Risks / Trade-offs

**[Risk] Removing `ensureMediaInitialized()` from `activateProject()` could miss an edge case where recording view is shown but streams aren't ready.**
→ Mitigation: `setWorkspaceView('recording')` is the single entry point to the recording view, and it already calls `ensureMediaInitialized()`. All paths go through it: `enterEditor()` with `initialView: 'recording'`, `_exitEditor()`, direct `setWorkspaceView('recording')` calls. Verified by searching all `setWorkspaceView` call sites.

**[Risk] Startup `cleanupAllMedia()` call might interfere with renderer init.**
→ Mitigation: At init time, all refs are `null`/`undefined`. `cleanupAllMedia()` is idempotent and no-ops on null refs. Zero side effects.

**[Risk] `cleanupMouseTrailTimer()` at main startup could clear a timer that was intentionally started.**
→ Mitigation: At startup, no timer can be running yet — `registerIpcHandlers` just created the closure, and no IPC messages have been received. The call is a defensive no-op.
