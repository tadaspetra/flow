## 1. Lazy Media Initialization

- [x] 1.1 Remove the `await ensureMediaInitialized();` call from `activateProject()` (line 1249 of `src/renderer/app.js`)
- [x] 1.2 Remove the `if (activeWorkspaceView === 'recording') updatePreview();` call from `activateProject()` (line 1250) — the recording view entry path in `setWorkspaceView` already handles this
- [x] 1.3 Verify that `setWorkspaceView('recording')` at line 731-738 still calls `ensureMediaInitialized()` and `updatePreview()` when entering recording view (read-only check, no code change expected)

## 2. Renderer Startup Cleanup

- [x] 2.1 Add a `cleanupAllMedia()` call in the renderer init block (near line 5559 of `app.js`, after `setWorkspaceView('home')`), passing the current refs bag — defensive cleanup for stale resources from a previous session

## 3. Main Process Startup Cleanup

- [x] 3.1 Add a `cleanupMouseTrailTimer()` call in `src/main.js` immediately after the `registerIpcHandlers()` destructuring (after line 29), before `app.whenReady()` — clears any stale timer from hot-reload

## 4. Tests

- [x] 4.1 Add test: `activateProject` with timeline sections does NOT call `ensureMediaInitialized()` — verify lazy init behavior
- [x] 4.2 Add test: `activateProject` without timeline sections (new project) DOES trigger media init via `setWorkspaceView('recording')`
- [x] 4.3 Add test: renderer startup calls `cleanupAllMedia()` once during init
- [x] 4.4 Add test: main process calls `cleanupMouseTrailTimer()` on startup (after registration, before ready)

## 5. Verification

- [x] 5.1 Run `npm run check` — all tests pass, lint clean
- [ ] 5.2 Manual test: open existing project with timeline → confirm no camera/screen permission prompts, no stream acquisition
- [ ] 5.3 Manual test: from timeline, switch to recording view → confirm streams start and preview is live
- [ ] 5.4 Manual test: create new project → confirm streams start immediately in recording view
