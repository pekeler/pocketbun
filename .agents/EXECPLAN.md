# Upgrade PocketBun Compatibility to PocketBase v0.39.10

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. This document follows `.agents/PLANS.md`.

## Purpose / Big Picture

PocketBun currently targets PocketBase v0.39.9. After this work, its package metadata, command failure behavior, file-field compatibility tests, and vendored Admin UI will target PocketBase v0.39.10. CLI command callbacks that throw will reject instead of being converted into returned command errors, matching upstream's restored panic behavior, while ordinary returned command errors will continue to be returned. The result is visible through focused tests, exact Admin UI parity, and the repository's full validation gate.

## Progress

- [x] (2026-07-30 08:03Z) Read the automation memory, repository upgrade guide, ExecPlan instructions, Ponytail coding and review skills, and current repository state.
- [x] (2026-07-30 08:03Z) Confirmed PocketBase v0.39.10 is the latest official mainline release at commit `0a74d2f2` and inventoried all 23 changed paths across seven commits.
- [x] (2026-07-30 08:03Z) Mapped the upstream file-field nil handling, CLI panic behavior, Go-only SQLite dependency update, and Admin UI changes to PocketBun.
- [x] (2026-07-30 08:05Z) Updated version metadata, changelog, vendored Admin UI, command execution behavior, and upstream-derived tests.
- [x] (2026-07-30 08:06Z) Passed 21 focused tests, Admin UI parity, version/docs checks, and the upstream mapping audit with only the four pre-existing `plugins/ghupdate` gaps.
- [x] (2026-07-30 08:10Z) Passed formatting, 1,897 concurrent tests, application and package typechecks, lint, deterministic docs checks, and diff checks.
- [x] (2026-07-30 08:10Z) Completed the Ponytail complexity review with no simplification findings and left the working tree uncommitted for user review.

## Surprises & Discoveries

- Observation: GitHub's rendered `/releases/latest` page initially still showed v0.39.9, while the live releases API already listed v0.39.10.
  Evidence: `gh api repos/pocketbase/pocketbase/releases?per_page=10` returned v0.39.10 published at `2026-07-30T04:19:15Z` before the web page cache updated.
- Observation: The upstream file-field source fix is already represented by PocketBun's JavaScript null handling.
  Evidence: `FileField.toSliceValue` returns an empty array for `null` and recursively ignores null array entries, which matches the new Go checks for nil `*filesystem.File` values. Only the corresponding nested-null regression case is missing from the ported test.
- Observation: The SQLite dependency bump is Go-runtime-specific.
  Evidence: PocketBun uses Bun's `bun:sqlite`, not `modernc.org/sqlite`, so no package dependency maps to the upstream `go.mod`, `go.sum`, or `modernc_versions_check.go` edits.
- Observation: Rebuilding from the unchanged pinned docs snapshot produced unrelated generated-output drift.
  Evidence: `docs/users/extend.md` lost PocketBun-only hook-bundling guidance and changed unrelated casing even though `pocketbase_site_ref.txt` did not change. Those two generated files were restored to their pre-run state; `bun run docs:check` still passes with the scoped version metadata update.

## Decision Log

- Decision: Port the upstream command panic change by allowing rejected command promises to propagate from `PocketBase.Execute`, while preserving the existing return path for ordinary `Error` values returned by commands.
  Rationale: In PocketBun a thrown or rejected JavaScript error is the equivalent of an upstream panic. Returning it as a normal command error is the auto-recovery behavior that v0.39.10 deliberately reverted.
  Date/Author: 2026-07-30 / Codex
- Decision: Add the upstream nested nil-file scenario as `[null, f1]` without changing `FileField.toSliceValue`.
  Rationale: JavaScript has no distinct typed nil pointer. The existing shared null branch already produces the new upstream behavior, and a focused regression test proves it without redundant code.
  Date/Author: 2026-07-30 / Codex
- Decision: Work directly on clean `master`, create no branch, and leave every change uncommitted.
  Rationale: The repository uses trunk-based development and the automation explicitly requests review before commit.
  Date/Author: 2026-07-30 / Codex

