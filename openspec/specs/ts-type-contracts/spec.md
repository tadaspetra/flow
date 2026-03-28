## ADDED Requirements

### Requirement: Domain type definitions

The project SHALL define TypeScript interfaces and type aliases in `src/shared/types/domain.ts` for all domain data shapes. These types SHALL match the shapes currently enforced by runtime normalization functions in `src/shared/domain/project.js`.

Required types:

| Type | Shape | Source of truth |
|------|-------|-----------------|
| `OutputMode` | `'landscape' \| 'reel'` | `OUTPUT_MODE_LANDSCAPE`, `OUTPUT_MODE_REEL` constants |
| `ExportAudioPreset` | `'off' \| 'compressed'` | `EXPORT_AUDIO_PRESET_OFF`, `EXPORT_AUDIO_PRESET_COMPRESSED` |
| `ScreenFitMode` | `'fit' \| 'fill'` | `normalizeProjectData` settings normalization |
| `PipSnapPoint` | `'tl' \| 'tc' \| 'tr' \| 'ml' \| 'center' \| 'mr' \| 'bl' \| 'bc' \| 'br'` | `VALID_PIP_SNAP_POINTS` array |
| `OverlayMediaType` | `'image' \| 'video'` | `VALID_OVERLAY_MEDIA_TYPES` array |
| `Section` | Object with id, index, label, start, end, duration, sourceStart, sourceEnd, takeId, transcript, saved | `normalizeSections()` output shape |
| `Keyframe` | Object with time, pipX, pipY, pipVisible, cameraFullscreen, backgroundZoom, backgroundPanX, backgroundPanY, reelCropX, pipScale, pipSnapPoint, autoTrack, autoTrackSmoothing, sectionId, autoSection, savedLandscape, savedReel | `normalizeKeyframes()` output shape |
| `OverlayPosition` | `{ x: number, y: number, width: number, height: number }` | `normalizeOverlayPosition()` output shape |
| `Overlay` | Object with id, trackIndex, mediaPath, mediaType, startTime, endTime, sourceStart, sourceEnd, landscape, reel, saved | `normalizeOverlays()` output shape |
| `Take` | Object with id, createdAt, duration, screenPath, cameraPath, mousePath, proxyPath, sections | `normalizeProjectData()` takes normalization |
| `ProjectSettings` | Object with screenFitMode, hideFromRecording, exportAudioPreset, cameraSyncOffsetMs, outputMode, pipScale | `normalizeProjectData()` settings normalization |
| `ProjectTimeline` | Object with duration, sections, savedSections, keyframes, selectedSectionId, hasCamera, sourceWidth, sourceHeight, overlays, savedOverlays | `normalizeProjectData()` timeline normalization |
| `Project` | Object with id, name, createdAt, updatedAt, settings, takes, timeline | `normalizeProjectData()` output shape |

#### Scenario: Section type matches normalizeSections output
- **WHEN** `normalizeSections()` returns a section object
- **THEN** the object's shape matches the `Section` interface exactly
- **AND** all fields are present with their correct types (no optional fields that should be required, no missing fields)

#### Scenario: Project type matches createDefaultProject output
- **WHEN** `createDefaultProject()` returns a project object
- **THEN** the object's shape matches the `Project` interface exactly
- **AND** nested objects (settings, timeline, takes) match their respective interfaces

#### Scenario: String literal unions replace string constants
- **WHEN** code previously compared against `OUTPUT_MODE_REEL` or `OUTPUT_MODE_LANDSCAPE` string constants
- **THEN** the TypeScript type system enforces that only `'landscape'` or `'reel'` values are valid via the `OutputMode` type
- **AND** passing any other string value is a compile error

#### Scenario: Nullable fields typed correctly
- **WHEN** a field can be `null` (e.g., `take.cameraPath`, `take.mousePath`, `take.proxyPath`, `keyframe.sectionId`, `timeline.sourceWidth`, `timeline.sourceHeight`)
- **THEN** the interface declares the field as `Type | null` (not optional `?`)
- **AND** code accessing the field must handle the `null` case to compile

