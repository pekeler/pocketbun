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
- [x] (2026-01-30 23:05Z) Port the v0.23 migration chain and auth alert template update, adding AES-GCM decrypt support for legacy settings.
- [x] (2026-01-30 23:58Z) Add read-only collections list/view endpoints with superuser auth, paging, sorting, and basic filter support plus tests.
- [x] (2026-01-30 23:45Z) Replace the minimal collections search parsing with a full search toolkit (inflector, filter parser, sort, provider) and integrate it into the collections list endpoint.
- [x] (2026-01-31 00:38Z) Add dbx-style identifier rewrite support for bun:sqlite and revert search SQL generation to upstream `[[...]]` quoting; add tests for the rewrite.
- [x] (2026-01-31 01:04Z) Add a DbxDatabase wrapper to apply the rewrite to all SQL queries and ensure the rewriter skips SQL comments.
- [x] (2026-01-31 01:18Z) Add attach helper for existing Database instances and tests verifying idempotent patching.
- [x] (2026-01-31 01:26Z) Add a dbx tools index export to surface DbxDatabase, rewrite, and attach helpers.
- [x] (2026-01-31 01:34Z) Re-export dbx helpers from the public entrypoint for external consumers.
- [x] (2026-01-31 01:40Z) Document dbx helper exports and usage in README.
- [x] (2026-01-31 02:15Z) Add superuser-only records list/view endpoints using the search provider with basic record export and tests.
- [x] (2026-01-31 03:10Z) Apply list/view rules for non-superusers via RecordFieldResolver and add rule-based record list/view tests.
- [x] (2026-01-31 11:58Z) Port multi-match joins for RecordFieldResolver and add dbutils index parsing + tokenizer support.
- [x] (2026-01-31 12:08Z) Extend collection models with indexes and resolve typecheck/lint issues; document migration SQL deviations.
- [x] (2026-01-31 12:16Z) Align record list count handling with upstream (_rowid_ for non-views) and apply view rule joins.
- [x] (2026-01-31 12:37Z) Block superuser-only filter/sort fields in list queries for non-superusers and add tests.
- [x] (2026-01-31 13:00Z) Port core field types/validators and initial field implementations (text, bool, date, email, password, relation, json) plus JSON/Date helpers and regex-based random generator.
- [x] (2026-01-31 13:58Z) Port upstream validator/field tests and align validation, field helpers, and record/collection utilities to match upstream behavior.
- [x] (2026-01-31 14:22Z) Port db/equal validators with upstream tests and export them from the validators barrel.
- [x] (2026-01-31 14:28Z) Port number field with upstream tests and add numeric casting helpers/pointer alias for parity.
- [x] (2026-01-31 14:54Z) Port select/url/editor/geoPoint/autodate fields + GeoPoint type and tests; register field factories for JSON parsing and ensure record exports include ids.
- [x] (2026-01-31 16:50Z) Port filesystem helpers, file field + validators, and associated tests; align record default values and transactional file cleanup with upstream behavior.
- [x] (2026-01-31 17:04Z) Replace thumbnail placeholder with real image resizing using Sharp and align CreateThumb behavior with upstream.
- [x] (2026-01-31 19:05Z) Add initial record CRUD write endpoints (create/update/delete) with request data parsing, record modifiers/auth helpers, and core record model tests.
- [x] (2026-01-31 20:25Z) Add initial collection CRUD endpoints (create/update/delete/truncate/import/scaffolds), basic collection persistence, and partial API tests.
- [x] (2026-01-31 21:15Z) Port collection options/view helpers and validation, add db table info helpers, and wire BaseApp view/table methods.
- [x] (2026-01-31 21:58Z) Port tools/hook tests (event/hook/tagged) to lock hook behavior with upstream.
- [x] (2026-01-31 22:07Z) Port security crypto helpers (S256Challenge/MD5/SHA/HS) with upstream tests.
- [x] (2026-01-31 22:18Z) Extend random-by-regex to support negated classes/flags guard and port security random tests.
- [x] (2026-01-31 22:32Z) Extend BaseProvider with auth URL building and port base provider tests.
- [x] (2026-01-31 23:10Z) Register all OAuth2 provider defaults and port upstream auth provider tests.
- [x] (2026-01-31 23:45Z) Port record token generation helpers, add FindAuthRecordByEmail/FindRecordById wrappers, and add record token tests.
- [x] (2026-01-31 23:58Z) Add record query filter helpers, extend FindRecordById with optional filters, and port record query tests for FindRecordById/FindAuthRecordByToken/FindAuthRecordByEmail.
- [x] (2026-02-01 00:45Z) Port RecordQuery, record query find helpers (FindRecordsByIds/All/Filter/Count/CanAccessRecord), add dbx expression helpers, and fix JSON path building for record filters.
- [x] (2026-02-01 02:35Z) Port auth origin model/query + tests, add record-proxy validation support, and wire auth-origin hooks for password change cleanup.
- [x] (2026-02-01 05:40Z) Port cron scheduler utilities + tests and add OTP/MFA models, queries, hooks, and stubs with SaveNoValidate support.
- [x] (2026-02-01 06:25Z) Port record auth methods endpoint + tests (rate limit scenarios left as TODO until middleware is ported).
- [x] (2026-02-01 08:20Z) Port record auth with password + auth refresh endpoints, mailer stubs/templates, record expand helpers, and auth tests (rate limit scenarios left as TODO).
- [x] (2026-02-01 09:40Z) Port record auth impersonate endpoint + tests and OAuth2 redirect tests with subscription notifications.
- [x] (2026-02-01 11:20Z) Port record auth with OAuth2 create flow, align record validation/hook ordering with upstream, and complete OAuth2 auth test coverage (rate limit scenarios still TODO).
- [x] (2026-02-01 16:30Z) Port rate limiting middleware + settings rules, update router hook chaining and request pattern tracking, and complete rate limit auth tests.
- [x] (2026-02-01 18:10Z) Port view helpers (save/delete/create fields + FindRecordByViewFile), align collection default new-state handling, and add upstream view tests.
- [x] (2026-02-01 20:10Z) Port file API (token + download + thumb generation), add file request hooks, and port upstream file API tests.
- [x] (2026-02-01 22:35Z) Port batch API (internal requests + body limit), add picker fields/excerpt modifiers with tests, and align record enrich + cascade delete behavior to upstream.
- [x] (2026-02-01 22:50Z) Port logs API (list/view/stats), log model/query helpers, activity logger middleware, and add log query/API tests with a SelectQuery shim.
- [x] (2026-02-01 23:45Z) Port settings API (list/update/test s3/email/apple secret), add settings forms/tests, and align settings JSON to omit secrets with corresponding hooks/events.
- [x] (2026-02-02 01:15Z) Port backups API + archive/osutils helpers, align zip output with Go (data descriptor + extended timestamps), and add backup/archive tests.
- [x] (2026-02-02 03:20Z) Port realtime API (SSE) + model support, add realtime tests, and align hook event propagation with upstream.
- [x] (2026-02-02 09:10Z) Port record CRUD view + delete tests, fix list/view selection to avoid join column collisions, add delete file cleanup hook, and unwrap hook responses for tx overrides.
- [x] (2026-02-02 10:48Z) Port record CRUD create/update tests and add manage-rule access checks for auth record create/update.
- [x] (2026-02-02 13:30Z) Port collection CRUD/import API tests and align collection behaviors (auth options merge, field validation codes, hook firing).
- [x] (2026-02-02 15:51Z) Implement pb_hooks loading/tests (added loader tests and aligned hook/migration loading behavior).
- [x] (2026-02-02 16:45Z) Port store/list helper tests and align Store missing-key zero value handling with upstream semantics.
- [x] (2026-02-02 17:02Z) Port inflector, tokenizer, and dbutils helper tests; add singularize + dbutils alias parsing support.
- [x] (2026-02-02 19:25Z) Port router event helpers/tests, align API error mapping and hook response handling, and add rereadable reader coverage.
- [x] (2026-02-02 20:05Z) Port RequestEvent tests and align RealIP handling with raw header values for proxy scenarios.
- [x] (2026-02-02 21:05Z) Port migrations list/runner tests, add caller filename detection, and align applied-migrations filtering with upstream.
- [x] (2026-02-02 21:45Z) Port middleware auth and body limit tests to cover panic recover and auth gate behavior.
- [x] (2026-02-02 22:40Z) Port apis base/cron modules (WrapStdHandler/Middleware, Static, MustSubFS, cron routes) plus tests; start cron on serve and add DB optimize/log cleanup jobs.
- [x] (2026-02-02 22:15Z) Port record_helpers tests and align MFA expiry duration units with upstream.
- [x] (2026-02-02 22:20Z) Port record auth origin CRUD API tests.
- [x] (2026-02-02 22:39Z) Port external auth/MFA/OTP/superuser record CRUD tests, register superuser hooks, and align delete error propagation.
- [x] (2026-02-02 22:57Z) Port mails/record tests, add ghupdate compareVersions/release helpers with tests, and add JWK fetch/signature validation utilities with tests.
- [x] (2026-02-02 23:20Z) Tighten serve parity with CORS middleware, admin UI cache/CSP headers, and gzip support.
- [x] (2026-02-02 23:54Z) Port s3blob driver + internal S3 client/uploader, align list/signing behavior, and add upstream S3/s3blob tests.
- [x] (2026-02-03 07:31Z) Port blob bucket/reader/writer and fileblob driver foundations for local storage compatibility.
- [ ] (2026-02-03 18:20Z) Restore 1:1 file mapping where practical by un-merging merged TS files and adding missing upstream files/tests (completed: analysis of missing files/tests, merged-header rule, low-risk un-merges like api_error_aliases/router error/collection_import + auth_origin/otp/mfa/external_auth query splits, base_backup helper extraction + base_paths constants, db_connect helper, syscall stub, collection_query module + tests + DbxDatabase query logging, and db_tx module + tests; remaining: larger splits and missing modules/tests).

