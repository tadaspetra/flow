## ADDED Requirements

### Requirement: Audio overlay preview during editor playback

When editor playback is active, the system SHALL play audio overlay files in sync with the timeline using the Web Audio API. For each audio overlay whose time range includes the current playhead position, an `AudioBufferSourceNode` SHALL be created with:
- `buffer`: the decoded `AudioBuffer` for the overlay's media file
- `offset`: `sourceStart + (playheadTime - startTime)` — the correct position within the source audio
- Connected through a `GainNode` with `gain.value = volume`

#### Scenario: Playback starts within audio overlay range
- **WHEN** editor playback starts at 6s and an audio overlay exists at 5-15s (sourceStart=0, volume=0.8)
- **THEN** an AudioBufferSourceNode starts at source offset 1s (0 + (6-5)), connected through a GainNode at 0.8

#### Scenario: Playback enters audio overlay range
- **WHEN** playback progresses from 4s to 5s and an audio overlay starts at 5s
- **THEN** an AudioBufferSourceNode is created and started at source offset 0s

#### Scenario: Playback exits audio overlay range
- **WHEN** playback progresses past an audio overlay's endTime
- **THEN** the AudioBufferSourceNode is stopped and disconnected

#### Scenario: No audio overlay at playhead
- **WHEN** playback is at a position where no audio overlay is active
- **THEN** no overlay audio is playing (only screen recording audio)

### Requirement: Audio overlay preview stops on pause

When editor playback is paused or stopped, ALL active audio overlay source nodes SHALL be stopped and disconnected. No audio overlay audio SHALL continue playing after playback stops.

#### Scenario: Pause during audio overlay playback
- **WHEN** the user pauses playback while an audio overlay is playing
- **THEN** the AudioBufferSourceNode is stopped immediately

#### Scenario: Stop playback
- **WHEN** playback is stopped (via stop button or end of timeline)
- **THEN** all audio overlay source nodes are cleaned up

### Requirement: Audio overlay preview updates on seek

When the user seeks to a new position (scrubbing the playhead), ALL active audio overlay source nodes SHALL be stopped and recreated at the new position. If playback is paused during seek, no new nodes are created until playback resumes.

#### Scenario: Seek during playback
- **WHEN** the user seeks from 7s to 12s during playback, and an audio overlay spans 10-20s
- **THEN** the old source node is stopped, a new one is created at source offset (12 - 10) = 2s

#### Scenario: Seek while paused
- **WHEN** the user seeks while playback is paused
- **THEN** no audio overlay source nodes are created (will be created on next play)

### Requirement: Audio overlay volume reflected in preview

The `GainNode` for each audio overlay source SHALL use the overlay's `volume` property. If the volume is changed while the overlay is playing (e.g., via sidebar volume drag), the `GainNode.gain.value` SHALL be updated in real-time.

#### Scenario: Volume change during playback
- **WHEN** the user adjusts an audio overlay's volume from 0.8 to 0.4 during playback
- **THEN** the GainNode's gain value updates to 0.4 immediately

#### Scenario: Muted audio overlay
- **WHEN** an audio overlay has `volume: 0` during playback
- **THEN** the GainNode gain is 0 (silent, but source node still exists for timing correctness)

### Requirement: Audio buffer decode and cache

Audio overlay files SHALL be decoded to `AudioBuffer` on import using `AudioContext.decodeAudioData()` or `OfflineAudioContext`. Decoded buffers SHALL be cached in memory keyed by `mediaPath`. The cache SHALL be cleared when the project is closed or when the media file is deleted.

#### Scenario: First access to audio overlay file
- **WHEN** an audio overlay is added and its file has not been decoded yet
- **THEN** the file is fetched, decoded to AudioBuffer, and cached

#### Scenario: Subsequent access uses cache
- **WHEN** a second audio overlay references the same mediaPath
- **THEN** the cached AudioBuffer is reused (no re-decode)

#### Scenario: Cache cleared on project close
- **WHEN** the user closes the project
- **THEN** all cached AudioBuffers are released

### Requirement: Waveform peak data extraction

When an audio overlay file is decoded, the system SHALL extract waveform peak data from the AudioBuffer. Peak data SHALL be downsampled to approximately 1000 data points (min/max pairs per segment) and stored alongside the cached AudioBuffer. This peak data is used for waveform thumbnail rendering in the timeline.

#### Scenario: Extract peaks from stereo audio
- **WHEN** a stereo MP3 file is decoded
- **THEN** peak data is extracted from the mixed-down mono representation, producing ~1000 min/max pairs

#### Scenario: Extract peaks from short audio
- **WHEN** an audio file shorter than 1000 samples is decoded
- **THEN** peak data contains one entry per sample (no downsampling needed)

### Requirement: Waveform thumbnail rendering in audio track

The system SHALL render a waveform thumbnail for each audio overlay segment in the audio track lane. The waveform displays the portion of the peak data corresponding to `sourceStart`–`sourceEnd`, scaled to fit the segment's width in the timeline. The waveform SHALL use a distinct color (e.g., green or teal) to differentiate from the main waveform canvas.

#### Scenario: Waveform for full audio overlay
- **WHEN** an audio overlay uses the full source (sourceStart=0, sourceEnd=duration)
- **THEN** the waveform thumbnail shows the complete audio waveform within the segment band

#### Scenario: Waveform for trimmed audio overlay
- **WHEN** an audio overlay has sourceStart=10, sourceEnd=30 in a 60-second file
- **THEN** the waveform thumbnail shows only the peaks from 10-30s of the source audio

#### Scenario: Waveform updates on trim
- **WHEN** the user trims an audio overlay (changing sourceStart or sourceEnd)
- **THEN** the waveform thumbnail re-renders to show the new source range

### Requirement: Section volume preview

When editor playback is active and a section has `volume` < 1.0, the screen recording audio playback volume SHALL reflect the section's volume setting. This is achieved by adjusting the screen recording's `<video>` element volume or using a GainNode on the screen audio source.

#### Scenario: Section at half volume
- **WHEN** playback enters a section with `volume: 0.5`
- **THEN** the screen recording audio plays at 50% volume

#### Scenario: Section at full volume (default)
- **WHEN** playback enters a section with `volume: 1.0`
- **THEN** the screen recording audio plays at normal volume

#### Scenario: Section volume changes during playback
- **WHEN** the user adjusts a section's volume while playback is within that section
- **THEN** the screen recording audio volume updates in real-time
