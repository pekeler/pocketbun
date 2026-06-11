# Remove JSVM Lowercase Name Collisions Before Exposing the Public Hook API

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries, Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.

PLANS.md exists in this repo at .agents/PLANS.md. This ExecPlan must be maintained in accordance with that file.

## Purpose / Big Picture

PocketBase's JavaScript hook runtime, called JSVM in this repository, exposes JavaScript-friendly lowercase method names such as `$app.findRecordsByFilter(...)`, `$app.runInTransaction(...)`, and `record.getString(...)`. PocketBun accidentally made the TypeScript core mostly expose Go-style uppercase method names and also added some lowercase internal helper methods with different semantics. That means directly adding public lowercase JSVM methods could collide with private helper names and silently choose the wrong behavior.

After this change, PocketBun will have no private/internal `App` helper methods whose names collide with the generated JSVM public app method names. Then the JSVM public API can expose lowercase methods consistently while retaining uppercase aliases for users who already wrote hooks against earlier PocketBun releases. A human can see this working by running a hook-style regression test that calls lowercase app, record, and DateTime methods inside a transaction callback; those calls should work and match the generated `types.d.ts` declarations.

## Progress

- [x] (2026-06-11T16:40:24Z) Removed the interrupted quick transaction-proxy patch so this work starts from a clean tree.
- [x] (2026-06-11T16:40:24Z) Replaced the old broad porting ExecPlan with this focused plan.
- [x] (2026-06-11T16:40:24Z) Audited generated JSVM declarations against current runtime/core lowercase methods and identified the dangerous semantic collisions: app lookup helpers and record raw `get`/`getBool`.
- [x] (2026-06-11T16:40:24Z) Renamed internal/private core helpers that collide with JSVM public app method names, updated internal call sites, and ran `bun run typecheck` successfully.
- [x] (2026-06-11T16:40:24Z) Added lowercase public JSVM-compatible app/record aliases for the collision-prone names after the internal helpers were renamed.
- [x] (2026-06-11T16:40:24Z) Added regression tests for lowercase app, record, and DateTime access in `pb_hooks`-style code, including transaction callback `txApp`.
- [x] (2026-06-11T16:40:24Z) Ran the required validation gate: `bun run format:fix`, `bun test --concurrent`, `bun run typecheck`, and `bun run lint`.

## Surprises & Discoveries

- Observation: The broad audit found many lowercase `BaseApp` method names that also appear in generated JSVM declarations, but most are already intended public aliases with matching semantics, such as hook registration methods. The real dangerous app collisions were `findCollectionByNameOrId`, `findRecordById`, `findFirstRecordByFilter`, and `findAuthRecordByToken`.
  Evidence: After the rename audit, those names remain only as public aliases; the nullable helpers are now named `findCollectionByNameOrIdOrNull`, `findRecordByIdOrNull`, `findFirstRecordByFilterOrNull`, and `findAuthRecordByTokenWithTypes`.

- Observation: `Record.get` and `Record.getBool` existed as lowercase raw `#data` accessors even though generated JSVM declarations define `get` and `getBool` as normalized record methods. They now delegate to `Get` and `GetBool`; raw internal access is explicitly named `getRawDataValue` and `getRawDataBool`.
  Evidence: `bun run typecheck` passed after the rename.

## Decision Log

- Decision: Rename internal/private helpers before adding or broadening public lowercase JSVM methods.
  Rationale: Some current lowercase helpers, such as `BaseApp.findCollectionByNameOrId`, are internal nullable helpers, while JSVM's generated public method with the same name should have the upstream `FindCollectionByNameOrId` behavior. Renaming internals first prevents public aliases from accidentally preserving the wrong behavior.
  Date/Author: 2026-06-11 / Codex

- Decision: Keep uppercase methods as backward-compatible aliases after lowercase JSVM names are made available.
  Rationale: PocketBun has already shipped releases where hook authors could use uppercase methods, so removing them would break existing users even though lowercase is the upstream PocketBase JSVM API.
  Date/Author: 2026-06-11 / Codex

## Outcomes & Retrospective

Implemented the safer sequence requested by the repo owner. Internal nullable app helpers no longer occupy generated JSVM public method names, record raw accessors no longer use `get`/`getBool`, and transaction callback `txApp` values are wrapped so lowercase JSVM methods work in the same path where the bug was observed. Uppercase aliases remain available. Validation passed with `bun run format:fix`, `bun test --concurrent` (1848 pass, 0 fail), `bun run typecheck`, and `bun run lint`.

## Context and Orientation

PocketBun is a TypeScript/Bun port of PocketBase. Upstream PocketBase is written in Go, but its JavaScript hooks use lowercase JavaScript-style method names through a Goja field-name mapper. In this repository, `src/plugins/jsvm/internal/types/generated/types.d.ts` is the generated declaration file copied into `pb_data/types.d.ts` for hook authors. That file advertises lowercase methods.

The JSVM runtime binding layer is implemented in `src/plugins/jsvm/binds.ts`. It currently wraps app/event/record values with JavaScript `Proxy` objects that map lowercase property reads back to uppercase TypeScript methods. This proxy approach works for some values, but it is fragile when raw core objects escape the wrapper, such as transaction callback `txApp` values.

