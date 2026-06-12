# Replace Generic JSVM Facades With Direct Compatibility Aliases

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. This document follows `.agents/PLANS.md`.

## Purpose / Big Picture

PocketBun exposes a server-side JavaScript runtime, called JSVM in the PocketBase codebase, for hooks, routes, and migrations. PocketBase's JSVM public API uses lower-camel names such as `record.getString(...)`, while much of PocketBun's core TypeScript port intentionally mirrors upstream Go names such as `Record.GetString(...)`. The current binding layer bridges that gap with a generic facade system that recursively wraps arbitrary objects and synthesizes lower-camel aliases at runtime.

That generic facade system caused a serious bug: a field setter function returned from `Field.FindSetter(...)` was wrapped into a non-callable object, so `new Record(collection, data)` and `record.set(...)` could throw in hooks. After this change, JSVM-exposed core objects should carry their compatibility aliases directly or be wrapped by narrow semantic adapters only where behavior genuinely differs. Users should still be able to use PocketBase-compatible server-side JavaScript, and the Admin UI should continue to work through the REST API and static asset paths.

## Progress

- [x] (2026-06-12T15:46:17Z) Read `.agents/PLANS.md`, inspected `src/plugins/jsvm/binds.ts`, `src/plugins/jsvm/binds.test.ts`, and `src/plugins/jsvm/types_runtime_contract.test.ts`.
- [x] (2026-06-12T15:46:17Z) Confirmed the current working tree already contains the narrow setter-panic fix in `CHANGELOG.md`, `src/plugins/jsvm/binds.ts`, and `src/plugins/jsvm/binds.test.ts`.
- [x] (2026-06-12T16:34:12Z) Replaced broad generic wrapping for ordinary core return values with direct aliases and explicit narrow adapters.
- [x] (2026-06-12T16:34:12Z) Added and adjusted regression tests that prove JSVM runtime contracts remain intact without generic object facades.
- [x] (2026-06-12T16:34:12Z) Ran targeted JSVM bind and generated type contract tests successfully: `bun test src/plugins/jsvm/binds.test.ts src/plugins/jsvm/types_runtime_contract.test.ts --concurrent`.
- [x] (2026-06-12T16:58:42Z) Ran `bun run format:fix`, `bun test --concurrent`, `bun run typecheck`, and `bun run lint` successfully.

## Surprises & Discoveries

- Observation: `src/core/base.ts` already declares many lower-camel aliases on `BaseApp` and `App`, so the generic facade is not the only source of JSVM-style names.
  Evidence: `src/core/base.ts` has declarations such as `declare runInTransaction: BaseApp["RunInTransaction"];`, `declare save: BaseApp["Save"];`, and a method alias table near the end of the file.
- Observation: The generated JSVM runtime contract test is the primary safety net for server-side JavaScript method/property shape.
  Evidence: `src/plugins/jsvm/types_runtime_contract.test.ts` creates real values such as records, collections, fields, hooks, forms, errors, and request events, then checks that every generated interface member exists at runtime.
- Observation: Validation errors have an unavoidable JavaScript name collision between internal `Error.message`/`code` properties and upstream JSVM `message()`/`code()` methods.
  Evidence: The generated `ozzo_validation.Error` interface requires `error()`, `code()`, `message()`, and `params()` methods, while `src/internal/compat/validation.ts` keeps property-style fields for internal compatibility.

## Decision Log

- Decision: Keep explicit app and event adapters while removing generic wrapping for ordinary object values.
  Rationale: App values need semantic differences such as sync `save(...)` and transaction callback wrapping; route events need request adapters for PocketBase-style request access. Ordinary records, collections, fields, dates, forms, and errors should not need reflective recursive facade wrapping.
  Date/Author: 2026-06-12 / Codex
- Decision: Validate Admin UI compatibility through the existing full test suite, including API and e2e smoke tests, rather than adding a JSVM-specific Admin UI test.
  Rationale: The Admin UI is a static frontend that depends on REST routes, JSON shapes, auth, files, and static serving. This refactor targets server-side JavaScript object exposure; existing API and e2e tests are the relevant regression coverage for Admin UI behavior.
  Date/Author: 2026-06-12 / Codex