### Requirement: Mouse trail type definitions

The project SHALL define TypeScript types for mouse trail data structures used by `src/shared/domain/mouse-trail.ts` and `src/renderer/features/timeline/mouse-trail.ts`.

Required types:
- `MouseTrailEntry`: `{ t: number, x: number, y: number }`
- `MouseTrailData`: `{ captureWidth: number, captureHeight: number, interval: number, trail: MouseTrailEntry[] }`
- `MouseFocus`: `{ focusX: number, focusY: number }`
- `TrailKeypoint`: `{ time: number, focusX: number, focusY: number }`

#### Scenario: lookupMouseAt accepts typed trail
- **WHEN** `lookupMouseAt(trail, sourceTime)` is called
- **THEN** `trail` parameter is typed as `MouseTrailEntry[]`
- **AND** the return type is `{ x: number, y: number }`

#### Scenario: subsampleTrail returns typed keypoints
- **WHEN** `subsampleTrail()` is called
- **THEN** the return type is `TrailKeypoint[]`

### Requirement: IPC channel type contract

The project SHALL define an `ElectronAPI` interface in `src/shared/types/ipc.ts` that declares the type signature of every method exposed via `contextBridge.exposeInMainWorld('electronAPI', ...)`. This interface SHALL be the single source of truth for IPC types, referenced by both `preload.ts` and `register-handlers.ts`.

The interface SHALL include request/response types for all 25 IPC channels:
- `saveVideo(buffer: ArrayBuffer, folder: string, suffix: string): Promise<string>`
- `pickFolder(opts?: PickFolderOptions): Promise<string | null>`
- `pickProjectLocation(opts?: { name?: string }): Promise<string | null>`
- `pathToFileUrl(filePath: string): string`
- `openFolder(folder: string): Promise<void>`
- `projectCreate(opts?: ProjectCreateOptions): Promise<ProjectCreateResult>`
- `projectOpen(projectFolder: string): Promise<ProjectOpenResult>`
- `projectSave(payload: ProjectSavePayload): Promise<ProjectSaveResult>`
- `projectSetRecoveryTake(payload: RecoveryTakePayload): Promise<RecoveryTakeResult>`
- `projectClearRecoveryTake(projectFolder: string): Promise<boolean>`
- `projectCompleteRecoveryTake(projectFolder: string): Promise<boolean>`
- `projectListRecent(limit?: number): Promise<RecentProjectsResult>`
- `projectLoadLast(): Promise<ProjectOpenResult | null>`
- `projectSetLast(projectFolder: string): Promise<boolean>`
- `setContentProtection(enabled: boolean): Promise<boolean>`
- `getSources(): Promise<DesktopSource[]>`
- `computeSections(opts: ComputeSectionsOptions): Promise<ComputeSectionsResult>`
- `renderComposite(opts: RenderOptions): Promise<string>`
- `onRenderProgress(listener: (update: RenderProgress) => void): () => void`
- `getScribeToken(): Promise<string>`
- `stageTakeFiles(projectPath: string, filePaths: string[]): Promise<void>`
- `unstageTakeFiles(projectPath: string, fileNames: string[]): Promise<void>`
- `cleanupDeleted(projectPath: string): Promise<void>`
- `cleanupUnusedTakes(projectPath: string): Promise<CleanupResult>`
- `importOverlayMedia(projectPath: string, sourcePath: string): Promise<string>`
- `stageOverlayFile(projectPath: string, mediaPath: string): Promise<void>`
- `unstageOverlayFile(projectPath: string, mediaPath: string): Promise<void>`
- `getFilePathFromDrop(file: File): string | null`
- `getCursorPosition(): Promise<{ x: number, y: number }>`
- `startMouseTrail(): Promise<void>`
- `stopMouseTrail(): Promise<MouseTrailEntry[]>`
- `saveMouseTrail(projectPath: string, suffix: string, trailData: MouseTrailData): Promise<string>`
- `generateProxy(opts: ProxyGenerateOptions): Promise<string | null>`
- `onProxyProgress(listener: (update: ProxyProgressEvent) => void): () => void`