The core app interface is declared in `src/core/app.ts` and implemented by `src/core/base.ts`. That implementation currently contains both uppercase PocketBase-port methods, such as `FindCollectionByNameOrId`, and lowercase internal helper methods, such as `findCollectionByNameOrId`, that may have nullable or lower-level behavior. Lowercase helpers with public JSVM names must be renamed before direct public aliases are added.

Record methods live in `src/core/record_model.ts`. The public JSVM declarations include `record.getString(...)`, `record.getDateTime(...)`, and similar lowercase names. DateTime methods live in `src/tools/types/datetime.ts`; this class already has both lowercase and uppercase method forms for many methods.

## Plan of Work

First, run an audit that extracts public method names from `src/plugins/jsvm/internal/types/generated/types.d.ts` and compares them with lowercase method declarations in the core runtime files. The most important type is `App`, because `$app` and transaction callback apps are central to hook code. Record and DateTime should also be checked because they are mentioned by users and commonly returned through app methods.

Second, rename internal `App` helpers that collide with generated JSVM method names and have different semantics. The new names should clearly communicate that they are nullable/internal helpers. For example, `findCollectionByNameOrId` should become something like `findCollectionByNameOrIdOrNull`, and `findRecordById` should become something like `findRecordByIdOrNull`. Update `src/core/app.ts`, `src/core/base.ts`, and every call site found by `rg`.

Third, run focused tests around collection and record lookup behavior to prove the rename did not change internals. Use existing tests that already exercise these helpers, then run typecheck to catch missed call sites.

Fourth, after collisions are removed, expose lowercase JSVM methods in the runtime in a way that matches generated types. If direct aliases are added to core classes, uppercase aliases must remain. If the binding proxy remains part of the solution, transaction callback apps and any other escaped raw values must still be wrapped before hook code sees them.

Fifth, add regression tests in `src/plugins/jsvm/binds.test.ts` that use hook-style lowercase names for app methods, record methods, and DateTime methods. The regression must include `$app.runInTransaction((txApp) => { ... })` because that is the path that exposed the mismatch.

Finally, update `CHANGELOG.md` under `Unreleased` with a concise user-facing note, format the code, and run the full required validation gate.

## Concrete Steps

Work from `/Users/pekeler/Projects/pocketbun`.

Run the audit with small Bun or shell commands that only read the repository. Prefer committing the audit as a temporary local command only if it becomes useful for future maintenance; otherwise keep it as terminal evidence in this plan.

Use `rg` to find call sites before each rename. After editing, run:

    bun run format:fix
    bun test --concurrent
    bun run typecheck
    bun run lint

Focused tests that are expected to be useful before the full gate are:

    bun test src/plugins/jsvm/binds.test.ts --concurrent
    bun test src/core/base.test.ts src/core/record_query.test.ts --concurrent

## Validation and Acceptance

Acceptance requires all of the following:

The generated TypeScript declaration examples are true at runtime in hook-style bindings: `$app.findRecordsByFilter(...)`, `$app.runInTransaction(...)`, `$app.save(...)`, `$app.findCollectionByNameOrId(...)`, `record.getString(...)`, `record.getDateTime(...)`, and `dateTime.isZero()`, `dateTime.before(...)`, `dateTime.after(...)`, `dateTime.compare(...)` all exist and work.

Uppercase aliases such as `$app.FindRecordsByFilter(...)` and `record.GetString(...)` still work for backward compatibility.

Internal nullable helpers no longer occupy public JSVM method names on `BaseApp` or `App`.

The full validation gate passes: `bun run format:fix`, `bun test --concurrent`, `bun run typecheck`, and `bun run lint`.

## Idempotence and Recovery

All planned edits are source-code renames and additive compatibility aliases. Running the audit and test commands repeatedly is safe. If a rename causes many failures, use `git diff` to inspect only the current task's files and adjust call sites rather than reverting unrelated work. Do not use destructive git commands. Because no changes are staged or committed at the start of this plan, recovery is to manually reverse the current task diff with `apply_patch` if needed.

## Artifacts and Notes

The interrupted quick patch was removed before this plan began. `git status --short` was clean at 2026-06-11T16:40:24Z.

## Interfaces and Dependencies

No new runtime dependency is expected. The affected interfaces are:

`src/core/app.ts`: internal nullable helpers should use names that cannot be confused with JSVM public names. Public uppercase compatibility methods stay.

`src/core/base.ts`: implements the renamed internal helpers and any public lowercase JSVM aliases after collisions are removed.

`src/plugins/jsvm/binds.ts`: must continue to provide hook globals and may keep proxy mapping, but it must not let raw transaction apps or returned records lose lowercase JSVM names.

`src/plugins/jsvm/binds.test.ts`: must contain regression coverage for lowercase JSVM names and uppercase compatibility aliases.

Revision note 2026-06-11: Created focused plan after the repo owner rejected a quick proxy-only fix and requested internal renames before public lowercase JSVM API exposure.

Revision note 2026-06-11: Completed the implementation and validation. The plan now records the audit findings, renamed helpers, regression coverage, and full validation results.
