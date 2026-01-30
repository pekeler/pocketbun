# Port PocketBase to Bun in Staged, Test-Verified Slices

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries, Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.

PLANS.md exists in this repo at .agents/PLANS.md. This ExecPlan must be maintained in accordance with that file.

## Purpose / Big Picture

The goal is to deliver a Bun-native PocketBase-compatible server that behaves like upstream PocketBase v0.36.1 for routes, response shapes, auth, realtime, and error formats. After completing the early milestones, a user should be able to run the PocketBun server, see the Admin UI at /_/, confirm /api/health responds exactly like PocketBase, and use the same client SDKs and Admin UI without changes. Each milestone ends with a concrete, observable behavior and tests that fail before the change and pass after.

## Progress

- [x] (2026-01-30 16:36Z) Read AGENTS.md and captured repository rules and compatibility priorities.
- [x] (2026-01-30 16:36Z) Surveyed .upstream/pocketbase tree to understand major subsystems and reference files.
- [x] (2026-01-30 16:57Z) Align repository versioning and scaffolding with the pinned PocketBase tag.
- [x] (2026-01-30 17:04Z) Implement the first compatibility slice (router + health + static UI) and add tests.
- [x] (2026-01-30 18:46Z) Add SQLite bootstrap, auth token verification, and test data cloning for auth-aware health responses.
- [x] (2026-01-30 18:49Z) Load trusted proxy settings from the settings param row during bootstrap.
- [x] (2026-01-30 18:55Z) Add migrations runner with _migrations table initialization and list-based execution.
- [x] (2026-01-30 19:13Z) Port the initial system migration and add a migrations test covering table creation and migration history.
- [x] (2026-01-30 21:24Z) Port the aux logs migration and extend migrations tests to cover _logs creation.
- [ ] Implement collections/records and auth flows, then realtime and hooks.

## Surprises & Discoveries

- Observation: package.json version is 0.0.0 but pocketbase_tag.txt is v0.36.1, so SemVer compatibility is not yet encoded.
  Evidence: package.json and pocketbase_tag.txt in the repo root.
- Observation: vendor/pocketbase-admin-ui/dist exists but there is no adjacent license file in vendor/pocketbase-admin-ui/.
  Evidence: vendor/pocketbase-admin-ui initially contained only dist/; added vendor/pocketbase-admin-ui/LICENSE.md.
- Observation: binding to a local TCP port from tests failed in the sandbox without escalation.
  Evidence: bun test initially failed with EPERM on listen; with escalated permissions, TCP-based tests pass.
- Observation: upstream test tokens map to auth collections stored in the seeded test data database.
  Evidence: regular user token claims collectionId _pb_users_auth_ (users table), superuser token claims pbc_3142635823 (_superusers table).

## Decision Log

- Decision: Structure the port as incremental, end-to-end slices that always end in runnable behavior with tests, starting with /api/health and static Admin UI.
  Rationale: Early behavioral parity and tests reduce drift and make later ports safer.
  Date/Author: 2026-01-30 / Codex
- Decision: Keep a 1:1 file mapping with upstream PocketBase wherever reasonable, but introduce src/internal/compat for Go-like primitives.
  Rationale: This matches AGENTS.md guidance and keeps the codebase upstream-syncable.
  Date/Author: 2026-01-30 / Codex
- Decision: Use Bun built-ins (Bun.serve, bun:sqlite, WebCrypto) as defaults and only add dependencies when a direct Bun/Web API is insufficient.
  Rationale: Bun-first approach is required and reduces maintenance.
  Date/Author: 2026-01-30 / Codex
- Decision: Clone upstream tests/data into a temporary directory for TCP-based tests.
  Rationale: Matches PocketBase testing behavior and keeps seeded auth tokens valid without re-seeding logic.
  Date/Author: 2026-01-30 / Codex
- Decision: Use node:crypto HMAC verification for JWT parsing to keep auth verification synchronous and dependency-free.
  Rationale: Bun supports node:crypto and it avoids adding a JWT dependency while preserving HS256 behavior.
  Date/Author: 2026-01-30 / Codex
- Decision: Implement a minimal migrations registry/runner that records applied files in _migrations without porting all migrations yet.
  Rationale: It preserves migration history semantics and unblocks bootstrapping while we port the full migration set incrementally.
  Date/Author: 2026-01-30 / Codex

## Outcomes & Retrospective

This plan has been created and no implementation has started yet. The next contributor should begin with Milestone 1 and update Progress, Decision Log, and Surprises as they work.

## Context and Orientation

