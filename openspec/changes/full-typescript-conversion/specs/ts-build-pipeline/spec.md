## ADDED Requirements

### Requirement: TypeScript compilation via tsc --build

The project SHALL compile all TypeScript source files in `src/` to JavaScript output in `dist/` using `tsc --build`. The compilation SHALL use project references to build four sub-projects (shared, main, preload, renderer) in dependency order. A single `tsc --build` command at the root SHALL compile all sub-projects.

#### Scenario: Full build from clean state
- **WHEN** `dist/` does not exist and `tsc --build` is run
- **THEN** all `.ts` files in `src/` are compiled to `.js` files in `dist/`
- **AND** the `dist/` directory structure mirrors `src/` (same relative paths)
- **AND** source map files (`.js.map`) are generated alongside each `.js` file
- **AND** declaration files (`.d.ts`) are generated for the shared project

#### Scenario: Incremental rebuild after single file change
- **WHEN** a single `.ts` file is modified and `tsc --build` is run
- **THEN** only the changed file and its dependents are recompiled
- **AND** the build completes in under 2 seconds for a single-file change

#### Scenario: Build fails on type error
- **WHEN** a `.ts` file contains a type error (e.g., passing `string` where `number` is expected)
- **THEN** `tsc --build` exits with a non-zero code
- **AND** the error message identifies the file, line, and type mismatch

### Requirement: Project references enforce module boundaries

The compilation SHALL use four TypeScript project reference configs that enforce architectural boundaries:

- `tsconfig.shared.json`: Compiles `src/shared/**/*.ts`. Has no project references (leaf node). Outputs to `dist/shared/`.
- `tsconfig.main.json`: Compiles `src/main/**/*.ts` and `src/main.ts`. References `tsconfig.shared.json`. Outputs to `dist/`.
- `tsconfig.preload.json`: Compiles `src/preload.ts`. References `tsconfig.shared.json`. Outputs to `dist/`.
- `tsconfig.renderer.json`: Compiles `src/renderer/**/*.ts` and `src/audio-processor.ts`. References `tsconfig.shared.json`. Outputs to `dist/`.

#### Scenario: Renderer cannot import from main process
- **WHEN** a file in `src/renderer/` attempts to import from `src/main/services/`
- **THEN** `tsc --build` fails with a "not listed in project references" error

#### Scenario: Main process can import from shared
- **WHEN** a file in `src/main/` imports from `src/shared/domain/`
- **THEN** `tsc --build` succeeds (shared is a declared reference)

#### Scenario: Shared domain has no upstream imports
- **WHEN** a file in `src/shared/` attempts to import from `src/main/` or `src/renderer/`
- **THEN** `tsc --build` fails

### Requirement: Strict mode enabled for all projects

All four TypeScript project configs SHALL set `strict: true`. This enables `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitThis`, and `alwaysStrict`. Additionally, `noUncheckedIndexedAccess` SHALL be enabled.

#### Scenario: Implicit any is a compile error
- **WHEN** a function parameter has no type annotation and the type cannot be inferred
- **THEN** `tsc --build` fails with "Parameter implicitly has an 'any' type"

#### Scenario: Null check required
- **WHEN** a value that could be `null | undefined` is used without a null check
- **THEN** `tsc --build` fails with "Object is possibly 'null'" or similar

#### Scenario: Indexed access returns T | undefined
- **WHEN** an array element is accessed by index (e.g., `arr[0]`)
- **THEN** the type includes `undefined` and the code must handle the undefined case

### Requirement: Main process compiles to CommonJS

The `tsconfig.main.json` SHALL set `module: "NodeNext"` and `moduleResolution: "NodeNext"`. With no `"type": "module"` in `package.json`, this outputs CommonJS (`require`/`module.exports`). The compiled output SHALL be functionally identical to the current CJS source files.

#### Scenario: Compiled main.js uses require()
- **WHEN** `src/main.ts` contains `import { createWindow } from './main/app/create-window.js'`
- **THEN** `dist/main.js` contains the equivalent `require("./main/app/create-window.js")` call

#### Scenario: Import extensions in source
- **WHEN** TypeScript source uses `import { foo } from './bar.js'` (with .js extension)
- **THEN** the import resolves to `./bar.ts` during compilation and outputs `./bar.js` in dist/

### Requirement: Renderer compiles to ES modules

The `tsconfig.renderer.json` SHALL set `module: "ES2022"` and include `lib: ["ES2022", "DOM"]`. The compiled output SHALL use `import`/`export` syntax. The HTML file SHALL load the compiled renderer entry point via `<script type="module" src="./renderer/app.js">`.

#### Scenario: Compiled renderer app.js uses import
- **WHEN** `src/renderer/app.ts` contains `import { cleanupAllMedia } from './features/media-cleanup.js'`
- **THEN** `dist/renderer/app.js` contains the same `import` statement (ESM preserved)

#### Scenario: Browser loads compiled renderer
- **WHEN** Electron loads `dist/index.html`
- **THEN** the `<script type="module" src="./renderer/app.js">` tag loads `dist/renderer/app.js`
- **AND** all renderer ES module imports resolve correctly relative to `dist/renderer/`

### Requirement: Electron loads from dist/

The `package.json` `"main"` field SHALL be set to `"dist/main.js"`. Electron SHALL load the compiled JavaScript from `dist/` at runtime, not from `src/`.

