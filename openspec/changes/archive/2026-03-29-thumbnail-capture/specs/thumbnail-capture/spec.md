## ADDED Requirements

### Requirement: Ctrl+T keyboard shortcut triggers thumbnail capture

The editor SHALL respond to Ctrl+T (Cmd+T on macOS) by initiating a thumbnail capture of the current playhead frame. The shortcut SHALL only be active when: the editor state exists, no render is in progress, the active workspace view is `timeline`, and a project folder is loaded. The handler SHALL call `e.preventDefault()` to suppress any default browser/Electron behavior. If any guard condition is not met, the shortcut SHALL be silently ignored.

#### Scenario: Capture triggered in normal editor state
- **WHEN** the user presses Ctrl+T while the editor is in timeline view with a loaded project and no active render
- **THEN** the system initiates a thumbnail capture at the current playhead time

#### Scenario: Shortcut ignored during render
- **WHEN** the user presses Ctrl+T while `editorState.rendering` is true
- **THEN** no capture is initiated and no error is shown

#### Scenario: Shortcut ignored when not in timeline view
- **WHEN** the user presses Ctrl+T while `activeWorkspaceView` is not `timeline`
- **THEN** no capture is initiated

#### Scenario: Shortcut ignored when focus is on form input
- **WHEN** the user presses Ctrl+T while focus is on a SELECT or INPUT element
- **THEN** no capture is initiated (consistent with existing shortcut guard)

### Requirement: Single-frame FFmpeg render produces full-quality PNG

The `captureThumbnail` service function SHALL render exactly one video frame using FFmpeg, producing a PNG image at full export resolution. For landscape mode, the output SHALL be 1920x1080 (or source-derived dimensions matching `resolveOutputSize`). For reel mode, the output SHALL be `round(sourceHeight * 9/16) x sourceHeight`. The FFmpeg command SHALL use `-frames:v 1` to limit output to one frame and `-update 1` for single-image output.

#### Scenario: Landscape thumbnail resolution
- **WHEN** capturing a thumbnail in landscape mode with source 1920x1080
- **THEN** the output PNG is 1920x1080

#### Scenario: Reel thumbnail resolution
- **WHEN** capturing a thumbnail in reel mode with source 1920x1080
- **THEN** the output PNG is 608x1080 (matching `resolveOutputSize` for reel)

#### Scenario: FFmpeg outputs exactly one frame
- **WHEN** the FFmpeg command is constructed
- **THEN** the args include `-frames:v 1` and `-update 1`, and the output filename ends with `.png`

### Requirement: Thumbnail uses same visual compositing as video render

The thumbnail capture SHALL produce an image visually identical to the corresponding frame of a full video render at the same playhead time. This means the FFmpeg filter graph SHALL use the same filter construction functions (`buildScreenFilter`, `buildFilterComplex`, `buildOverlayFilter` from `render-filter-service.ts`) as the video render pipeline. The frozen keyframe state passed to these functions SHALL represent the interpolated visual state at the capture time.

#### Scenario: Thumbnail with camera PIP matches render PIP
- **WHEN** capturing at a time where the camera PIP is visible at position (100, 50) with scale 0.22
- **THEN** the thumbnail shows the camera PIP at the same position and scale as a video render would at that time

#### Scenario: Thumbnail with zoom/pan matches render
- **WHEN** capturing at a time where backgroundZoom is 1.5 and backgroundPanX is 0.3
- **THEN** the thumbnail shows the same zoomed and panned view as a video render would

#### Scenario: Thumbnail in reel mode uses reel crop
- **WHEN** capturing in reel mode with reelCropX set to 0.2
- **THEN** the thumbnail shows the reel-cropped view matching the video render

### Requirement: Overlays visible at capture time are included

The renderer SHALL determine which overlays are visible at the current playhead time (overlay `startTime <= currentTime < endTime`) and pass only those overlays to the capture service. The capture service SHALL include these overlays in the FFmpeg filter graph using `buildOverlayFilter`, positioned according to the current output mode (landscape or reel coordinates).

#### Scenario: Image overlay visible at capture time
- **WHEN** an image overlay exists at 5-10s and the playhead is at 7s
- **THEN** the thumbnail includes that overlay composited at its position

#### Scenario: No overlays at capture time
- **WHEN** no overlays are active at the current playhead time
- **THEN** the filter graph contains no overlay compositing stages

#### Scenario: Multiple overlays visible at capture time
- **WHEN** two overlays (track 0 and track 1) are both active at the playhead time
- **THEN** both overlays are composited with track 0 below track 1, matching render z-order

### Requirement: Camera visibility respected in thumbnail

The thumbnail capture SHALL respect the camera PIP visibility state at the capture time. If `pipVisible` is false and `cameraFullscreen` is false in the interpolated keyframe state, the camera input SHALL be excluded from the FFmpeg command entirely. If `cameraFullscreen` is true, the camera SHALL fill the full output frame. If `pipVisible` is true, the camera SHALL appear as a PIP overlay at the keyframe-specified position and scale.

#### Scenario: Camera hidden at capture time
- **WHEN** the interpolated keyframe at playhead time has pipVisible=false and cameraFullscreen=false
- **THEN** no camera input is included in the FFmpeg command, and the thumbnail shows only the screen content

#### Scenario: Camera fullscreen at capture time
- **WHEN** the interpolated keyframe at playhead time has cameraFullscreen=true
- **THEN** the camera fills the full thumbnail frame

#### Scenario: Camera PIP at capture time
- **WHEN** the interpolated keyframe at playhead time has pipVisible=true with a PIP position
- **THEN** the thumbnail shows the camera as a PIP overlay at that position

