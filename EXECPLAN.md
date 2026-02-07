# Port PocketBase to Bun in Staged, Test-Verified Slices

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries, Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.

PLANS.md exists in this repo at .agents/PLANS.md. This ExecPlan must be maintained in accordance with that file.

## Purpose / Big Picture

The goal is to deliver a Bun-native PocketBase-compatible server that behaves like upstream PocketBase v0.36.1 for routes, response shapes, auth, realtime, and error formats. After completing the early milestones, a user should be able to run the PocketBun server, see the Admin UI at /_/, confirm /api/health responds exactly like PocketBase, and use the same client SDKs and Admin UI without changes. Each milestone ends with a concrete, observable behavior and tests that fail before the change and pass after.

## Progress

- Milestone status (2026-02-04):
  - Milestone 1: complete
  - Milestone 2: complete
  - Milestone 3: complete
  - Milestone 4: complete
  - Milestone 5: complete (all remaining gaps are intentional and documented)
  - Milestone 6: planned (CI + e2e tests, docs/examples, upgrade to v0.36.2, and a full port audit)

### Performance TODOs (active)

- [x] (2026-02-06) Re-run profiling after the fire-and-forget log worker changes; top slices now are router/middleware chain, db.get/db.all, pbGzip, records_list.query/hook (log hooks no longer dominate).
- [x] (2026-02-06) Bench logs disabled vs enabled: logs still add ~0.34–0.40ms on records_list endpoints.
- [x] (2026-02-06) A/B flatten vs values[] in log worker messages: flatten is slightly faster (kept).
- [x] (2026-02-06) Compare PocketBun vs PocketBase on same bench config after latest log changes (see perf notes in work log).
- [x] (2026-02-06) Expand local benchmark suite with write-path coverage (`bench_db_write`) on both PocketBun and PocketBase runners.
- [x] (2026-02-06) Remove duplicate request URL parsing on the hot path by threading the router-parsed URL into `Event`/`RequestEvent` (`router.buildHandler` -> `requestUrl` option).
- [x] (2026-02-06) Optimize `skipTotal` provider path by avoiding count-SQL construction when totals are disabled and by reusing parsed `URLSearchParams` (no `.toString()` + reparse in list handlers).
- [ ] Revisit log batching alternatives only if logging remains the dominant bottleneck (eg. worker-side multi-row INSERT), but avoid extra complexity without measurable wins.
- [x] (2026-02-06) Re-profile record list sub-steps (hook/enrich/hydrate/query/response) with logs disabled and optimize highest-cost controllable slice (no-handler hook wiring).
- [x] (2026-02-06) Replace non-profile `Hook.Trigger` closure-chain setup with a cursor-driven single `next` runner to reduce per-request middleware/hook allocation churn.
- [x] (2026-02-06) Concurrency sweep after log changes (1/4/16/32/64); captured records_list and skip_total scaling.
- [ ] (low priority) Stabilize upstream baseline measurements by running the upstream suite on a dedicated server and/or increasing scenario durations/iterations (the very short create scenarios show high run-to-run variance on VM/laptop environments).
- [ ] Keep admin UI optimizations low priority unless they also help non-admin endpoints; note any ideas rather than implement immediately.
- [x] (2026-02-06) Continue request-info/header normalization and event JSON/response allocation work (completed: header snakecase cache, JSON `fields` lookup cache, and non-exception response status fast path).
- [x] (2026-02-06) Reduce router match-path allocations by iterating method buckets directly (no per-request candidate slice) and skipping params map allocation for static matches.
- [x] (2026-02-06) Investigated and fixed `bench_db_write` bottleneck: `BaseApp.bootstrap()` was opening DBs directly with `new DbxDatabase(...)`, bypassing `DefaultDBConnect` PRAGMAs (`WAL`, `synchronous=NORMAL`, etc.); switched bootstrap to `DefaultDBConnect`.
- [x] (2026-02-06) Retro-audited all performance commits since 2026-02-05 (range `2d077507..06a95f89`) and added inline `PocketBun perf deviation` markers where missing (router matching, response path, hook trigger fast path, request header normalization cache, provider skipTotal fast path, bootstrap DB connect path).
- [x] (2026-02-06) Added a no-join fast path in `RecordFieldResolver.updateQuery`, reduced allocation churn in `search.Provider.exec`, and switched list hydration from `map()` to indexed assignment; reran profile + A/B benches.
- [x] (2026-02-06) Vendored upstream `pocketbase/benchmarks` into `vendor/pocketbase-benchmarks` (synced via `bun run upstream:sync:benchmarks`) and added a fixed local runner (`bun run bench:upstream`) for repeatable full-suite baselines.
- [x] (2026-02-06) Ran the full upstream benchmark suite locally via the new wrapper and captured baseline/anomaly signals for follow-up PocketBun work.
- [x] (2026-02-06) Ported the upstream benchmark app logic into a PocketBun-native module (`scripts/bench_upstream_pocketbun/*`) and added a fixed runner command (`bun run bench:upstream:pocketbun`).
- [x] (2026-02-06) Executed the full PocketBun-native benchmark suite and saved output to `/tmp/pocketbun-benchmarks-latest.txt`.
- [x] (2026-02-07) Root-caused upstream high-concurrency create errors on macOS to benchmark requester connection churn (per-request `http.Client` plus non-drained response bodies) and patched the local copied benchmark source in `scripts/bench_run_upstream.ts` to use a shared transport and always drain response bodies; `run=create` now completes with `Errors: 0` across all post-create scenarios.
- [x] (2026-02-07) Reworked the PocketBun-native upstream benchmark requester (`scripts/bench_upstream_pocketbun/request.ts`) to use a shared keep-alive Node HTTP/HTTPS transport with lightweight retries, eliminating per-request `fetch` overhead as the dominant bottleneck in long create scenarios.
- [x] (2026-02-07) Reduced write-path request-info overhead by replacing `request.clone().json()` in `RequestEvent` with a direct JSON bind path that caches parsed bodies and rebinds `request` for reread compatibility.
- [x] (2026-02-07) Updated PocketBun-native benchmark requester `Send(nil)` behavior to skip response text decoding (cancel body only), matching upstream semantics more closely and reducing client overhead.
- [x] (2026-02-07) Re-ran upstream `run=create` for PocketBase and PocketBun after the request-body optimization to capture fresh end-to-end deltas (`2026-02-07T12-42-16Z-*`).
- [x] (2026-02-07) Added focused upstream-shape users probe mode (`probe:create-users-upstream`) to both upstream and PocketBun benchmark runners for faster high-concurrency user-create iteration.
- [x] (2026-02-07) Added `probe:create-errors` support to the PocketBun benchmark runner to mirror the upstream posts25k create-error probe.
- [ ] Investigate why the PocketBun-native JS hook benchmark case currently returns `100/100` request errors while the Go-tagged hook case in the same run returns `0/100`.