#### Scenario: App launches from dist/
- **WHEN** `electron .` is run after `tsc --build`
- **THEN** Electron loads `dist/main.js` as the main process entry point
- **AND** the BrowserWindow loads `dist/index.html`
- **AND** the preload script is `dist/preload.js`
- **AND** the app functions identically to the pre-conversion JavaScript version

#### Scenario: App fails without build
- **WHEN** `dist/` does not exist and `electron .` is run
- **THEN** Electron fails to start (missing main entry point)

### Requirement: Static asset copying

The build pipeline SHALL copy non-TypeScript assets from `src/` to `dist/`:
- `src/index.html` → `dist/index.html`
- `src/renderer/styles/main.css` → `dist/renderer/styles/main.css`
- `src/renderer/styles/tailwind.input.css` is NOT copied (it's a build input, not a runtime asset)

#### Scenario: HTML file available after build
- **WHEN** `npm run build` completes
- **THEN** `dist/index.html` exists and is identical to `src/index.html`

#### Scenario: CSS file available after build
- **WHEN** `npm run build:styles` and `npm run build` complete
- **THEN** `dist/renderer/styles/main.css` exists with compiled Tailwind output

### Requirement: Development watch mode

The project SHALL provide a `npm run dev` command that:
1. Runs `tsc --build --watch` for continuous recompilation
2. Copies static assets to `dist/`
3. Builds Tailwind CSS
4. Launches Electron pointing at `dist/main.js`

Changes to `.ts` source files SHALL trigger recompilation and Electron reload automatically via `electron-reload` watching the `dist/` directory.

#### Scenario: Edit source file during dev
- **WHEN** a developer edits `src/main/services/fps-service.ts` while `npm run dev` is running
- **THEN** `tsc --build --watch` recompiles the changed file to `dist/`
- **AND** `electron-reload` detects the change in `dist/` and reloads the app

### Requirement: Clean command

The project SHALL provide a `npm run clean` command that removes the `dist/` directory and all TypeScript build cache files (`.tsbuildinfo`).

#### Scenario: Clean removes all build output
- **WHEN** `npm run clean` is run
- **THEN** the `dist/` directory is deleted
- **AND** all `.tsbuildinfo` files are deleted
- **AND** `tsc --build` after clean performs a full rebuild

### Requirement: dist/ is gitignored

The `dist/` directory SHALL be listed in `.gitignore`. Compiled JavaScript output SHALL NOT be committed to the repository.

#### Scenario: dist/ not tracked by git
- **WHEN** `tsc --build` generates files in `dist/`
- **THEN** `git status` does not show `dist/` files as untracked

### Requirement: Updated npm scripts

The `package.json` scripts SHALL be updated:
- `build:ts`: Runs `tsc --build`
- `build`: Runs `build:ts`, copies static assets, builds styles
- `clean`: Removes `dist/` and `.tsbuildinfo` files
- `dev`: Runs watch mode (tsc watch + electron + styles)
- `start`: Runs full build then launches Electron
- `typecheck`: Runs `tsc --build --noEmit` (type-check without output)
- `check`: Runs `lint && typecheck && test && test:e2e && package:smoke`

#### Scenario: npm run check passes
- **WHEN** all TypeScript files compile without errors and all tests pass
- **THEN** `npm run check` exits with code 0

#### Scenario: npm run build produces working app
- **WHEN** `npm run build` completes successfully
- **THEN** `electron .` launches a fully functional app

### Requirement: ESLint TypeScript integration

ESLint SHALL be configured with `typescript-eslint` to lint `.ts` files. The ESLint config SHALL replace `.js` file globs with `.ts` globs across all rule sections (main, renderer, tests, config). The `no-unused-vars` rule SHALL be replaced with `@typescript-eslint/no-unused-vars`.

#### Scenario: Lint catches TypeScript-specific issues
- **WHEN** `npm run lint` is run against `.ts` source files
- **THEN** ESLint processes all `.ts` files with TypeScript-aware rules
- **AND** exits with zero warnings (matching existing `--max-warnings=0` policy)

### Requirement: Vitest TypeScript test support

Vitest SHALL be configured to discover and run `.test.ts` files instead of `.test.js`/`.test.mjs`. The `include` pattern SHALL be `['tests/**/*.test.ts']`. Coverage globs SHALL reference `src/**/*.ts` instead of `src/**/*.js`.

#### Scenario: Tests run against TypeScript sources
- **WHEN** `npm run test` is run
- **THEN** Vitest discovers all `.test.ts` files in `tests/`
- **AND** test imports resolve TypeScript source files directly
- **AND** coverage reports cover `src/**/*.ts` files

### Requirement: Ambient type declarations for untyped dependencies

The project SHALL include ambient declaration files for dependencies that do not ship TypeScript types:
- `electron-reload`: `declare module 'electron-reload'` with appropriate signature
- `ffmpeg-static`: `declare module 'ffmpeg-static'` exporting `string | null`
- `AudioWorkletProcessor` and `registerProcessor` globals for `audio-processor.ts`

#### Scenario: ffmpeg-static import compiles
- **WHEN** `src/main/services/proxy-service.ts` imports `ffmpeg-static`
- **THEN** the import resolves to `string | null` type without error

#### Scenario: AudioWorkletProcessor compiles
- **WHEN** `src/audio-processor.ts` extends `AudioWorkletProcessor`
- **THEN** compilation succeeds with the global class available
