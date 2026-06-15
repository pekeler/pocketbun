# Bundle Server Hooks for Deployable Artifacts

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. This document follows `.agents/PLANS.md`.

## Purpose / Big Picture

PocketBun currently loads server hook files from `pb_hooks` using Bun's normal module resolution from each hook file. That is correct for development repositories where `node_modules` or workspace links exist above `pb_hooks`, but it is fragile for deploy artifacts that copy only loose hook files and the PocketBun runtime. After this change, a user can bundle server hook entry files into deploy-ready hook files whose statically imported workspace packages, npm packages, local modules, and JSON files are included by Bun's bundler. Users can either run a CLI build command before packaging, or set a registration option that bundles hooks into a generated directory before loading them.

## Progress

- [x] (2026-06-15T11:27:03Z) Read `.agents/PLANS.md`, inspected the current JSVM hook loader in `src/plugins/jsvm/jsvm.ts`, the CLI command shape in `src/cmd/server_js.ts`, current hook loading docs, and existing hook import tests.
- [x] (2026-06-15T11:34:10Z) Added `src/plugins/jsvm/bundler.ts`, which discovers hook entry files, calls `Bun.build`, writes deterministic bundled output, disables environment variable inlining, and fails on unresolved dynamic specifiers.
- [x] (2026-06-15T11:34:10Z) Integrated bundling into `RegisterAsync` through `bundleHooks` and `bundledHooksDir`; synchronous `Register` now returns a clear error if bundling is requested.
- [x] (2026-06-15T11:34:10Z) Added the user-facing `pocketbun hooks build` CLI command and made the main CLI execute it before app startup.
- [x] (2026-06-15T11:34:10Z) Added focused tests proving bundled hooks can import package JSON, then run after the original package tree and loose hooks are removed.
- [x] (2026-06-15T11:34:10Z) Updated docs and `/CHANGELOG.md`.
- [x] (2026-06-15T11:40:56Z) Added dynamic `require(...)` error regression coverage and reran the full project gate successfully: `bun run format:fix`, `bun test --concurrent`, `bun run typecheck`, `bun run lint`, and `git diff --check`.

## Surprises & Discoveries

- Observation: PocketBun already supports normal package imports from hooks when dependencies are present in an ancestor `node_modules`.
  Evidence: `src/plugins/jsvm/jsvm.ts` creates `require` with `createRequire(pathToFileURL(resolvedHookFile))`, and `src/plugins/jsvm/jsvm.test.ts` has a test named `supports dependency imports in .pb.ts hooks`.
- Observation: Bun throws an `AggregateError` for non-static dynamic `require(...)` when `allowUnresolved: []` is set, and the detailed message is stored under the error's `errors` array.
  Evidence: a local probe with `require(moduleName)` produced `AggregateError: Bundle failed` with a `BuildMessage` saying the expression would not be bundled because the argument is not a string literal.

## Decision Log

- Decision: Implement bundling with Bun's built-in `Bun.build` rather than adding a new dependency or a custom resolver.
  Rationale: PocketBun is Bun-only, and Bun's bundler already handles TypeScript, JavaScript, package resolution, workspace-linked packages, local modules, and JSON imports. Using it keeps behavior close to what users expect from Bun.
  Date/Author: 2026-06-15 / Codex
- Decision: Preserve current hook loading as the default and make bundling opt-in.
  Rationale: Existing development behavior is already correct and covered by tests. Bundling is a deploy packaging tool and should not change loose hook execution unless explicitly requested.
  Date/Author: 2026-06-15 / Codex
- Decision: Add the CLI as `pocketbun hooks build`.
  Rationale: The feature is a deploy packaging command for hooks rather than a source-upgrade maintenance command, and the user-facing request explicitly proposed this shape. The main CLI detects it before hook registration so it does not accidentally load the current app hooks while building deploy output.
  Date/Author: 2026-06-15 / Codex

## Outcomes & Retrospective

Implementation is complete. The targeted test command `bun test src/plugins/jsvm/bundler.test.ts src/plugins/jsvm/jsvm.test.ts src/cmd/server_js.test.ts --concurrent` passed with 14 tests and 0 failures. The full gate also passed: `bun run format:fix`, `bun test --concurrent` with 1886 passing tests and 0 failures, `bun run typecheck`, `bun run lint`, and `git diff --check`.

## Context and Orientation

The server hook loader lives in `src/plugins/jsvm/jsvm.ts`. A hook entry file is a file in `pb_hooks` whose name matches the hook file pattern, currently `*.pb.js` or `*.pb.ts` by default. The loader reads matching files in sorted filename order and executes them with global PocketBase-compatible bindings such as `routerAdd`, `onBootstrap`, and `$app`. A "bundle" in this plan means a generated JavaScript file emitted by `Bun.build` that includes the code reachable through static `import` and resolvable `require` statements, including JSON and package files. A bundled hook should still be loaded by the existing JSVM loader so that all PocketBun hook globals and event behavior remain unchanged.

The public API is exported from `index.ts`; tests for that exported type surface live in `src/public_api_types.test.ts`. CLI utilities for server-side JavaScript live in `src/cmd/server_js.ts`, with tests in `src/cmd/server_js.test.ts`. User docs for hooks live in `docs/users/extend.md`; compatibility notes live in `docs/users/differences.md`. `/CHANGELOG.md` must be updated before committing any user-facing or developer-relevant change.

