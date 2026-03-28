## 1. Types & Constants

- [x] 1.1 Add `AudioOverlay` interface to `src/shared/types/domain.ts` with fields: `id`, `trackIndex`, `mediaPath`, `startTime`, `endTime`, `sourceStart`, `sourceEnd`, `volume`, `saved`
- [x] 1.2 Add constants to `domain.ts`: `MAX_AUDIO_TRACKS = 1`, `AUDIO_OVERLAY_EXTENSIONS`, `DEFAULT_AUDIO_VOLUME = 1.0`
- [x] 1.3 Add `volume: number` field to the `Section` interface in `domain.ts`
- [x] 1.4 Add `audioOverlays: AudioOverlay[]` and `savedAudioOverlays: AudioOverlay[]` to `ProjectTimeline` interface
- [x] 1.5 Add `volume: number` to `RenderSectionInput` in `src/shared/types/services.ts`
- [x] 1.6 Add `audioOverlays?: AudioOverlay[]` to `RenderOptions` in `services.ts`
- [x] 1.7 Add `AudioOverlay` to imports in `services.ts` from `domain.js`

## 2. Domain Normalization

- [x] 2.1 Implement `normalizeAudioOverlays(rawAudioOverlays)` in `src/shared/domain/project.ts` — validate fields, clamp values, resolve overlaps, sort by `[trackIndex, startTime]`
- [x] 2.2 Implement `generateAudioOverlayId()` in `project.ts` with format `audio-overlay-{timestamp}-{counter}`
- [x] 2.3 Add `normalizeAudioVolume(volume)` helper that clamps to 0.0–1.0, defaults to 1.0
- [x] 2.4 Update `normalizeProjectData()` to normalize `audioOverlays` and `savedAudioOverlays` arrays using `normalizeAudioOverlays()`
- [x] 2.5 Update `normalizeProjectData()` to normalize `Section.volume` (default 1.0, clamp 0.0–1.0) for all sections and saved sections
- [x] 2.6 Update `getProjectTimelineSnapshot()` to include `audioOverlays` and `savedAudioOverlays` in the payload
- [x] 2.7 Update `normalizeSectionInput()` in `render-service.ts` to extract `volume` from raw section data (default 1.0)

## 3. Domain Normalization Tests

- [x] 3.1 Write tests for `normalizeAudioOverlays()`: empty input, missing fields, volume clamping, overlap resolution, sort order
- [x] 3.2 Write tests for `generateAudioOverlayId()`: uniqueness, format validation
- [x] 3.3 Write tests for Section `volume` normalization: default, clamping, persistence
- [x] 3.4 Write tests for `normalizeProjectData()` with audioOverlays and savedAudioOverlays
- [x] 3.5 Write tests for `normalizeSectionInput()` with volume field

## 4. IPC & File Import

- [x] 4.1 Create `import-audio-overlay-media` IPC handler in main process — copies audio file to `{project}/audio-overlay-media/`, returns `{ mediaPath, duration }`
- [x] 4.2 Add audio duration probe (ffprobe or ffmpeg) in the IPC handler to return duration with the import response
- [x] 4.3 Implement duplicate audio file detection (reuse existing file if same content)
- [x] 4.4 Register the IPC channel in the preload/bridge and expose `window.electronAPI.importAudioOverlayMedia()`
- [x] 4.5 Update project cleanup logic to include `audio-overlay-media/` files staged in `.deleted/`

## 5. IPC & File Import Tests

- [x] 5.1 Write tests for audio file import IPC: successful import, directory creation, duplicate detection
- [x] 5.2 Write tests for audio file cleanup: staging, unstaging on undo, permanent removal on cleanup

## 6. HTML & Timeline Layout

- [x] 6.1 Add audio overlay track HTML element (`editorAudioTrack0`) in `src/index.html` between media overlay tracks and waveform area, with distinct background tint
- [x] 6.2 Add drop zone event listeners on the audio track element for audio file drag-and-drop
- [x] 6.3 Add `selectedAudioOverlayId` to editor state in `app.ts`

## 7. Audio Overlay Timeline UI

- [x] 7.1 Implement `renderAudioOverlayMarkers()` in `app.ts` — render audio overlay bands in the audio track lane with waveform thumbnails and filename labels
- [x] 7.2 Implement audio overlay segment selection on click (set `selectedAudioOverlayId`, deselect section/media overlay)
- [x] 7.3 Implement mutual deselection: selecting a section or media overlay clears `selectedAudioOverlayId`, and vice versa
- [x] 7.4 Implement audio overlay trim handles (left/right edge drag on selected segment, clamped by same-track neighbors and minimum duration)
- [x] 7.5 Implement `splitAudioOverlayAtPlayhead()` — split selected audio overlay at playhead, adjust sourceStart/sourceEnd, preserve volume
- [x] 7.6 Implement `deleteSelectedAudioOverlay()` — remove from array, stage media file if last reference, handle saved/unsaved
- [x] 7.7 Implement `placeAudioOverlayAtTime()` — position new audio overlay, resolve conflicts with existing overlays on same track
- [x] 7.8 Wire keyboard shortcuts: Backspace/Delete triggers `deleteSelectedAudioOverlay()` when audio overlay is selected, split shortcut triggers `splitAudioOverlayAtPlayhead()`

## 8. Audio Overlay Undo/Redo

- [x] 8.1 Include `audioOverlays` and `savedAudioOverlays` in undo snapshot (alongside existing overlays/savedOverlays)
- [x] 8.2 Implement `beforeAudioOverlayPaths` / `afterAudioOverlayPaths` comparison for media file staging on undo/redo
- [x] 8.3 Ensure all audio overlay mutations call `pushUndo()` before mutation: add, delete, trim, split, volume change, save/unsave

