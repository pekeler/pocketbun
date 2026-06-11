# Remove JSVM Proxy Wrappers

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries, Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.

PLANS.md exists in this repo at .agents/PLANS.md. This ExecPlan must be maintained in accordance with that file.

## Purpose / Big Picture

PocketBun exposes PocketBase-compatible JavaScript APIs inside `pb_hooks`. The current bridge makes lower-case JSVM names work by putting `Proxy` objects in front of apps, hook events, route requests, and arbitrary returned objects. A JavaScript `Proxy` runs a trap on every property access and method call, which is the wrong default for hot hook paths. After this change, hook code should still be able to call lower-case JSVM methods such as `$app.findRecordsByFilter(...)`, `record.getString(...)`, and `dateTime.before(...)`, while legacy upper-case aliases continue to work, but the runtime bridge will use explicit cached facades and concrete adapter objects instead of `new Proxy`.

The observable proof is that the existing JSVM compatibility tests still pass, new regression tests exercise lower-case methods without proxies, and `rg "new Proxy" src/plugins/jsvm/binds.ts` returns no matches.

## Progress

- [x] (2026-06-11T18:05:00Z) Confirmed the remaining proxy usage is localized to `src/plugins/jsvm/binds.ts`.
- [x] (2026-06-11T18:05:00Z) Replaced the completed migration-template ExecPlan with this JSVM proxy-removal plan.
- [x] (2026-06-11T18:35:00Z) Replaced `wrapApp`, `wrapEvent`, and generic `wrapBoundValue` with explicit cached facades that map Go-style names to JSVM-style names without `Proxy`.
- [x] (2026-06-11T18:35:00Z) Replaced route request, header, URL, and query proxies with concrete adapter classes.
- [x] (2026-06-11T18:35:00Z) Added a focused regression test that rejects `new Proxy` in `src/plugins/jsvm/binds.ts` and updated the changelog.
- [x] (2026-06-11T18:38:00Z) Ran focused JSVM tests: `bun test src/plugins/jsvm/binds.test.ts src/plugins/jsvm/jsvm.test.ts --concurrent` passed with 81 tests.
- [x] (2026-06-11T19:05:00Z) Ran the full validation gate: `bun run format:fix`; `bun test --concurrent` passed with 1860 tests; `bun run typecheck` passed; `bun run lint` passed with 0 warnings and 0 errors; `rg "new Proxy" src/plugins/jsvm/binds.ts -n` returned no matches.
- [x] (2026-06-11T19:08:00Z) Committed the focused changes.

## Surprises & Discoveries

- Observation: The broad proxy bridge predates this thread; this task is a cleanup of older infrastructure, not a removal of code that was introduced only for lower-case compatibility.
  Evidence: `rg "new Proxy|wrapApp|wrapEvent|wrapBoundValue" src/plugins/jsvm/binds.ts` shows all active proxy use in one file, while earlier git history showed app/event wrappers first arriving months before this task.

- Observation: Output arrays must preserve identity when passed back into bound methods.
  Evidence: The first focused JSVM test run left `arrayOf(...)` and query `.all(result)` targets empty because `unwrapBoundValue` cloned arrays; changing array unwrapping to mutate elements in place fixed the query and dynamic model tests.

- Observation: `FieldsList` is an `Array` subclass and needs both list behavior and JSVM lower-case aliases.
  Evidence: `collection.Fields.getByName(...)` needs facade aliases, while `collection.Fields.map(...)` should return a plain array for existing tests. The final implementation exposes array subclasses through facades and normalizes common array-result methods such as `map`, `filter`, and `slice` to plain arrays.

## Decision Log

- Decision: Remove all `new Proxy` calls from `src/plugins/jsvm/binds.ts`, including route request adapters, rather than only removing the generic object proxy.
  Rationale: Leaving smaller request/query/header proxies would keep the same hidden per-access trap cost and make future performance audits ambiguous. Concrete classes are straightforward for those fixed surfaces.
  Date/Author: 2026-06-11 / Codex

- Decision: Use cached facades for app and general bound values rather than mutating every original object in place.
  Rationale: A facade can expose lower-case and upper-case methods with stable own properties while preserving the underlying PocketBun object untouched. It also gives `unwrapBoundValue` a concrete map back to the raw object when a hook passes a facade back into app methods.
  Date/Author: 2026-06-11 / Codex

- Decision: Keep plain arrays as arrays and unwrap them in place when they are passed back into bound methods.
  Rationale: Query methods use arrays as caller-owned output parameters. Cloning those arrays preserves values but loses the mutation target, so the caller observes an empty result.
  Date/Author: 2026-06-11 / Codex

## Outcomes & Retrospective

The JSVM compatibility bridge no longer uses `Proxy` wrappers. Lower-case JSVM methods and legacy upper-case aliases still pass the focused and full test suites. The final validation gate passed with `bun run format:fix`, `bun test --concurrent` (1860 pass, 0 fail), `bun run typecheck`, `bun run lint` (0 warnings, 0 errors), and `rg "new Proxy" src/plugins/jsvm/binds.ts -n` returning no matches. The focused changes are committed.

## Context and Orientation

The JSVM bridge lives in `src/plugins/jsvm/binds.ts`. It creates the global `$app` binding used inside `pb_hooks`, wraps hook event objects before user callbacks run, and exposes PocketBase helper classes/functions such as `Record`, `Collection`, fields, router helpers, filesystem helpers, and date/time helpers. In this plan, a "facade" means a normal JavaScript object created with `Object.create(rawObject)`. The facade has concrete properties and methods defined on it, and each method calls the raw object. This is different from a `Proxy`, because JavaScript can use ordinary property lookup instead of invoking a trap for every access.

