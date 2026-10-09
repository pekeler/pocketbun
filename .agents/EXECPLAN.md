# Upgrade PocketBase compatibility to v0.40.5

This living plan follows `.agents/PLANS.md`.

## Purpose / Big Picture

Upgrade from v0.40.4 to v0.40.5 (6f370ea7). Users gain corrected CORS origin matching, migration stack traces, a removable UI extension hook, and upstream UI fixes. Leave changes uncommitted.

## Progress

- [x] (2026-10-09 08:03Z) Checked release and clean master; synced upstream/UI and compared changed files.
- [x] Ported CORS matching, SafeWrap and migration wrapping, mail typo, package version.
- [x] (2026-10-09 08:08Z) Finished UI hook, comments/declarations and regression tests.
- [x] (2026-10-09 08:08Z) Updated docs/changelog; all 2,018 tests, 7 snapshots, format, typecheck, lint, package build/types, version/docs, UI equality and diff checks pass.
- [x] (2026-10-09 08:08Z) Ponytail review completed; no remaining findings. Changes uncommitted for owner review.

## Surprises & Discoveries

Sync deletes upstream Git metadata and stages UI. Old source is at `/tmp/pocketbase-v0.40.4-upstream-check`. Generated declaration changes mostly reorder namespaces and aliases. Bun already normalizes negative pool lengths. Local regex wildcard conversion retains an erroneous escape; fix it for upstream compatibility.

## Decision Log

- Preserve Bun dependencies: Go HTTP and modernc updates do not apply. Preserve local declaration adaptations. Date: 2026-10-09.
- Add upstream SafeWrap and adapt returned errors to the existing throwing migration runner. Date: 2026-10-09.

## Context and Orientation

`pocketbase_tag.txt` pins upstream and `package.json` sets package version. `src/apis/middlewares_cors.ts` validates request origins. `src/plugins/jsvm/jsvm.ts` registers migration callbacks; `src/core/migrations_runner.ts` catches throws and names files. `src/apis/base.ts` installs defaults; `src/apis/serve.ts` currently installs extension routes after hooks. Upstream instead uses a named late hook. Vendored UI must exactly match upstream.

## Plan of Work

Port exactWildcardMatch and all upstream test scenarios, fix regex fallback, and backfill upstream comments. Add SafeWrap tests and JS migration rollback/error tests. Install UI extensions through the named hook and test removal. Fix mail typo. Update package/docs version and Unreleased changelog.

## Concrete Steps

Work in `/Users/pekeler/Projects/pocketbun`. Run focused Bun tests, then `bun run format:fix`, `bun test --concurrent`, `bun run typecheck`, `bun run lint`, `bun run check:versions`, `bun run docs:check`, and `bun run typecheck:package`. Run `diff -qr vendor/pocketbase-admin-ui/dist .upstream/pocketbase/ui/dist` and review source diffs with Ponytail.

## Validation and Acceptance

Checks pass without warnings. CORS rejects mismatched fixed labels and supports wildcard fallback. Failed migration callbacks include filenames and bounded stacks, and roll back transactions. Named UI hook removal suppresses extension routes. Version is 0.40.5-pocketbun.0 and UI matches upstream.

## Idempotence and Recovery

No user data changes; tests use temporary databases. Initial tree was clean. Re-running sync restores pinned UI. Review changes with git diff HEAD. Never edit upstream or commit this task.

## Artifacts and Notes

Release: https://github.com/pocketbase/pocketbase/releases/tag/v0.40.5 . Commit: 6f370ea7.

## Interfaces and Dependencies

Retain Bun dependencies and existing public APIs. SafeWrap returns errors; migration callbacks remain synchronous for transactional execution.

## Outcomes & Retrospective

Completed compatibility upgrade to 0.40.5-pocketbun.0. Regression coverage includes all upstream CORS scenarios, middleware wildcard fallback, SafeWrap regular errors and byte-bounded stacks, synchronous/asynchronous migration registration, empty callbacks, failed migration filenames and rollback, and named UI hook removal.

Ponytail review traced affected callers and transactions for ordinary and multi-worker serving. Limited stack encoding allocations before UTF-8 conversion; no remaining correctness, safety, load, or complexity findings. Runtime negative-pool probe confirms existing behavior. Go dependency changes, Go SQL scan documentation, generated alias renames and namespace reorderings do not require Bun changes. No manual browser UI interaction or upstream executable comparison was performed; vendored UI matches upstream byte-for-byte.

Initial sandboxed suite failed because local listeners were blocked. The permitted full rerun passed 2,018 tests with zero failures and 7 snapshots in 113.24 seconds. All other checks passed without warnings. UI assets are staged by the sync script; source changes remain unstaged. No commit created.

Created 2026-10-09 after upstream comparison.

Updated 2026-10-09 08:08Z with completed review and validation evidence.