Performance notes (2026-02-06): the benchmark suite now includes `bench_db_write` (`POST /_bench/db_write`) and query metrics are opt-in (`POCKETBUN_BENCH_QUERY_METRICS=1`) to avoid default measurement overhead. The major write-path regression was traced to bootstrap DB initialization bypassing `DefaultDBConnect`; after fixing that, sequential runs at concurrency=32/duration=15000ms are: PocketBun `bench_db_write` ~0.94ms avg / 33,981 rps vs PocketBase ~1.05ms / 30,486 rps. Read-paths also improved with proper PRAGMAs: PocketBun `records_list` ~2.94ms and `records_list_skip_total` ~2.15ms vs PocketBase ~2.31ms / ~1.31ms. After request URL reuse plus provider `skipTotal` fast paths (same bench config, logs disabled), latest run shows PocketBun ahead on write/list paths and essentially at skip-total parity: PocketBun `bench_db_write` ~1.03ms / 31,100 rps vs PocketBase ~1.36ms / 23,493 rps; `records_list` ~2.57ms / 12,445 rps vs ~2.97ms / 10,778 rps; `records_list_skip_total` ~1.77ms / 18,078 rps vs ~1.78ms / 17,992 rps. After hook/request-info/router/response-path optimizations and fresh paired logs-disabled runs (same config), PocketBun remains clearly faster on write and near parity on full list, while PocketBase still leads skip-total reads: PocketBun `bench_db_write` ~0.94ms / 34,017 rps vs PocketBase ~1.04ms / 30,804 rps; `records_list` ~2.41ms / 13,266 rps vs ~2.40ms / 13,332 rps; `records_list_skip_total` ~1.64ms / 19,515 rps vs ~1.27ms / 25,103 rps. The no-join/provider/hydration allocation reductions improved internal profile slices slightly (`records_list.query` ~0.0230ms -> ~0.0224ms, `records_list.total` ~0.0333ms -> ~0.0325ms at 5s profile runs) but did not materially change external `records_list_skip_total` latency (still ~1.8ms in local runs), indicating the remaining gap is outside those list-handler allocations. The newest hook-trigger cursor fast path improves the middleware-inclusive profile average (`router.total` ~0.0273ms -> ~0.0221ms in the latest profile sample) and nudges API list throughput up in logs-disabled 15s runs (`records_list` ~13,266 -> ~13,602 rps; `records_list_skip_total` ~19,515 -> ~20,092 rps), while keeping PocketBun ahead on `bench_db_write` (~34,904 vs PocketBase ~30,439 rps) and `records_list` (~13,602 vs ~13,110 rps). We now also have the full upstream benchmark harness vendored (`vendor/pocketbase-benchmarks`) and runnable through a fixed command (`bun run bench:upstream`); the runner is configured to persist full result output to `/tmp/pocketbase-benchmarks-latest.txt` on each run. Initial local full-suite baselines surfaced high error counts in large high-concurrency create scenarios and near-total failures in JS route scenarios; the create-error issue is now explained and mitigated locally by patching the copied benchmark requester to reuse transport connections and drain response bodies before close (preventing client-side `connect: can't assign requested address` exhaustion on macOS loopback runs).
Performance notes (2026-02-06, PocketBun-native upstream module): `bun run bench:upstream:pocketbun` now runs the full `create,auth,search,custom,delete` matrix inside PocketBun and writes results to `/tmp/pocketbun-benchmarks-latest.txt`. In the first complete run, create/auth/search/delete scenarios were stable with zero request errors (including high-concurrency post creates), JS route scenarios no longer showed the near-total failure pattern seen in upstream-local runs, and one anomaly remains: the JS-tagged hook case (`JS OnRecordBeforeUpdateRequest hook handler`) returned `100/100` errors while the Go-tagged hook case returned `0/100`.
Performance notes (2026-02-07): create-path profiling showed `request_info.body` as a dominant controllable slice. After switching JSON request-info binding to a direct cached path in `RequestEvent` (and rebinding `request` for reread behavior), profile `request_info.body` dropped from ~0.126ms to ~0.012ms avg in create-organizations probes, and `record_create.total` dropped from ~0.333ms to ~0.195ms. Probe latency improved from roughly ~20–23ms (organizations no-rule, warmup=0) to ~11–13ms. With warmup=100 requests, organizations probes are now PocketBun ~6.58ms / ~7.50ms vs PocketBase ~3.21ms / ~3.99ms (rules: `""` and `@request.body.name != ''`). In full upstream `run=create` reruns, PocketBun improved materially across create scenarios (eg. organizations no-rule `35.5ms -> 19.1ms`, permissions no-rule `18.2ms -> 5.1ms`, posts100k no-rule `11.44s -> 5.45s`) while still trailing PocketBase.
Performance notes (2026-02-07, follow-up probes): upstream-shape users create probes (`250 req / 50 conc`) now show PocketBun ahead in this local environment (`~1.69–1.71s` vs PocketBase `~3.50–3.74s` for the two user create-rule variants). Heavy posts create-error probes (`posts25k`, `12500 req / 500 conc`) are near parity with zero errors on both sides (PocketBun `~1089ms`, PocketBase `~1027ms`). Remaining measurable create gap is concentrated in short organizations/permissions scenarios, where PocketBun is currently about `1.6x–1.8x` slower in warmed probe runs.
Performance notes (2026-02-07, requester-path correction): after replacing PocketBun-native benchmark `Request.Send` with a shared keep-alive transport path, full `run=create` timings improved dramatically in the highest-volume scenarios (eg. users no-rule `~17.9s -> ~1.79s`, users rule `~14.9s -> ~1.80s`, posts100k no-rule `~12.3s -> ~6.30s`) with `Errors: 0` preserved. This indicates a substantial share of the earlier delta came from benchmark requester overhead rather than server-side create handler execution.