## Outcomes & Retrospective

PocketBun now targets PocketBase v0.39.10 as `0.39.10-pocketbun.0`. The vendored Admin UI exactly matches the new release and includes its logs-chart loading and layout improvements. Unexpected command callback throws now reject `PocketBase.execute()` instead of being converted into ordinary returned command errors, while deliberately returned command errors preserve their existing API. The upstream nil file-pointer behavior required no production change because JavaScript null values were already ignored; the ported regression test now pins nested null handling.

No dependency or public signature was added. PocketBase's `modernc.org/sqlite` update is Go-specific because PocketBun uses `bun:sqlite`. The complete gate passed 1,897 tests across 242 files with zero failures, 10,086 assertions, and seven snapshots. Formatting, application and package typechecks, lint, generated docs checks, version checks, vendored-asset parity, and whitespace checks all passed. The mapping audit still reports only four pre-existing `plugins/ghupdate` gaps. The final Ponytail review found no unnecessary abstraction or code to remove. Changes remain uncommitted on `master` for review.

## Context and Orientation

PocketBun is a Bun-native TypeScript port of PocketBase. `pocketbase_tag.txt` pins the upstream release. `package.json` uses the matching version with a `-pocketbun.0` suffix, and `docs/_data/pocketbun.yml` mirrors that package version. `CHANGELOG.md` records user-visible compatibility changes.

The PocketBun application wrapper is `src/pocketbase.ts`. Its `PocketBase.Execute` method bootstraps the app, starts the selected root command, waits for command completion or a termination signal, triggers termination hooks, and returns ordinary command errors. `src/pocketbase.test.ts` pins this behavior. PocketBase v0.39.10 removes a panic-recovering goroutine wrapper around root command execution so a panic once again terminates with a non-zero status. In JavaScript, an unexpected callback throw or rejected promise is the corresponding failure mode.

File normalization lives in `src/core/field_file.ts`, with the ported upstream tests adjacent in `src/core/field_file.test.ts`. A JavaScript `null` represents both an untyped nil and a nil pointer for this boundary. The current recursive normalization already discards null values.

The compiled PocketBase Admin UI is vendored unchanged in `vendor/pocketbase-admin-ui/dist`. Running `bun run upstream:sync` checks out the tag from `pocketbase_tag.txt`, replaces the vendored distribution with `.upstream/pocketbase/ui/dist`, stages the generated asset changes, and removes only the upstream checkout's Git metadata. `.upstream/pocketbase` is ignored and read-only reference material.

## Plan of Work

First, set `pocketbase_tag.txt` to `v0.39.10`, set `package.json` and generated docs metadata to `0.39.10-pocketbun.0`, and add a dated changelog section linked to the upstream v0.39.10 notes and commit `0a74d2f2`. Run `bun run upstream:sync` to refresh both the ignored source reference and the exact compiled Admin UI.

Second, minimally adjust `PocketBase.Execute` in `src/pocketbase.ts` so a rejection from `rootCmd.execute()` rejects the enclosing execution instead of being assigned to `commandErr`. Keep signal listener cleanup reliable and retain the termination hook path for normal command completion and external termination. Add an adjacent test proving returned command errors remain returned and thrown command failures reject.

Third, port the new file-field nil-pointer scenario into `src/core/field_file.test.ts` as an array containing `null` followed by a real file. Do not edit `src/core/field_file.ts` unless the test reveals a mismatch, because its shared null handling already matches upstream.

Finally, run focused tests and the full repository gate. Verify the vendored Admin UI byte-for-byte against the synchronized upstream checkout, run the mapping audit, review every changed file, and apply the Ponytail review format to the final diff. Leave the tree uncommitted.

## Concrete Steps

Work from `/Users/pekeler/Projects/pocketbun`.

