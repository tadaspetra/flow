## Context

The editor currently supports two types of timeline content: **sections** (trimmed segments of the screen recording) and **media overlays** (image/video layers composited on the canvas). Audio exists only as embedded streams within the screen recording files — there is no mechanism for external audio.

The media overlay system provides a proven architectural pattern: types in `domain.ts`, normalization in `project.ts`, state computation in `overlay-utils.ts`, timeline/sidebar UI in `app.ts`, FFmpeg rendering in `render-filter-service.ts` / `render-service.ts`, and file management via IPC. Audio overlays follow this pattern closely, but diverge in key areas: no spatial position (no landscape/reel split), volume control instead of position/size, audio FFmpeg filters instead of video overlay filters, and Web Audio API for editor playback instead of canvas drawing.

The zoom control's `initScrubDrag()` pattern (mousedown/mousemove/mouseup with pixel-to-value sensitivity) is the established interaction for continuous value adjustment and will be reused for volume controls.

**Current audio pipeline (FFmpeg):**
```
[screen:a] → atrim per section → concat → [audio_out] → optional acompressor → output
```

**Current timeline layout:**
```
┌─ overlay track 1 ──────────────────────────┐
├─ overlay track 0 ──────────────────────────┤
├─ waveform canvas + section markers ────────┤
├─ playhead scrubber ────────────────────────┤
└────────────────────────────────────────────┘
```

## Goals / Non-Goals

**Goals:**
- Allow users to import, position, trim, split, and delete external audio files on the timeline
- Provide per-section and per-audio-overlay volume control with an intuitive drag interaction
- Mix all audio sources (screen recording + audio overlays) in the FFmpeg render pipeline with correct timing, volume, and fade transitions
- Preview mixed audio in the editor during playback
- Display waveform thumbnails for audio overlay segments in the timeline track
- Build on the foundation of the media overlay system so extending to multiple audio tracks is straightforward
- Maintain backward compatibility — existing projects without audio overlays load and render identically

**Non-Goals:**
- Multiple audio tracks (foundation built for it, but only 1 track in this change)
- Audio effects beyond volume and fade (EQ, reverb, etc.)
- Audio recording from the editor (mic capture is for Scribe transcription, not timeline audio)
- Real-time audio waveform during playback (static pre-decoded waveforms only)
- Keyframeable volume over time within a single segment (volume is per-segment, not animated)
- Audio-visual sync offset for audio overlays (no equivalent of `cameraSyncOffsetMs`)

## Decisions

### 1. AudioOverlay type mirrors Overlay minus spatial fields

**Decision:** `AudioOverlay` has `id`, `trackIndex`, `mediaPath`, `startTime`, `endTime`, `sourceStart`, `sourceEnd`, `volume`, `saved` — no `landscape`/`reel`/`mediaType`/`OverlayPosition`.

**Rationale:** Audio has no spatial representation. The `volume` field (0.0–1.0) replaces position/size as the primary adjustable property. Keeping `trackIndex` allows future multi-track without type changes. Keeping `sourceStart`/`sourceEnd` enables source trimming (play a sub-range of the imported file).

**Alternative considered:** Extend the existing `Overlay` type with optional audio fields. Rejected — it would pollute the type with nullable spatial fields and require conditional logic throughout the visual overlay code.

### 2. Separate arrays in ProjectTimeline

**Decision:** `ProjectTimeline` gets `audioOverlays: AudioOverlay[]` and `savedAudioOverlays: AudioOverlay[]`, separate from `overlays`/`savedOverlays`.

**Rationale:** Audio and media overlays have different rendering pipelines (canvas vs. audio), different timeline tracks, and different interaction patterns. Separate arrays keep the data model clean and avoid filtering by type in hot paths (draw loop, FFmpeg filter builder). The normalization, save/unsave, and undo/redo flows parallel the existing overlay pattern.

**Alternative considered:** Unified array with discriminated union (`type: 'audio' | 'image' | 'video'`). Rejected — would require type guards everywhere and break the existing overlay code's assumptions.

### 3. Per-section volume via `Section.volume` field

**Decision:** Add `volume: number` (0.0–1.0, default 1.0) directly to the `Section` interface.

