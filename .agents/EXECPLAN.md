# Expose public model constructors

This living plan follows .agents/PLANS.md. Work on master in /Users/pekeler/Projects/pocketbun.

## Purpose / Big Picture

Allow regular Bun programs to import Collection, Record, all fourteen field constructors and collection factories from pocketbun, with the same configuration semantics as server hooks. Keep the existing release process.

## Progress

- [x] (2026-10-31 17:42Z) Reviewed fork, constructors, callers, upstream JSVM behavior, declarations and tests.
- [x] (2026-10-31 17:47Z) Shared and exported constructors; hook Record still unwraps bound arguments.
- [x] (2026-10-31 17:47Z) Added seven model tests, external consumer type regressions, README example and credited Unreleased entry.
- [x] (2026-10-31 17:49Z) Full suite passed: 2,041 tests, 7 snapshots, zero failures or warnings. Formatting, lint, typecheck, package consumer declarations and built-export smoke check all passed; final diff reviewed.

## Surprises & Discoveries

The internal Collection constructor does not initialize auth defaults or viewQuery like the hook constructor does. The reviewed fork exported it directly. The shared wrapper now calls UnmarshalJSON. Explicit JSON fields replace defaults, so the auth regression adds its custom field after constructing the default auth collection, matching existing hook behavior. Public field types derive their lowercase aliases from the runtime alias tables to avoid drift.

## Decision Log

Extract shared public model constructors from bindings, keeping database constructors and binding argument unwrapping unchanged. This avoids divergent behavior. Keep release files unchanged per the clarified recommendation. Date: 2026-10-31.

## Context and Orientation

index.ts is the public entrypoint. src/plugins/jsvm/binds.ts installs hook constructors and exposes bindCore. Core collection_model.ts and record_model.ts also serve database loading. field_jsvm_aliases.ts installs lowercase aliases. scripts/check_package_types.ts tests external consumer declarations. The reviewed fork is at /private/tmp/pocketbun-fork-review.JAbTI0/heisdezz with the same MIT license notice.

## Plan of Work

First adapt the fork's field wrappers in src/core/model_constructors.ts, sharing the existing Collection hook constructor and public Record initialization. Bindings reuse the constructors, factories are exported with JSVM names, and bindCore returns typed model bindings while still mutating its target. Check focused runtime tests and typecheck for this milestone.

Then add src/tests/package_models.test.ts covering auth defaults/password persistence, view queries, fields, collection lifecycle and imported/bound parity. Extend the package consumer fixture, README and Unreleased changelog. Finish with full checks and review.

## Concrete Steps

Run from the repository root:

    bun test --concurrent src/tests/package_models.test.ts src/plugins/jsvm/binds.test.ts src/plugins/jsvm/jsvm.test.ts
    bun run format:fix
    bun test --concurrent
    bun run typecheck
    bun run lint
    bun run typecheck:package

Use bun test --only-failures --concurrent for retries. HTTP tests may need execution outside the network sandbox. All checks should exit successfully without warnings.

## Validation and Acceptance

Imported view collections must preserve their SQL query and save. Auth defaults and password hashing must match hooks. Lowercase field options compile; invalid types and method replacement do not. Published declarations compile for an external consumer. No release changes.

## Idempotence and Recovery

Tests use disposable databases; builds overwrite ignored dist output. Do not publish, push or modify application databases.

## Interfaces and Dependencies

Export Collection, Record, fourteen field constructors and newCollection/newBaseCollection/newAuthCollection/newViewCollection. Return typed model members from bindCore. Use existing dependencies and guarded alias installation; no new request hot-path work.

## Artifacts and Notes

Review reproduced the fork dropping viewQuery. The new regression must exercise it.

## Outcomes & Retrospective

Public model APIs are implemented and shared with hooks, including auth/view constructor parity. Seven focused tests (154 assertions), the full suite (2,041 tests across 256 files, 122.61 seconds), formatting, lint, typecheck, package build, external consumer declarations and built-export smoke check passed without warnings. Runtime performance review found no new request hot-path work; shared wrappers avoid recreating fourteen field classes for each binding target. README and Unreleased notes document the feature and credit heisdezz. Release files, version numbers and application databases were not changed. No release or push was performed. No full throughput benchmark or cross-platform CI run was needed for this constructor-only change.

Plan created 2026-10-31 for the approved API additions and compatibility correction.

Updated 2026-10-31 17:47Z after implementing the constructors and passing focused/runtime type checks; full suite remains in progress.

Updated 2026-10-31 17:49Z with final validation evidence and completed scope. Implementation is ready as one focused commit.
