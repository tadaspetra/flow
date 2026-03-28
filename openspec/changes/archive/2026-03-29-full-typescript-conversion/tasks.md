## 1. Build Foundation & Tooling (ts-build-pipeline)

- [x] 1.1 Create `tsconfig.shared.json` — `composite: true`, `strict: true`, `noUncheckedIndexedAccess: true`, `target: "ES2022"`, `module: "NodeNext"`, `moduleResolution: "NodeNext"`, `outDir: "dist/shared"`, `rootDir: "src/shared"`, `declaration: true`, `declarationMap: true`, `sourceMap: true`, `include: ["src/shared/**/*.ts"]`, `types: ["node"]`
- [x] 1.2 Create `tsconfig.main.json` — extends base settings, `strict: true`, `noUncheckedIndexedAccess: true`, `module: "NodeNext"`, `moduleResolution: "NodeNext"`, `outDir: "dist"`, `rootDir: "src"`, `sourceMap: true`, `include: ["src/main.ts", "src/main/**/*.ts"]`, `types: ["node"]`, `references: [{ "path": "./tsconfig.shared.json" }]`
- [x] 1.3 Create `tsconfig.preload.json` — extends base settings, `strict: true`, `noUncheckedIndexedAccess: true`, `module: "NodeNext"`, `moduleResolution: "NodeNext"`, `outDir: "dist"`, `rootDir: "src"`, `sourceMap: true`, `include: ["src/preload.ts"]`, `types: ["node"]`, `references: [{ "path": "./tsconfig.shared.json" }]`
- [x] 1.4 Create `tsconfig.renderer.json` — extends base settings, `strict: true`, `noUncheckedIndexedAccess: true`, `module: "ES2022"`, `moduleResolution: "Bundler"`, `outDir: "dist/renderer"`, `rootDir: "src/renderer"`, `sourceMap: true`, `lib: ["ES2022", "DOM"]`, `include: ["src/renderer/**/*.ts", "src/audio-processor.ts"]`, `references: [{ "path": "./tsconfig.shared.json" }]`
- [x] 1.5 Replace existing `tsconfig.json` with project-reference root — `files: []`, `references: [{ "path": "./tsconfig.shared.json" }, { "path": "./tsconfig.main.json" }, { "path": "./tsconfig.preload.json" }, { "path": "./tsconfig.renderer.json" }]`
- [x] 1.6 Add `dist/` and `*.tsbuildinfo` to `.gitignore`
- [x] 1.7 Create `scripts/copy-assets.mjs` — copies `src/index.html` → `dist/index.html`, creates `dist/renderer/styles/` directory
- [x] 1.8 Update `package.json` `"main"` field from `"src/main.js"` to `"dist/main.js"`
- [x] 1.9 Update `package.json` scripts: add `"build:ts": "tsc --build"`, `"build:copy": "node scripts/copy-assets.mjs"`, `"clean": "rm -rf dist *.tsbuildinfo src/**/*.tsbuildinfo"`, update `"build:styles"` to output to `dist/renderer/styles/main.css`, update `"start"` to `"npm run build:ts && npm run build:copy && npm run build:styles && electron ."`, update `"dev"` to run tsc watch + electron, update `"typecheck"` to `"tsc --build --noEmit"`
- [x] 1.10 Install `typescript-eslint` as dev dependency: `npm install -D @typescript-eslint/parser @typescript-eslint/eslint-plugin`
- [x] 1.11 Update `eslint.config.mjs` — replace `src/**/*.js` globs with `src/**/*.ts`, replace `tests/**/*.js` with `tests/**/*.ts`, add TypeScript parser config, replace `no-unused-vars` with `@typescript-eslint/no-unused-vars`, add `@typescript-eslint/no-explicit-any` as warning
- [x] 1.12 Update `vitest.config.mjs` — change `include` to `['tests/**/*.test.ts']`, change coverage `include` globs from `*.js` to `*.ts`
- [x] 1.13 Create ambient declaration file `src/types/electron-reload.d.ts` — `declare module 'electron-reload' { function reload(paths: string, opts?: Record<string, unknown>): void; export = reload; }`
- [x] 1.14 Create ambient declaration file `src/types/ffmpeg-static.d.ts` — `declare module 'ffmpeg-static' { const ffmpegPath: string | null; export default ffmpegPath; }`
- [x] 1.15 Create ambient declaration file `src/types/audio-worklet.d.ts` — declare `AudioWorkletProcessor` class and `registerProcessor` global for `audio-processor.ts`
- [x] 1.16 Verify foundation: run `tsc --build` with existing `.js` files (via `allowJs: true` temporarily), confirm `dist/` is populated, confirm `electron dist/main.js` launches the app
- [x] 1.17 Update `electron-reload` call in `main.ts` entry point to watch `dist/` directory (currently watches `__dirname` which was `src/`, now is `dist/`)

