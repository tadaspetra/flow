## ADDED Requirements

### Requirement: Per-section volume in FFmpeg filter chain

When sections have `volume` values other than 1.0, the FFmpeg audio filter chain SHALL apply a `volume` filter to each section's audio before concatenation. The filter is applied between `atrim` and the concat input label:
```
[screenIdx:a]atrim=start=X:end=Y,asetpts=PTS-STARTPTS,volume=V[saI]
```
When a section's volume is 1.0, the `volume` filter SHALL be omitted for that section (no-op optimization).

#### Scenario: All sections at default volume
- **WHEN** all sections have `volume: 1.0` (or no volume field)
- **THEN** no `volume` filter is added — the audio pipeline is identical to the current behavior

#### Scenario: One section at half volume
- **WHEN** section 0 has `volume: 0.5` and section 1 has `volume: 1.0`
- **THEN** section 0's audio chain includes `volume=0.5` after `asetpts`, section 1's chain does not

#### Scenario: Section at zero volume
- **WHEN** a section has `volume: 0`
- **THEN** the section's audio chain includes `volume=0` (effectively muted)

### Requirement: Audio overlay inputs added to FFmpeg args

When audio overlay segments exist in the render data, the render service SHALL add each audio overlay file as an additional FFmpeg input. Each audio overlay adds `-i {absolutePath}` to the args list. The input index for each audio overlay is tracked for filter chain reference.

#### Scenario: Single audio overlay input
- **WHEN** rendering with one audio overlay at `audio-overlay-media/music.mp3`
- **THEN** the FFmpeg args include `-i /project/audio-overlay-media/music.mp3` after all screen/camera inputs

#### Scenario: Multiple audio overlay inputs
- **WHEN** rendering with two audio overlays
- **THEN** both audio files are added as FFmpeg inputs in order, with sequential input indices

#### Scenario: No audio overlays
- **WHEN** rendering with no audio overlay segments
- **THEN** no additional audio inputs are added — the pipeline is unchanged

### Requirement: Audio overlay filter chain construction

For each audio overlay, the FFmpeg filter chain SHALL build an audio stream that:
1. Extracts audio from the overlay input: `[N:a]`
2. Trims to source range: `atrim=start={sourceStart}:end={sourceEnd},asetpts=PTS-STARTPTS`
3. Delays to timeline position: `adelay={startTime*1000}|{startTime*1000}` (delay in milliseconds, both channels)
4. Applies volume: `volume={volume}`
5. Applies fade-in: `afade=t=in:st={startTime}:d=0.3` (unless at timeline start)
6. Applies fade-out: `afade=t=out:st={endTime-0.3}:d=0.3` (unless at timeline end)
7. Pads with silence: `apad=whole_dur={totalDuration}` (to match screen audio duration for amix)
8. Labels the output: `[audio_ovl_I]`

#### Scenario: Audio overlay filter chain
- **WHEN** an audio overlay at 5-15s, sourceStart=10, sourceEnd=20, volume=0.7 is rendered in a 30s timeline
- **THEN** the filter chain is: `[N:a]atrim=start=10:end=20,asetpts=PTS-STARTPTS,adelay=5000|5000,volume=0.7,afade=t=in:st=5:d=0.3,afade=t=out:st=14.7:d=0.3,apad=whole_dur=30[audio_ovl_0]`

#### Scenario: Audio overlay at timeline start (no fade-in)
- **WHEN** an audio overlay starts at 0s
- **THEN** the fade-in filter is omitted (no fade at the beginning)

#### Scenario: Audio overlay at timeline end (no fade-out)
- **WHEN** an audio overlay ends at the timeline's total duration
- **THEN** the fade-out filter is omitted (no fade at the end)

#### Scenario: Audio overlay with zero volume
- **WHEN** an audio overlay has `volume: 0`
- **THEN** the filter includes `volume=0` (muted but still in the mix chain)

### Requirement: Audio mix combining all sources