**Rationale:** Volume is a per-section property that flows through the render pipeline alongside `sourceStart`, `sourceEnd`, `backgroundZoom`, etc. Adding it to `Section` keeps it in the natural data flow. The normalization function already handles Section defaults, so adding one more field is minimal. The `RenderSectionInput` interface also gets a `volume` field.

**Alternative considered:** Store volume in keyframes (like `backgroundZoom`). Rejected — volume is not a per-keyframe animated property in this design; it's a per-section constant. Keyframes would add complexity with no benefit.

### 4. Volume drag control using `initScrubDrag()` pattern

**Decision:** Reuse the existing `initScrubDrag(labelEl, valueEl, hiddenInputEl)` function for volume controls. Each section row and audio overlay row in the sidebar gets a volume icon + value display + hidden range input.

**Rationale:** The pattern is proven (zoom control works this way), handles mousedown/mousemove/mouseup correctly, supports configurable sensitivity via min/max/step on the hidden input, and dispatches standard input/change events. Volume range: `min=0, max=1, step=0.01`, sensitivity = `1/200 = 0.005` per pixel.

**Alternative considered:** Dedicated slider component. Rejected — the scrub-drag pattern is already established in the codebase, and a slider would take more space in the sidebar rows.

### 5. Audio track positioned between media overlay tracks and waveform

**Decision:** New timeline layout:
```
┌─ overlay track 1 ──────────────────────────┐
├─ overlay track 0 ──────────────────────────┤
├─ audio overlay track 0 ────────────────────┤  ← NEW
├─ waveform canvas + section markers ────────┤
├─ playhead scrubber ────────────────────────┤
└────────────────────────────────────────────┘
```

**Rationale:** Audio overlays are supplementary layers like media overlays, but they don't composite on the visual canvas. Placing them between media overlays and the main waveform creates a natural visual grouping: visual layers on top, audio layers in the middle, primary content at the bottom.

**Alternative considered:** Below the waveform. Rejected — it would push the scrubber down and feel disconnected from the overlay tracks.

### 6. FFmpeg audio mixing architecture

**Decision:** Build the audio mix in three stages within `renderComposite()`:

**Stage 1 — Per-section volume:** Apply `volume=X` filter to each section's audio before concat:
```
[screen:a] → atrim → volume=0.85 → [sa0]
[screen:a] → atrim → volume=1.0 → [sa1]
[sa0][sa1] → concat → [screen_audio]
```
When all sections have volume 1.0, the `volume` filter is omitted (no change from current behavior).

**Stage 2 — Audio overlay preparation:** For each audio overlay, create a filtered audio stream:
```
[N:a] → atrim(sourceStart,sourceEnd) → adelay(startTime ms) → volume(vol) → afade in/out → apad → [audio_ovl_0]
```
- `atrim`: extract the source time range
- `adelay`: position on the rendered timeline
- `volume`: per-overlay volume
- `afade`: 0.3s fade in/out (matching visual overlay transitions)
- `apad`: pad with silence to full timeline duration (required for `amix`)

**Stage 3 — Final mix:**
```
[screen_audio][audio_ovl_0][audio_ovl_1]... → amix=inputs=N:duration=first:normalize=0 → [mixed_audio]
[mixed_audio] → optional acompressor → [audio_final]
```
- `duration=first` — output duration matches screen audio (the primary track)
- `normalize=0` — preserves our manual volume values (prevents amix from auto-leveling)

**Alternative considered:** Using `amerge` instead of `amix`. Rejected — `amerge` creates multi-channel output (stereo+stereo = 4 channels), while `amix` properly mixes down to the same channel layout.

### 7. Export audio preset interaction with audio overlays

**Decision:**
- `'compressed'` — all audio mixed, then `acompressor` applied
- `'off'` — when no audio overlays exist, behave as before (no audio in output). When audio overlays exist, include the mixed audio WITHOUT compression. This prevents a confusing state where the user has placed audio overlays but they're silently dropped from the export.

**Rationale:** The "off" preset was designed for the screen-recording-only world. With audio overlays, the user has explicitly added audio content. Discarding it silently would be surprising. The render service already selects the audio label based on preset — we just need to ensure the overlay audio flows through even when screen audio is marked "off".

### 8. Editor audio preview via Web Audio API

