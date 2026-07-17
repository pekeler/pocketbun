# Upgrade PocketBun Compatibility to PocketBase v0.39.7

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. This document follows `.agents/PLANS.md`.

## Purpose / Big Picture

PocketBun currently targets PocketBase v0.39.6. After this work, its version metadata, vendored Admin UI, generated upstream-derived artifacts, and observable server behavior will target PocketBase v0.39.7. Users should receive the v0.39.7 fixes for import-collection field access, View collection query validation, and safe handling of failures in internal asynchronous workers. The completed upgrade is demonstrated by focused compatibility tests and the repository's complete format, test, typecheck, and lint gate.

## Progress

- [x] (2026-07-17T13:45:56Z) Read `.agents/PLANS.md`, the repository instructions, the active PocketBun version metadata, and the PocketBase v0.39.7 release notes.
- [x] (2026-07-17T13:48:12Z) Synced `.upstream/pocketbase` to v0.39.7 and inventoried every upstream change since v0.39.6.
- [x] (2026-07-17T14:02:10Z) Ported View wildcard validation, dry-run query normalization, dependent-view error aggregation/logging, upstream View tests, and asynchronous worker rejection coverage.
- [x] (2026-07-17T14:02:10Z) Updated the upstream pin, package/docs version, changelog, and vendored v0.39.7 Admin UI.
- [x] (2026-07-17T14:11:04Z) Ran focused tests, `bun run format:fix`, the full 1,891-test suite, `bun run typecheck`, package build/type validation, `bun run lint`, version/docs checks, asset parity, and final diff review successfully.

## Surprises & Discoveries

- Observation: PocketBase v0.39.7 is explicitly marked as a security release because internal worker goroutine panics could go unhandled.
  Evidence: The GitHub release notes identify issue `#7762` and state that internal worker functions were wrapped so panics are recovered and returned as ordinary errors.
- Observation: The import-collection `fields` fix is isolated to the upstream Admin UI review modal.
  Evidence: Upstream commit `4221a1b8` changes `ui/src/settings/sync/importCollectionsReviewModal.js` from `imported.fields.find(...)` to optional access with `imported.fields?.find(...)`; syncing `ui/dist` carries the fix without PocketBun runtime changes.
- Observation: PocketBun already contains the JavaScript equivalent of the upstream worker safety mechanism.
  Evidence: Awaited concurrent work uses rejecting promises, while `src/tools/routine/routine.ts` catches both synchronous throws and rejected promises for detached tasks. Auditing the upstream `routine.SafeWrap` and `routine.FireAndForget` call sites found no unprotected PocketBun equivalent.

## Decision Log

- Decision: Use a mechanical v0.39.6-to-v0.39.7 upstream diff as the source of truth, then port only behavior that maps to PocketBun's Bun/TypeScript architecture.
  Rationale: PocketBun prioritizes observable PocketBase compatibility and upstream traceability while permitting runtime-specific implementation differences.
  Date/Author: 2026-07-17 / Codex
- Decision: Reset the PocketBun-specific version suffix to `0.39.7-pocketbun.0`.
  Rationale: Repository versioning rules require the package base version to match `pocketbase_tag.txt` and reset the PocketBun patch counter for a new upstream release.
  Date/Author: 2026-07-17 / Codex
- Decision: Do not add a JavaScript `SafeWrap` helper.
  Rationale: A Go panic inside `errgroup` must be recovered and converted to an error, whereas a throw inside an awaited JavaScript worker already rejects its promise and follows the caller's normal error path. Detached PocketBun workers already use `FireAndForget`, which catches sync and async failures. A new wrapper would duplicate these semantics and could accidentally turn a rejected operation into a successfully resolved `Error` value.
  Date/Author: 2026-07-17 / Codex

## Outcomes & Retrospective

PocketBun now targets PocketBase v0.39.7 as `0.39.7-pocketbun.0`. The vendored Admin UI exactly matches `.upstream/pocketbase/ui/dist`, carrying the import-collection `fields` fix and updated View-query guidance. The TypeScript runtime now rejects wildcard View columns with the upstream message, normalizes dry-run View ids like persisted Views, and continues checking all dependent Views while aggregating and logging their errors.

The upstream worker-panic security audit found that PocketBun already used the correct JavaScript mechanisms: awaited worker promises reject to callers and detached work is contained by `FireAndForget`. A new regression test proves rejected detached promises are logged without an `unhandledRejection`.

Validation completed with 38 focused tests and the full repository suite: 1,891 tests passed, 0 failed, with 7 snapshots and 10,062 assertions. `bun run format:fix`, `bun run typecheck`, `bun run typecheck:package`, `bun run lint`, `bun run check:versions`, `bun run docs:check`, `git diff --check`, and vendored-asset parity also passed. The upstream mapping audit still reports the repository's two pre-existing unported `plugins/ghupdate` source files and their tests; v0.39.7 introduces no change there.

## Context and Orientation