- [x] (2026-02-06) Threaded router-parsed URL into `Event`/`RequestEvent` and validated compatibility against upstream request usage (`*http.Request.URL` reuse in Go).
- [x] (2026-02-06) Re-ran full required validation gate: `bun run format:fix`, `bun test --concurrent`, `bun run typecheck`, `bun run lint`.
- [x] (2026-02-06) Re-ran both benchmark runners with logs disabled (`bench:local` and `bench:pocketbase`) to refresh deltas after URL-path optimization.
- [x] (2026-02-06) Re-ran both benchmark runners with logs disabled after provider `skipTotal` optimization and parsed-params reuse to refresh deltas.
- [x] (2026-02-06) Re-ran profiling + logs-disabled benchmark pair after hook/request-info/router/response-path optimizations and recorded fresh deltas.
- [x] (2026-02-07) Continued the async runtime I/O slices by removing sync fd open/temp-create/close calls from fileblob async paths (`NewRangeReader`, `NewTypedWriter`, async writer close) while preserving the sync-compatible reader/writer methods.
- [x] (2026-02-07) Switched shipped examples (`examples/base`, `examples/simple`, `examples/advanced`) to async-first startup (`MustRegisterAsync`/`RegisterJSVMAsync`, `serveAsync`) and removed early manual bootstrap in advanced example so JSVM bootstrap hooks execute in the intended order.
- [x] (2026-02-07) Added async settings reload plumbing (`ReloadSettingsAsync` in `settings_query`, `reloadSettingsAsync`/`ReloadSettingsAsync` in `BaseApp` + `App` interface), switched `bootstrapAsync` to use it, and updated `OnSettingsReload` logger hook chaining to support async downstream handlers without dropping cleanup work.
- [x] (2026-02-07) Removed serial per-file `stat` + `readFile` work from JSVM async loader startup by switching `filesContentAsync` to `readdir(..., { withFileTypes: true })` and ordered concurrent reads.
- [x] (2026-02-07) Removed serial async template file reads in `Registry.LoadFilesAsync` / `Registry.LoadFSAsync` by switching to ordered `Promise.all` source loading.
- [x] (2026-02-07) Reduced async archive I/O overhead by parallelizing per-file `lstat` + `readFile` in `CreateAsync` and memoizing recursive `mkdir` calls in `ExtractAsync` to avoid redundant directory creation churn.
- [x] (2026-02-07) Switched async auth/runtime paths that validate passwords (`record_auth_with_otp`, `record_auth_email_change_confirm`, `RecordUpsert` old-password checks) to `ValidatePasswordAsync` to avoid sync bcrypt verification blocking.
- [x] (2026-02-07) Added `Record.SetPasswordAsync` / `Record.SetRandomPasswordAsync` and migrated async API/CLI call sites (`record_auth_password_reset_confirm`, `record_auth_otp_request`, `record_auth_with_oauth2`, `cmd/superuser`) to avoid sync bcrypt hashing on async paths.
- [x] (2026-02-07) Added async installer helper alternatives (`findOrCreateInstallerSuperuserAsync`, `loadInstallerAsync`) and tests, preserving upstream-compatible sync installer helpers while avoiding sync password hashing/save on async installer flows.
- [x] (2026-02-07) Reduced sync startup filesystem syscall count by removing redundant `existsSync` checks in sync bootstrap/JSVM temp/types paths and relying on recursive `mkdir*` semantics instead.
- [x] (2026-02-07) Wired serve-path installer initialization to the new async installer helper (`ServeEvent.InstallerFunc` now runs in `serve`/`serveAsync` via `loadInstallerAsync`) and added a dedicated serve installer test.
- [x] (2026-02-07) Split serve handler/server startup into sync+async paths so `serveAsync` can await async `OnServe` hooks while preserving upstream-compatible sync behavior in `buildServeHandler`/`serve`; added coverage for both supported and rejected async-hook scenarios.
- [x] (2026-02-07) Removed synchronous disk reads from `System.UploadFile` when `File.Reader` is path-backed by adding an async `PathReader` fast path (`readFile(...)`) and a regression test to ensure the sync `Open().readAll()` fallback is not used for local path uploads.
- [x] (2026-02-07) Added `FormData.toMultipartAsync()` for JSVM async HTTP sends, wired `$http.sendAsync` to it, and added regression coverage that path-backed files avoid sync `Open().readAll()` reads in async paths.
- [x] (2026-02-07) Added shared filesystem reader helpers (`ReadFileReaderBytes*`) and switched async call sites (`System.UploadFile`, JSVM multipart async send, batch multipart re-encoding) to the centralized async fast path for path-backed files.
- [x] (2026-02-07) Added async uploaded-file MIME validator support (`UploadedFileMimeTypeAsync`) and switched async backup upload validation to it, with regression coverage for path-backed readers avoiding sync `Open()` in async validation flow.
- [x] (2026-02-07) Optimized file-path reader hot paths by removing eager full-file reads in `NewFileFromPathAsync`, adding sample-based extension detection helpers (`detectExtensionAsync` + sync helper parity), switching `PathReader.Open()` to fd-backed streaming reads (closer to upstream), and adding regression coverage that async path-backed detection avoids sync `Open()`.
- [x] (2026-02-07) Added a non-buffering filesystem reader API (`System.GetReaderAsync`) and switched backup S3 restore temp-zip writes to chunked stream copy instead of eager `readAll()` buffering.
- [x] (2026-02-07) Removed synchronous zlib work from archive async paths by switching `CreateAsync` and `ExtractAsync` to async raw deflate/inflate helpers.
- [x] (2026-02-07) Optimized path-backed upload hot paths by streaming `System.UploadFile` from disk in chunks (instead of full-file buffering) and making writer helpers handle partial writes safely.
- [x] (2026-02-07) Hardened local blob writer internals to drain full write buffers in both sync and async driver writers, preventing partial-write truncation risk under high I/O pressure.
- [x] (2026-02-07) Removed eager file buffering from `System.Serve` by streaming blob reader chunks (including single-range responses) directly into response writers, with recorder updates to accept streamed chunks in file/backup API paths.

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
- [x] (2026-02-02 22:57Z) Port mails/record tests and add JWK fetch/signature validation utilities with tests.
- [x] (2026-02-02 23:20Z) Tighten serve parity with CORS middleware, admin UI cache/CSP headers, and gzip support.
- [x] (2026-02-02 23:54Z) Port s3blob driver + internal S3 client/uploader, align list/signing behavior, and add upstream S3/s3blob tests.
- [x] (2026-02-03 07:31Z) Port blob bucket/reader/writer and fileblob driver foundations for local storage compatibility.
- [x] (2026-02-03 18:10Z) Wrap model create/update/delete DB writes with lock retry handling to match upstream baseLockRetry behavior.
- [x] (2026-02-03 12:57Z) Port tools/search tests (filter/provider/sort/token functions/simple resolver/identifier macros/multi-match) and align filter parsing + LIKE wrapping to upstream behavior.
- [x] (2026-02-03 12:57Z) Port tools/types tests (DateTime/JSONRaw/JSONMap/JSONArray) and align DateTime + JSON* helper semantics with upstream Scan/Value/Marshal behavior.
- [x] (2026-02-03 13:04Z) Port tools/security encrypt/jwt tests, align AES-GCM key handling with Go (128/192/256), and expose claims on parseUnverifiedJWT errors.
- [x] (2026-02-04 21:10Z) Restore 1:1 file mapping where practical by un-merging merged TS files and adding missing upstream files/tests (completed: analysis of missing files/tests, merged-header rule, low-risk un-merges like api_error_aliases/router error/collection_import + auth_origin/otp/mfa/external_auth query splits, base_backup helper extraction + base_paths constants, db_connect helper, syscall stub, core renames to match upstream (base/collection_model/record_model/settings_model), record_model_auth extraction, record_field_resolver_replace_expr + db_connect_nodefaultdriver + syscall_wasm stubs, collection_import + collection_record_table_sync extraction, settings_query extraction, added modernc/ui/embed/installer/jsvm pool/types stubs, collection_query module + tests + DbxDatabase query logging, db_tx module + tests, db_retry/db_builder modules with tests for db_retry, and tools/search + tools/types + tools/security + tools/osutils + tools/logger + tools/mailer + tools/routine tests).
- [x] (2026-02-04 22:40Z) Add PocketBase-compatible CLI entrypoint (serve/superuser/migrate) and register migratecmd/jsvm like upstream example, then port CLI tests (pocketbase_test, migratecmd_test).
- [x] (2026-02-04 21:10Z) Documented SQL placeholder index differences (unused empty-string params are dropped) in README for debugging parity expectations.
- [x] (2026-02-03 20:05Z) Port tools/osutils cmd/run modules and tests, and align MoveDirContent mkdir/rollback behavior with upstream.
- [x] (2026-02-03 21:05Z) Port tools/logger log/batch handler + tests and add a minimal slog compat shim for structured logging parity.
- [x] (2026-02-03 22:10Z) Port tools/template registry/renderer + tests, wire $template into JS hooks/migrations, and document JS-friendly templating guidance.
- [x] (2026-02-03 22:21Z) Port remaining tools/types Pointer test, add core settings_query + record_model_superusers + db tests, and wire ValidateWithContext in BaseApp.
- [x] (2026-02-03 22:51Z) Port core base/base_backup/db_table/record_query_expand/fields_list tests, add FieldsList Scan/Value/MarshalJSON helpers, expose TableColumns/DeleteTable/Vacuum/AuxHasTable on BaseApp, and validate S3 config before NewFilesystem/NewBackupsFilesystem.
- [x] (2026-02-03 23:05Z) Port tools/mailer html2text + smtp login auth + mailer tests for address formatting and mime detection.
- [x] (2026-02-03 23:20Z) Port tools/routine FireAndForget test and align async recovery behavior.
- [x] (2026-02-04 00:50Z) Port collection import + record table sync tests and implement single↔multiple normalization during table schema sync.
- [x] (2026-02-04 23:55Z) Un-merged S3 client implementation into per-file modules (error/copy/delete/get/head/list/uploader) and kept s3.ts as the s3.go wrapper with delegated methods.
- [x] (2026-02-04 23:59Z) Add a GitHub Actions CI workflow that runs format, lint, typecheck, and tests, and surface the workflow status in README.
- [x] (2026-02-04 23:59Z) Add end-to-end tests that start the server and confirm the Admin UI and basic API endpoints respond successfully.
- [x] (2026-02-04 23:59Z) Add a short README quick-start example and a minimal runnable example under examples/simple.
- [x] (2026-02-04 23:59Z) Define the upgrade workflow doc with release notes + git diff instructions.
- [x] (2026-02-04 23:59Z) Upgrade to PocketBase v0.36.2 (sync upstream, bump versions, reconcile diffs, and update docs/tests).
- [x] (2026-02-04 23:59Z) Snapshot .upstream/pocketbase as v0.36.1, sync upstream to v0.36.2, and bump package.json to 0.36.2-pocketbun.0.
- [x] (2026-02-04 23:59Z) Ran a full port audit against upstream v0.36.2; only missing files are ghupdate plugin sources/tests (intentional and documented).
- [x] (2026-02-04 23:59Z) Add an advanced example under examples/ that demonstrates core features (auth, CRUD, files, realtime, hooks, and CLI usage).
- [x] (2026-02-05 00:15Z) Add Playwright-based e2e tests with a dedicated web server script and CI coverage.
- [x] (2026-02-05 02:10Z) Add local benchmark runners for PocketBun and PocketBase and capture baseline/sweep results.
- [ ] (2026-02-05 02:20Z) Profile and optimize hot request paths (router matching, middleware overhead) while preserving compatibility.

