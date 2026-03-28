## Context

The Loop app is an Electron desktop video editor with 24 production files and 22 test files, all plain JavaScript. The architecture is well-structured across three layers:

- **Main process** (`src/main/`): 11 CJS files — services (8), infra (1), IPC registration (1), window creation (1)
- **Renderer** (`src/renderer/`): 8 ESM files — `app.js` monolith (DOM/UI) + 7 pure utility modules
- **Shared** (`src/shared/`): 2 CJS files — domain normalization for project data and mouse trail math

Entry points: `main.js` (Electron main), `preload.js` (context bridge), `audio-processor.js` (AudioWorklet).

Today Electron loads JavaScript directly from `src/` — there is no build step for app code. TypeScript is installed (`^5.9.3`) with a tsconfig that has `noEmit: true`, `checkJs: false`, `strict: false` — effectively a placeholder. The app runs `npm run typecheck` as part of CI, but it checks nothing since no files are typed.

The module system is split: main process uses CommonJS (`require`/`module.exports`), renderer uses ES modules (`import`/`export`), tests use a mix (`.js` for CJS, `.mjs` for ESM). Vitest handles both formats transparently.

Key constraints from AGENTS.md:
- Prefer small, isolated changes over broad rewrites
- Preserve behavior unless the task explicitly changes product behavior
- Shared logic in `src/shared/`, main services in `src/main/services/`, renderer features in `src/renderer/features/`
- `preload.js` remains a narrow bridge
- `npm run check` must pass before completion

This conversion is a broad rewrite by nature, but it changes zero behavior — the constraints about module boundaries and narrow preload apply to the TypeScript structure too.

## Goals / Non-Goals