### Requirement: Source time resolved from playhead via section mapping

The renderer SHALL resolve the current playhead time to a source time within the correct take using the same section-to-source time mapping as playback. The source time SHALL be computed as `section.sourceStart + (playheadTime - section.start)` for the section containing the playhead. This source time is passed to the capture service for FFmpeg input seeking.

#### Scenario: Playhead in first section
- **WHEN** playhead is at 3.0s, and section 0 spans timeline 0-10s with sourceStart=0
- **THEN** the source time is 3.0s in the section's take

#### Scenario: Playhead in second section from different take
- **WHEN** playhead is at 12.0s, section 1 spans timeline 10-20s with sourceStart=5.0s
- **THEN** the source time is 7.0s (5.0 + (12.0 - 10.0)) in section 1's take

#### Scenario: Playhead at section boundary
- **WHEN** playhead is exactly at a section boundary (e.g., 10.000s where section 0 ends and section 1 starts)
- **THEN** the system resolves to a valid section and does not error

### Requirement: Camera sync offset applied to camera seek

When the project has a non-zero `cameraSyncOffsetMs`, the camera input seek time SHALL be offset accordingly. The camera seek time SHALL be `screenSourceTime + (cameraSyncOffsetMs / 1000)`. This matches the render pipeline behavior where camera audio/video is shifted relative to the screen.

#### Scenario: Positive camera sync offset
- **WHEN** screen source time is 5.0s and cameraSyncOffsetMs is 200
- **THEN** the camera seek time is 5.2s

#### Scenario: Zero camera sync offset
- **WHEN** cameraSyncOffsetMs is 0
- **THEN** the camera seek time equals the screen source time

#### Scenario: Negative camera sync offset
- **WHEN** screen source time is 5.0s and cameraSyncOffsetMs is -300
- **THEN** the camera seek time is 4.7s

### Requirement: Thumbnail saved to project folder with timestamp and mode

Each captured thumbnail SHALL be saved to the project folder with filename pattern `thumbnail-{timestamp}-{mode}.png` where `{timestamp}` is `Date.now()` at capture time and `{mode}` is `landscape` or `reel`. The function SHALL return the absolute path of the saved file.

#### Scenario: Landscape thumbnail filename
- **WHEN** capturing in landscape mode at timestamp 1711700000000
- **THEN** the file is saved as `thumbnail-1711700000000-landscape.png` in the project folder

#### Scenario: Reel thumbnail filename
- **WHEN** capturing in reel mode at timestamp 1711700000000
- **THEN** the file is saved as `thumbnail-1711700000000-reel.png` in the project folder

#### Scenario: Multiple captures produce separate files
- **WHEN** the user captures two thumbnails 2 seconds apart
- **THEN** two separate PNG files exist in the project folder, each with a different timestamp

### Requirement: Multiple thumbnails accumulate without deletion

Each Ctrl+T press SHALL create a new thumbnail file. The system SHALL NOT delete or overwrite any previously captured thumbnails. There is no limit on the number of thumbnails per project.

#### Scenario: Second capture preserves first
- **WHEN** the user captures a thumbnail, then changes the playhead and captures again
- **THEN** both thumbnail files exist in the project folder

#### Scenario: Captures across modes accumulate
- **WHEN** the user captures in landscape mode, switches to reel mode, and captures again
- **THEN** both the landscape and reel thumbnail files exist

### Requirement: Toast notification on capture

The editor SHALL display a brief toast notification when a thumbnail capture completes. The toast SHALL show text indicating success (e.g., "Thumbnail saved"). The toast SHALL auto-dismiss after approximately 2 seconds. The toast SHALL be visible in the editor without blocking interaction.

#### Scenario: Successful capture shows toast
- **WHEN** a thumbnail capture completes successfully
- **THEN** a toast notification appears showing a success message and auto-dismisses after ~2 seconds

#### Scenario: Toast does not block editor interaction
- **WHEN** the toast is visible
- **THEN** the user can still interact with the timeline, playhead, and other editor controls

### Requirement: IPC channel bridges renderer to thumbnail service

A new IPC channel `capture-thumbnail` SHALL be registered via `ipcMain.handle`. The renderer SHALL invoke it via `window.electronAPI.captureThumbnail(opts)` where `opts` is `ThumbnailCaptureOptions`. The handler SHALL call the `captureThumbnail` service function and return the absolute path of the saved PNG. The `ElectronAPI` interface SHALL include the `captureThumbnail` method, and the preload bridge SHALL expose it.

#### Scenario: IPC round-trip returns file path
- **WHEN** the renderer invokes `captureThumbnail` with valid options
- **THEN** the IPC handler returns the absolute path of the saved PNG file

#### Scenario: IPC error propagation
- **WHEN** the FFmpeg process fails during capture
- **THEN** the IPC handler throws an error that propagates to the renderer

### Requirement: Capture debounced to prevent rapid re-triggers

The Ctrl+T handler SHALL prevent concurrent captures. If a capture is already in progress, subsequent Ctrl+T presses SHALL be ignored until the current capture completes. This prevents queueing multiple FFmpeg processes from rapid key presses.

#### Scenario: Rapid Ctrl+T presses
- **WHEN** the user presses Ctrl+T three times in quick succession
- **THEN** only one capture is initiated; the second and third presses are ignored

#### Scenario: Sequential captures after completion
- **WHEN** the user presses Ctrl+T, waits for the toast to appear, then presses Ctrl+T again
- **THEN** both captures complete successfully, producing two separate files