## 2. Type System & Shared Domain (ts-type-contracts)

- [x] 2.1 Create `src/shared/types/domain.ts` with all domain interfaces: `OutputMode`, `ExportAudioPreset`, `ScreenFitMode`, `PipSnapPoint`, `OverlayMediaType`, `Section`, `Keyframe`, `OverlayPosition`, `Overlay`, `Take`, `ProjectSettings`, `ProjectTimeline`, `Project`. Use string literal unions for constants. Type nullable fields as `T | null` (not optional). Include numeric constraint constants as `as const` exports.
- [x] 2.2 Create `src/shared/types/services.ts` with service interfaces: `RenderOptions`, `RenderDeps`, `RenderProgress`, `FfmpegProgress`, `ProxyOptions`, `ProxyDeps`, `ProxyProgressEvent`, `ComputeSectionsOptions`, `ComputeSectionsResult`, `ProjectCreateOptions`, `ProjectCreateResult`, `ProjectOpenResult`, `ProjectSavePayload`, `ProjectSaveResult`, `RecoveryTakePayload`, `RecoveryTakeResult`, `RecoveryTake`, `RecentProjectsResult`, `RecentProjectListEntry`, `DesktopSource`, `CleanupResult`, `PickFolderOptions`
- [x] 2.3 Create `src/shared/types/ipc.ts` with the `ElectronAPI` interface — all 25+ IPC channel methods with full request/response types. Import domain and service types. Include `ProxyGenerateOptions` for the proxy IPC.
- [x] 2.4 Create `src/shared/types/index.ts` barrel file that re-exports all types from `domain.ts`, `services.ts`, and `ipc.ts`
- [x] 2.5 Create `src/shared/types/mouse-trail.ts` with `MouseTrailEntry`, `MouseTrailData`, `MousePosition`, `MouseFocus`, `TrailKeypoint` interfaces
- [x] 2.6 Convert `src/shared/domain/project.js` → `src/shared/domain/project.ts` — add type annotations to all exported functions, type constants with `as const`, type `normalizeProjectData` input as `unknown` with `Project` return type, type `normalizeSections` input as `unknown[]` with `Section[]` return, type all normalize functions similarly. Replace `module.exports` with named `export`. Preserve all runtime validation logic unchanged.
- [x] 2.7 Convert `src/shared/domain/mouse-trail.js` → `src/shared/domain/mouse-trail.ts` — type `lookupMouseAt(trail: MouseTrailEntry[], sourceTime: number): MousePosition`, type `lookupSmoothedMouseAt(trail: MouseTrailEntry[], sourceTime: number, smoothing?: number, captureWidth?: number, captureHeight?: number): MouseFocus`, type `subsampleTrail(...)` return as `TrailKeypoint[]`. Replace `module.exports` with named `export`.
- [x] 2.8 Convert `tests/unit/project-domain.test.js` → `tests/unit/project-domain.test.ts` — update imports to `.ts` source paths, add type annotations where vitest type inference is insufficient
- [x] 2.9 Convert `tests/unit/mouse-trail-cleanup.test.mjs` → `tests/unit/mouse-trail-cleanup.test.ts` — update imports from ESM `.mjs` format to `.ts` imports
- [x] 2.10 Run `tsc --build` — verify shared project compiles with zero errors under strict mode
- [x] 2.11 Run `npm run test` — verify converted tests pass with identical assertions