## Surprises & Discoveries

- Observation: package.json version is 0.0.0 but pocketbase_tag.txt is v0.36.1, so SemVer compatibility is not yet encoded.
  Evidence: package.json and pocketbase_tag.txt in the repo root.
- Observation: vendor/pocketbase-admin-ui/dist exists but there is no adjacent license file in vendor/pocketbase-admin-ui/.
  Evidence: vendor/pocketbase-admin-ui initially contained only dist/; added vendor/pocketbase-admin-ui/LICENSE.md.
- Observation: binding to a local TCP port from tests failed in the sandbox without escalation.
  Evidence: bun test initially failed with EPERM on listen; with escalated permissions, TCP-based tests pass.
- Observation: upstream test tokens map to auth collections stored in the seeded test data database.
  Evidence: regular user token claims collectionId _pb_users_auth_ (users table), superuser token claims pbc_3142635823 (_superusers table).
- Observation: legacy settings migration expects AES-256-GCM decryption of encrypted params values.
  Evidence: upstream migration attempts to decrypt the old settings value before JSON decode.
- Observation: bun:sqlite does not accept PocketBase/dbx-style double-square-bracket identifier quoting (`[[name]]`).
  Evidence: executing `select [[name]] from t` in bun:sqlite raises "unrecognized token: ]", while `[name]` works.