**Goals:**
- Convert all 56 source and test files from JavaScript to TypeScript
- Enable `strict: true` with no exceptions — `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `noUncheckedIndexedAccess`
- Create explicit type definitions for all domain data shapes
- Create a typed IPC contract shared between preload and main process
- Enforce module boundaries at compile time via TypeScript project references
- Maintain identical runtime behavior — zero feature changes, zero behavior changes
- All existing tests pass with the same assertions (updated only for import paths / syntax)
- `npm run check` passes at every phase of the conversion
- `npm run dev` continues to work with fast iteration (watch mode)

**Non-Goals:**
- Migrating the module system (main process stays CJS output, renderer stays ESM output)
- Refactoring any business logic, normalization functions, or service patterns
- Adding new features, tests, or capabilities beyond what exists today
- Introducing a bundler (Vite, esbuild, webpack) for any layer
- Converting `index.html` to a framework (React, Svelte, etc.)
- Changing the Electron architecture (main/renderer/preload split)
- Achieving 100% type coverage where third-party types are unavailable — limited `any` is acceptable for `electron-reload`, `ffmpeg-static`, and `AudioWorkletProcessor` globals
- Converting root config files (`.mjs`/`.cjs`) to TypeScript — these stay as-is

## Decisions

### Decision 1: tsc with project references (not Vite, not ts-node)

**Chosen**: Use `tsc --build` with four project references:
```
tsconfig.json              (root: references all four projects)
├── tsconfig.shared.json   (src/shared/ → dist/shared/)
├── tsconfig.main.json     (src/main/ + entry points → dist/)
├── tsconfig.preload.json  (src/preload.ts → dist/)
└── tsconfig.renderer.json (src/renderer/ → dist/renderer/)
```

**Rationale**: The renderer has 8 files and zero npm dependencies — there is nothing for a bundler to optimize. `tsc` handles TypeScript compilation, source maps, declaration files, and incremental rebuilds. Project references enforce that renderer code cannot import from `src/main/services/` (matching the architecture guardrails in AGENTS.md). A single `tsc --build` command compiles everything with correct dependency ordering.

**Alternatives considered:**
- **Vite for renderer**: The upstream fork uses this approach. Vite adds HMR and bundling, but requires `moduleResolution: "Bundler"` (non-standard), `assetsInlineLimit: 0` workaround for CSP, and a new dependency. The renderer has zero npm imports, so bundling provides no tree-shaking or code-splitting benefit. Adding Vite is the right move if/when npm packages are imported in the renderer — the TypeScript source won't need changing, only the build config.
- **electron-vite**: Replaces `tsc` entirely with an opinionated Electron-aware bundler. Restructures the project layout. Too heavy for a codebase this size.
- **tsx/ts-node**: Runtime TypeScript loading eliminates the build step, but adds startup latency, is fragile in production packaging, and doesn't support project references for boundary enforcement.

### Decision 2: CJS output for main process, ESM output for renderer

**Chosen**: `tsconfig.main.json` uses `module: "NodeNext"` which outputs CJS (because `package.json` has no `"type": "module"` field). `tsconfig.renderer.json` uses `module: "ES2022"` which outputs ESM. This matches the current runtime behavior exactly — main process files currently use `require()`, renderer files currently use `import`.

**Rationale**: The TypeScript source uses `import`/`export` syntax regardless of output format. The compiled output format is a config switch. Keeping CJS for main process avoids breaking `electron-reload` (which uses `require()` internally), `require('ffmpeg-static')` (which returns a path via CJS), and `__dirname` usage in `create-window.js`. Switching to ESM later requires changing two config lines and handling three compatibility points — zero source code changes.

**Alternatives considered:**
- **ESM everywhere**: Would unify the module system, but `electron-reload`, `ffmpeg-static`, and `__dirname`/`__filename` all need workarounds. The source code is identical either way, so there's no benefit to taking on those risks now.

### Decision 3: Strict mode from day one

**Chosen**: All four tsconfig projects set `strict: true` from the first file conversion. Files are converted one at a time, and each must compile with strict mode before moving to the next.

**Rationale**: Enabling strict mode later means revisiting every file twice — once to convert from JS to TS, once to fix strict errors. The codebase already uses defensive validation (nearly every function checks `Number.isFinite`, `typeof`, `Array.isArray`), so most strict-mode errors will be solvable by adding type annotations, not by changing logic. Starting strict avoids accumulating `any` debt.

**Alternatives considered:**
- **Incremental strict**: Convert all files to TS first with `strict: false`, then enable strict flags one at a time. Safer per-step, but doubles the total work. Each file would need two review passes.

### Decision 4: dist/ layout mirrors src/ layout

**Chosen**: The `dist/` directory mirrors the `src/` directory structure exactly:
```
dist/
├── main.js                     ← compiled from src/main.ts
├── preload.js                  ← compiled from src/preload.ts
├── audio-processor.js          ← compiled from src/audio-processor.ts
├── index.html                  ← copied from src/index.html
├── main/
│   ├── services/*.js
│   ├── infra/*.js
│   ├── ipc/*.js
│   └── app/*.js
├── renderer/
│   ├── app.js
│   ├── features/**/*.js
│   └── styles/
│       └── main.css            ← copied (Tailwind output)
└── shared/
    ├── domain/*.js
    └── types/*.d.ts
```

**Rationale**: Mirroring means all relative import paths stay the same after compilation. `import { foo } from '../../shared/domain/project.js'` in source maps to the same relative path in `dist/`. No path rewriting needed. The HTML file's `<script type="module" src="./renderer/app.js">` still works — it's now loading from `dist/renderer/app.js` instead of `src/renderer/app.js`.

### Decision 5: Path references updated for dist/ layout

**Chosen**: `create-window.js` currently uses `path.join(__dirname, '..', '..', 'preload.js')` and `path.join(__dirname, '..', '..', 'index.html')` to locate files. After compilation, `__dirname` resolves to `dist/main/app/`, so the relative paths `../../preload.js` and `../../index.html` still resolve correctly to `dist/preload.js` and `dist/index.html`.

Similarly, `electron-reload(__dirname)` in `main.ts` points to `dist/`, which is where the compiled files live. Hot-reload watches `dist/` for changes, and `tsc --build --watch` recompiles on source changes.

**No path changes needed** — the mirrored layout preserves all relative relationships.

### Decision 6: Static asset copying via build script

**Chosen**: Add a `build:copy` script that copies `src/index.html` and `src/renderer/styles/` to `dist/`. This runs as part of the build pipeline: `tsc --build && build:copy && build:styles`.

**Rationale**: `tsc` only processes `.ts` files — it doesn't copy HTML, CSS, or other static assets. A simple copy script (using `cp -r` or a Node script) fills this gap without adding a dependency. Tailwind output (`main.css`) is built directly into `dist/renderer/styles/` by updating the Tailwind output path.

### Decision 7: Type definitions in src/shared/types/

**Chosen**: Create a `src/shared/types/` directory containing:
- `domain.ts` — interfaces for Project, Section, Keyframe, Overlay, Take, OverlayPosition, and all string literal unions (OutputMode, ExportAudioPreset, PipSnapPoint, OverlayMediaType, ScreenFitMode)
- `ipc.ts` — the `ElectronAPI` interface defining all 25 IPC channels with request/response types
- `services.ts` — interfaces for service option bags and dependency injection (RenderOptions, RenderDeps, RenderProgress, FfmpegProgress, ProxyOptions, etc.)

**Rationale**: Placing types in `src/shared/` means both main process and renderer can import them (via project references). The `types/` subdirectory separates type-only files from domain logic files. All type files use `export type` / `export interface` only — no runtime code.

**Why not co-locate types with their modules**: Many types are used across layers. `Section` is used in shared/domain, main/services (render, sections, project), renderer/features (section-utils, keyframe-ops), and IPC handlers. A centralized location avoids circular imports and makes the data contract explicit.

### Decision 8: IPC type contract

**Chosen**: Define an `ElectronAPI` interface in `src/shared/types/ipc.ts` that types every method exposed via `contextBridge.exposeInMainWorld('electronAPI', ...)`. The preload script implements this interface. The renderer accesses it via `window.electronAPI` (typed via a global augmentation or type assertion).

```typescript
// src/shared/types/ipc.ts
export interface ElectronAPI {
  saveVideo(buffer: ArrayBuffer, folder: string, suffix: string): Promise<string>;
  pickFolder(opts?: PickFolderOptions): Promise<string | null>;
  projectCreate(opts?: ProjectCreateOptions): Promise<ProjectCreateResult>;
  projectOpen(projectFolder: string): Promise<ProjectOpenResult>;
  projectSave(payload: ProjectSavePayload): Promise<ProjectSaveResult>;
  renderComposite(opts: RenderOptions): Promise<string>;
  onRenderProgress(listener: (update: RenderProgress) => void): () => void;
  generateProxy(opts: ProxyGenerateOptions): Promise<string | null>;
  onProxyProgress(listener: (update: ProxyProgressEvent) => void): () => void;
  // ... all 25 channels
}
```

**Rationale**: Today, the preload defines anonymous functions like `(opts) => ipcRenderer.invoke('render-composite', opts)` and the main handler destructures `opts` independently. There is no compile-time guarantee that the shapes match. With the `ElectronAPI` interface, adding a parameter to a main handler without updating the preload (or vice versa) is a compile error.

### Decision 9: Conversion order — bottom-up by dependency

**Chosen**: Convert in this order:
1. **Build foundation** — tsconfigs, scripts, dist/ layout, tooling
2. **Shared domain** — `src/shared/types/` (new) + `src/shared/domain/` (2 files) + their tests
3. **Infrastructure & services** — `file-system.ts`, then all 8 services + their tests
4. **Electron wiring** — `register-handlers.ts`, `create-window.ts`, `main.ts`, `preload.ts`, `audio-processor.ts` + tests
5. **Renderer** — all `features/` utilities + `app.ts` + tests
6. **Final audit** — remove `allowJs`, purge `.js` from include globs, no-any audit

**Rationale**: Each layer depends on the layer below it. Converting bottom-up means every file's dependencies are already typed when it's converted — no `any` imports from unconverted modules. The shared types exist before any consumer is converted.

### Decision 10: Test file unification

**Chosen**: All test files convert from `.test.js`/`.test.mjs` to `.test.ts`. The vitest config updates `include` to `['tests/**/*.test.ts']`. Tests import typed modules from `src/` (vitest resolves TypeScript directly — it doesn't need the compiled `dist/` output).

