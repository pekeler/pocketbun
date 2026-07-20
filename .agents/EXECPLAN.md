# Upgrade PocketBun Compatibility to PocketBase v0.39.8

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. This document follows `.agents/PLANS.md`.

## Purpose / Big Picture

PocketBun currently targets PocketBase v0.39.7. After this work, its version metadata, vendored Admin UI, upstream-derived artifacts, and observable server behavior will target PocketBase v0.39.8. A PocketBun user should be able to use the fixes and compatibility changes shipped in that PocketBase release without changing client code. The result will be demonstrated by regression tests for every applicable behavior change and by the repository's complete format, test, typecheck, and lint gate.

## Progress

- [x] (2026-07-20 13:56Z) Read `AGENTS.md`, `.agents/PLANS.md`, `.agents/PERFORMANCE.md`, the ponytail coding skill, the current version metadata, and the completed v0.39.7 upgrade plan.
- [x] (2026-07-20 14:00Z) Read the PocketBase v0.39.8 release notes, pinned `pocketbase_tag.txt`, and synchronized `.upstream/pocketbase` plus the vendored Admin UI to commit `cc4e8570`.
- [x] (2026-07-20 14:02Z) Inventoried all 27 changed upstream paths and classified the runtime, test, UI, generated declaration, fixture, and Go dependency changes.
- [x] (2026-07-20 14:07Z) Ported scoped `$app` reset behavior and all four upstream regression scenarios; backfilled the upstream thumbnail containment rationale.
- [x] (2026-07-20 14:09Z) Updated the package/docs version, changelog, upstream pin, and vendored v0.39.8 Admin UI.
- [x] (2026-07-20 14:12Z) Passed focused compatibility tests and the complete repository validation gate, including 1,895 concurrent tests.
- [x] (2026-07-20 14:13Z) Reviewed the final diff for unrelated edits, upstream traceability, comment parity, performance risk, and version consistency.

## Surprises & Discoveries

- Observation: PocketBase v0.39.8 contains ten commits and changes 27 paths, but only two non-UI runtime areas: pooled JSVM `$app` reset and extra panic recovery around thumbnail creation.
  Evidence: The tag diff changes `plugins/jsvm/binds.go`, adds `plugins/jsvm/binds_app_reset_test.go`, and wraps `tools/filesystem/filesystem.go` `CreateThumb`; the remaining runtime-adjacent changes are Go dependencies and regenerated declarations.
- Observation: PocketBun had the same `$app` leak through a Bun-specific mechanism.
  Evidence: Before the fix, the four ported tests all failed at `wrapApp(123)` after a hook, route handler, function middleware, or class middleware assigned `scope.$app = 123`; after the shared accessor change, all four pass.
- Observation: PocketBun already contains the Bun equivalent of upstream's new thumbnail panic wrapper.
  Evidence: `src/tools/filesystem/filesystem.ts` runs all image decoding, resizing, encoding, and upload work inside a `try`/`catch` that returns failures as `Error`; the focused upstream-derived thumbnail test passes after backfilling the explanatory comment.
- Observation: The regenerated upstream JSVM declaration file has no unaudited public contract delta, and the changed upstream SQLite fixture has no semantic data or schema delta.
  Evidence: All five `types_runtime_contract.test.ts` cases pass against the v0.39.8 declaration file, while `sqlite3 .dump` output is byte-for-byte identical for the v0.39.7 and v0.39.8 `tests/data/data.db` files.
- Observation: PocketBase's `golang.org/x/*`, `modernc.org/sqlite`, and related Go dependency updates do not map to npm dependencies in PocketBun.
  Evidence: PocketBun uses Bun 1.3.14's built-in `bun:sqlite` rather than `modernc.org/sqlite`; the local runtime reports SQLite 3.51.0, as it did for earlier compatible PocketBun releases.
- Observation: The first complete test attempt encountered a transient Bun/macOS `EADDRINUSE` failure while requesting ephemeral port `0`; it was not reproducible.
  Evidence: The prescribed `bun test --only-failures --concurrent` rerun passed all 1,895 tests, and a subsequent clean `bun test --concurrent` also passed all 1,895 tests with zero failures.

## Decision Log

- Decision: Treat the complete v0.39.7-to-v0.39.8 tag diff, not only the release summary, as the authoritative upgrade scope.
  Rationale: Release notes describe user-facing highlights but can omit tests, generated assets, and supporting source changes needed for observable compatibility.
  Date/Author: 2026-07-20 / Codex
- Decision: Work directly on the clean `master` branch and do not create or commit a task branch.
  Rationale: `AGENTS.md` requires trunk-based work by default, and the user requested the upgrade but did not request a commit or publication.
  Date/Author: 2026-07-20 / Codex
