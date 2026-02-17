# AGENTS.md — PocketBun

## What this repo is
PocketBun is a **Bun-native** reimplementation/port of **PocketBase** with the goal of being **API-compatible** (drop-in for clients + Admin UI).
- Runtime target: **Bun only** (no Node.js support needed).
- Language: **TypeScript** (keep types practical; avoid type wizardry).
- Serve the existing PocketBase Admin UI **unchanged** as static assets.

PocketBun is a separate open-source project and must **clearly credit PocketBase** and preserve upstream license notices for any copied code/assets.

## Repository Guidelines
- Repo: https://github.com/pekeler/pocketbun
- GitHub issues/comments/PR comments: use literal multiline strings or `-F - <<'EOF'` (or $'...') for real newlines; never embed "\\n".

## Top priority: compatibility
When implementing behavior, prioritize **matching PocketBase observable behavior**:
- routes, status codes, JSON response shapes
- query params semantics (filters, sort, expand, fields, paging)
- auth/token behavior
- realtime protocol behavior (SSE)
- error formatting

If you’re unsure about an edge case:
1) check PocketBase docs
2) check PocketBase source in the pinned upstream checkout (see below)
3) if still unclear, run upstream PocketBase at the pinned tag and compare behavior, then encode it in tests.
If you discover a behavior difference that cannot be avoided, confirm with the repo owner that the incompatibility is acceptable before documenting it. Only then add it to the README’s “Known Differences” list (keep that list very short).

## Porting Guidelines
Goal: maximize long-term maintainability and upstream-syncability by keeping PocketBun structurally close to the PocketBase Go codebase, while preserving *observable behavior*.

- **Behavior first:** Match PocketBase observable behavior (API, status codes, JSON shapes, error formats, auth, realtime) even if the internal implementation differs.
- **Mechanical translation preferred:** Avoid “cleanup”, refactors, or re-architecture unless needed for correctness or Bun constraints.
- **Traceability:** When porting a file, add a short header comment linking to the upstream source path (no version/hash; `pocketbase_tag.txt` is the source of truth), e.g.
  `// Ported from pocketbase/<path>`
  - If a single TS file merges multiple upstream files, list *all* upstream source paths in that header comment.
- **Preserve upstream comments:** Copy upstream comments (doc comments and relevant inline notes) into the TypeScript port. If comments are missing, backfill them so the TS file reflects upstream commentary.
- **Comment backfill is mandatory:** When you notice missing upstream comments in already ported code, add them immediately rather than deferring.
- **Non-upstream files:** Any source or test file without an upstream counterpart must include a short header comment explaining why the file exists (keep these files to a minimum).
- **1:1 file mapping (when reasonable):** Prefer one `.ts` file per corresponding `.go` file and mirror directory structure (Go packages → TS folders) to keep diffs and future syncing straightforward.
  - If strict 1:1 creates unnatural modules (circular imports, huge files, etc.), it’s OK to merge/split — but document it in a comment near the top of the file and list every upstream source file included.
- **Naming:** Prefer upstream naming and concepts for internal identifiers (types/functions), even if not idiomatic JS/TS, **as long as it doesn’t reduce clarity or cause bugs**.
  - Do not rename just for style.
- **Only deviate when necessary:** Deviations are allowed when required by JS/Bun semantics (async I/O, concurrency model, time/number handling, resource cleanup, etc.).
  - When you deviate, leave a brief comment explaining *why*.
- **Document significant differences:** If a ported file intentionally diverges from upstream behavior/implementation, document the difference and the rationale in the file.
- **Compatibility shims:** Prefer small internal helpers (`src/internal/compat/*`) to model Go-like primitives (errors/time/sync/http/sql) so most files remain a straightforward, 1:1 port.
- **Dependencies:** Prefer **Bun built-ins** first (e.g. `Bun.serve`, `bun:sqlite`, Web APIs).
  - If PocketBase uses a Go third-party library and Bun lacks equivalent functionality, choose an npm dependency that is:
    - actively maintained,
    - reasonably popular,
    - small/specific (avoid heavy frameworks),
    - permissively licensed (MIT/Apache/BSD).
  - Avoid adding dependencies for trivial utilities—write small local helpers instead.