**Rationale**: Vitest supports TypeScript natively via esbuild transform. Tests don't need to import from `dist/` because vitest handles `.ts` imports at runtime. This means tests can run against source files with full type checking, and the `dist/` build is only for Electron runtime.

**The mixed `.js`/`.mjs` test format is unified**: Currently 11 tests are `.test.js` (CJS) and 8 are `.test.mjs` (ESM). Converting all to `.test.ts` eliminates the format split. Vitest treats `.ts` files as ESM by default.

### Decision 11: electron-reload in development

**Chosen**: `electron-reload` watches the `dist/` directory. In development, two processes run: `tsc --build --watch` (recompiles on source changes) and `electron dist/main.js` (relaunches on dist/ changes). The `npm run dev` script orchestrates both.

**Rationale**: This is the standard pattern for TypeScript Electron apps. The TypeScript watcher writes to `dist/`, and `electron-reload` detects the file change and reloads the window. Hot-reload latency is slightly higher than before (a few hundred ms for tsc compilation), but still near-instant for single-file changes due to tsc incremental mode.

## Risks / Trade-offs

**[Risk] Build step adds development friction** → Mitigation: `tsc --build --watch` runs continuously with incremental compilation. Single-file changes compile in <500ms. The dev experience is `save file → auto-compile → auto-reload`. Only the first full build is slow (~2-3s for 56 files).

