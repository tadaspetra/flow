## MODIFIED Requirements

### Requirement: Overlay persistence in project timeline

Overlay segments SHALL be stored in `project.timeline.overlays` and persisted with the project. The `normalizeProjectData` function SHALL normalize the overlays array on project load, including setting default `trackIndex` values. The `getProjectTimelineSnapshot` function SHALL include overlays with their `trackIndex` in the saved payload. Additionally, `normalizeProjectData` SHALL normalize `audioOverlays` and `savedAudioOverlays` arrays using `normalizeAudioOverlays()`, and `getProjectTimelineSnapshot` SHALL include both arrays.

#### Scenario: Project save includes overlays with trackIndex
- **WHEN** the project is saved with overlay segments on track 0 and track 1
- **THEN** the saved project JSON includes `timeline.overlays` with each segment's `trackIndex` preserved

#### Scenario: Project load restores overlays with backward compatibility
- **WHEN** a project from before multi-track support is loaded (overlays have no `trackIndex`)
- **THEN** all overlays are assigned `trackIndex: 0` and appear on track 0

#### Scenario: Project save includes audio overlays
- **WHEN** the project is saved with audio overlay segments
- **THEN** the saved project JSON includes `timeline.audioOverlays` and `timeline.savedAudioOverlays`

#### Scenario: Project load without audio overlays (backward compatibility)
- **WHEN** a project from before audio overlay support is loaded
- **THEN** `timeline.audioOverlays` defaults to `[]` and `timeline.savedAudioOverlays` defaults to `[]`

## ADDED Requirements

### Requirement: Section volume field

Each `Section` SHALL have a `volume` field: a number between 0.0 and 1.0 (inclusive), defaulting to 1.0. This controls the screen recording audio volume for that section during render. The normalization function SHALL clamp volume to the 0.0–1.0 range and default to 1.0 if missing, invalid, or non-finite.

#### Scenario: Section with default volume
- **WHEN** a section is loaded without a `volume` field (backward compatibility)
- **THEN** `volume` defaults to 1.0 (full volume, no change from current behavior)

#### Scenario: Section with custom volume
- **WHEN** a section has `volume: 0.5`
- **THEN** the section's screen audio is rendered at 50% volume

#### Scenario: Section with zero volume
- **WHEN** a section has `volume: 0`
- **THEN** the section's screen audio is muted in the render output

#### Scenario: Section volume out of range
- **WHEN** a section is loaded with `volume: 2.5`
- **THEN** `volume` is clamped to 1.0

#### Scenario: Section volume negative
- **WHEN** a section is loaded with `volume: -0.5`
- **THEN** `volume` is clamped to 0.0

#### Scenario: Section volume persistence
- **WHEN** a project with sections having custom volume values is saved and reopened
- **THEN** each section's `volume` value is preserved

### Requirement: Section volume in render section input

The `RenderSectionInput` interface SHALL include a `volume: number` field. The `normalizeSectionInput` function SHALL extract volume from raw section data, defaulting to 1.0 if missing. This volume value is used by the render service to apply per-section audio volume.

#### Scenario: RenderSectionInput includes volume
- **WHEN** a section with `volume: 0.7` is normalized for rendering
- **THEN** the resulting `RenderSectionInput` has `volume: 0.7`

#### Scenario: RenderSectionInput default volume
- **WHEN** a section without a `volume` field is normalized for rendering
- **THEN** the resulting `RenderSectionInput` has `volume: 1.0`