#### Scenario: Preload implements ElectronAPI
- **WHEN** `src/preload.ts` is compiled
- **THEN** the object passed to `contextBridge.exposeInMainWorld('electronAPI', ...)` satisfies the `ElectronAPI` interface
- **AND** any missing method or type mismatch is a compile error

#### Scenario: Renderer accesses typed electronAPI
- **WHEN** renderer code accesses `window.electronAPI`
- **THEN** the type is `ElectronAPI` (via global augmentation or type assertion)
- **AND** calling `window.electronAPI.renderComposite({})` with wrong argument types is a compile error

#### Scenario: IPC handler type matches preload caller
- **WHEN** `register-handlers.ts` implements the `render-composite` IPC handler
- **THEN** the handler's `opts` parameter type matches `RenderOptions` as declared in `ElectronAPI`
- **AND** adding a required field to `RenderOptions` without updating the handler causes a compile error in either the handler or the preload

### Requirement: Service dependency injection types

The project SHALL define TypeScript interfaces for service option bags and dependency injection objects. Services that accept `deps = {}` injection parameters SHALL have typed interfaces for those parameters.

Required types:
- `RenderOptions`: Options passed to `renderComposite()` — takes, sections, keyframes, overlays, pipSize, screenFitMode, exportAudioPreset, cameraSyncOffsetMs, sourceWidth, sourceHeight, outputMode, outputFolder
- `RenderDeps`: Dependency injection for `renderComposite()` — probeVideoFpsWithFfmpeg, runFfmpeg, ffmpegPath, now, onProgress
- `RenderProgress`: Progress update from render pipeline — phase, percent, status, outTimeSec, durationSec, frame, speed
- `FfmpegProgress`: Parsed ffmpeg progress output — status, frame, fps, speed, outTimeSec, raw
- `ProxyOptions`: Options for `generateProxy()` — screenPath, proxyPath, ffmpegPath, onProgress
- `ProxyDeps`: Dependency injection for proxy service — runFfmpeg, fs, ffmpegPath
- `ProxyProgressEvent`: Progress events from proxy generation — takeId, status, percent, proxyPath, error
- `ComputeSectionsOptions`: Options for `computeSections()` — segments, paddingSeconds
- `ComputeSectionsResult`: Result from `computeSections()` — sections, trimmedDuration
- `ProjectCreateOptions`: Options for project creation — name, projectPath, parentFolder
- `ProjectCreateResult`: Result from project creation — projectPath, project
- `ProjectOpenResult`: Result from project open — projectPath, project, recoveryTake
- `ProjectSavePayload`: Payload for project save — projectPath, project
- `ProjectSaveResult`: Result from project save — projectPath, project
- `RecoveryTakePayload`: Payload for recovery take — projectPath, take
- `RecoveryTakeResult`: Result from recovery take set — projectPath, recoveryTake
- `RecentProjectsResult`: Result from listRecentProjects — lastProjectPath, projects
- `DesktopSource`: Source from desktopCapturer — id, name
- `CleanupResult`: Result from cleanupUnusedTakes — removedCount
- `PickFolderOptions`: Options for folder picker — title, buttonLabel

#### Scenario: renderComposite accepts typed options
- **WHEN** `renderComposite(opts, deps)` is called
- **THEN** `opts` is typed as `RenderOptions`
- **AND** `deps` is typed as `Partial<RenderDeps>` (all deps optional for production defaults)
- **AND** passing a misspelled option key (e.g., `outputmode` instead of `outputMode`) is a compile error