## 9. Sidebar UI — Audio Overlay Items

- [x] 9.1 Implement `renderAudioOverlayList()` — render audio overlay items in the Overlays tab below media overlays, with "Audio" section header
- [x] 9.2 Each audio overlay item shows: filename, time range, volume control, heart icon
- [x] 9.3 Implement heart toggle for audio overlays (save/unsave with undo)
- [x] 9.4 Implement saved+removed audio overlay display (reduced opacity, [+] re-add button)
- [x] 9.5 Implement re-add saved audio overlay: restore to `audioOverlays` at original position
- [x] 9.6 Implement unsave removed audio overlay: remove from `savedAudioOverlays`, clean up media file if last reference

## 10. Sidebar UI — Volume Drag Controls

- [x] 10.1 Add volume scrub-drag control to each audio overlay sidebar item using `initScrubDrag()` pattern (hidden input min=0 max=1 step=0.01)
- [x] 10.2 Add volume scrub-drag control to each section sidebar item using `initScrubDrag()` pattern (same parameters)
- [x] 10.3 Implement volume icon updates based on level: 🔊 (>0.5), 🔉 (>0, <=0.5), 🔇 (0)
- [x] 10.4 Wire volume drag events: update audio overlay `volume` or section `volume` field, trigger project save, debounce undo (single undo entry per drag)
- [x] 10.5 Ensure volume controls call `pushUndo()` on mousedown (before first value change), not during drag

## 11. Audio Playback Preview

- [x] 11.1 Implement `AudioBuffer` decode and cache: decode audio files on import via `AudioContext.decodeAudioData()`, cache by mediaPath
- [x] 11.2 Implement waveform peak data extraction from decoded `AudioBuffer` (~1000 min/max pairs)
- [x] 11.3 Implement `startAudioOverlayPlayback()` — create `AudioBufferSourceNode` + `GainNode` per active overlay on play start
- [x] 11.4 Implement `stopAudioOverlayPlayback()` — stop and disconnect all overlay source nodes on pause/stop
- [x] 11.5 Implement seek handling: stop active nodes, recreate at new position if playing
- [x] 11.6 Implement real-time volume update: adjust `GainNode.gain.value` when overlay volume changes during playback
- [x] 11.7 Implement section volume preview: adjust screen recording `<video>` element volume based on current section's `volume` property
- [x] 11.8 Clear audio buffer cache on project close

## 12. Waveform Visualization

- [x] 12.1 Implement waveform thumbnail renderer: draw peak data onto mini canvas within audio overlay band in timeline
- [x] 12.2 Use distinct color (e.g., teal/green) for audio overlay waveforms to differentiate from main waveform
- [x] 12.3 Handle trimmed overlays: render only peaks between sourceStart and sourceEnd
- [x] 12.4 Re-render waveform on trim (sourceStart/sourceEnd change)

## 13. FFmpeg Render — Per-Section Volume

- [x] 13.1 Update audio filter chain in `renderComposite()` to apply `volume=X` filter per section when volume != 1.0
- [x] 13.2 Rename `[audio_out]` to `[screen_audio]` when audio overlays are present (to distinguish from mixed output)
- [x] 13.3 Ensure no-op when all sections have volume 1.0 (identical to current behavior)

## 14. FFmpeg Render — Audio Overlay Mix

- [x] 14.1 Add audio overlay files as additional FFmpeg inputs in `renderComposite()` (`-i` args after screen/camera inputs)
- [x] 14.2 Implement `buildAudioOverlayFilter()` — generate filter chain per overlay: atrim, adelay, volume, afade, apad, output label
- [x] 14.3 Implement `amix` filter combining `[screen_audio]` with all `[audio_ovl_N]` streams: `amix=inputs=N:duration=first:normalize=0`
- [x] 14.4 Route mixed audio to `[mixed_audio]` label, apply acompressor if compressed preset
- [x] 14.5 Update export audio label logic: use `[mixed_audio]` (or `[audio_final]` if compressed) when audio overlays exist
- [x] 14.6 Handle `exportAudioPreset === 'off'` with audio overlays: mute screen sections (volume=0), preserve overlay volumes, include audio in output
- [x] 14.7 Ensure no changes when no audio overlays exist (backward compatible)

## 15. FFmpeg Render Tests

- [x] 15.1 Write tests for per-section volume filter generation: default (no filter), custom volume, zero volume
- [x] 15.2 Write tests for `buildAudioOverlayFilter()`: single overlay, multiple overlays, fades, edge cases (timeline start/end)
- [x] 15.3 Write tests for amix filter: 1 overlay, multiple overlays, correct input count
- [x] 15.4 Write tests for export audio preset interaction: 'off' with overlays, 'compressed' with overlays, 'off' without overlays
- [x] 15.5 Write tests for backward compatibility: no audio overlays produces identical output to current behavior

## 16. Integration & Cleanup

- [x] 16.1 Add audio overlay drop handler on canvas/editor area (for drag-and-drop from filesystem)
- [x] 16.2 Ensure audio file extension validation matches `AUDIO_OVERLAY_EXTENSIONS` constant
- [x] 16.3 Verify audio overlay state is included in `scheduleProjectSave()` writes
- [x] 16.4 Test full flow: import audio → place on timeline → adjust volume → trim → split → delete → undo → render
- [x] 16.5 Verify backward compatibility: open old project without audio overlays, ensure no errors
- [x] 16.6 Clean up media-cleanup.ts to handle audio overlay resources (AudioContext, source nodes, buffer cache)
