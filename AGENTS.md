# AGENTS.md

This file is the canonical contributor guide for this repository.

If another assistant-specific file exists, it should defer to this document for repo workflow, quality gates, and architecture constraints.

## Mission

Keep this Electron video app production-ready while preserving:

- clear module boundaries
- deterministic tests
- stable user-facing behavior
- release integrity

Do not optimize for "quickly making tests pass." Optimize for making the codebase more robust.

## Required Workflow

For any non-trivial change, follow this order:

1. Identify the affected feature and expected behavior.
2. Define or update acceptance criteria before implementation.
3. Add or update tests first for the intended behavior.
4. Implement the code change.
5. Run the full verification suite.
6. Fix code defects if tests fail. Do not weaken assertions unless the product requirement itself changed.

## Change Policy

- Prefer small, isolated changes over broad rewrites.
- Preserve behavior unless the task explicitly changes product behavior.
- Do not introduce duplicate business logic across renderer and main.
- Shared normalization/domain logic belongs in `src/shared/`.
- Main-process business logic belongs in `src/main/services/`, not in IPC registration or app bootstrap.
- Renderer feature logic belongs in `src/renderer/features/`, not inline in `src/index.html`.
- `src/preload.js` should remain a narrow bridge and not gain business logic.

## Architecture Guardrails

Current intended structure:

- `src/main/`
  - Electron runtime bootstrapping, IPC registration, services, infra
- `src/shared/`
  - domain rules, normalization, data-shape helpers shared across layers
- `src/renderer/`
  - renderer entrypoint and feature utilities
- `tests/unit/`
  - pure logic and isolated helper tests
- `tests/integration/`
  - service/integration tests with controlled fakes
- `tests/e2e/`
  - Electron smoke and workflow checks

When adding new code:

- Put pure data logic in a testable module first.
- Keep side effects at the edges.
- Inject dependencies where practical for testability.
- Favor explicit validation and errors over silent fallback when data is invalid.

## Test-First Requirements

Before implementing behavior changes:

- Add unit tests for pure logic.
- Add integration tests for filesystem, IPC, or service coordination.
- Add or extend e2e coverage for critical user flows if the change affects runtime behavior.

Minimum expectation by change type:

- Pure helper/domain change: unit tests
- Main-process service or IPC change: unit + integration tests
- Renderer feature change: utility tests and, if behaviorally important, e2e or smoke coverage
- Release/build/packaging change: verification via packaging smoke and relevant CI updates

## Testing Rules

- Never "fix" a test by removing meaningful assertions just to get green CI.
- If a test reveals a bug, fix the underlying code.
- Prefer deterministic tests using mocks, fakes, fixtures, and temp directories.
- Avoid live external dependencies in tests.
- Keep tests readable and behavior-focused.

## Required Commands

Use npm only in this repo.

Primary commands:

- `npm run build:styles`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:e2e`
- `npm run package:smoke`
- `npm run check`

Before finishing a substantive change, run:

- `npm run check`

## Build And Runtime Notes

- Start the app with `npm run dev` or `npm start`, not raw `electron .`
  - this ensures renderer styles are rebuilt first
- Tailwind output is generated into `src/renderer/styles/main.css`
- Do not reintroduce Tailwind CDN loading
- Keep the stricter CSP in `src/index.html`

## Environment Rules

- Required env vars must be documented in `.env.example`
- Validate required env at runtime before using it
- Do not hardcode secrets
- Do not commit `.env`

## Release Integrity

Any change that affects build, packaging, or runtime startup must keep these green:

- lint
- typecheck
- unit/integration tests
- Electron smoke test
- packaging smoke

Update `.github/workflows/ci.yml` if the required validation steps change.

## Code Quality Expectations

- Prefer composition over large monoliths.
- Keep files focused.
- Name modules by responsibility.
- Write defensive normalization around persisted project/timeline data.
- Add comments only where the logic is non-obvious.
- Avoid dead code and stale compatibility layers unless intentionally retained.

## Documentation Expectations

Update docs when behavior or contributor workflow changes:

- `docs/production/feature-inventory.md`
- `docs/production/target-architecture.md`
- `docs/production/runbook.md`
- this file

## If You Are Unsure

Default to:

- tests first
- smaller modules
- stricter validation
- shared domain logic
- full `npm run check` before completion