- Decision: Prefer existing PocketBun helpers and Bun/Web APIs, adding no dependency or abstraction unless the upstream behavior cannot be expressed correctly without it.
  Rationale: The repository's Bun-only porting rules and the ponytail skill both favor the smallest maintainable compatibility change.
  Date/Author: 2026-07-20 / Codex
- Decision: Store `$app` assignments in the current `AsyncLocalStorage` hook context and leave the accessor's default app unchanged.
  Rationale: PocketBun has no goja executor to snapshot and restore. A per-invocation mutable state object reproduces assignment semantics during synchronous or asynchronous handlers, is naturally discarded afterward, and isolates concurrent hooks without a new pool abstraction.
  Date/Author: 2026-07-20 / Codex
- Decision: Do not replace PocketBun's generated JSVM declarations or add a SQLite package.
  Rationale: The v0.39.8 generated file has no public contract delta according to the repository's exhaustive semantic audit, while PocketBun intentionally relies on Bun's built-in SQLite runtime. Copying randomized generated aliases would discard PocketBun-specific declaration fixes, and adding a second SQLite driver would violate the Bun-native architecture.
  Date/Author: 2026-07-20 / Codex

## Outcomes & Retrospective

PocketBun now targets PocketBase v0.39.8 as `0.39.8-pocketbun.0`. Its shipped Admin UI exactly matches the pinned v0.39.8 distribution, including the number-input and Shift + Click selection fixes. Server-side JavaScript `$app` assignments are isolated to the active hook, route handler, or middleware context and are discarded afterward, matching upstream executor reset behavior without introducing an executor pool. The existing thumbnail error boundary already provides the Bun equivalent of upstream's extra panic containment, and now carries the upstream rationale.

All applicable upstream changes were either ported, proven already equivalent, synchronized as generated UI assets, or classified as Go-only dependencies. The final gate passed 1,895 tests across 242 files with zero failures, 10,073 assertions, and seven snapshots. Formatting, application and package typechecks, lint, documentation checks, version checks, vendored-asset parity, and `git diff --check` all passed. The upstream mapping audit reports only the repository's pre-existing unported `plugins/ghupdate` source and tests; v0.39.8 introduced no remaining audit gap.

The primary lesson is that upstream's pooled-runtime state bug mapped to a different Bun failure mode: the process-wide accessor default was mutable. Modeling only the mutable `$app` value as async-local state was the smallest compatible fix and avoids both global leakage and a speculative runtime-pool abstraction.

## Context and Orientation

PocketBun is a Bun-native TypeScript reimplementation of PocketBase. Observable compatibility means that routes, status codes, JSON shapes, query semantics, authentication, realtime behavior, error formatting, and server-side JavaScript APIs should match the pinned PocketBase release.

`pocketbase_tag.txt` pins the upstream PocketBase release. `package.json` carries the PocketBun SemVer version, whose base must match that tag and whose suffix resets to `pocketbun.0` for a new upstream release. `bun.lock` records dependency resolution but has no root package-version field. `CHANGELOG.md` describes the user-visible upgrade and includes the upstream commit. `.upstream/pocketbase` is a local, ignored, read-only checkout created by `bun run upstream:sync`; the tag diff there is the source of truth for the port. PocketBun runtime code and adjacent ported tests live under `src/`. PocketBase's unchanged compiled Admin UI is copied from `.upstream/pocketbase/ui/dist` into `vendor/pocketbase-admin-ui/dist`, with its license notice preserved.

An upstream change is applicable when it changes behavior that PocketBun exposes or an upstream-derived asset PocketBun ships. Go-only dependency or concurrency maintenance may require no literal TypeScript port, but its observable purpose must still be audited against the Bun implementation. When upstream changes a source file that already has a TypeScript counterpart, the corresponding comments and tests must be compared even if the final runtime diff is small.

## Plan of Work

First, inspect the official v0.39.8 release notes to understand the advertised user-facing changes. Change `pocketbase_tag.txt` to v0.39.8 and run `bun run upstream:sync`, which obtains the exact tagged checkout. Record the upstream commit and compare v0.39.7 with v0.39.8 by commit list, file list, diff statistics, and full patches.

Second, classify every changed upstream file. Map Go source and tests to PocketBun modules using source-header comments, mirrored paths, and repository search. For each observable change, trace the existing TypeScript flow and all relevant callers before editing. Port upstream comments and regression cases mechanically, adapting only for Bun, JavaScript promises, Web APIs, or `bun:sqlite`. For a Go-only implementation change, prove whether PocketBun already has equivalent behavior or add the smallest shared fix and a regression test. Do not add speculative generality.

Third, synchronize upstream-derived files. Copy compiled Admin UI files only from the pinned `.upstream/pocketbase/ui/dist` if that directory changed. Run existing generators for documentation, declarations, or version references only where the diff or repository checks require them. Set the package version to `0.39.8-pocketbun.0`, align the lockfile and all checked version surfaces, and add a dated top-level changelog entry that links to the v0.39.8 upstream changelog, records the release commit, and nests directly ported changes beneath the compatibility bullet.