- Decision: Keep `ValidationError` as an explicit bind adapter while leaving the internal validation helper shape unchanged.
  Rationale: A single JavaScript value cannot expose both a string `message` property and a callable `message()` method. The JSVM constructor needs the upstream method shape, while internal code and tests still use property-style validation errors.
  Date/Author: 2026-06-12 / Codex

## Outcomes & Retrospective

Implementation is complete. The final full gate passed: `bun run format:fix`, `bun test --concurrent` with 1881 passing tests, `bun run typecheck`, `bun run lint`, and `git diff --check`.

## Context and Orientation

The main file is `src/plugins/jsvm/binds.ts`. It creates the globals available to PocketBase-compatible server-side JavaScript. The functions `baseBinds`, `appBinds`, `formsBinds`, `apisBinds`, `routerBinds`, and related helpers populate a JavaScript scope with constructors and namespaces such as `Record`, `$app`, `$apis`, and router helpers.

The problematic layer starts around `wrapBoundValueInternal` in `src/plugins/jsvm/binds.ts`. It currently takes nearly any object returned by a bind method and builds an object facade with lower-camel aliases using `defineFacadeMembers`. A facade is an object that forwards properties and methods to an underlying target object. This is fragile because not every JavaScript value can be safely represented by a plain object facade. Functions must remain callable, and objects with private fields, such as `DateTime`, must run their methods on the real object, not on a facade.

The compatibility tests live in `src/plugins/jsvm/binds.test.ts` and `src/plugins/jsvm/types_runtime_contract.test.ts`. The full project test suite also covers REST API behavior used by the vendored Admin UI.

## Plan of Work

First, narrow `wrapBoundValueInternal` so it no longer recursively facades arbitrary non-app objects. It should preserve raw values by default. It may still dispatch app-like values to `wrapApp`, and error wrapping may remain explicit where the bind constructors need non-native error shape.

Second, update constructors and factories in `baseBinds`, `formsBinds`, and `apisBinds` so they return raw instances when those instances already expose the generated JSVM members directly. For classes that do not yet expose direct lower-camel aliases, add small, commented alias blocks to the owning class or to the bind-specific class when the class only exists for JSVM binding. Keep Go-style methods and names intact for upstream traceability.

Third, keep `wrapApp` and `wrapEvent` focused on semantic adaptation. `wrapApp` should continue to provide JSVM-safe sync `save(...)`, `delete(...)`, `importCollections(...)`, and `runInTransaction(...)` behavior. `wrapEvent` should continue to adapt route requests and event values that do not have direct JSVM-compatible request APIs.

Fourth, run the targeted JSVM tests and then the full verification commands required by `AGENTS.md`.

## Concrete Steps

Work from `/Users/pekeler/Projects/pocketbun`.

1. Edit `src/plugins/jsvm/binds.ts`.
2. If runtime contract tests report missing concrete methods or properties, add direct aliases to the appropriate source files. Prefer existing patterns such as `getString(...) { return this.GetString(...); }`.
3. Run targeted tests:

        bun test src/plugins/jsvm/binds.test.ts src/plugins/jsvm/types_runtime_contract.test.ts --concurrent

4. Run full checks:

        bun run format:fix
        bun test --concurrent
        bun run typecheck
        bun run lint

## Validation and Acceptance

The change is accepted when:

- The regression for `new Record(collection, data)` and `record.set(...)` still passes.
- The generated JSVM runtime contract test passes, proving server-side JavaScript objects still expose the methods and properties described by generated types.
- The full test suite passes, including REST API and e2e smoke tests that protect Admin UI-facing behavior.
- Typecheck and lint pass with no warnings or errors.

## Idempotence and Recovery

All edits are ordinary source changes and can be repeated. If a narrowed wrapper causes widespread missing JSVM names, restore the last known passing shape from `git diff`, add the missing direct aliases in small groups, and rerun the two targeted JSVM test files before continuing. Do not revert unrelated user changes.

## Artifacts and Notes

Before this plan, the exact setter panic was reproduced with a one-line `bun -e` script and then fixed by preserving callable functions and unwrapping `Record` constructor arguments. The full suite passed once with 1881 tests and 0 failures after the narrow bugfix. This plan extends that work by reducing the generic facade system that caused the bug.