## Plan of Work

First, create a small `src/plugins/jsvm/bundler.ts` module. It should expose `bundleServerHooksAsync(options)` and a result type. The options should include `hooksDir`, `outDir`, and optional `hooksFilesPattern`. The function should discover files using the same filename sorting semantics as `jsvm.ts`, then call `Bun.build` once with all matching hook entrypoints. The output format should be ESM targeting Bun, with `splitting` disabled so each generated hook entry is independently loadable from the output directory. The default naming should preserve each hook basename as a `.pb.js` output file so the existing loader finds it. It should return the output file list and throw or return a clear error when Bun reports build failures.

Second, integrate the bundler into `src/plugins/jsvm/jsvm.ts`. Extend `Config` with `BundleHooks` and `bundleHooks`, plus optional `BundledHooksDir` and `bundledHooksDir` if a caller wants to choose the generated location. `normalizeConfig` should map lower-camel and Go-style aliases. `RegisterAsync` should be able to run the bundler before `registerHooksAsync` and then load from the generated directory. The synchronous `Register` cannot call `Bun.build`, which is async, so if `bundleHooks` is true it should return a clear error telling callers to use `registerServerJSAsync`. This preserves the existing synchronous API without pretending to bundle synchronously.

Third, add CLI support in `src/cmd/server_js.ts`. Register `pocketbun hooks build` with flags `--hooksDir`, `--outDir`, and `--hooksFilesPattern`. The command should call `bundleServerHooksAsync`, print a concise success message listing the output directory and bundled file count, and return an error if the build fails. This command gives users an explicit deploy step without requiring code-first registration.

Fourth, add focused tests. In `src/plugins/jsvm/jsvm.test.ts`, create a temporary app layout with `node_modules/@example/common` pointing at or containing a package with `pricing.json`, create `pb_hooks/main.pb.ts` importing that JSON, bundle to `dist/pb_hooks`, remove the original packages and `node_modules`, then register from the bundled output and call the route. In `src/cmd/server_js.test.ts`, add help/output coverage for `pocketbun hooks build` and a small successful build command test. Update `src/public_api_types.test.ts` if any new public types or exports are added.

Fifth, update documentation and changelog. Add a concise hook bundling section to `docs/users/extend.md`, mention the CLI and registration option, and explain that dynamic requires must be statically resolvable or moved behind normal deploy packaging. Add an `Unreleased` changelog entry that describes deployable bundled hooks from the user's perspective.

## Concrete Steps

Work from `/Users/pekeler/Projects/pocketbun`.

1. Add `src/plugins/jsvm/bundler.ts`.
2. Edit `src/plugins/jsvm/jsvm.ts` to add opt-in bundle config and async loading integration.
3. Edit `src/cmd/server_js.ts` to add `pocketbun hooks build`.
4. Edit tests in `src/plugins/jsvm/jsvm.test.ts` and `src/cmd/server_js.test.ts`.
5. Edit docs in `docs/users/extend.md`, `docs/users/differences.md` if needed, and `/CHANGELOG.md`.
6. Run targeted tests:

        bun test src/plugins/jsvm/jsvm.test.ts src/cmd/server_js.test.ts --concurrent

7. Run the full required gate:

        bun run format:fix
        bun test --concurrent
        bun run typecheck
        bun run lint

## Validation and Acceptance

The feature is accepted when a test creates this layout:

    app/
      package.json
      node_modules/@example/common
      packages/common/pricing.json
      pb_hooks/main.pb.ts

The hook imports `@example/common/pricing.json`, the bundler writes a deploy hook under `dist/pb_hooks`, the original workspace package tree is removed, and `registerServerJSAsync` can still load the bundled hook and serve a route returning the expected pricing count. Existing hook tests for loose `.pb.ts` imports and dependency imports must continue to pass, proving dev behavior is unchanged. The CLI help must show `pocketbun hooks build`, and the CLI build test must create bundled output files.

## Idempotence and Recovery

The bundler writes to an output directory and can be rerun. Tests should use temporary directories and remove only their own temporary paths. If bundling integration breaks loose hook loading, disable the `bundleHooks` branch and rerun existing `jsvm.test.ts` import tests before reintroducing the branch. Do not delete or rewrite unrelated files, and do not revert user changes.

## Artifacts and Notes

Current evidence before implementation:

    src/plugins/jsvm/jsvm.ts creates require from each hook file URL.
    src/plugins/jsvm/jsvm.test.ts already verifies `.pb.ts` can import a dependency from parent node_modules.

Revision note, 2026-06-15 / Codex: Created this plan for the hook bundling feature request and replaced the completed prior ExecPlan so the active plan matches the current task.

Revision note, 2026-06-15 / Codex: Updated progress and decisions after implementing `pocketbun hooks build`, `bundleHooks`, docs, changelog, and focused tests.

Revision note, 2026-06-15 / Codex: Marked validation complete after the full required gate passed.

Revision note, 2026-06-15 / Codex: Added dynamic require error handling notes and updated validation counts after adding `src/plugins/jsvm/bundler.test.ts`.
