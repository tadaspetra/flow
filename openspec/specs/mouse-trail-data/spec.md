## ADDED Requirements

### Requirement: Mouse trail data loading

The system SHALL provide a function to load and parse a mouse trail JSON file from disk. The loaded trail SHALL be validated: entries with non-numeric `t`, `x`, or `y` are filtered out. The trail SHALL be sorted by `t`.

#### Scenario: Load valid mouse trail
- **WHEN** a mouse trail JSON file is read with valid entries
- **THEN** the trail array is returned sorted by `t` with numeric validation

#### Scenario: Load corrupt or empty file
- **WHEN** the file is missing, empty, or contains invalid JSON
- **THEN** an empty trail is returned (auto-track unavailable)

### Requirement: Mouse position lookup at source time

The system SHALL provide `lookupMouseAt(trail, sourceTime)` that returns the raw `{ x, y }` mouse position at a given source time by linear interpolation between the two nearest trail entries.

#### Scenario: Exact match
- **WHEN** `sourceTime` matches a trail entry's `t` exactly
- **THEN** that entry's `{ x, y }` is returned

#### Scenario: Between entries
- **WHEN** `sourceTime` is between two trail entries (e.g., t=0.12 between t=0.10 and t=0.15)
- **THEN** `{ x, y }` is linearly interpolated between the two entries

#### Scenario: Before first entry
- **WHEN** `sourceTime` is before the first trail entry
- **THEN** the first entry's `{ x, y }` is returned

#### Scenario: After last entry
- **WHEN** `sourceTime` is after the last trail entry
- **THEN** the last entry's `{ x, y }` is returned

### Requirement: Smoothed mouse position lookup

The system SHALL provide `lookupSmoothedMouseAt(trail, sourceTime, smoothing, captureWidth, captureHeight)` that returns smoothed `{ focusX, focusY }` in normalized coordinates (0-1) suitable for zoompan focus. The smoothing uses an exponential moving average: `smoothX += (targetX - smoothX) * (1 - e^(-dt/smoothing))`.

#### Scenario: Smooth lookup with default smoothing
- **WHEN** called with smoothing=0.15 and a trail with jittery mouse data
- **THEN** the returned focusX/focusY are a smooth approximation of the raw mouse path

#### Scenario: Smoothing of 0 (no smoothing)
- **WHEN** smoothing is 0 or very small
- **THEN** the returned position closely matches the raw interpolated mouse position

#### Scenario: Large smoothing value
- **WHEN** smoothing is 0.5
- **THEN** the returned position lags significantly behind the raw mouse position, producing very smooth movement

### Requirement: Trail subsampling for render keypoints

The system SHALL provide `subsampleTrail(trail, smoothing, captureWidth, captureHeight, startTime, endTime, rate)` that produces an array of `{ time, focusX, focusY }` keypoints at the given sample rate (default 2Hz). Each keypoint represents the smoothed focus position at that time.

#### Scenario: Subsample at 2Hz
- **WHEN** a 10-second section is subsampled at 2Hz
- **THEN** approximately 20 keypoints are returned, evenly spaced at 0.5s intervals

#### Scenario: Subsample preserves endpoints
- **WHEN** subsampling a section from startTime=5 to endTime=10
- **THEN** the first keypoint is at t=5 and the last is at or near t=10

### Requirement: Pure utility module

All mouse trail functions SHALL be in a pure utility module (`src/renderer/features/timeline/mouse-trail.js`) with no DOM dependencies, exported as ES modules, and independently testable.

#### Scenario: Import and use in tests
- **WHEN** the module is imported in a test file
- **THEN** all functions work without browser/Electron APIs