Finally, run focused tests during implementation. Then run `bun run format:fix`, `bun test --concurrent`, `bun run typecheck`, and `bun run lint`, along with repository-specific version, package, documentation, asset-parity, and diff checks discovered from `package.json` and prior upgrade practice. Fix every failure or warning. Review the complete diff and update every living-plan section with evidence.

## Concrete Steps

Work from `/Users/pekeler/Projects/pocketbun`.

1. Open the official PocketBase v0.39.8 release and record its summary, date, and release commit.
2. Edit `pocketbase_tag.txt` from `v0.39.7` to `v0.39.8`.
3. Run `bun run upstream:sync`.
4. Inspect `git -C .upstream/pocketbase log v0.39.7..v0.39.8`, `git -C .upstream/pocketbase diff --stat v0.39.7..v0.39.8`, `git -C .upstream/pocketbase diff --name-status v0.39.7..v0.39.8`, and the complete relevant patches.
5. Search `src/`, tests, scripts, docs, and vendored assets for corresponding implementations and port the minimum compatible changes with regression coverage.
6. Update version metadata, changelog, generated outputs, and vendored upstream assets.
7. Run focused test files for every changed subsystem.
8. Run:

       bun run format:fix
       bun test --concurrent
       bun run typecheck
       bun run lint
       git diff --check

9. Run the repository's version, package-type, docs parity, and vendored-asset checks when present, then inspect `git status --short` and `git diff --stat`.

## Validation and Acceptance

The upgrade is accepted when `pocketbase_tag.txt` contains `v0.39.8`; the package and documentation versions are `0.39.8-pocketbun.0`; the changelog identifies PocketBase v0.39.8 and its release commit; and every upstream v0.39.8 change has been mapped to a PocketBun runtime change, test, shipped asset, documentation update, or a recorded reason that no TypeScript change is needed.

Regression tests must demonstrate each applicable behavior with the same successful result or error semantics as PocketBase. The vendored Admin UI must exactly match the pinned upstream distribution if upstream changed it. The complete Bun test suite must pass with zero failures, typecheck and lint must report no errors or warnings, formatting and diff checks must be clean, and version/document/package checks must agree.

## Idempotence and Recovery

`bun run upstream:sync` is safe to rerun and treats `.upstream/pocketbase` as disposable read-only reference data. Asset and generator commands must be rerunnable and source only from the pinned checkout. Preserve all user work: do not reset, restore, or overwrite unrelated changes. If a test or generator partially fails, inspect its output, correct the scoped files, and rerun the same stable command. Temporary comparison data belongs under `.tmp/` or the system temporary directory and must not be committed.

## Artifacts and Notes

Initial repository state:

    Branch: master
    Working tree: clean
    PocketBase pin: v0.39.7
    PocketBun version: 0.39.7-pocketbun.0
    Current commit: 69e2f53a Upgrade PocketBase compatibility to v0.39.7

Release and focused-test evidence:

    PocketBase v0.39.8 release commit: cc4e85709074c8a81284c3d9c5064d2adbf4c854
    Release date: 2026-07-19
    Announced behavior: clean pooled JSVM $app state, Admin UI number-input
    handling and Shift + Click selection, plus Go/SQLite dependency updates.

    4 pass, 0 fail — src/plugins/jsvm/binds_app_reset.test.ts
    5 pass, 0 fail — src/plugins/jsvm/types_runtime_contract.test.ts
    1 pass, 0 fail — filesystem CreateThumb focused test

Final validation evidence:

    1895 pass, 0 fail, 10073 assertions, 7 snapshots — bun test --concurrent
    pass — bun run format:fix
    pass — bun run typecheck
    pass — bun run typecheck:package
    pass — bun run lint (0 warnings, 0 errors across 587 files)
    pass — bun run docs:check
    pass — bun run check:versions
    pass — vendored Admin UI parity with .upstream/pocketbase/ui/dist
    pass — git diff --check

## Interfaces and Dependencies

No new npm dependency is expected. Reuse the existing PocketBun public APIs, validators, models, router, database helpers, promise/error containment, logging, generators, and Bun/Web primitives. New public names are allowed only when PocketBase v0.39.8 exposes corresponding behavior, and they must follow PocketBase JSVM naming with compatibility tests. Any source or test added without an upstream counterpart must include the repository-required header explaining why it exists.

Revision note, 2026-07-20 / Codex: Replaced the completed v0.39.7 plan with the active, self-contained PocketBase v0.39.8 compatibility upgrade plan.

Revision note, 2026-07-20 / Codex: Closed the plan with the completed upstream mapping, implementation decisions, transient-test diagnosis, and final validation evidence.