## Surprises & Discoveries

- Observation: `net/http` in upstream PocketBase parses URL once and reuses `req.URL`, while our Bun path was reparsing with `new URL(req.url)` in both router and event-level helpers.
  Evidence: `.upstream/pocketbase/tools/router/router.go` passes `*http.Request` through the event factory, and `.upstream/pocketbase/core/event_request.go` reads `e.Request.URL.Query()` directly.
- Observation: the advanced example bootstrapped `BaseApp` before JSVM registration, so JSVM bootstrap hook work (like types refresh) could be skipped in that example flow.
  Evidence: `examples/advanced/main.ts` called `app.bootstrap()` before `RegisterJSVM(...)`; this was changed to register first and use `serveAsync(...)` to bootstrap.
- Observation: Provider `skipTotal` still built/updated count SQL strings even though totals were disabled; this was avoidable CPU work on the hot path.
  Evidence: `src/tools/search/provider.ts` built `countSql` and ran `buildCountQuery(...)` before the `skipTotal` branch.
- Observation: Reusing parsed `URLSearchParams` and skipping count-query construction moved `records_list_skip_total` to near parity in the latest run.
  Evidence: logs-disabled run at concurrency=32/duration=15000ms: PocketBun `records_list_skip_total` ~1.77ms / 18,078 rps vs PocketBase ~1.78ms / 17,992 rps.