- Observation: Bun ships native S3 bindings that may be a better long-term fit than a Go-style S3 client port for performance and integration.
  Evidence: Bun runtime capabilities (to be evaluated alongside the current s3blob driver).
- Observation: dbx placeholder rewrites should not touch SQL comments to avoid altering commented-out fragments.
  Evidence: added dbx quoting tests that preserve `[[...]]`/`{{...}}` inside `--` and `/* */` comments.
- Observation: record validation order must match upstream so hook counters and auth flow tests behave as expected.
  Evidence: upstream auth tests expect hook counters to reflect validation failures, which required validation to run before model execute hooks in BaseApp.
- Observation: collection model validations were not firing OnCollectionValidate until Save used App.Validate for collections.
  Evidence: collection API tests reported OnCollectionValidate=0 while OnModelValidate was firing.
- Observation: field name validation errors in TS differed from upstream ozzo-validation codes.
  Evidence: collection create/update tests expected validation_not_in_invalid/validation_match_invalid but received validation_invalid_field_name.
- Observation: picker field selection must stop recursive pruning once a field is fully matched, and excluded HTML tag contents must be ignored.
  Evidence: upstream picker tests failed until exact field matches skipped recursion and excerpt stripping skipped script/style contents.
- Observation: expanded records require enrich hooks even for superusers to match upstream counts.
  Evidence: batch tests expecting OnRecordEnrich 5 vs. 2 when expanded records were not enriched for superusers.