- **Regression tests required:** For each ported subsystem or endpoint, add/adjust tests so behavior is pinned. If you discover an upstream edge case, add a regression test immediately.

## ExecPlans
When writing complex features or significant refactors, use an ExecPlan (as described in `.agents/PLANS.md`) from design to implementation.
Keep the active plan in `.agents/EXECPLAN.md`.

## PERFORMANCE
- Follow `.agents/PERFORMANCE.md` for all performance work.
- Optimize only measured hotspots and keep PocketBase behavior compatibility.
- Prefer low-allocation hot-path code: combine multi-pass array chains, move invariants out of loops, and use `Set`/`Map` for repeated membership checks.
- Keep changes small and verify with full checks:
  - `bun run format:fix`
  - `bun test --concurrent`
  - `bun run typecheck`
  - `bun run lint`

## Default routes/dirs to match PocketBase
Keep these defaults unless we intentionally document a deviation:
- REST API base path: `/api/`
- Admin UI: `/_/`
- If `pb_public/` exists, serve it at `/` as static files.
- Default app directories (relative to CWD unless configured):
  - `pb_data/` (SQLite DB + storage, should be gitignored)
  - `pb_migrations/` (schema/data migrations, safe to commit)
  - `pb_hooks/` (server-side hooks/extensions)

## Upstream PocketBase reference (for reading & diffing behavior)
We track a specific PocketBase release tag in a simple text file:

- `pocketbase_tag.txt` — contains a tag like `v0.36.1`
- `.upstream/pocketbase` — local git checkout used for reference (NEVER commit)

### Sync upstream checkout
Use the repo script (must remain simple: clone + checkout):
- `bun run upstream:sync`

Conventions:
- `.upstream/` is **local only** and must be in `.gitignore`.
- Never edit upstream files; treat it as read-only reference material.
- Bumping upstream:
  1) edit `pocketbase_tag.txt`
  2) run `bun run upstream:sync`
  3) update PocketBun code + tests until compatibility is restored

## Vendored Admin UI
We reuse PocketBase Admin UI as static assets (do not modify upstream UI code manually).

Conventions:
- Keep vendored UI under `vendor/pocketbase-admin-ui/dist`.
- Update the vendored UI only by copying from:
  `.upstream/pocketbase/ui/dist`
  after syncing to a specific tag.
- Keep a copy of PocketBase’s MIT license text next to the vendored UI assets.

## Bun-only implementation rules
- Use **ESM** (`import`/`export`), no CJS compatibility work required.
- Prefer Bun/Web APIs:
  - `Bun.serve` for HTTP
  - `bun:sqlite` for SQLite
  - Web `Request`/`Response`, `URL`, `fetch`, streams
- Avoid Node-only dependencies and Node-specific runtime assumptions.
  - `node:` builtins are OK only if Bun supports them and they keep things simpler.
- Tooling/scripts must use Bun runtime entrypoints (`bun ...` / `bun run ...`) instead of `node ...`.
  - Prefer `.js` script files for Bun tooling helpers unless there is a specific reason to use another extension.
- Keep dependencies minimal; prefer small utilities over frameworks.

## TypeScript rules (keep it friendly for JS-minded devs)
- Keep types **useful but lightweight**:
  - explicit types for exported/public APIs
  - internal code can rely on inference
  - avoid complex generics and type-level tricks
- Prefer runtime validation + clear errors at boundaries over “perfect types”.
- Don’t “TypeScript-ify” everything; correctness + clarity > cleverness.

## Hooks/extensions philosophy
PocketBun should make server-side extensibility practical in Bun:
- Support loading code from `pb_hooks/` (and allow TS/ESM naturally).
- Keep the ergonomics simple and documented.
- Where possible, keep naming/semantics close to PocketBase hook concepts so existing users can migrate.