When audio overlays exist, the render service SHALL mix all audio sources using the `amix` filter:
```
[screen_audio][audio_ovl_0][audio_ovl_1]...amix=inputs=N:duration=first:normalize=0[mixed_audio]
```
- `inputs=N` where N is 1 (screen) + number of audio overlays
- `duration=first` — output duration matches the screen audio (primary track)
- `normalize=0` — prevents automatic volume normalization, preserving manual volume settings

The `[screen_audio]` label replaces the current `[audio_out]` label when audio overlays are present. When no audio overlays exist, the current `[audio_out]` label is used unchanged.

#### Scenario: Mix screen audio with one overlay
- **WHEN** rendering with one audio overlay
- **THEN** the filter includes `[screen_audio][audio_ovl_0]amix=inputs=2:duration=first:normalize=0[mixed_audio]`

#### Scenario: Mix screen audio with multiple overlays
- **WHEN** rendering with three audio overlays
- **THEN** the filter includes `[screen_audio][audio_ovl_0][audio_ovl_1][audio_ovl_2]amix=inputs=4:duration=first:normalize=0[mixed_audio]`

#### Scenario: No audio overlays — no mix
- **WHEN** rendering with no audio overlay segments
- **THEN** the amix filter is not used and the audio pipeline is identical to current behavior

### Requirement: Audio compression applied after mix

When `exportAudioPreset` is `'compressed'`, the `acompressor` filter SHALL be applied to the mixed audio output (after `amix`) rather than directly to `[audio_out]`. The filter chain becomes:
```
[mixed_audio]acompressor=threshold=0.125:ratio=3:attack=20:release=250:makeup=1.5[audio_final]
```
When no audio overlays exist, the compression is applied to `[audio_out]` as before.

#### Scenario: Compressed preset with audio overlays
- **WHEN** export audio preset is 'compressed' and audio overlays exist
- **THEN** `acompressor` is applied to `[mixed_audio]` producing `[audio_final]`

#### Scenario: Compressed preset without audio overlays
- **WHEN** export audio preset is 'compressed' and no audio overlays exist
- **THEN** `acompressor` is applied to `[audio_out]` as before (no change)

### Requirement: Export audio preset behavior with audio overlays

When `exportAudioPreset` is `'off'`:
- If NO audio overlays exist: no audio in output (current behavior)
- If audio overlays exist: audio IS included (screen audio at volume 0, overlay audio at their set volumes). The user explicitly added audio content; dropping it silently would be unexpected.

When `exportAudioPreset` is `'compressed'`:
- All audio sources are mixed and compressed (as described above)

#### Scenario: Preset 'off' with no audio overlays
- **WHEN** export preset is 'off' and no audio overlays exist
- **THEN** no audio is mapped to the output (current behavior)

#### Scenario: Preset 'off' with audio overlays
- **WHEN** export preset is 'off' and audio overlays exist
- **THEN** screen audio sections are mixed at volume 0 (muted), audio overlay volumes are preserved, the mixed audio is included in the output

#### Scenario: Preset 'compressed' with audio overlays
- **WHEN** export preset is 'compressed' and audio overlays exist
- **THEN** all audio is mixed, then compressed, and included in the output

### Requirement: RenderOptions accepts audio overlays

The `RenderOptions` interface SHALL include an `audioOverlays` field: `audioOverlays?: AudioOverlay[]`. The `renderComposite` function SHALL normalize and sort audio overlays by `[trackIndex, startTime]` before processing.

#### Scenario: RenderOptions with audio overlays
- **WHEN** `renderComposite` is called with `audioOverlays: [...]`
- **THEN** the audio overlays are included in the FFmpeg filter chain

#### Scenario: RenderOptions without audio overlays
- **WHEN** `renderComposite` is called without `audioOverlays`
- **THEN** the render pipeline is unchanged from current behavior

### Requirement: Audio overlay render independent of output mode

Audio overlay rendering SHALL NOT depend on `outputMode` (landscape/reel). Audio has no spatial component, so the same audio mix is produced regardless of whether the output is 16:9 or 9:16.

#### Scenario: Same audio in landscape and reel
- **WHEN** the same project is rendered in landscape mode and then reel mode
- **THEN** the audio mix (volumes, timing, fades) is identical in both outputs