- Observation: Go’s archive/zip writer emits data descriptors and extended timestamp extra fields (UT), affecting byte-for-byte zip size expectations.
  Evidence: archive create test expected 544 bytes; matching required UT extra + data descriptor and deflate best-speed semantics.
- Observation: The repo has fewer TypeScript files than upstream Go files; a mapping scan shows 95 upstream .go files without direct TS counterparts (44 tests, 51 non-tests), with gaps in core/tools/plugins/apis.
  Evidence: `rg --files -g '*.go' .upstream/pocketbase | wc -l` → 440 vs `rg --files -g '*.ts' src | wc -l` → 388; mapping scan reports 44 missing tests and 51 missing non-tests.

## Decision Log

- Decision: Structure the port as incremental, end-to-end slices that always end in runnable behavior with tests, starting with /api/health and static Admin UI.
  Rationale: Early behavioral parity and tests reduce drift and make later ports safer.
  Date/Author: 2026-01-30 / Codex
- Decision: Prefer mechanical 1:1 ports of upstream files and architecture; avoid bespoke abstractions unless Bun/TS requires a shim.
  Rationale: Keeping structure aligned with upstream maximizes compatibility and lowers long-term maintenance cost.
  Date/Author: 2026-01-31 / Codex
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
- Decision: Port the v0.23 migration chain using raw SQL/JSON manipulation instead of full model APIs.
  Rationale: The full collection model/validation stack is not yet ported, but we still need to preserve upgrade behavior for pre-v0.23 databases.
  Date/Author: 2026-01-30 / Codex
- Decision: Implement a lightweight, collection-specific search parser (page/perPage/sort/filter) before porting the full search toolkit.
  Rationale: It unlocks the collections list endpoint with upstream-like behavior while deferring the heavier fexpr-based filter engine port.
  Date/Author: 2026-01-30 / Codex
- Decision: Port the full search toolkit (inflector, filter parser, sort, provider) and switch collections list to use it.
  Rationale: This aligns query parsing with upstream behavior and reduces future refactors as record endpoints come online.
  Date/Author: 2026-01-30 / Codex
- Decision: Use single-bracket identifier quoting (`[name]`) in search SQL instead of dbx-style `[[name]]`.
  Rationale: bun:sqlite rejects the double-bracket syntax, and single brackets preserve SQLite-compatible quoting while keeping behavior aligned.
  Date/Author: 2026-01-30 / Codex
- Decision: Defer multi-match subquery handling in the search filter engine until record field resolvers are ported.
  Rationale: collections list uses only simple fields, so it is safe to stub multi-match while we prioritize core CRUD and auth flows.
  Date/Author: 2026-01-30 / Codex
- Decision: Implement a dbx placeholder rewrite layer (`[[...]]`, `{{...}}`) and return search SQL generation to upstream `[[...]]` quoting.
  Rationale: dbx-style placeholders are part of the PocketBase query surface and must be supported even though bun:sqlite only accepts single-bracket or quoted identifiers.
  Date/Author: 2026-01-31 / Codex
