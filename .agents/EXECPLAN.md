# Lower-camel public package API aliases

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. This document follows `.agents/PLANS.md`.

## Purpose / Big Picture

PocketBun users should see TypeScript-style lower-camel names in public JavaScript and TypeScript examples, while existing released code that imports or calls Go-style exported names continues to run. After this change, package embedders can import helpers such as `newPocketBase`, `registerServerJSAsync`, `requireGuestOnly`, `serveStatic`, `registerMigrateCmd`, and `templateLangJS`, and can call lower-camel command/app helpers when wiring custom CLIs. Existing names such as `New`, `RegisterServerJSAsync`, `RequireGuestOnly`, `Static`, `RegisterMigrateCmd`, `TemplateLangJS`, `RootCmd`, and `Start()` remain available as deprecated compatibility aliases.

## Progress

- [x] (2026-06-12T12:36:17Z) Audited the package entrypoint, examples, generated server-side JavaScript declarations, and host-side CLI classes for remaining Go-style public names.
- [x] (2026-06-12T12:48:00Z) Added lower-camel package exports, `PocketBase` launcher aliases, `Command`/`FlagSet` aliases, lower-camel config keys, and prototype-level `BaseApp` aliases while preserving old names.
- [x] (2026-06-12T12:52:00Z) Updated public examples, docs, and the `server-js upgrade-source` codemod to prefer lower-camel package names.
- [x] (2026-06-12T12:54:00Z) Cleaned remaining generated declaration comments that showed Go syntax in PocketBase-facing examples.
- [x] (2026-06-12T12:58:00Z) Added regression tests covering preferred aliases, codemod rewrites, command aliases, launcher aliases, and generated comment guards.
- [x] (2026-06-12T13:38:00Z) Ran formatting, full tests, typecheck, lint, and docs checks successfully.

## Surprises & Discoveries

- Observation: The server-side hook and migration examples already use lower-case runtime names, but generated `types.d.ts` comments still include Go-shaped examples for `GeoPointField` and `apis.serve`.
  Evidence: `src/plugins/jsvm/internal/types/generated/types.d.ts` contains `types.GeoPoint{Lat: 123, Lon: 456}` and `apis.ServeConfig{ HttpAddr: ... }`.
- Observation: The package/embedding API has a separate public surface from server-side JavaScript. Its current examples use Go-style names such as `New`, `RootCmd`, `PersistentFlags`, `RegisterMigrateCmd`, `TemplateLangJS`, `Static`, and `Start()`.
  Evidence: `examples/base/main.ts` imports and calls those names.
- Observation: The first focused test run exposed that `version` existed at the package entrypoint but not as a direct `src/pocketbase.ts` export.
  Evidence: `bun test src/public_api_types.test.ts src/tools/cli/command.test.ts src/plugins/jsvm/case_codemod.test.ts src/plugins/jsvm/types_runtime_contract.test.ts src/pocketbase.test.ts --concurrent` failed with `Export named 'version' not found in module '/Users/pekeler/Projects/pocketbun/src/pocketbase.ts'`.
- Observation: `BaseApp` had lower-camel aliases after the initial fix, but the exported `App` interface still forced helper authors back to Go-style names for several app methods.
  Evidence: `src/core/app.ts` declared `CreateBackup`, `RecordQuery`, `Save`, and `RunInTransaction` without matching lower-camel `App` entries.

## Decision Log

- Decision: Keep all previously released Go-style package names as deprecated compatibility aliases.
  Rationale: PocketBun has already released those names, and removing them would break existing embedders. The fix is to provide preferred lower-camel names without forcing an immediate migration.
  Date/Author: 2026-06-12 / Codex.
- Decision: Use descriptive lower-camel names where the exact first-letter lowercase form would be invalid or awkward JavaScript.
  Rationale: `new` is a keyword and `static` is awkward as an import binding. Preferred names such as `newPocketBase` and `serveStatic` communicate intent and avoid syntax traps.
  Date/Author: 2026-06-12 / Codex.
- Decision: Implement `BaseApp` method aliases on the prototype.
  Rationale: Prototype aliases avoid `Proxy`, avoid per-instance allocation, preserve old method implementations, and make package embedders able to call lower-camel app methods outside the server-side JavaScript facade.
  Date/Author: 2026-06-12 / Codex.

## Outcomes & Retrospective

Lower-camel package, `PocketBase`, `Command`, `FlagSet`, `App`, and `BaseApp` aliases are implemented while preserving Go-style compatibility names. Docs, examples, generated declaration comments, and the `server-js upgrade-source` codemod now prefer or rewrite to the lower-camel names. Full validation passed:

    bun run format:fix
    bun run typecheck
    bun run lint
    bun run docs:check
    bun test --concurrent

