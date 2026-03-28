## Why

The editor supports visual overlays (images/videos) on the timeline but has no way to add external audio tracks. Users need to layer background music, sound effects, or voiceover narration onto their screen recordings. Currently, the only audio source is the embedded screen recording audio — there is no mechanism to import, position, trim, volume-adjust, or mix additional audio. Adding audio overlay support completes the media layering story and brings the editor to feature parity with professional editing workflows.

## What Changes

- **New `AudioOverlay` data type** — a timeline-positioned audio segment with `id`, `trackIndex`, `mediaPath`, `startTime`, `endTime`, `sourceStart`, `sourceEnd`, `volume` (0.0–1.0), and `saved` flag. Stored in `ProjectTimeline.audioOverlays` and `ProjectTimeline.savedAudioOverlays`.
- **Per-section volume control** — add a `volume` field (0.0–1.0, default 1.0) to the existing `Section` interface, allowing users to adjust the screen recording audio volume on a per-section basis.
- **Audio overlay timeline track** — a new track lane below the existing media overlay tracks and above the waveform/section area. Displays audio overlay segments with waveform thumbnails, supports selection, trim handles, split, and delete — mirroring the media overlay track behavior.
- **Volume drag control in sidebar** — a scrub-style volume adjustment (reusing the `initScrubDrag()` pattern from the zoom control) on both section items and audio overlay items in the sidebar. Displays a speaker icon with the current volume value; drag left/right to adjust.
- **Audio file import** — drag-and-drop audio files (MP3, WAV, AAC, OGG, FLAC) onto the audio track or a dedicated drop zone. Files are copied to `{project}/audio-overlay-media/` via IPC. Supports the same save/unsave and undo/redo flow as media overlays.
- **FFmpeg audio mixing in render pipeline** — extend the render service to mix audio overlay tracks with the screen recording audio. Per-section volume is applied via FFmpeg `volume` filter on each section's audio before concat. Audio overlays are trimmed, delayed, volume-adjusted, faded, and mixed via `amix` with `normalize=0` to preserve manual volume settings. The optional `acompressor` (compressed preset) applies after the final mix. When `exportAudioPreset === 'off'` and audio overlays exist, audio is still included (muted screen audio, overlay audio only).
- **Editor audio preview** — use Web Audio API to decode and play audio overlays in sync with the timeline during editor playback, mixed with the screen recording audio at their respective volumes.
- **Waveform visualization** — decode audio overlay files with `OfflineAudioContext` and render waveform thumbnails in the audio track lane, similar to the existing main waveform canvas.

## Capabilities

### New Capabilities
- `audio-overlay-data`: AudioOverlay type definition, normalization, ID generation, volume defaults, and persistence in ProjectTimeline (parallels `media-overlay-data`)
- `audio-overlay-timeline`: Audio track lane in the timeline UI — segment rendering with waveforms, selection, trim handles, split, delete, drop targeting (parallels `media-overlay-timeline`)
- `audio-overlay-files`: Audio file import via drag-and-drop, IPC channel, project folder storage (`audio-overlay-media/`), reference counting, delete staging (parallels `media-overlay-files`)
- `audio-overlay-render`: FFmpeg audio mixing — per-section volume filter, audio overlay trim/delay/volume/fade, amix combining all audio sources, integration with export audio presets (parallels `media-overlay-render`)
- `audio-overlay-playback`: Editor audio preview — Web Audio API decode, playback sync with timeline, volume control, waveform visualization (parallels `media-overlay-playback`)
- `audio-overlay-sidebar`: Sidebar UI for audio overlays — listing in the Overlays tab, volume drag control on audio overlay items and section items, save/unsave heart toggle (new capability, no direct media-overlay parallel)

### Modified Capabilities
- `media-overlay-data`: Add `volume: number` field to the `Section` interface (default 1.0). Update `normalizeProjectData` to handle `audioOverlays` and `savedAudioOverlays` arrays in ProjectTimeline. No changes to the `Overlay` type itself.

## Impact

- **Types**: `domain.ts` — new `AudioOverlay` interface, new constants (`MAX_AUDIO_TRACKS`, `AUDIO_EXTENSIONS`, `DEFAULT_AUDIO_VOLUME`), `Section` gains `volume` field, `ProjectTimeline` gains `audioOverlays`/`savedAudioOverlays` arrays
- **Services types**: `services.ts` — `RenderOptions` gains `audioOverlays` array, `RenderSectionInput` gains `volume` field
- **Domain logic**: `project.ts` — new `normalizeAudioOverlays()`, `generateAudioOverlayId()`, updated `normalizeProjectData()` and `getProjectTimelineSnapshot()`
- **Renderer**: `app.ts` — new audio track lane rendering, audio overlay sidebar list, volume drag controls, audio overlay import handling, editor audio playback, waveform decode/render
- **Render service**: `render-service.ts` — per-section volume filters, audio overlay input handling, new `buildAudioOverlayFilter()` function
- **Render filter service**: `render-filter-service.ts` — new audio filter chain builder (or in render-service.ts directly)
- **IPC**: new `import-audio-overlay-media` channel
- **HTML**: `index.html` — new audio track lane element, volume controls in sidebar items
- **Tests**: new `audio-overlay-utils.test.ts`, updates to `render-service.test.ts`, `project-domain.test.ts`
- **No breaking changes** — existing projects without audio overlays continue to work unchanged. The `Section.volume` field defaults to 1.0 (no change in behavior).