#### Scenario: Dependency injection is optional with defaults
- **WHEN** a service function accepts `deps: Partial<ServiceDeps> = {}`
- **THEN** calling the function without `deps` uses production implementations
- **AND** tests can override specific deps: `renderComposite(opts, { runFfmpeg: mockFn })`
- **AND** the mock function must match the expected type signature

### Requirement: All functions have explicit type annotations

Every exported function in the converted TypeScript codebase SHALL have explicit parameter types and return types. Internal (non-exported) functions MAY rely on type inference for return types when the inferred type is unambiguous.

#### Scenario: Exported function with explicit types
- **WHEN** `normalizeSections(rawSections: unknown[], duration?: number): Section[]` is defined
- **THEN** callers get full type information for parameters and return value
- **AND** passing `normalizeSections("not an array")` is a compile error

#### Scenario: Normalization functions accept unknown input
- **WHEN** normalization functions like `normalizeProjectData`, `normalizeSections`, `normalizeKeyframes` are converted
- **THEN** their raw input parameters SHALL be typed as `unknown` or a loose input type (not the strict output type)
- **AND** the function body performs runtime validation and returns the strict output type
- **AND** this preserves the existing defensive validation pattern without weakening it

### Requirement: No implicit any in the codebase

After conversion, the codebase SHALL contain zero instances of implicit `any`. Every variable, parameter, and return value SHALL have an explicit or inferred concrete type. The only permitted uses of explicit `any` are:

1. Third-party library interop where no types are available and a declaration file is impractical
2. Electron event handler parameters where the Electron type definitions use `any`

Each instance of explicit `any` SHALL include a `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comment with a brief justification.

#### Scenario: Codebase search for any
- **WHEN** the codebase is searched for `: any` type annotations
- **THEN** each instance has a justification comment
- **AND** the total count is fewer than 10 across the entire codebase

#### Scenario: tsc strict catches implicit any
- **WHEN** `tsc --build` is run with `noImplicitAny: true`
- **THEN** compilation succeeds with zero "implicitly has an 'any' type" errors

### Requirement: Constants use const assertions or enums

Existing string constant arrays (e.g., `VALID_PIP_SNAP_POINTS`, `VALID_OVERLAY_MEDIA_TYPES`) and numeric constants SHALL be typed using `as const` assertions to preserve literal types. String constants like `OUTPUT_MODE_LANDSCAPE = 'landscape'` SHALL be typed as their literal string type, not `string`.

#### Scenario: String constants preserve literal type
- **WHEN** `const OUTPUT_MODE_LANDSCAPE = 'landscape' as const` is declared
- **THEN** the type of `OUTPUT_MODE_LANDSCAPE` is `'landscape'` (not `string`)
- **AND** using it in a comparison with `outputMode` narrows the type

#### Scenario: Array constants produce union types
- **WHEN** `const VALID_PIP_SNAP_POINTS = ['tl', 'tc', 'tr', 'ml', 'center', 'mr', 'bl', 'bc', 'br'] as const` is declared
- **THEN** `typeof VALID_PIP_SNAP_POINTS[number]` produces the union type `'tl' | 'tc' | 'tr' | 'ml' | 'center' | 'mr' | 'bl' | 'bc' | 'br'`

### Requirement: Renderer global type augmentation

The renderer SHALL have access to `window.electronAPI` with the `ElectronAPI` type via a global type augmentation. This SHALL be declared in a `.d.ts` file (e.g., `src/renderer/globals.d.ts`) that augments the `Window` interface.

#### Scenario: window.electronAPI is typed in renderer
- **WHEN** renderer code accesses `window.electronAPI.projectOpen(folder)`
- **THEN** TypeScript knows the return type is `Promise<ProjectOpenResult>`
- **AND** IntelliSense shows all available methods on `electronAPI`

#### Scenario: Augmentation does not leak to main process
- **WHEN** main process code attempts to access `window.electronAPI`
- **THEN** it is a compile error (the augmentation is scoped to the renderer tsconfig)