## 3. Infrastructure & Services (file-by-file conversion)

- [x] 3.1 Convert `src/main/infra/file-system.js` → `src/main/infra/file-system.ts` — type all functions (`ensureDirectory(folderPath: string): void`, `safeUnlink(filePath: string | null): void`, `readJsonFile<T>(filePath: string, fallback?: T): T`, `writeJsonFile(filePath: string, data: unknown): void`, `isDirectoryEmpty(folderPath: string): boolean`). Remove re-export of `fs` (import `fs` directly where needed). Replace `module.exports` with named `export`.
- [x] 3.2 Convert `tests/unit/file-system.test.js` → `tests/unit/file-system.test.ts`
- [x] 3.3 Convert `src/main/services/ffmpeg-runner.js` → `src/main/services/ffmpeg-runner.ts` — type `FfmpegRunOptions` interface (`ffmpegPath: string, args: string[], spawnImpl?: typeof spawn, onProgress?: (progress: FfmpegProgress) => void`), type `parseFfmpegProgress(fields: Record<string, string>): FfmpegProgress | null`, type `runFfmpeg(opts: FfmpegRunOptions): Promise<{ stderr: string }>`. Replace `module.exports` with named `export`.
- [x] 3.4 Convert `tests/unit/ffmpeg-runner.test.js` → `tests/unit/ffmpeg-runner.test.ts`
- [x] 3.5 Convert `src/main/services/fps-service.js` → `src/main/services/fps-service.ts` — type `parseFpsToken(token: string | null): number | null`, `parseVideoFpsFromProbeOutput(output: string): number | null`, `probeVideoFpsWithFfmpeg(ffmpegPath: string, filePath: string): Promise<number | null>`, `chooseRenderFps(candidates: (number | null)[], hasCamera: boolean): number`. Replace `module.exports` with named `export`.
- [x] 3.6 Convert `tests/unit/fps-service.test.js` → `tests/unit/fps-service.test.ts`
- [x] 3.7 Convert `src/main/services/render-filter-service.js` → `src/main/services/render-filter-service.ts` — type all functions with explicit parameter/return types. `buildFilterComplex` takes keyframes array, numeric params, returns `string`. `buildScreenFilter` similar. `buildOverlayFilter` returns `{ inputs: string[][], filterParts: string[] }`. `resolveOutputSize` returns `{ outW: number, outH: number }`. Import `Keyframe`, `OutputMode` from shared types. Replace `module.exports` with named `export`.
- [x] 3.8 Convert `tests/unit/render-filter-service.test.js` → `tests/unit/render-filter-service.test.ts`
- [x] 3.9 Convert `src/main/services/render-service.js` → `src/main/services/render-service.ts` — type `renderComposite(opts: RenderOptions, deps?: Partial<RenderDeps>): Promise<string>`, type all internal functions. Convert `require('ffmpeg-static')` to `import ffmpegStatic from 'ffmpeg-static'` (uses ambient declaration). Replace `module.exports` with named `export`.
- [x] 3.10 Convert `tests/unit/render-service.test.js` → `tests/unit/render-service.test.ts`
- [x] 3.11 Convert `src/main/services/sections-service.js` → `src/main/services/sections-service.ts` — type `computeSections(opts: ComputeSectionsOptions): ComputeSectionsResult`. Replace `module.exports` with named `export`.
- [x] 3.12 Convert `tests/unit/sections-service.test.js` → `tests/unit/sections-service.test.ts`
- [x] 3.13 Convert `src/main/services/scribe-service.js` → `src/main/services/scribe-service.ts` — type `getRequiredEnv(name: string): string`, `getScribeToken(): Promise<string>`. Convert the dynamic `require('@elevenlabs/elevenlabs-js')` inside `getScribeToken` to a top-level `import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'` (the SDK ships types). Replace `module.exports` with named `export`.
- [x] 3.14 Convert `tests/unit/scribe-service.test.js` → `tests/unit/scribe-service.test.ts`
- [x] 3.15 Convert `src/main/services/proxy-service.js` → `src/main/services/proxy-service.ts` — type `generateProxy(opts: ProxyOptions, deps?: Partial<ProxyDeps>): Promise<void>`, `deriveProxyPath(screenPath: string): string`. Type the module-level queue state (`activeCount: number`, `queue: Array<() => Promise<void>>`). Convert `require('ffmpeg-static')` to `import`. Replace `module.exports` with named `export`.
- [x] 3.16 Convert `tests/unit/proxy-service.test.js` → `tests/unit/proxy-service.test.ts`
- [x] 3.17 Convert `src/main/services/project-service.js` → `src/main/services/project-service.ts` — type the `createProjectService({ app }: { app: Electron.App })` factory function. Type all internal functions with explicit parameter/return types. Type `normalizeRecoveryTake` input as `unknown` and return as `RecoveryTake | null`. Type `stageTakeFiles(projectPath: string, filePaths: (string | null)[]): void`. Replace `module.exports` with named `export`.
- [x] 3.18 Convert `tests/integration/project-service.test.js` → `tests/integration/project-service.test.ts`
- [x] 3.19 Run `tsc --build` — verify all service files compile with zero strict-mode errors
- [x] 3.20 Run `npm run test` — verify all unit and integration tests pass