This repository currently contains a minimal Bun setup with index.ts printing a message, a scripts/sync_upstream_pocketbase.sh helper, a vendor/pocketbase-admin-ui/dist directory, and pocketbase_tag.txt set to v0.36.1. The upstream PocketBase reference exists in .upstream/pocketbase and includes key subsystems in apis/, core/, tools/router/, forms/, migrations/, plugins/, tests/, and ui/.

PocketBase’s main behavior is organized around an App interface (core.App), a BaseApp implementation, a router with events and middleware, and API binders such as apis/health.go. The Admin UI is served as static assets from ui/dist under the /_/ prefix, while public files in pb_public/ are served at /.

The port must be Bun-only, use TypeScript, preserve observable behavior, and keep upstream license notices for any copied code or assets. For every ported subsystem or endpoint, add tests in Bun (bun test) that pin expected behavior.

## Plan of Work

Milestone 1 delivers a runnable server that serves /api/health and the Admin UI, using a minimal router and RequestEvent port, plus tests that validate the guest health response and static file delivery. This will also align versioning and .gitignore with PocketBase expectations. The work is primarily in new TypeScript files mirroring upstream packages and in package.json.

Milestone 2 brings in the BaseApp bootstrap flow, settings, store, and SQLite persistence via bun:sqlite. It also introduces system migrations and minimal auth loading so /api/health returns superuser fields when a valid superuser token is provided. This requires porting core settings, record, and token utilities from upstream and adding tests.

Milestone 3 ports collections, records, and auth APIs, enabling CRUD and email/password auth compatible with PocketBase. This includes file storage basics and response shapes, and extends tests with upstream-compatible scenarios.

Milestone 4 ports realtime (SSE) subscriptions, hook system, and hook loading from pb_hooks/, and completes server features like backups and admin operations needed by the Admin UI. Tests for SSE and hook effects are added.

Each milestone keeps files 1:1 with upstream where possible, adds a header comment linking to the upstream file path and tag/commit, and includes Bun tests that verify behavior against upstream tests.

## Concrete Steps

Work in /Users/pekeler/Projects/pocketbun for all commands.

Milestone 1 steps. First align versioning and repo hygiene, then add the minimal runtime.

