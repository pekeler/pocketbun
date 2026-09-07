# Upgrade PocketBun to PocketBase v0.40.3

This living plan follows `.agents/PLANS.md`.

## Purpose / Big Picture

Match PocketBase v0.40.3 fixes for nested relation deletion, partial indexes, JSON validation, field-picker errors, and body limits. Refresh upstream Admin UI and JSVM declarations.

## Progress

- [x] (2026-09-07) Verified release and synced upstream 5684ee24 and UI.
- [x] (2026-09-07 08:14Z) Ported applicable behavior and regression cases.
- [x] (2026-09-07 08:14Z) All 1,987 tests and full checks pass; Ponytail review complete; changes uncommitted.

## Surprises & Discoveries

The sync script removes upstream .git and stages UI assets. Bun already accepts legacy duplicate JSON keys on output, but validation needs an extra duplicate-name/number check. The upstream generated declaration file contains project-specific casing and API deltas, so only the applicable PocketBase interface and maxBytesReader changes were ported. The runtime contract audit and an actual TypeScript interface-extension check pass. The health proxy header spelling was already correct. Initial sandbox-only OIDC failures were resolved by running integration tests with localhost access.

## Decision Log

Use native JSON and existing request rebind helpers with minimal additional guards. No dependencies. User explicitly requires no commit.

## Context and Orientation

Work in /Users/pekeler/Projects/pocketbun. pocketbase_tag.txt pins upstream; package.json encodes the matching version. Reference source is .upstream/pocketbase. Cascade logic lives in src/core/base.ts; JSON validation in src/core/field_json.ts; picker/router under src/tools; body guards under src/apis. Never edit upstream; copy UI and generated declarations from it.

## Plan of Work

Milestone 1 ports index regex, geodistance clamp, picker errors, fresh-record cascade batching, bounded body reads, JSON validation, OIDC error text, health header spelling, and migration serialization simplification. Add tests in corresponding existing test files. Milestone 2 updates package/docs versions, generated declarations and Unreleased changelog, then qualifies the complete diff.

## Concrete Steps

Run bun run upstream:sync, focused bun test --concurrent paths, bun run docs:version, bun run format:fix, bun test --concurrent, bun run typecheck, bun run lint, bun run check:versions, bun run docs:check, and bun run typecheck:package. Compare vendor to upstream UI with diff -qr.

## Validation and Acceptance

Tests demonstrate fresh-record nested cascades, zero distance for identical rounding-edge coordinates, parenthesized WHERE indexes, duplicate-key rejection and readable legacy output, original-data fallback for broken modifiers, and no reads after body overflow. All checks pass without warnings. No commit or publication.

## Idempotence and Recovery

Regeneration and checks can be repeated. Initial worktree was clean. Leave code for review and unstage automation-owned vendor changes before delivery. No application data changes.

## Artifacts and Notes

Release: https://github.com/pocketbase/pocketbase/releases/tag/v0.40.3, commit 5684ee24.

## Interfaces and Dependencies

Reuse Bun/Web APIs, SQL query builder and existing error conventions. No new dependencies or public configuration.

## Outcomes & Retrospective

Upgraded to 0.40.3-pocketbun.0. All 1,987 tests pass (251 files, 7 snapshots), with formatting, typecheck, lint, versions, docs parity, package build/types, and whitespace checks passing. Vendored UI matches upstream exactly. Ponytail review replaced manual chunk copying with native Blob and found no remaining unnecessary complexity. No dependencies added; no commit created. Cascade batches now select only IDs and fetch current records before changes; body reads stop at overflow and JSON validation uses a linear token scan.

Revision: Created 2026-09-07 for the newly released upstream patch.

Revision: Completed 2026-09-07 08:14Z; all qualification gates pass and owner review is next.