## 4. Electron Wiring (main entry points + IPC)

- [x] 4.1 Convert `src/main/ipc/register-handlers.js` → `src/main/ipc/register-handlers.ts` — define `RegisterIpcDeps` interface for the dependency bag (`ipcMain: Electron.IpcMain`, `app: Electron.App`, `dialog: Electron.Dialog`, `desktopCapturer: typeof Electron.desktopCapturer`, `shell: Electron.Shell`, `getWindow: () => Electron.BrowserWindow | null`, `screen: Electron.Screen`, `projectService: ReturnType<typeof createProjectService>`, `renderComposite: typeof renderComposite`, `computeSections: typeof computeSections`, `getScribeToken: typeof getScribeToken`, `proxyService: typeof import('../services/proxy-service')`). Type the function as `registerIpcHandlers(deps: RegisterIpcDeps): { cleanupMouseTrailTimer: () => void }`. Type all handler parameters. Replace `module.exports` with named `export`.
- [x] 4.2 Convert `tests/unit/register-handlers.test.js` → `tests/unit/register-handlers.test.ts`
- [x] 4.3 Convert `tests/integration/proxy-ipc.test.js` → `tests/integration/proxy-ipc.test.ts`
- [x] 4.4 Convert `src/main/app/create-window.js` → `src/main/app/create-window.ts` — type `CreateWindowOptions` interface (`BrowserWindow: typeof Electron.BrowserWindow`, `onConsoleMessage?: (info: { event: Electron.Event, level: number, message: string, line: number, sourceId: string }) => void`). Type return as `Electron.BrowserWindow`. Update `path.join(__dirname, '..', '..', 'preload.js')` — verify this still resolves correctly from `dist/main/app/create-window.js` to `dist/preload.js`. Update `loadFile` path similarly for `dist/index.html`. Replace `module.exports` with named `export`.
- [x] 4.5 Convert `src/main.js` → `src/main.ts` — convert all `require()` calls to `import` statements. Type `win` as `Electron.BrowserWindow | null`. Convert `electron-reload` call to typed import (uses ambient declaration). Replace `module.exports` (none in this file). Ensure `import 'dotenv/config'` replaces `require('dotenv').config()`.
- [x] 4.6 Convert `src/preload.js` → `src/preload.ts` — import `ElectronAPI` from shared types. Type the object passed to `contextBridge.exposeInMainWorld('electronAPI', ...)` as satisfying `ElectronAPI`. Type `toFileUrl(filePath: string): string`. Convert `require('electron')` to `import { contextBridge, ipcRenderer, webUtils } from 'electron'`. Convert `require('node:url')` to `import url from 'node:url'`.
- [x] 4.7 Create `src/renderer/globals.d.ts` — global type augmentation: `declare global { interface Window { electronAPI: ElectronAPI } }` with import of `ElectronAPI` type. Include this file in `tsconfig.renderer.json` include.
- [x] 4.8 Convert `src/audio-processor.js` → `src/audio-processor.ts` — type `AudioCaptureProcessor` class extending `AudioWorkletProcessor`. Type `process(inputs: Float32Array[][]): boolean`. Uses ambient declaration from task 1.15.
- [x] 4.9 Convert `tests/unit/preload.test.js` → `tests/unit/preload.test.ts`
- [x] 4.10 Run `tsc --build` — verify all wiring files compile
- [x] 4.11 Run `npm run build && electron .` — verify app launches from `dist/`, window loads, preload bridge works
- [x] 4.12 Run `npm run test` — verify all tests pass