- Update package.json version to 0.36.1-pocketbun.0 and add scripts for bun test and bun run.
- Add pb_data/, pb_migrations/, and pb_hooks/ to .gitignore.
- Copy PocketBase’s MIT license text to vendor/pocketbase-admin-ui/LICENSE.md.
- Replace index.ts with a library entry that exports PocketBase from src/pocketbase.ts.
- Create src/ directory structure mirroring upstream: src/apis, src/core, src/tools/router, src/internal/compat, src/ui, src/tests.
- Port apis/health.go to src/apis/health.ts with a header comment linking to upstream.
- Port core/event_request.go into src/core/event_request.ts with RealIP, RequestInfo parsing, and HasSuperuserAuth.
- Implement a minimal router in src/tools/router that can register GET routes, mount a group prefix, and dispatch based on path and method.
- Implement apis/serve.ts for a Bun.serve server that handles /api/*, /_/* (Admin UI), and / (pb_public) in the same order.
- Add tests in tests/health.test.ts and tests/admin_ui.test.ts that start the server on a random port and hit /api/health and /_/.

Example commands to run for Milestone 1:

    cd /Users/pekeler/Projects/pocketbun
    bun test

Milestone 2 steps. Add bootstrapping, settings, and persistence.

- Create src/core/app.ts and src/core/base_app.ts to mirror core.App and core.BaseApp in a minimal usable form.
- Add src/core/settings.ts with TrustedProxy defaults matching upstream.
- Implement src/internal/compat/time.ts for durations, src/internal/compat/errors.ts for error wrapping, and src/internal/compat/sync.ts for a simple async mutex, only as needed by ported files.
- Introduce bun:sqlite usage in src/core/db.ts and set up pb_data/ creation in BaseApp.Bootstrap().
- Port relevant migrations from .upstream/pocketbase/migrations into src/migrations as TypeScript-runner equivalents, keeping SQL identical.
- Add auth token parsing to load superuser auth in RequestEvent, sufficient for /api/health to include canBackup, realIP, and possibleProxyHeader.
- Extend health tests to cover superuser response once auth is in place.

Milestone 3 steps. Port collections/records and auth APIs.

- Port core record, collection, and DAO equivalents from upstream core/.
- Implement CRUD endpoints in src/apis/record and src/apis/collection to match response shapes and errors.
- Port auth endpoints from upstream apis/record_auth and related core token logic.
- Add file storage helpers for uploads in pb_data/storage.
- Add regression tests mirroring upstream tests for record CRUD and auth flows.

Milestone 4 steps. Port realtime, hooks, and remaining server behaviors.

- Implement subscriptions broker and SSE endpoints to match PocketBase realtime protocol.
- Port hook system and make pb_hooks/ loading work with TS/ESM.
- Add backups and installer logic as needed by Admin UI.
- Add tests for realtime subscribe/unsubscribe and hook-triggered behaviors.

## Validation and Acceptance

Milestone 1 is accepted when running bun test passes and a manual request to /api/health returns a 200 JSON payload with code 200, message "API is healthy.", and data as an empty object for guest requests. The Admin UI must be served at /_/ and return index.html from vendor/pocketbase-admin-ui/dist.

Milestone 2 is accepted when a superuser token causes /api/health to return data containing canBackup, realIP, and possibleProxyHeader, and bun test includes a test that fails before the auth change and passes after.

Milestone 3 is accepted when CRUD and auth tests pass and match upstream response shapes, including error formats and paging semantics.

Milestone 4 is accepted when SSE tests pass, hook loading works from pb_hooks/, and Admin UI functionality that relies on realtime and hooks works in a manual smoke test.

## Idempotence and Recovery

Running bun run upstream:sync is safe to repeat; it replaces vendor/pocketbase-admin-ui/dist with upstream ui/dist and re-checks out the tag from pocketbase_tag.txt. If a migration or bootstrap step fails, remove the local pb_data/ directory and re-run the bootstrap for a clean start. The plan expects additive changes; avoid deleting existing behavior unless a later milestone explicitly replaces it.

## Artifacts and Notes

Expected upstream sync output:

    PocketBase checked out: v0.36.1 (abcdef1)

Expected /api/health guest response in Milestone 1:

    HTTP/1.1 200 OK
    {
      "code": 200,
      "message": "API is healthy.",
      "data": {}
    }

## Interfaces and Dependencies

In src/tools/router/router.ts, define a minimal router interface that can grow toward upstream behavior:

    export type Handler<E> = (event: E) => Response | Promise<Response> | void | Promise<void>;

    export class Router<E> {
      get(path: string, handler: Handler<E>): this;
      group(prefix: string): RouterGroup<E>;
      buildHandler(): (req: Request) => Promise<Response>;
    }

    export class RouterGroup<E> {
      get(path: string, handler: Handler<E>): this;
      group(prefix: string): RouterGroup<E>;
    }

In src/tools/router/event.ts, define the request event base used by core.RequestEvent:

    export class Event {
      request: Request;
      responseHeaders: Headers;
      params: Record<string, string>;
      next(): Promise<void>;
      json(status: number, body: unknown): Response;
      bindBody<T extends object>(target: T): Promise<void>;
      remoteIP(): string;
    }

In src/core/event_request.ts, define RequestEvent to match upstream behaviors used by health:

    export class RequestEvent extends Event {
      app: App;
      auth: Record | null;
      realIP(): string;
      hasSuperuserAuth(): boolean;
      requestInfo(): Promise<RequestInfo>;
    }

In src/core/app.ts, define the minimal App interface used by Milestone 1 and expanded in Milestone 2:

    export interface App {
      dataDir(): string;
      settings(): Settings;
      store(): Store<string, unknown>;
      isBootstrapped(): boolean;
      bootstrap(): Promise<void>;
    }

Dependencies must prefer Bun built-ins: Bun.serve for HTTP and bun:sqlite for SQLite. Any new dependency must be justified and small; if JWT is needed before WebCrypto helpers are mature, prefer a single well-maintained library and record the decision in the Decision Log.

Plan change note: 2026-01-30, created initial ExecPlan based on AGENTS.md and the .upstream/pocketbase tree to guide the first full porting effort.
Plan change note: 2026-01-30, marked versioning/scaffolding complete and added the Admin UI license copy step after addressing the missing license file.
Plan change note: 2026-01-30, completed the initial router/health/admin UI slice and updated progress to reflect the new tests and server scaffolding.
Plan change note: 2026-01-30, recorded the sandbox socket restriction and retained TCP-based tests with escalated test runs.
Plan change note: 2026-01-30, added SQLite-backed auth token verification and test data cloning to support auth-aware health tests.
Plan change note: 2026-01-30, added minimal settings load from the settings param row during bootstrap.
Plan change note: 2026-01-30, added a minimal migrations runner and list registry to track applied migrations.
Plan change note: 2026-01-30, ported the initial system migration and added tests to verify it applies on a fresh data dir.
Plan change note: 2026-01-30, ported the aux logs migration and updated tests to assert the aux _logs table exists.