- Decision: Centralize dbx placeholder rewriting in a DbxDatabase wrapper and skip comment regions in the rewriter.
  Rationale: applying the rewrite at the database boundary ensures coverage for all raw queries while preserving comment content.
  Date/Author: 2026-01-31 / Codex
- Decision: Provide an attach helper that monkey-patches an existing bun:sqlite Database instance with dbx placeholder rewriting.
  Rationale: some callers may construct Database instances outside BaseApp, and we still need dbx placeholder compatibility without changing their construction flow.
  Date/Author: 2026-01-31 / Codex
- Decision: Gate record list/view behind superuser auth until list/view rule parsing and request-auth-aware filtering are ported.
  Rationale: it preserves safety and admin compatibility while we implement the full record rule/resolver stack.
  Date/Author: 2026-01-31 / Codex
- Decision: Mirror default field values into new record data to emulate Go's `store.GetOk` fallback semantics for missing keys in JS objects.
  Rationale: ensures `GetRaw` and validation see upstream-equivalent defaults even when JS objects omit keys.
  Date/Author: 2026-01-31 / Codex
- Decision: Use Sharp for thumbnail generation and expose CreateThumb as async in the Bun port.
  Rationale: Bun-compatible image decoding/resizing libraries are async; Sharp provides the closest feature parity to the Go imaging stack.
  Date/Author: 2026-01-31 / Codex
- Decision: Land initial record write endpoints without hooks/forms/manage-access features while documenting the deviation.
  Rationale: Enables incremental API progress and test coverage while larger hook/form infrastructure is still being ported.
  Date/Author: 2026-01-31 / Codex
- Decision: Implement a minimal collection save/delete path with basic validation and schema sync, deferring full collection options, view query handling, and single↔multiple field migrations.
  Rationale: Unblocks collection CRUD endpoints and basic tests while the full collection model/options/hook stack is ported.
  Date/Author: 2026-01-31 / Codex
- Decision: Run record validation before OnModelCreateExecute/OnModelUpdateExecute to mirror upstream hook ordering during auth/record flows.
  Rationale: Upstream tests (OAuth2 auth flows) rely on hook counters and side effects that only match when validation happens before model execute hooks.
  Date/Author: 2026-02-01 / Codex
- Decision: Apply picker semantics exactly as upstream, including short-circuiting recursive field pruning on exact matches and treating excluded tag contents as non-text in excerpts.
  Rationale: Upstream picker tests enforce these behaviors and they affect public fields selection.
  Date/Author: 2026-02-01 / Codex
- Decision: Always run enrich hooks for expanded records regardless of auth role.
  Rationale: Upstream expand flow enriches related records even for superusers, and hook counters depend on it.
  Date/Author: 2026-02-01 / Codex
- Decision: Emit zip entries with data descriptors and extended timestamp extras (UT) and use best-speed deflate semantics to match upstream archive output.
  Rationale: Tests and behavior depend on the exact zip structure produced by Go’s archive/zip with flate.BestSpeed.
  Date/Author: 2026-02-02 / Codex
- Decision: Use App.Validate() inside collection saves so OnModelValidate/OnCollectionValidate fire consistently.
  Rationale: Upstream hook counters expect validation hooks on both success and failure paths.
  Date/Author: 2026-02-02 / Codex
- Decision: Map field name validation errors to required/length/match/not-in codes to match ozzo-validation output.
  Rationale: Upstream tests assert specific validation codes for reserved/system field names.
  Date/Author: 2026-02-02 / Codex
- Decision: Merge auth option updates instead of replacing defaults during collection updates/imports.
  Rationale: Upstream binding merges partial option payloads; replacing caused missing identity fields and failed validations.
  Date/Author: 2026-02-02 / Codex