- Observation: Router matching was still paying avoidable allocation costs (candidate slice building and params map creation for static routes).
  Evidence: after iterating route buckets directly and avoiding params-map allocation for static matches, profile `router.match` average improved from ~0.0029ms to ~0.0026ms.
- Observation: Event response-path cleanup (cached JSON `fields` lookup and non-exception status handling) preserved behavior but didn’t materially reduce JSON serialization cost.
  Evidence: `src/tools/router/event.test.ts` still passes non-standard status scenarios (123/234), while profile `event.json` remained ~0.0038ms avg before/after.
- Observation: Some non-obvious perf deviations from the 2026-02-05..2026-02-06 optimization window were not explicitly marked and could be accidentally dropped during upstream syncs.
  Evidence: retro audit of commits since 2026-02-05 identified missing markers in router/event/hook/request/provider/base hot-path changes; inline `PocketBun perf deviation` comments were added.
- Observation: `OnSettingsReload` logger middleware assumed synchronous downstream handlers and would short-circuit cleanup behavior when downstream returned a Promise.
  Evidence: the new async settings reload test initially failed (`asyncHookDone` remained false) because the logger hook returned early on Promise from `event.Next()`; switching it to Promise chaining restored awaited behavior.
- Observation: `serveAsync` previously shared the sync `buildServeHandler` initialization path, so async `OnServe` hooks were effectively unsupported despite an async serve entrypoint.
  Evidence: adding a dedicated async `OnServe` test (`src/apis/serve_installer.test.ts`) required splitting serve startup into sync/async builder paths and preserving a sync-only error path for `buildServeHandler`.
- Observation: `System.UploadFile` used a synchronous reader path even in async runtime flow when given `NewFileFromPath(...)` files, which could block on local disk reads.
  Evidence: `src/tools/filesystem/filesystem.ts` now detects `PathReader` and uses `readFile(...)`, and the new regression test (`upload file prefers async disk reads for path-backed readers`) fails if sync `Open()` is invoked.
- Observation: JSVM async HTTP client sends were still using sync multipart file reads, including disk-backed hook files, which can block the event loop under async hook load.
  Evidence: `src/plugins/jsvm/form_data.ts` now provides `toMultipartAsync()` with a `PathReader` async fast path (`readFile(...)`), `$http.sendAsync` uses it, and the regression test (`toMultipartAsync prefers async disk reads for path-backed readers`) fails if sync `Open()` is called.