1. Edit `.agents/EXECPLAN.md`, `pocketbase_tag.txt`, `package.json`, and `CHANGELOG.md` with `apply_patch`; regenerate docs metadata with `bun run docs:version`.
2. Run `bun run upstream:sync` and inspect the v0.39.9 to v0.39.10 source and vendored asset changes.
3. Edit `src/pocketbase.ts`, `src/pocketbase.test.ts`, and `src/core/field_file.test.ts` with `apply_patch`.
4. Run `bun test src/pocketbase.test.ts src/core/field_file.test.ts` and expect every case to pass.
5. Run `bun run upstream:audit` and compare `vendor/pocketbase-admin-ui/dist` with `.upstream/pocketbase/ui/dist`.
6. Run `bun run format:fix`, `bun test --concurrent`, `bun run typecheck`, `bun run typecheck:package`, and `bun run lint`.
7. Run `bun run check:versions`, `bun run docs:check`, `git diff --check`, and inspect the complete uncommitted diff.

## Validation and Acceptance

The upgrade is accepted when `pocketbase_tag.txt` contains `v0.39.10`; package and docs metadata contain `0.39.10-pocketbun.0`; the changelog names v0.39.10 and upstream commit `0a74d2f2`; and the vendored Admin UI exactly matches upstream v0.39.10. A focused command test must show that a returned `Error` remains the resolved `PocketBase.execute()` result while a thrown error rejects. The file-field test must show that `[null, file]` serializes exactly like `[file]`.

All required format, concurrent test, application and package typecheck, and lint commands must exit zero without warnings. Repository-specific mapping, version, docs, asset parity, and whitespace checks must pass or any pre-existing mapping exceptions must be explicitly identified. No commit or branch may be created.

## Idempotence and Recovery

`bun run upstream:sync` is safe to rerun after setting the tag and deterministically replaces only the ignored upstream checkout plus the vendored Admin UI distribution. Version and docs generation are deterministic. Preserve user changes and never use reset or checkout to discard work. If a validation step fails, repair only the scoped compatibility change and rerun the stable command.

## Artifacts and Notes

Initial state:

    Branch: master, clean and aligned with origin/master
    PocketBase pin: v0.39.9
    PocketBun version: 0.39.9-pocketbun.0
    Current commit: 059c624c Upgrade PocketBase compatibility to v0.39.9

Release evidence:

    PocketBase release: v0.39.10
    Release commit: 0a74d2f25d6decfc9bd0fc64656ec431f23bf610
    Published: 2026-07-30T04:19:15Z
    Tag range: 7 commits, 23 changed paths

Focused validation evidence:

    21 pass, 0 fail, 255 assertions — bun test src/pocketbase.test.ts src/core/field_file.test.ts
    no differences — diff -qr .upstream/pocketbase/ui/dist vendor/pocketbase-admin-ui/dist

Final validation evidence:

    1897 pass, 0 fail, 10086 assertions, 7 snapshots — bun test --concurrent
    pass — bun run format:fix
    pass — bun run typecheck
    pass — bun run typecheck:package
    pass — bun run lint (0 warnings, 0 errors across 588 files)
    pass — bun run check:versions
    pass — bun run docs:check
    pass — git diff --check and staged diff check
    pass — vendored Admin UI parity
    known only — upstream mapping audit reports the four pre-existing plugins/ghupdate gaps

## Interfaces and Dependencies

No new package is allowed or needed. Keep `PocketBase.Execute(): Promise<Error | null>` and its lower-camel alias signature unchanged: a thrown callback is represented by promise rejection, while ordinary command failures continue to resolve to `Error`. Keep `FileField` public methods unchanged. Continue using Bun's native SQLite implementation; the modernc dependency remains an upstream-only implementation detail.

Revision note, 2026-07-30 / Codex: Replaced the completed v0.39.9 plan with a self-contained v0.39.10 compatibility plan after confirming the live release and mapping all upstream changes.

Revision note, 2026-07-30 / Codex: Closed the plan with the implemented CLI, file-field, UI, version, and changelog updates; full validation evidence; docs-rebuild drift handling; Ponytail review; and the requested uncommitted state.