## Context and Orientation

PocketBun has two JavaScript-facing surfaces. The first is server-side JavaScript loaded from `pb_hooks` and `pb_migrations`; its generated declarations live in `src/plugins/jsvm/internal/types/generated/types.d.ts`, and the runtime bindings are primarily in `src/plugins/jsvm/binds.ts`. That surface should follow PocketBase upstream JSVM lower-camel names.

The second surface is the PocketBun npm package entrypoint in `index.ts` and public classes used by embedders, such as `src/pocketbase.ts`, `src/apis/base.ts`, `src/apis/middlewares.ts`, `src/plugins/jsvm/jsvm.ts`, `src/plugins/migratecmd/migratecmd.ts`, and `src/tools/cli/command.ts`. Because PocketBun was ported from PocketBase Go, this package API still exposes several Go-style exported names. The goal here is not to remove those names, but to add lower-camel preferred aliases and update docs/examples to use them.

## Plan of Work

First, add lower-camel aliases at the package entrypoint in `index.ts`. Aliases must point to the same function object where possible so runtime compatibility tests can use identity checks. Add lower-camel names for server-side JavaScript registration helpers, JSVM bind helpers, migrate command registration, migration template language constants, route middleware exports, the static file handler, archive helpers, registry creation, package version, and PocketBase construction.

Next, add lower-camel runtime aliases on the classes embedders touch directly. In `src/pocketbase.ts`, expose `rootCmd` and `app` as property aliases for `RootCmd` and `App`, add `start()` as an alias for `Start()`, and add `newPocketBase()` / `newPocketBaseWithConfig()` helpers next to `New()` / `NewWithConfig()`. In `src/tools/cli/command.ts`, add lower-camel methods and lower-camel constructor property normalization for `Command` and `FlagSet`, including `addCommand`, `removeCommand`, `persistentFlags`, `flags`, `parseFlags`, `setErr`, `setOut`, `setHelpCommand`, and lower-camel object keys such as `use`, `run`, and `runE`. Keep existing PascalCase fields and methods.

Then update public examples and docs to prefer the lower-camel names. `examples/base/main.ts` and `examples/advanced/main.ts` should import the preferred package names and call lower-camel instance methods. Docs in `docs/users/extend.md` and `docs/users/differences.md` should describe old names as deprecated compatibility aliases. The upgrade-source codemod in `src/plugins/jsvm/case_codemod.ts` should rewrite released package aliases to the new preferred names when it is run against package setup files.

Finally, clean generated declaration comments that still show Go syntax in PocketBase-facing examples, update `docs/users/reference.md` if it mirrors those comments, and add tests. `src/public_api_types.test.ts` should pin the new package aliases and old compatibility identities. `src/plugins/jsvm/case_codemod.test.ts` should cover package setup rewrites. `src/plugins/jsvm/types_runtime_contract.test.ts` should guard the remaining generated comment snippets.

## Concrete Steps

Work from `/Users/pekeler/Projects/pocketbun`.

Run focused checks while editing:

    bun test src/public_api_types.test.ts src/plugins/jsvm/case_codemod.test.ts src/plugins/jsvm/types_runtime_contract.test.ts --concurrent

After all edits, run the required gate:

    bun run format:fix
    bun test --concurrent
    bun run typecheck
    bun run lint
    bun run docs:check

## Validation and Acceptance

The preferred package API is accepted when TypeScript can import and type-check lower-camel names from `pocketbun`, examples use those names, and tests prove old names still point to the same runtime behavior. The generated comment cleanup is accepted when tests fail on stale Go-shaped snippets such as `types.GeoPoint{` and `apis.ServeConfig{` and pass after the cleanup.

## Idempotence and Recovery

All edits are additive except docs/example rewrites and generated comment cleanup. If a test fails, rerun the focused test after the relevant file is fixed. The old Go-style exported names must not be removed during this plan; they are compatibility aliases.

## Artifacts and Notes

Focused validation:

    bun test src/public_api_types.test.ts src/tools/cli/command.test.ts src/plugins/jsvm/case_codemod.test.ts src/plugins/jsvm/types_runtime_contract.test.ts src/pocketbase.test.ts --concurrent
    39 pass, 0 fail

## Interfaces and Dependencies

No new dependencies are required. All runtime aliases should be implemented with ordinary TypeScript exports, methods, and getters. The codemod should continue using TypeScript AST helpers in `src/plugins/jsvm/case_codemod.ts`.
