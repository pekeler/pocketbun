# Remove Go Migration Template Generation

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries, Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.

PLANS.md exists in this repo at .agents/PLANS.md. This ExecPlan must be maintained in accordance with that file.

## Purpose / Big Picture

PocketBun runs JavaScript and TypeScript migrations from `pb_migrations`. It should not generate Go migration files, because PocketBun cannot execute them and they are not a useful user-facing surface for this project. After this change, the migrate command will generate JavaScript migrations by default, explicit `TemplateLangGo` configuration will fail fast with a clear error, and the large Go template emitters will be removed from the runtime source and tests.

## Progress

- [x] (2026-06-11T17:25:00Z) Committed the prior JSVM lowercase API fix before starting this separate migration-generation change.
- [x] (2026-06-11T17:25:00Z) Audited `src/plugins/migratecmd` and confirmed that omitted `TemplateLang` currently defaults to Go and that automigrate/create/collections still contain Go template branches.
- [x] (2026-06-11T17:25:00Z) Removed Go template generation code and made JavaScript the only supported output language.
- [x] (2026-06-11T17:25:00Z) Updated tests to assert default `.js` generation and explicit rejection of `TemplateLangGo`.
- [x] (2026-06-11T17:25:00Z) Updated changelog and ran the required validation gate.

## Surprises & Discoveries

- Observation: The public examples already pass `TemplateLangJS`, which hid the fact that the plugin default still points at `TemplateLangGo`.
  Evidence: `examples/base/main.ts` and `examples/advanced/main.ts` configure `TemplateLang: TemplateLangJS`, while `Register` in `src/plugins/migratecmd/migratecmd.ts` defaults missing `TemplateLang` to `TemplateLangGo`.

- Observation: The Go template strings were only used by the migrate command and its tests; there was no runtime path outside `src/plugins/migratecmd`.
  Evidence: After removing the emitters, `rg 'goDiffTemplate|goSnapshotTemplate|package _test_migrations|github.com/pocketbase/pocketbase/migrations' src/plugins/migratecmd` returns no matches.

## Decision Log

- Decision: Keep exporting `TemplateLangGo` as a legacy sentinel, but reject it during registration.
  Rationale: Existing imports get a clear runtime/configuration error instead of silently generating unusable Go migrations. Removing the export entirely can be a later breaking cleanup, but failing fast fixes the user-facing behavior now.
  Date/Author: 2026-06-11 / Codex

- Decision: Remove Go template emitter functions instead of hiding them behind an unreachable branch.
  Rationale: PocketBun should not carry code that generates artifacts it cannot run, and keeping the strings around makes future docs/search audits noisy.
  Date/Author: 2026-06-11 / Codex

## Outcomes & Retrospective

Implemented JS-only migration generation. Missing `TemplateLang` now normalizes to JavaScript, so automigrate produces `.js` files by default under `pb_migrations`. Explicit `TemplateLangGo` remains exported as a legacy sentinel but `Register` rejects it with a clear error. The Go template emitter functions and Go fixture expectations were removed from `src/plugins/migratecmd`. Validation passed with `bun run format:fix`, `bun test --concurrent` (1849 pass, 0 fail), `bun run typecheck`, and `bun run lint`.

## Plan of Work

First, edit `src/plugins/migratecmd/templates.ts` so it only contains JavaScript template emitters plus the legacy `TemplateLangGo` constant and shared unsupported-language error helper.

Second, update `src/plugins/migratecmd/migratecmd.ts` and `src/plugins/migratecmd/automigrate.ts` so omitted `TemplateLang` normalizes to `TemplateLangJS`, unsupported languages return a clear error, and all create/collections/automigrate paths call only JS template functions.

Third, update `src/plugins/migratecmd/migratecmd.test.ts`: remove Go expected template fixtures, collapse JS/Go scenario loops to JS-only assertions, add regression coverage for omitted `TemplateLang` generating `.js`, and add explicit `TemplateLangGo` rejection coverage.

Finally, update `CHANGELOG.md`, run formatting, focused migratecmd tests, typecheck, lint, and the full concurrent test suite.

## Validation and Acceptance

Acceptance requires:

- `MustRegister(app, ..., { Automigrate: true })` with no `TemplateLang` generates `.js` automigration files.
- `Register(app, ..., { TemplateLang: TemplateLangGo })` returns an error explaining that PocketBun only supports JavaScript migration templates.
- No Go migration template emitter functions remain in `src/plugins/migratecmd`.
- Existing JS migration generation tests still pass.
- The full validation gate passes: `bun run format:fix`, `bun test --concurrent`, `bun run typecheck`, and `bun run lint`.

## Idempotence and Recovery

The edits are source-code removals and test expectation updates. Re-running tests is safe. If the migration tests fail, inspect the generated file contents in the test output and adjust only the JS template path; do not restore the Go template path.

## Artifacts and Notes

The prior lowercase JSVM API work is committed as `129df21d` before this plan starts.