**Decision:** Use `AudioContext` with `AudioBufferSourceNode` per audio overlay. On playback start, create source nodes for active overlays, set their offset to match the current playhead position, and apply `GainNode` for volume control. On seek, recreate source nodes at the new position.

**Rationale:** Web Audio API is already used in the app (mic capture, metering, Scribe worklet). `AudioBufferSourceNode` supports precise time offset and integrates naturally with the existing `AudioContext`. `GainNode` maps directly to the volume property.

**Alternative considered:** HTML `<audio>` elements (like `<video>` for video overlays). Rejected — `<audio>` elements have less precise seek behavior and don't support fine-grained volume control as cleanly as Web Audio API.

### 9. Waveform decode and cache strategy

**Decision:** Decode audio overlay files on import using `OfflineAudioContext.decodeAudioData()`. Store the decoded peak data (not the full `AudioBuffer`) in a memory cache keyed by `mediaPath`. Render waveforms as static canvas draws in the audio track lane, updated when the timeline scrolls or zooms.

**Rationale:** The app already uses `OfflineAudioContext` for the main waveform. Caching decoded peak data (downsampled to ~1000 points) is memory-efficient and avoids re-decoding on every timeline render. The waveform is static (not animated), so a single canvas draw per segment is sufficient.

### 10. Audio file storage in `audio-overlay-media/` directory

**Decision:** Store imported audio files in `{project}/audio-overlay-media/` (separate from `overlay-media/` which holds visual overlays). New IPC channel `import-audio-overlay-media`.

**Rationale:** Separating directories avoids confusion between visual and audio overlay media. The import IPC pattern is identical to `import-overlay-media` — copy file, return relative path. Supported extensions: `.mp3`, `.wav`, `.aac`, `.ogg`, `.flac`, `.m4a`.

**Alternative considered:** Shared `overlay-media/` directory. Rejected — mixing audio and visual files in one directory complicates cleanup logic and makes it harder to distinguish file types at a glance.

### 11. One audio track with multi-track foundation

**Decision:** `MAX_AUDIO_TRACKS = 1` constant. All audio overlay code uses `trackIndex` filtering, same as media overlays. The timeline renders one audio track lane. Expanding to multiple tracks later requires: bumping the constant, adding HTML track lane elements, and no logic changes.

**Rationale:** Matches the user's request. The media overlay system proved this approach works — it shipped with 2 tracks, and all the per-track logic (collision detection, trim clamping, normalization) was built in from the start.

## Risks / Trade-offs

**[Risk] `amix` with many inputs degrades performance** → Audio overlay count is expected to be small (1-5 per project). For large counts, `amix` still performs well since it's a simple sample-by-sample sum. If performance becomes an issue, pre-mixing overlays with `amerge` before final `amix` is a viable optimization.

**[Risk] `adelay` introduces silence padding that bloats filter graph** → `apad` is needed to equalize stream lengths for `amix`. The `duration=first` flag on `amix` ensures the output doesn't exceed the screen audio length. Memory impact is minimal since FFmpeg processes audio streams in chunks.

**[Risk] Editor audio preview may have latency on seek** → Recreating `AudioBufferSourceNode` on every seek has some overhead. Mitigation: debounce seek events during scrubbing, only create nodes when playback starts.

**[Risk] Large audio files (multi-minute WAV) may be slow to decode for waveform** → Mitigation: decode in a Web Worker or use `OfflineAudioContext` with a low sample rate (8000 Hz) for waveform-only decode. Cache peak data so decode happens only once per import.

**[Risk] Per-section volume at 0.0 with audio overlays may confuse users** → When section volume is 0.0, screen audio is muted but audio overlays still play. This is correct behavior but may surprise users. Mitigation: the volume icon visually indicates muted state, providing clear feedback.

**[Trade-off] Volume per-segment vs keyframeable volume** → Per-segment volume is simpler and sufficient for most use cases (mute a section, lower music volume). Keyframeable volume (volume curves over time) is a future enhancement if needed — it would require a new data structure and interpolation logic in both the editor and FFmpeg filter builder.

**[Trade-off] Separate audio/visual overlay arrays vs unified** → Separate arrays add some code duplication (normalization, save/unsave logic). But the codepaths are cleaner and there's no risk of regressions in the visual overlay system. The duplication is small and well-contained.