- Observation: File-reader byte extraction logic had started diverging across modules, and batch multipart re-encoding still opened readers synchronously inside an async flow.
  Evidence: `src/tools/filesystem/file.ts` now owns `ReadFileReaderBytes`/`ReadFileReaderBytesAsync`, and `src/tools/filesystem/filesystem.ts`, `src/plugins/jsvm/form_data.ts`, and `src/apis/batch.ts` now call the shared async helper; new tests in `src/tools/filesystem/file.test.ts` assert path-backed async reads bypass sync `Open()`.
- Observation: Backup upload validation was async overall but still called the sync MIME validator, leaving a sync reader-open path inside an async request flow.
  Evidence: `src/core/validators/file.ts` now provides `UploadedFileMimeTypeAsync` (using `ReadFileReaderBytesAsync`), `src/apis/backup_upload.ts` awaits it, and `src/core/validators/file.test.ts` now asserts path-backed async MIME validation succeeds even when `PathReader.Open` is forced to throw.
- Observation: No-join `updateQuery`/provider allocation trims reduced profiled internal list-handler CPU slightly, but end-to-end `records_list_skip_total` remained effectively unchanged in local benchmark runs.
  Evidence: profile averages moved modestly (`records_list.query` ~0.0230ms -> ~0.0224ms; `records_list.total` ~0.0333ms -> ~0.0325ms), while benchmarked `records_list_skip_total` stayed around ~1.78–1.80ms.
- Observation: Replacing non-profile hook closure-chain construction with a cursor-driven `next` reduced middleware-inclusive router cost and gave a small but consistent improvement on list-path throughput.
  Evidence: latest profile sample shows `router.total` avg ~0.0221ms (down from ~0.0273ms in earlier samples), and logs-disabled 15s runs moved `records_list` to ~13,602 rps (from ~13,266) and `records_list_skip_total` to ~20,092 rps (from ~19,515).
- Observation: The upstream `pocketbase/benchmarks` full-suite local run reports heavy error counts in large create scenarios at conc=500.
  Evidence: in latest run, `create posts25k` and above showed thousands of failed requests (eg. `posts100k` create reported 29,697/50,000 errors), while auth/search/delete phases were mostly error-free.
- Observation: The upstream suite’s JS route benchmark scenarios are currently failing almost entirely in local runs while Go-route scenarios pass.
  Evidence: latest run reported JS route errors of 496/500, 497/500, and 500/500 for high/medium/no-concurrency cases, while all equivalent Go-route cases reported 0 errors.
- Observation: Importing the full upstream benchmark schema directly in PocketBun failed because system collection rule updates (eg. `_externalAuths.deleteRule`) are blocked by collection validation.
  Evidence: initial PocketBun-native runner attempts failed during `resetSchema` with `validation_collection_system_rule_change` for `_externalAuths`.
- Observation: The PocketBun-native full benchmark run removed the earlier create/JS-route failure pattern, but surfaced a new JS-hook-only failure.
  Evidence: in `bun run bench:upstream:pocketbun`, create/search/delete and all custom route scenarios completed with `Errors: 0`, while `JS OnRecordBeforeUpdateRequest hook handler` reported `Errors: 100` and the Go hook variant reported `Errors: 0`.
- Observation: JSON request binding via `request.clone().json()` had a disproportionately large cost on write-heavy request paths.
  Evidence: create-probe profiling before/after the direct JSON bind path showed `request_info.body` ~0.126ms -> ~0.012ms and `record_create.total` ~0.333ms -> ~0.195ms.
- Observation: Warmup size materially changes perceived short-scenario create latency and narrows apparent PocketBun/PocketBase gaps.
  Evidence: organizations probe with warmup=0 measured roughly PocketBun ~11–13ms vs PocketBase ~4–6ms, while warmup=100 measured ~6.6–7.5ms vs ~3.2–4.0ms.
- Observation: With the current create-path optimizations, the largest historical create deltas are no longer in high-concurrency user/posts probes.
  Evidence: `probe:create-users-upstream` measured PocketBun ~1.69–1.71s vs PocketBase ~3.50–3.74s, and `probe:create-errors` (posts25k, 12.5k req, conc=500) measured PocketBun ~1089ms vs PocketBase ~1027ms, both at zero errors.
- Observation: The PocketBun-native full upstream-port benchmark still had significant requester-side overhead in long create runs, even after server-side create-path improvements.
  Evidence: switching `scripts/bench_upstream_pocketbun/request.ts` from per-request `fetch` to a shared keep-alive transport reduced full `run=create` users/posts timings by multiple seconds while keeping error counts at zero (eg. users no-rule `~17.9s -> ~1.79s`, posts100k no-rule `~12.3s -> ~6.30s`).
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
- Observation: DateTime parsing treats numeric inputs as seconds even when provided as a float (eg. `1.0` → `1970-01-01 00:00:01.000Z`), matching cast.ToTime behavior.
  Evidence: DateTime Scan test scenario for `1.0` expects `1970-01-01 00:00:01.000Z`.
- Observation: Post-upgrade audit against v0.36.2 only reports missing ghupdate plugin files/tests, which are intentionally removed.
  Evidence: `bun run upstream:audit` reported missing `plugins/ghupdate/*` only.

## Decision Log

- (2026-02-04) Reversed the earlier "no CLI" decision: PocketBun now includes a CLI script compatible with the PocketBase binary to ease migration, so cmd/serve + migratecmd + pocketbase CLI tests are now in scope.
- Decision: Reuse the router-parsed URL by extending router event factory options with `requestUrl` and threading it into `Event`/`RequestEvent`.
  Rationale: This matches upstream’s single parsed-request URL model and removes duplicate `new URL(...)` allocations on hot request paths without changing behavior.
  Date/Author: 2026-02-06 / Codex