The old bridge has four proxy families in `src/plugins/jsvm/binds.ts`:

- `wrapApp` proxies the app and overrides methods such as `save`, `delete`, and `runInTransaction` so hook scripts get synchronous PocketBase JSVM behavior where required.
- `wrapEvent` proxies hook events and maps `e.record`, `e.app`, `e.next`, and route `e.request` to JSVM-style names.
- `wrapRouteRequest`, `wrapRouteRequestURL`, `wrapHeaderValues`, and `wrapQueryValues` proxy fixed Web API objects to expose PocketBase-style route request helpers.
- `wrapBoundValue` recursively proxies arbitrary returned PocketBun objects so lower-case names such as `record.getString` map to Go-style methods such as `GetString`.

The helper `src/plugins/jsvm/mapper.ts` converts between Go-style names and JS-style names. `convertJSToGoName("getString")` returns `GetString`, and `convertGoToJSName("GetString")` returns `getString`.

## Plan of Work

First, replace the generic proxy machinery with facade helpers in `src/plugins/jsvm/binds.ts`. The new helper should cache one facade per raw object in a `WeakMap`, cache the reverse mapping for `unwrapBoundValue`, and define concrete own properties on the facade for both the original name and the lower-case JSVM alias. Function properties should unwrap facade arguments, call the raw method with the raw object as `this`, throw returned `Error` values to match the old bridge, and expose returned objects through the same facade helper. Data and accessor properties should use getters and setters that forward to the raw object.

Second, keep app-specific behavior explicit. `$app` should return an app facade. The facade must preserve lower-case JSVM methods and legacy upper-case methods, but the lower-case app methods with special semantics must still call the correct sync implementation: `save`, `saveNoValidate`, `saveWithContext`, `saveNoValidateWithContext`, `delete`, `deleteWithContext`, `importCollections`, `importCollectionsByMarshaledJSON`, `validate`, `saveView`, and `createViewFields`. Transaction callbacks for `runInTransaction` and `auxRunInTransaction` must receive an app facade for the transaction app.

Third, replace route request proxies with concrete adapter classes in the same file. A route request adapter should expose `header`, `url`, `pathValue(name)`, `setPathValue(name, value)`, `raw`, and common `Request` pass-through methods/properties such as `method`, `headers`, `body`, `json()`, `text()`, `arrayBuffer()`, `formData()`, and `clone()`. A URL adapter should expose `path`, `rawQuery`, `scheme`, `query()`, `string()`, `toString()`, and common URL pass-through properties. Header and query adapters should expose the PocketBase JSVM semantics where missing values return empty strings and JSON conversion returns `Record<string, string[]>`.

Fourth, update constructors and helper functions in `baseBinds` that currently return `wrapBoundValue(...)` so they return the new facade helper. Update hook callback wrapping sites so they call the new event facade helper. Keep the public function names close to the existing code to minimize the diff.

Fifth, update tests and docs only where needed. Existing docs should already prefer lower-case names because the previous commits changed that. Add a regression test that asserts the bridge source has no `new Proxy` and that lower-case and upper-case calls still work through hook bindings.

## Concrete Steps

All commands run from `/Users/pekeler/Projects/pocketbun`.

1. Inspect the current bridge and tests:

   `rg "new Proxy|wrapApp|wrapEvent|wrapBoundValue" src/plugins/jsvm src/core src/tools -n`

2. Edit `src/plugins/jsvm/binds.ts` to replace proxy wrappers with cached facades and concrete adapters.

3. Add focused tests in `src/plugins/jsvm/binds.test.ts` or the closest existing JSVM regression test file.

4. Update `CHANGELOG.md` under `Unreleased` or the active target version with a concise user-facing note that JSVM lower-case compatibility no longer relies on proxy wrappers.

5. Run:

   `bun run format:fix`

   `bun test src/plugins/jsvm/binds.test.ts src/plugins/jsvm/jsvm.test.ts --concurrent`

   `bun test --concurrent`

   `bun run typecheck`

   `bun run lint`

6. Commit the focused source, test, changelog, and ExecPlan changes.

## Validation and Acceptance

Acceptance requires:

- `rg "new Proxy" src/plugins/jsvm/binds.ts` returns no matches.
- `$app.findCollectionByNameOrId(...)`, `$app.FindCollectionByNameOrId(...)`, `$app.runInTransaction(...)`, and `$app.RunInTransaction(...)` all continue to work from hook scripts.
- Record and date-time lower-case methods continue to work from hook scripts.
- Route hook scripts can continue to use `e.request.header.get(...)`, `e.request.url.query().get(...)`, `e.request.pathValue(...)`, and `e.request.raw`.
- The focused JSVM tests pass.
- The full gate passes: `bun run format:fix`, `bun test --concurrent`, `bun run typecheck`, and `bun run lint`.

## Idempotence and Recovery

The changes are normal source edits. Re-running formatting and tests is safe. If a facade bug appears, inspect whether the failing property is an app special case, a route adapter property, or a generic bound-value alias. Fix the smallest helper that owns that surface rather than restoring a `Proxy`. If a method receives a facade where it expects a raw PocketBun object, add or adjust an `unwrapBoundValue` call at the call boundary.

## Artifacts and Notes

The prior lowercase API and codemod work is already committed before this plan starts. The relevant existing commits are `497c7eaa` for docs and `e934a950` for the codemod.