**[Risk] dist/ and src/ can get out of sync** → Mitigation: `npm run clean` removes `dist/`. The CI pipeline always builds from scratch. `.gitignore` includes `dist/`. Developers never edit files in `dist/`.

**[Risk] Strict mode surfaces many errors at once** → Mitigation: Files are converted one at a time. Each file must compile before moving to the next. The bottom-up order ensures dependencies are typed first, reducing cascading errors.

**[Risk] `audio-processor.ts` uses `AudioWorkletProcessor` and `registerProcessor` globals not in standard DOM types** → Mitigation: Add a `src/audio-processor.d.ts` ambient declaration file for these globals, or use `@anthropic-ai/anthropic-sdk`-style declare statements.

**[Risk] `ffmpeg-static` has no published types — `require('ffmpeg-static')` returns `string | null`** → Mitigation: Add a minimal `ffmpeg-static.d.ts` declaration: `declare module 'ffmpeg-static' { const path: string | null; export default path; }`.

**[Risk] `electron-reload` has no published types** → Mitigation: Add a minimal `electron-reload.d.ts` declaration: `declare module 'electron-reload' { function reload(paths: string, opts?: object): void; export = reload; }`.

**[Risk] `require()` calls inside functions (`scribe-service.js` line 12: `require('@elevenlabs/elevenlabs-js')`)** → Mitigation: Convert to top-level `import` (or dynamic `import()` if lazy loading is needed). The ElevenLabs SDK ships with TypeScript types.

**[Trade-off] Tests import from `src/` (TypeScript) while Electron runs from `dist/` (JavaScript)** → This is standard for TypeScript projects. The types ensure src/ and dist/ are equivalent. If a test passes against src/, the compiled dist/ will behave identically.

**[Trade-off] Two copies of mouse-trail code (shared/domain/mouse-trail.js CJS + renderer/features/timeline/mouse-trail.js ESM)** → Both can import from the same shared `.ts` source once the renderer's project references include shared. However, the renderer module (`lookupSmoothedMouseAt`) currently re-exports for the renderer's ESM context. Post-conversion, both can import from `src/shared/domain/mouse-trail.ts` since the renderer tsconfig references the shared project. But this is a refactoring decision — for this change, convert both files as-is and leave deduplication for a follow-up.

## Migration Plan

1. **Phase 1**: Create tsconfig project references, build scripts, dist/ layout. Verify `tsc --build` succeeds with the current JS files (via `allowJs: true`). Verify Electron boots from `dist/`.
2. **Phase 2-5**: Convert files layer by layer. After each file conversion, run `tsc --build` and `npm run test` to verify. After each layer, run full `npm run check`.
3. **Phase 6**: Remove `allowJs: true` from all tsconfigs. Verify zero `.js` files remain in `src/`. Final `npm run check`. Update AGENTS.md to reference `.ts` file extensions.
4. **Rollback**: At any phase, reverting to the previous commit restores a working state. The conversion is additive — each phase adds type safety without removing functionality.

## Open Questions

- Should the two mouse-trail modules (`src/shared/domain/mouse-trail.js` and `src/renderer/features/timeline/mouse-trail.js`) be deduplicated as part of this conversion, or left as separate files and deduplicated in a follow-up? (Recommendation: leave as-is, deduplicate later — this change is about language conversion, not refactoring.)
- Should `src/renderer/app.js` (~2000+ lines) be split into smaller modules as part of the TS conversion? (Recommendation: no — convert as-is. Splitting is a separate change that should be planned on its own merits.)