- Decision: Keep shipped examples async-first by using JSVM async registration and `serveAsync` instead of explicit sync bootstrap/serve calls.
  Rationale: Examples are the primary user-facing entrypoint and should model non-blocking startup and correct hook registration order in PocketBun.
  Date/Author: 2026-02-07 / Codex
- Decision: Keep `ReloadSettings()` behavior-compatible and add `ReloadSettingsAsync()` as a PocketBun-only superset API, then update the built-in settings-reload logger hook to chain async downstream handlers.
  Rationale: This preserves upstream sync semantics for existing call sites while making async startup paths truly async and preventing internal settings-reload hooks from dropping async work.
  Date/Author: 2026-02-07 / Codex
- Decision: Add a provider API that consumes pre-parsed `URLSearchParams` and bypass count-query construction when `skipTotal` is enabled.
  Rationale: Request URLs are already parsed at router/event level; avoiding query-string reserialization/reparse and unused count SQL work reduces hot-path overhead while preserving upstream response semantics.
  Date/Author: 2026-02-06 / Codex
- Decision: Iterate router candidate buckets directly during matching and skip params allocation for static-route matches.
  Rationale: This removes per-request temporary array/object churn on a hot path while preserving route scoring and compatibility behavior.
  Date/Author: 2026-02-06 / Codex
- Decision: Replace exception-driven response construction with a status-range branch in `Event.buildResponse`, while keeping fallback support for non-standard status codes.
  Rationale: Avoiding `try/catch` on the normal response path reduces overhead and still matches upstream-compatible behavior validated by router event tests.
  Date/Author: 2026-02-06 / Codex
- Decision: Mark all non-obvious behavior-compatible performance deviations with short inline `PocketBun perf deviation` comments and keep them cross-referenced in this ExecPlan.
  Rationale: This lowers the risk of accidentally removing important optimizations during future upstream merges while keeping compatibility intent explicit.
  Date/Author: 2026-02-06 / Codex
- Decision: Keep the no-join resolver/provider/hydration allocation reductions even without large benchmark delta because they are behavior-compatible, low-risk, and measurably reduce profiled handler CPU.
  Rationale: The change set is small and upstream-compatible in observable behavior, and it trims hot-path allocations while we continue searching for larger wins.
  Date/Author: 2026-02-06 / Codex
- Decision: Keep the non-profile cursor-based `Hook.Trigger` runner as the default fast path.
  Rationale: It preserves upstream-compatible hook ordering/`event.Next()` behavior but removes per-request closure-chain allocations in the default middleware path, producing measurable router/list throughput gains.
  Date/Author: 2026-02-06 / Codex
- Decision: Vendor and run the full upstream `pocketbase/benchmarks` suite via fixed wrapper commands before porting scenarios into PocketBun internals.
  Rationale: This gives us a reproducible baseline and a richer workload matrix (create/auth/search/custom/delete) to identify optimization targets beyond our custom microbench harness while honoring the stable-command approval workflow.
  Date/Author: 2026-02-06 / Codex
- Decision: Keep the PocketBun-native benchmark runner schema sourced from the upstream benchmark file, but filter it to benchmark-required collections only.
  Rationale: PocketBun currently rejects some system-collection rule updates in the upstream benchmark schema import path; filtering to the benchmark workload collections preserves scenario coverage and unblocks full-suite execution while we investigate full-system schema import parity separately.
  Date/Author: 2026-02-06 / Codex
- Decision: Use direct JSON request binding in `RequestEvent` (cache parsed body + rebuild `request`) instead of `request.clone().json()` on the hot request-info path.
  Rationale: This preserves bind/read semantics for downstream handlers while removing a measurable request-body parse overhead in create/update flows.
  Date/Author: 2026-02-07 / Codex

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
- Decision: Align JSONRaw/JSONMap/JSONArray/DateTime helpers with upstream Scan/Value/Marshal behavior.
  Rationale: Upstream tools/types tests depend on Scan/Value/Marshal JSON behavior; matching them keeps dbx and type utility semantics in sync with PocketBase.
  Date/Author: 2026-02-03 / Codex
- Decision: Select AES-GCM algorithm based on key length (128/192/256) to match Go's aes.NewCipher behavior.
  Rationale: Go accepts 16/24/32 byte keys; choosing the corresponding AES-GCM variant preserves compatibility for non-32-byte keys.
  Date/Author: 2026-02-03 / Codex
- Decision: Merge auth option updates instead of replacing defaults during collection updates/imports.
  Rationale: Upstream binding merges partial option payloads; replacing caused missing identity fields and failed validations.
  Date/Author: 2026-02-02 / Codex
- Decision: Restore 1:1 file mapping by splitting merged TS modules into upstream-named files where feasible, and list all upstream source files in headers when a merge must remain.
  Rationale: Closer structural parity reduces future sync/upgrade friction and clarifies provenance for merged ports.
  Date/Author: 2026-02-03 / Codex
- Decision: Order the next phase as CI + e2e tests first, then docs/examples, then the upgrade process + upgrade to v0.36.2, then a full port audit, then the advanced example.
  Rationale: CI and e2e tests provide safety nets for the upgrade, docs/examples stay accurate after the version bump, and the audit should reflect the upgraded baseline before the advanced example is finalized.
  Date/Author: 2026-02-04 / Codex
- Decision: Base upgrades on release notes plus a tag-to-tag git diff from a temporary clone, while keeping the checked-out upstream snapshot free of .git to avoid IDE confusion.
  Rationale: Release notes highlight intentional behavior changes, and a full diff captures unmentioned source/test changes; keeping .upstream clean avoids accidental IDE operations.
  Date/Author: 2026-02-04 / Codex
- Decision: Infer Store missing-key zero values from provided data or explicit zeroValue when available.
  Rationale: Go maps return a type-specific zero value, which TypeScript cannot infer for empty stores.
  Date/Author: 2026-02-02 / Codex
