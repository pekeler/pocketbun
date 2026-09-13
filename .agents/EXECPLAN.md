# Upgrade PocketBase compatibility to v0.40.4

This living plan follows `.agents/PLANS.md`. Work on master without committing.

## Purpose / Big Picture

Expose `app.clearBootstrap()` and `onBootstrapClear` so custom resources and queued logs are cleaned before shutdown or rebootstrap. Preserve non-blocking log writes during migrations. Target upstream v0.40.4 (5cec579d), package 0.40.4-pocketbun.0.

## Progress

- [x] (2026-09-13) Read automation memory, confirmed release, synced upstream and UI, compared upstream changes, wrote initial lifecycle port.
- [x] (2026-09-13) Added lifecycle, cron, JSVM, and upstream logging regressions; all pass.
- [x] (2026-09-13) Completed all validation and Ponytail review; no commit created.

## Surprises & Discoveries

The sync script removes upstream Git metadata; `/tmp/pocketbase-upstream-check.git` holds comparison history. PocketBun already offloads logs to a worker. The new cleanup must await that worker before closing databases.

## Decision Log

Preserve local JSVM declarations and apply semantic upstream changes, avoiding upstream's unrelated randomized aliases and namespace reordering. Cleanup returns a Promise when asynchronous work requires it and otherwise completes synchronously. All internal callers await it. Preserve the upstream BlockKey opt-in for awaiting log writes and avoid waiting when a cleanup hook runs manually inside an auxiliary transaction. No new dependencies. The user prohibits commits.

## Outcomes & Retrospective

Upgraded to 0.40.4-pocketbun.0. Full rerun: 1,990 pass, 0 fail, 7 snapshots across 251 files. Final focused cleanup/logger run: 24 pass. Format, typecheck, lint (zero warnings/errors), version/docs checks, package build/types, UI equality, and staged/unstaged diff checks pass. Ponytail review: lean already; no complexity findings or new dependencies. Added work occurs at cleanup and once per log batch, with no new per-request work. Ready for owner review; no commit created.

## Context and Orientation

`src/core/base.ts` owns bootstrap, logs, and hooks; `src/core/app.ts` declares its API. `src/pocketbase.ts` and `src/tests/app.ts` terminate apps. JSVM reflects app hook methods and declares them in `src/plugins/jsvm/internal/types/generated/types.d.ts`. `src/core/base.test.ts` ports upstream base tests. UI assets in `vendor/pocketbase-admin-ui/dist` must equal `.upstream/pocketbase/ui/dist`.

## Plan of Work

First route bootstrap, restart, and termination through the cleanup hook, moving cron stop and log flushing there. Preserve hook errors and propagation control. Then add idle cleanup, aliases, async/error hooks, queued log persistence across rebootstrap, and auxiliary transaction log batch tests. Finally review the complete diff with Ponytail and run all checks.

## Concrete Steps

Work in `/Users/pekeler/Projects/pocketbun`. Run `bun run format:fix`, `bun test --concurrent`, `bun run typecheck`, `bun run lint`, `bun run check:versions`, `bun run docs:check`, and `bun run typecheck:package`. Inspect both `git diff` and `git diff --cached` because the sync script stages UI files.

## Validation and Acceptance

All commands must pass without warnings. Hooks must run only for bootstrapped apps, support async cleanup, stop propagation, and report errors. Queued logs must survive rebootstrap, and batches inside auxiliary transactions must finish without deadlock. JSVM lowercase cleanup APIs must work. No commit is created.

## Idempotence and Recovery

Tests use temporary directories and checks are repeatable. Initial working tree was clean; preserve later user changes. Do not edit upstream files. Repeat sync only if UI needs copying again.

## Artifacts and Notes

Release: https://github.com/pocketbase/pocketbase/releases/tag/v0.40.4
Comparison: `git --git-dir=/tmp/pocketbase-upstream-check.git diff v0.40.3 v0.40.4`.

## Interfaces and Dependencies

Add `clearBootstrap(): void | Promise<void>`, `ClearBootstrap()` alias, and `onBootstrapClear()`/`OnBootstrapClear()` returning `Hook<BootstrapEvent>`. Keep `resetBootstrapState()` as the deprecated alias. Use existing hooks, logger worker, and native Promises.

Created 2026-09-13 to document the upstream lifecycle changes and their acceptance tests.

Completed 2026-09-13: removed the upstream-deleted closer declaration after parity testing, retained existing docs content when regeneration attempted unrelated changes, and verified the final diff. The first sandboxed HTTP tests could not open listeners; the approved full runs passed with local network access.

Owner approval: 2026-09-13T15:16:24.193704+00:00. The owner approved committing the reviewed upgrade; this supersedes the earlier no-commit instruction. All recorded validation remains applicable; source code is unchanged since review.