## 5. Renderer (features + app)

- [x] 5.1 Convert `src/renderer/features/transcript/transcript-utils.js` → `src/renderer/features/transcript/transcript-utils.ts` — type `normalizeTranscriptText(value: unknown): string`, `stripNonSpeechAnnotations(text: string): string`, `extractSpokenWordTokens(tokens: unknown[]): Array<{ text: string, start?: number, end?: number }>`. Convert `export` statements (already ESM — just add types).
- [x] 5.2 Convert `tests/unit/transcript-utils.test.mjs` → `tests/unit/transcript-utils.test.ts`
- [x] 5.3 Convert `src/renderer/features/timeline/camera-sync.js` → `src/renderer/features/timeline/camera-sync.ts` — type all three functions with explicit number params and returns. Already ESM — just add types.
- [x] 5.4 Convert `tests/unit/camera-sync.test.mjs` → `tests/unit/camera-sync.test.ts`
- [x] 5.5 Convert `src/renderer/features/timeline/section-utils.js` → `src/renderer/features/timeline/section-utils.ts` — import `Section` type from shared types. Type `buildRemappedSectionsFromSegments(segments: unknown[]): Section[]`, `normalizeSections(rawSections: unknown[], duration?: number): Section[]`, `buildDefaultSectionsForDuration(duration: number): Section[]`, `normalizeTakeSections(rawSections: unknown[], duration: number): Section[]`, `attachSectionTranscripts(sections: Section[], transcriptSections: unknown[]): Section[]`, `roundMs(value: number): number`.
- [x] 5.6 Convert `tests/unit/section-utils.test.mjs` → `tests/unit/section-utils.test.ts`
- [x] 5.7 Convert `src/renderer/features/timeline/keyframe-ops.js` → `src/renderer/features/timeline/keyframe-ops.ts` — import `Keyframe` type from shared types. Type `generateSectionId(): string`, `reindexSections(sections: Array<{ index: number, label: string }>): void`, `buildSplitAnchorKeyframe(keyframes: Keyframe[], parentSectionId: string, newSectionId: string, newSectionStart: number, defaults: Partial<Keyframe>): Keyframe`.
- [x] 5.8 Convert `tests/unit/keyframe-ops.test.mjs` → `tests/unit/keyframe-ops.test.ts`
- [x] 5.9 Convert `src/renderer/features/timeline/overlay-utils.js` → `src/renderer/features/timeline/overlay-utils.ts` — import `Overlay`, `OutputMode`, `OverlayPosition` from shared types. Define `OverlayState` return type (`{ active: false } | { active: true, overlayId: string, mediaPath: string, mediaType: OverlayMediaType, x: number, y: number, width: number, height: number, opacity: number, sourceTime: number }`). Type `getOverlayStateAtTime(time: number, overlays: Overlay[], outputMode: OutputMode, timelineDuration?: number): OverlayState`.
- [x] 5.10 Convert `tests/unit/overlay-utils.test.mjs` → `tests/unit/overlay-utils.test.ts`
- [x] 5.11 Convert `src/renderer/features/timeline/mouse-trail.js` → `src/renderer/features/timeline/mouse-trail.ts` — import `MouseTrailEntry`, `MousePosition`, `MouseFocus`, `TrailKeypoint` from shared types. Type all three functions identically to the shared/domain version. Convert `export { ... }` to typed exports.
- [x] 5.12 Convert `src/renderer/features/media-cleanup.js` → `src/renderer/features/media-cleanup.ts` — define `MediaRefs` interface for the mutable refs bag (all fields optional/nullable: `screenStream?: MediaStream | null`, `cameraStream?: MediaStream | null`, `audioStream?: MediaStream | null`, `recorders?: MediaRecorder[]`, `screenRecInterval?: ReturnType<typeof setInterval> | null`, `audioSendInterval?: ...`, `timerInterval?: ...`, `audioContext?: AudioContext | null`, `scribeWorkletNode?: AudioWorkletNode | null`, `scribeWs?: WebSocket | null`, `drawRAF?: number | null`, `meterRAF?: number | null`, `cancelEditorDrawLoop?: (() => void) | null`, `stopAudioMeter?: (() => void) | null`, `recording?: boolean`). Type `cleanupAllMedia(refs: MediaRefs | null): void` and `stopStream(stream: MediaStream | null | undefined): void`.
- [x] 5.13 Convert `tests/unit/media-cleanup.test.mjs` → `tests/unit/media-cleanup.test.ts`
- [x] 5.14 Convert `src/renderer/app.js` → `src/renderer/app.ts` — this is the largest file (~2000+ lines). Convert all `import` statements to typed imports. Type `window.electronAPI` usage via the global augmentation (task 4.7). Add type annotations to key state objects, event handler parameters, and function definitions. Where the file accesses DOM elements (`document.getElementById`), handle the `null` case (strict null checks). For inline event listeners on dynamically created elements, type `Event` parameters. This file will likely have the most strict-mode fixes needed — primarily null checks on DOM queries and typed event handlers.
- [x] 5.15 Run `tsc --build` — verify all renderer files compile with zero strict-mode errors
- [x] 5.16 Run `npm run test` — verify all unit tests pass
- [x] 5.17 Run `npm run build && electron .` — verify full app works: project creation, recording flow, editor, export