- Decision: Convert Go regex inline flags and replacement syntax when porting inflector singularize rules to JS.
  Rationale: JavaScript RegExp doesn't support Go's (?i) inline flags or ${1} replacement syntax.
  Date/Author: 2026-02-02 / Codex

## Outcomes & Retrospective

Milestones 1 and 2 are substantially complete, including migrations and auth-aware health responses. Batch API and picker fields are now aligned with upstream. Backups API and archive tooling are now ported with tests. Realtime (SSE) support is now ported with tests. Collection CRUD/import parity is now in place. pb_hooks/pb_migrations loader coverage is now in place via dedicated jsvm loader tests. The active performance milestone now includes write-path benchmarking, request URL reuse in the router/event stack, provider-level `skipTotal` fast paths, and router/request-info/response-path allocation reductions; in the latest A/B run PocketBun leads write performance, `records_list` is effectively at parity, and `records_list_skip_total` still trails PocketBase.

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

Milestone 6 steps. Add CI, end-to-end tests, docs/examples, and the upgrade workflow (then perform the upgrade to v0.36.2), followed by a full port audit and an advanced example.

- Add a GitHub Actions workflow in .github/workflows/ci.yml. Use the official Bun setup action, install dependencies, and run the same four commands required before commits: bun run format, bun run lint, bun run typecheck, and bun test --only-failures --concurrent. The workflow should run on push and pull_request. Update README.md to include a status badge for this workflow near the top.
- Add end-to-end tests that start the server on a random local port and verify that:
  - GET /_/ returns HTML that looks like the Admin UI index.
  - GET /api/health returns a 200 JSON payload with the expected shape.
  Put these tests under tests/e2e or a new src/tests/e2e folder and include a header comment explaining there is no upstream test for these and why they exist.
- Add a short, minimal README example showing how to start the server and call a basic endpoint. Keep it runnable with Bun. Also add examples/simple with a minimal script and a README that shows how to run it.
- Define an upgrade workflow document (for example docs/UPGRADING.md) that spells out the exact steps to move to a new upstream version, including reading upstream release notes, using a tag-to-tag git diff from a temporary clone, updating pocketbase_tag.txt and package.json to X.Y.Z-pocketbun.0, running bun run upstream:sync, refreshing vendor/pocketbase-admin-ui/dist + LICENSE, running the mapping audit to find missing files/tests, fixing breakages, and updating README compatibility notes. Then execute this workflow to upgrade to v0.36.2 and ensure tests pass.
- Perform a full port audit against upstream v0.36.2 using a scripted file mapping (for example via rg) to identify any missing .go/.go test files, and add TODOs in EXECPLAN.md or a dedicated tracking file. Include a brief summary in Progress and Surprises & Discoveries.
- Add examples/advanced that demonstrates the major features the Bun port supports (auth, CRUD, files, realtime, hooks, and CLI usage). Keep it runnable and documented, and ensure it avoids any intentionally documented incompatibilities.

Milestone 7 steps. Performance investigation and optimization (Bun vs PocketBase).

- Maintain a small local benchmark suite (PocketBun + PocketBase) for /api/health, /_/ and records list.
- Run a short concurrency sweep and capture baseline throughput/latency for comparison.
- Identify and address the hottest request-path overhead (router matching, repeated URL parsing, middleware overhead) without changing observable behavior.
- Re-run the benchmark suite and document the deltas.

## Validation and Acceptance

Milestone 1 is accepted when running bun test passes and a manual request to /api/health returns a 200 JSON payload with code 200, message "API is healthy.", and data as an empty object for guest requests. The Admin UI must be served at /_/ and return index.html from vendor/pocketbase-admin-ui/dist.

Milestone 2 is accepted when a superuser token causes /api/health to return data containing canBackup, realIP, and possibleProxyHeader, and bun test includes a test that fails before the auth change and passes after.

Milestone 3 is accepted when CRUD and auth tests pass and match upstream response shapes, including error formats and paging semantics.

Milestone 4 is accepted when SSE tests pass, hook loading works from pb_hooks/, and Admin UI functionality that relies on realtime and hooks works in a manual smoke test.

Milestone 6 is accepted when CI runs on GitHub Actions and the README badge updates to green, e2e tests prove /_/ and /api/health respond correctly, the README and examples directories contain runnable minimal and advanced examples, the upgrade workflow document exists and the project is upgraded to PocketBase v0.36.2 with package.json version 0.36.2-pocketbun.0, and a post-upgrade port audit identifies any remaining gaps.

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
Plan change note: 2026-02-03, recorded tools/search + tools/types test ports and helper parity updates during the 1:1 file mapping milestone.
Plan change note: 2026-02-03, recorded tools/security encrypt/jwt test ports and AES-GCM key handling alignment.
Plan change note: 2026-02-04, removed the ghupdate self-update plugin/command because PocketBun is distributed as a package; documented package-manager updates in README.
Plan change note: 2026-02-04, added Milestone 6 for CI, e2e tests, docs/examples, the v0.36.2 upgrade workflow, and a post-upgrade port audit.
Plan change note: 2026-02-04, split the S3 client merge into per-file modules while keeping s3.ts as the s3.go entrypoint with delegated methods.
Plan change note: 2026-02-06, continued Milestone 7 by threading router-parsed URLs into Event/RequestEvent, re-running full validation and both benchmark runners, and updating the performance TODOs with the remaining skip-total gap focus.
Plan change note: 2026-02-06, continued Milestone 7 by adding provider parsed-params APIs and a `skipTotal` count-query fast path, updating list/log/collection call sites, validating with full checks, and re-running both benchmark runners.
