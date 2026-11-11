# PocketBase v0.42.0 upgrade

## Purpose and Context

Port published v0.42.0 (787fe1e) from v0.41.1 on master. Invalid authorization must yield 401; logs gain countLogs and disk reclamation; unchanged upstream UI gains JPEG XL previews and provider ordering. Leave uncommitted.

## Progress

- [x] 2026-11-11: Verified HTTPS Atom publication, inspected source diff, bumped version and synced UI.
- [x] Port middleware, log counting/cleanup and filesystem changes; add regression tests.
- [x] Reconcile JSVM types, generated docs, changelog and mapping audit.
- [x] Run full validation and Ponytail review.

## Plan of Work

Port rejection middleware at priority 9999 in src/apis/middlewares.ts and register in src/apis/base.ts. Add CountLogs and countLogs to src/core/log_query.ts, app.ts and base.ts. Count cleanup deletions and vacuum at 20,000, then checkpoint. Port matching upstream tests beside source files. Update filesystem MIME and error wording. Preserve Bun declaration adaptations while incorporating upstream types. Rebuild docs and record compatibility under Unreleased.

## Milestones and Acceptance

First implement behavior: valid/no-token requests succeed, unknown/expired tokens receive 401, countLogs handles null and combined filters, cleanup vacuums at threshold. Then reconcile generated assets and documentation. Finally run bun run format:fix, bun test --concurrent, bun run typecheck, bun run lint, bun run check:versions, bun run typecheck:package and UI equality checks. Review using Ponytail and fix findings.

## Surprises & Discoveries

Atom titles end in " release". Maintenance channel v0.22.59 is not the highest release. Cron Go race is inapplicable to native Bun cron; hashing already uses native hex. Binary updater is not ported.

## Decision Log

Keep native Bun adaptations, no new dependencies, no commits. Source reference: /tmp/pocketbase-upgrade-042, git diff v0.41.1 v0.42.0.

## Recovery and Artifacts

Initial working tree clean. Sync and docs commands are repeatable. Review diff before reverting files. Run bun run upstream:audit and capture gaps here.

## Outcomes & Retrospective

Completed 2026-11-11. Full suite: 2045 pass, zero failures, seven snapshots. Format, typecheck, lint (zero warnings), version alignment, docs parity, package build/types and diff checks pass. Mapping audit: zero missing source/test files. Vendored UI equals upstream. Ponytail review traced authentication ordering/custom auth, log query aliases and JSVM forwarding, cleanup threshold/reset, benign error logging and filesystem MIME handling; no remaining findings. Added regression checks for these behaviors. No dependencies added. Authentication adds only a late header check; log count scans run on the six-hour cleanup schedule. Native hash and cron implementations need no change. Generated declaration namespace reorder/random names were excluded; both CountLogs declarations added while preserving Bun adaptations. Docs snapshot remains pinned; rebuild changes version metadata only. Initial sandbox test run could not bind ports; full authorized rerun outside sandbox passed. No commits created; UI sync stages assets by design.

Plan completed after validation and review on 2026-11-11.
