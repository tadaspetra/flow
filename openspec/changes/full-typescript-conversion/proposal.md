## Why

The entire codebase (24 production files, 22 test files) is plain JavaScript with zero type safety — no TypeScript, no JSDoc, no `.d.ts` files. TypeScript is installed and configured but inactive (`checkJs: false`, `strict: false`, `noEmit: true`). Data shapes for projects, sections, keyframes, overlays, takes, and IPC messages are implicit — enforced only by runtime normalization functions and developer memory. Mismatches between the preload bridge (25 IPC channels) and main process handlers are invisible until runtime. As the codebase grows beyond its current 24-file footprint, this lack of compile-time safety becomes increasingly expensive: bugs hide longer, refactors are riskier, and onboarding is harder.

Converting now — while the codebase is well-structured and small — is the cheapest it will ever be. Every file added after this point would need to be converted later at higher cost.

## What Changes

- **Build pipeline**: Add a `tsc` compilation step that compiles `src/**/*.ts` to `dist/`. Electron loads from `dist/` instead of `src/`. Use TypeScript project references to enforce module boundaries (main, renderer, shared, preload).
- **Strict mode from day one**: `strict: true` in all tsconfigs — `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `noUncheckedIndexedAccess`. No `any` escape hatches except where unavoidable (third-party types).
- **Core type definitions**: Create explicit interfaces for all data shapes: `Project`, `Section`, `Keyframe`, `Overlay`, `Take`, `RenderOptions`, `RenderProgress`, `FfmpegProgress`, `MouseTrailEntry`, `OverlayPosition`, plus string literal unions (`OutputMode`, `ExportAudioPreset`, `PipSnapPoint`, `OverlayMediaType`). These types become the shared contract between all layers.
- **IPC type contract**: A single `ElectronAPI` interface defines every IPC channel's request/response types, shared between `preload.ts` and `register-handlers.ts`. Mismatches become compile-time errors.
- **Convert all 24 production files** from `.js` to `.ts`: `src/shared/domain/` (2), `src/main/services/` (8), `src/main/infra/` (1), `src/main/ipc/` (1), `src/main/app/` (1), `src/renderer/features/` (7), `src/renderer/app.ts` (1), entry points (3: `main.ts`, `preload.ts`, `audio-processor.ts`).
- **Convert all 22 test files** from `.js`/`.mjs` to `.ts`: unify the mixed CommonJS/ESM test format into `.test.ts`.
- **Update tooling**: ESLint with `typescript-eslint`, Vitest configured for `.ts` test files, coverage globs updated for `src/**/*.ts`.
- **Module system**: Main process TypeScript compiles to CommonJS (matching current runtime behavior). Renderer TypeScript compiles to ESM (matching current browser loading). **No runtime module system change** — the compiled output behaves identically to today's code.
- **BREAKING**: The `"main"` field in `package.json` changes from `src/main.js` to `dist/main.js`. `electron-reload` and `create-window.js` path references change to point into `dist/`. The `dist/` directory is added to `.gitignore`.

## Capabilities

### New Capabilities

- `ts-build-pipeline`: TypeScript compilation pipeline using `tsc --build` with project references. Compiles `src/**/*.ts` to `dist/`, manages separate compilation targets for main process (Node/CJS), renderer (ESM/DOM), preload (isolated context), and shared domain. Includes source maps, declaration files, development watch mode, and static asset copying (HTML, CSS).
- `ts-type-contracts`: Centralized TypeScript type definitions for all domain data shapes (Project, Section, Keyframe, Overlay, Take, etc.), service interfaces, dependency injection patterns, and the IPC channel contract between main process and renderer. These types enforce data-shape correctness at compile time across all layers.

### Modified Capabilities

(None — this change modifies implementation language only. All feature behavior, data shapes, normalization logic, IPC channels, and user-facing behavior remain identical. No existing spec requirements change.)

## Impact

- **All 24 production files** renamed `.js` → `.ts` and converted to typed TypeScript with strict mode
- **All 22 test files** renamed `.js`/`.mjs` → `.test.ts` and converted to typed imports
- **Config files modified**: `tsconfig.json` (replaced with project-reference root), `package.json` (scripts, main field), `eslint.config.mjs`, `vitest.config.mjs`, `.gitignore`
- **New config files**: `tsconfig.main.json`, `tsconfig.renderer.json`, `tsconfig.preload.json`, `tsconfig.shared.json`
- **New source files**: `src/shared/types/` directory containing type definition files
- **Build output**: New `dist/` directory (gitignored) containing compiled JavaScript
- **Static assets**: `src/index.html` and `src/renderer/styles/` copied to `dist/` during build
- **Path references**: `create-window.js` `__dirname`-relative paths to `preload.js` and `index.html` must be updated for the `dist/` layout
- **Dependencies**: Add `typescript-eslint` (dev). No production dependency changes.
- **CI**: `npm run check` pipeline updated to include `tsc --build` step. Existing lint, test, e2e, and packaging smoke steps continue to work against compiled output.