## Testing (must exist and grow over time)
Use `bun test --concurrent` and keep tests focused on compatibility. Always run all four — `bun run format:fix`, `bun test --concurrent`, `bun run typecheck`, and `bun run lint` — before committing any changes to `src/` or `tests/`, and fix any errors or warnings they report. Treat compiler/runtime warnings (including deprecation warnings surfaced during tests or `bun run start`) as issues to fix before committing. Use `bun run format` for a formatting check when you don’t want to apply auto-fixes. When rerunning tests during fixes, prefer `bun test --only-failures --concurrent` to keep output quieter, and expect ~40s of no output before results (set a longer timeout so it doesn’t look hung).
When running with `--concurrent`, mark tests that mutate global state or shared resources as serial using `test.serial` / `it.serial` (examples: `process.env`, `process.argv`, `globalThis`, shared temp paths, or other global singletons). Keep those serial exceptions minimal; everything else should run concurrently.
When porting any upstream code (especially validators/fields), also port the corresponding upstream tests and use them as the primary verification of correctness.
Keep tests in the same relative paths as upstream: if the upstream test lives next to the code (for example `core/validators/db_test.go`), place the ported test next to the TS source (for example `src/core/validators/db.test.ts`). Only keep tests under `tests/` when the upstream file is under `tests/`, or when the test is PocketBun-only (and then include the required “why this file exists” header comment).
Minimum expectations:
- tests for core API endpoints (status + JSON shape)
- tests for auth flows we implement
- tests for realtime basics (connect/subscribe/events)
- regression tests for any compatibility edge case discovered

Add tests whenever:
- you implement an endpoint
- you fix a bug
- you observe a behavior difference vs upstream

## Commands
- `bun run upstream:sync` — sync `.upstream/pocketbase` to the tag in `pocketbase_tag.txt`
- `bun test` — run test suite
- `bun run typecheck` — run TypeScript typecheck (no emit)
- `bun run lint` — run oxlint (type-aware)
- `bun run format` — check formatting with oxfmt
- `bun run format:fix` — apply formatting fixes with oxfmt
- For Codex approval persistence, keep command prefixes/strings stable across runs.
- If params/env need to change repeatedly, prefer editing a dedicated wrapper script (for example under `scripts/`) and rerun the same wrapper command instead of issuing new inline env-var command variants each time.

## Change hygiene
- Make small, focused commits.
- Do not reformat unrelated files.
- If you copy upstream code/assets, preserve required license notices and document what was copied.
- If PocketBun intentionally deviates from PocketBase behavior, document it explicitly (README / docs).
- Keep `/CHANGELOG.md` up to date: every important user-facing change must be recorded under an appropriate version (or `Unreleased`) before release.
- Keep changelog entries concise and outcome-focused; skip internal-only details (tests, refactors, CI/tooling churn) unless they directly affect users.

## Versioning
PocketBun versions must be valid SemVer for npm/Bun tooling, and must clearly encode which PocketBase release we target.

### Scheme
We mirror the upstream PocketBase `X.Y.Z` and add a PocketBun-specific patch as a SemVer *pre-release*:

**PocketBun version = `X.Y.Z-pocketbun.N`**

- `X.Y.Z` is the PocketBase version we are compatible with.
- `N` is a PocketBun-only increment for fixes/changes that keep compatibility with the same upstream `X.Y.Z`.

Examples:
- Compatible with PocketBase `v0.36.1` (first PocketBun release): `0.36.1-pocketbun.0`
- Bugfix release while still compatible with `v0.36.1`: `0.36.1-pocketbun.1`
- After syncing to PocketBase `v0.36.2`: `0.36.2-pocketbun.0`

### Source of truth
- `pocketbase_tag.txt` contains the upstream tag, e.g. `v0.36.1`.
- The `X.Y.Z` in `package.json` **must match** `pocketbase_tag.txt` (strip the leading `v`).
- When `pocketbase_tag.txt` changes to a new `vX.Y.Z`, reset `N` to `0`.

### Rules
- Never publish a plain `X.Y.Z` (without the `-pocketbun.N` suffix).
- Git tags/releases should match the package version, prefixed with `v`, e.g. `v0.36.1-pocketbun.2`.
- Release notes must state: “Compatible with PocketBase vX.Y.Z” and, when available, include the upstream commit hash.