- Decision: Restore 1:1 file mapping by splitting merged TS modules into upstream-named files where feasible, and list all upstream source files in headers when a merge must remain.
  Rationale: Closer structural parity reduces future sync/upgrade friction and clarifies provenance for merged ports.
  Date/Author: 2026-02-03 / Codex
- Decision: Infer Store missing-key zero values from provided data or explicit zeroValue when available.
  Rationale: Go maps return a type-specific zero value, which TypeScript cannot infer for empty stores.
  Date/Author: 2026-02-02 / Codex
- Decision: Convert Go regex inline flags and replacement syntax when porting inflector singularize rules to JS.
  Rationale: JavaScript RegExp doesn't support Go's (?i) inline flags or ${1} replacement syntax.
  Date/Author: 2026-02-02 / Codex

## Outcomes & Retrospective

Milestones 1 and 2 are substantially complete, including migrations and auth-aware health responses. Batch API and picker fields are now aligned with upstream. Backups API and archive tooling are now ported with tests. Realtime (SSE) support is now ported with tests. Collection CRUD/import parity is now in place. pb_hooks/pb_migrations loader coverage is now in place via dedicated jsvm loader tests.

## Context and Orientation

This repository currently contains a minimal Bun setup with index.ts printing a message, a scripts/sync_upstream_pocketbase.sh helper, a vendor/pocketbase-admin-ui/dist directory, and pocketbase_tag.txt set to v0.36.1. The upstream PocketBase reference exists in .upstream/pocketbase and includes key subsystems in apis/, core/, tools/router/, forms/, migrations/, plugins/, tests/, and ui/.

PocketBase’s main behavior is organized around an App interface (core.App), a BaseApp implementation, a router with events and middleware, and API binders such as apis/health.go. The Admin UI is served as static assets from ui/dist under the /_/ prefix, while public files in pb_public/ are served at /.

The port must be Bun-only, use TypeScript, preserve observable behavior, and keep upstream license notices for any copied code or assets. For every ported subsystem or endpoint, add tests in Bun (bun test) that pin expected behavior.

## Plan of Work

Milestone 1 delivers a runnable server that serves /api/health and the Admin UI, using a minimal router and RequestEvent port, plus tests that validate the guest health response and static file delivery. This will also align versioning and .gitignore with PocketBase expectations. The work is primarily in new TypeScript files mirroring upstream packages and in package.json.

Milestone 2 brings in the BaseApp bootstrap flow, settings, store, and SQLite persistence via bun:sqlite. It also introduces system migrations and minimal auth loading so /api/health returns superuser fields when a valid superuser token is provided. This requires porting core settings, record, and token utilities from upstream and adding tests.

Milestone 3 ports collections, records, and auth APIs, enabling CRUD and email/password auth compatible with PocketBase. This includes file storage basics and response shapes, and extends tests with upstream-compatible scenarios.

Milestone 4 ports realtime (SSE) subscriptions, hook system, and hook loading from pb_hooks/, and completes server features like backups and admin operations needed by the Admin UI. Tests for SSE and hook effects are added.

Each milestone keeps files 1:1 with upstream where possible, adds a header comment linking to the upstream file path (no version/hash; pocketbase_tag.txt is the source of truth), and includes Bun tests that verify behavior against upstream tests.

Plan update (2026-02-01): recorded the batch + picker milestone, added related discoveries and decisions, and narrowed the remaining APIs list to exclude batch.
Plan update (2026-02-02): recorded backups + archive/osutils progress, plus the zip output discovery/decision, and updated the outcomes to reflect backups completion.
Plan update (2026-02-02): recorded collection CRUD/import parity work, added validation/merge/hook decisions, and clarified remaining pb_hooks scope.

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