## 6. E2E & Smoke Tests

- [x] 6.1 Convert `tests/e2e/smoke-electron.test.mjs` → `tests/e2e/smoke-electron.test.ts` — update imports, add types to test helpers and assertions
- [x] 6.2 Update `scripts/package-smoke.mjs` if it imports from `src/` — update paths to reference `dist/` where applicable
- [x] 6.3 Run `npm run test:e2e` — verify Electron smoke test passes against compiled `dist/`
- [x] 6.4 Run `npm run package:smoke` — verify packaging produces a working app from `dist/`

## 7. Final Audit & Cleanup

- [x] 7.1 Remove `allowJs: true` from all tsconfig files — verify `tsc --build` still succeeds (all files are now `.ts`)
- [x] 7.2 Delete all `.js` source files from `src/` — verify no `.js` files remain in `src/` (except `dist/` output)
- [x] 7.3 Delete all `.js` and `.mjs` test files from `tests/` — verify no `.js`/`.mjs` test files remain
- [x] 7.4 Update ESLint config `include` patterns to remove any remaining `.js` globs for source files
- [x] 7.5 Update vitest config to remove `.js`/`.mjs` from include patterns
- [x] 7.6 Audit for `any` usage — search codebase for `: any` and `as any`. Each instance must have a justification comment. Target: fewer than 10 total.
- [x] 7.7 Verify all exported functions have explicit parameter and return type annotations
- [x] 7.8 Update `AGENTS.md` — change file extension references from `.js` to `.ts` in architecture section, add note about `tsc --build` in required commands, add `npm run build` and `npm run clean` to required commands list
- [x] 7.9 Run full `npm run check` — lint, typecheck, unit tests, integration tests, e2e, packaging smoke — all green
- [x] 7.10 Verify `npm run dev` works end-to-end: edit a `.ts` file → tsc watch recompiles → electron-reload refreshes the app