`pocketbase_tag.txt` pins the upstream release and `package.json` carries the matching PocketBun SemVer version. `.upstream/pocketbase` is a read-only local checkout populated by `bun run upstream:sync`; comparing tags v0.39.6 and v0.39.7 there reveals the authoritative Go source and test changes. PocketBun source lives under `src/`, with ported tests normally adjacent to the corresponding TypeScript source. The vendored unchanged PocketBase Admin UI lives under `vendor/pocketbase-admin-ui/dist`. `CHANGELOG.md` records user-facing compatibility changes and must identify the upstream release and commit.

PocketBase uses goroutines for asynchronous work. PocketBun instead uses promises and Bun tasks, so a direct translation of panic recovery is not possible or desirable. The relevant observable requirement is that failures in internal asynchronous work are contained, reported through the existing error path, and do not become unhandled failures that can terminate or destabilize the process.

## Plan of Work

First, change `pocketbase_tag.txt` to v0.39.7 and run `bun run upstream:sync`. Compare the pinned v0.39.6 and v0.39.7 tags by commit, file, and patch. Classify each upstream change as runtime behavior, test-only coverage, dependency-only Go maintenance, documentation, or vendored Admin UI.

Second, map each runtime change to the corresponding PocketBun module by using the upstream source-path headers and repository searches. Port upstream comments and tests along with behavior. For import collections, verify that API-rule field resolution can access the imported collection's `fields` property. For View collections, port the `*` query validation and friendly error messages at the shared validator. For internal workers, trace all upstream `routine.SafeWrap` call sites and PocketBun equivalents, then add the smallest shared containment needed for any equivalent fire-and-forget promise paths. Add regression tests that fail on v0.39.6 behavior and pass after the port.

Third, sync unchanged upstream-distributed assets using existing repository workflows. Copy the v0.39.7 Admin UI distribution and license only from `.upstream/pocketbase/ui/dist` if the upstream diff changed it. Rebuild generated docs or declarations only where the normal version checks or upstream diff require them. Update `package.json` to `0.39.7-pocketbun.0` and add a dated v0.39.7 entry at the top of `CHANGELOG.md`, linking the upstream changelog and recording commit `636b7e2`.

Finally, run focused tests while implementing, then the complete required gate. Review `git diff --check`, source headers, comments, and the final file list to ensure the upgrade contains no unrelated refactors or user changes.

## Concrete Steps

Work from `/Users/pekeler/Projects/pocketbun`.

1. Edit `pocketbase_tag.txt` to `v0.39.7`.
2. Run `bun run upstream:sync`.
3. Inspect `git -C .upstream/pocketbase diff v0.39.6..v0.39.7` and the release commit history.
4. Locate the corresponding PocketBun source and tests with `rg`, then edit the minimum applicable files.
5. Update version metadata, changelog, and upstream-derived assets.
6. Run focused tests for each affected subsystem.
7. Run:

       bun run format:fix
       bun test --concurrent
       bun run typecheck
       bun run lint
       git diff --check

## Validation and Acceptance

The upgrade is accepted when `pocketbase_tag.txt` contains `v0.39.7`, `package.json` contains `0.39.7-pocketbun.0`, and `bun run check:versions` accepts the synchronized version metadata. The vendored Admin UI must exactly match the pinned upstream distribution that contains the import-collection fix. Ported regression tests must demonstrate View `*` validation and dry-run normalization with the same successful or friendly-error behavior as upstream. Any PocketBun equivalent of an upstream internal worker must turn asynchronous failures into its normal logged or returned error path without an unhandled rejection. All pre-existing tests must continue to pass, and the four required repository checks must complete successfully.

## Idempotence and Recovery

`bun run upstream:sync` is safe to rerun and treats `.upstream/pocketbase` as disposable read-only reference data. Generated asset sync commands should be rerunnable and must copy only from the pinned upstream checkout. Do not reset or discard repository changes; if a focused edit causes failures, inspect and repair that edit while preserving unrelated work. Temporary test data belongs in the repository's existing test helpers or system temporary directories.

## Artifacts and Notes

Initial release evidence:

    PocketBase v0.39.7 release commit: 636b7e2
    Release date: 2026-07-16
    Announced fixes: import collection fields access, View `*` validator/errors,
    and panic recovery for internal workers.

Final validation evidence:

    1891 pass
    0 fail
    7 snapshots, 10062 expect() calls
    Ran 1891 tests across 241 files.

    Version sources are aligned: PocketBase v0.39.7,
    PocketBun 0.39.7-pocketbun.0
    Generated docs parity checks passed.
    Found 0 lint warnings and 0 lint errors.

## Interfaces and Dependencies

No new npm dependency is expected. PocketBase's Go-only switch from the original `go-ozzo/ozzo-validation` module to its trusted fork will be recorded as upstream dependency maintenance unless the source diff reveals behavior PocketBun must reproduce. Existing PocketBun validators, collection models, promise/error helpers, logging, and Bun/Web APIs should be reused.

Revision note, 2026-07-17 / Codex: Replaced the completed hook-bundling plan with the active PocketBase v0.39.7 compatibility upgrade plan.

Revision note, 2026-07-17 / Codex: Recorded the synchronized upstream diff, implementation decisions, completed runtime/UI/version changes, and successful full validation.