- Extend the collections API to support list/view (superuser-only) with paging and filtering; keep error responses JSON-compatible with upstream.
- Port core record, collection, and DAO equivalents from upstream core/.
- Port record rule evaluation by translating core/record_field_resolver.go + core/record_field_resolver_runner.go (and any helpers) directly, then use them in records list/view instead of ad-hoc rule handling.
- Implement CRUD endpoints in src/apis/record and src/apis/collection to match response shapes and errors.
- Port auth endpoints from upstream apis/record_auth and related core token logic.
- Add file storage helpers for uploads in pb_data/storage.
- Add regression tests mirroring upstream tests for record CRUD and auth flows.

Milestone 4 steps. Port realtime, hooks, and remaining server behaviors.

- Implement subscriptions broker and SSE endpoints to match PocketBase realtime protocol.
- Port hook system and make pb_hooks/ loading work with TS/ESM.
- Add backups and installer logic as needed by Admin UI.
- Add tests for realtime subscribe/unsubscribe and hook-triggered behaviors.

Milestone 5 steps. Restore 1:1 file mapping and port remaining upstream tests.

Describe any merged module and decide whether to un-merge it. When un-merging, create upstream-named TypeScript files that contain the logic formerly embedded in merged files, and route callers to those new files. When a merge must remain (for example, a class split that would require invasive refactors), keep the merged file but update its top header comment to list all upstream source paths it contains. Use the upstream .go filename-to-TS mapping rule: `foo/bar/baz.go` → `src/foo/bar/baz.ts` and `foo/bar/baz_test.go` → `src/foo/bar/baz.test.ts`.

Port missing upstream tests in-place under the same directory as their source code, matching the upstream file names. If a test depends on missing functionality, note the gap in `Progress` and add a stub test that fails with a clear TODO until the feature is implemented.

For any new files added to satisfy mapping, add the required “ported from” header comment that names the upstream file(s). For any remaining merged files, list all upstream files in the header comment.

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
      encryptionEnv(): string;
      settings(): Settings;
      store(): Store<string, unknown>;
      isBootstrapped(): boolean;
      bootstrap(): void;
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
Plan change note: 2026-01-30, ported the v0.23 system migrations and auth alert template update, adding AES-GCM settings decryption support for legacy databases.
Plan change note: 2026-01-30, added read-only collections list/view endpoints with superuser auth and a minimal search parser to unlock collections listing before full search tooling is ported.
Plan change note: 2026-01-30, replaced the minimal collections search parser with the ported search toolkit and adjusted identifier quoting to `[name]` for bun:sqlite compatibility.
Plan change note: 2026-01-31, added dbx identifier placeholder rewriting so we can keep upstream `[[...]]` quoting while remaining compatible with bun:sqlite.
Plan change note: 2026-01-31, moved dbx placeholder rewriting into a DbxDatabase wrapper and taught the rewriter to ignore SQL comments.
Plan change note: 2026-01-31, added an attach helper to retrofit dbx placeholder rewriting onto existing Database instances with tests for idempotency.
Plan change note: 2026-01-31, added a dbx tools index export to surface DbxDatabase and rewrite helpers.
Plan change note: 2026-01-31, exported dbx helpers from the package entrypoint to make them available to external consumers.
Plan change note: 2026-01-31, documented dbx helper exports and example usage in README for external consumers.
Plan change note: 2026-01-31, added superuser-only record list/view endpoints with basic record export and tests.
Plan change note: 2026-01-31, reaffirmed mechanical upstream porting and updated Milestone 3 to port record field resolver/rule handling directly.
Plan change note: 2026-01-31, ported a minimal RecordFieldResolver for list/view rule filtering; relation joins and advanced modifiers remain to be ported.
Plan change note: 2026-01-31, recorded progress on collection options/view helpers and collection validation plus BaseApp view/table wiring.
Plan change note: 2026-02-01, recorded OAuth2 auth create flow progress and the validation/hook ordering alignment required by upstream tests.
Plan change note: 2026-02-02, recorded collection CRUD/import parity completion, updated discovery/decision logs, and narrowed remaining work to pb_hooks loading/tests.
Plan change note: 2026-02-03, added the 1:1 file mapping/missing tests milestone and recorded the file-count discrepancy plus mapping scan results.
