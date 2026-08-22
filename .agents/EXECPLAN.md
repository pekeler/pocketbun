# Adopt Bun v1.4 Before Adding Vertical Scaling

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. This document follows `.agents/PLANS.md`.

Stable Bun v1.4.0 is now available. The Bun v1.4 compatibility and native-runtime work in Milestones 1 through 5 is the active, higher-priority workstream. The vertical-scaling work in Milestones 6 through 10 remains planned, but must not begin until the Bun v1.4 workstream has passed its full release gate. PocketBun remains primarily an npm library that includes an executable; producing a standalone compiled executable is explicitly outside this plan.

## Purpose / Big Picture

PocketBun is a TypeScript port of PocketBase whose observable behavior must remain compatible with PocketBase while its implementation embraces Bun. Bun v1.4 adds native capabilities that can remove fragile PocketBun code, close an existing cron compatibility gap, reduce static-file memory use, make shutdown more deterministic, and shorten the test feedback loop. After the first workstream, PocketBun will use those capabilities only where they preserve or improve PocketBase compatibility: cron will retain PocketBase's UTC default and gain the missing timezone API, S3 and request XML will use Bun's parser, local static files will use Bun's streaming file responses where their HTTP behavior matches, and the project will test and maintain itself with the useful new Bun v1.4 tooling.

The Bun v1.4 work deliberately does not replace working components merely because Bun now has a similarly named API. Playwright remains the real-browser test framework, backups remain ZIP-compatible, the multipart parser continues to spool uploads to disk, and the custom S3 client remains until Bun exposes the metadata, conditional-operation, response-header, arbitrary-header, and native-copy behavior PocketBase compatibility requires. No new runtime dependency is expected.

After that work is complete, the lower-priority vertical-scaling work begins. PocketBun currently runs one Bun process and one JavaScript event loop. A single process is already competitive with PocketBase, but a server with several CPU cores cannot use those cores for parallel HTTP request handling. After the scaling work, an operator will be able to run:

    pocketbun --workers=4 serve --http=127.0.0.1:8090

One lightweight primary process will supervise four PocketBun worker processes. On Linux, every worker will call the existing native `Bun.serve()` implementation on the same address with `reusePort: true`, and the kernel will distribute incoming TCP connections with `SO_REUSEPORT`. On Windows and macOS, where Bun cannot share that listening port, workers will bind predictable consecutive loopback ports and an operator-provided reverse proxy or load balancer will distribute traffic across them. The primary will not proxy HTTP or open PocketBun's SQLite databases. It will supervise worker lifecycles and coordinate only the process-local state that must be shared for correctness.

The operator will still supervise the one cluster primary with systemd, a Windows service host, Docker, or an equivalent operating-system service manager. No npm process manager or PocketBun-specific daemon dependency will be added. The default remains one process (`--workers=1`) on every operating system. Multi-worker mode is opt-in. Linux has the zero-extra-hop shared-port path; Windows and macOS require the external traffic distributor.

Success is observable, not architectural. First, the complete test suite must pass under Bun v1.4 with explicit tests for timezone, XML, static-file routing and delivery, and clean shutdown, while the parallel test command is measurably faster and no incompatible dependency replacement is introduced. Later, several worker process IDs must answer through one public endpoint; read-heavy throughput must improve on a multi-core machine; migrations and scheduled work must run once; realtime, OAuth2 redirects, rate limits, backups, settings reloads, and shutdown must behave as one PocketBun application; and killing a worker must not take down the service.

## Progress

- [x] (2026-08-02 16:00Z) Confirmed the agreed direction: Bun `node:cluster` for supervision and IPC, native same-port `Bun.serve({ reusePort: true })` on Linux, predictable per-worker ports behind an external traffic distributor on Windows/macOS, and an external service manager for the primary.
- [x] (2026-08-02 16:00Z) Audited PocketBun startup, migrations, SQLite configuration, cron, realtime, rate limiting, backup/restore, settings notifications, OAuth2 redirect state, email resend guards, logging, docs generation, CI, and benchmark tooling.
- [x] (2026-08-02 16:00Z) Recorded the current Bun documentation and source-level assumptions that must be revalidated with stable Bun v1.4.0.
- [x] (2026-08-02 16:00Z) Replaced the completed PocketBase v0.39.10 upgrade plan with this deferred, self-contained implementation plan.
- [x] (2026-08-02 16:30Z) Corrected the gate to Bun v1.4.0 and expanded the plan beyond Linux port sharing: Windows/macOS use predictable worker ports behind an external traffic distributor, subject to v1.4 qualification.
- [x] (2026-08-21 00:00Z) Reviewed the complete Bun v1.4 release announcement against PocketBun's dependencies, runtime paths, tests, CI, documentation, and known Bun issue workarounds; measured 1,898 passing tests in 30.21 seconds with `--parallel=4` and 28.70 seconds with `--parallel=4 --concurrent` on the local Bun v1.4.0 checkout.
- [x] (2026-08-21 00:00Z) Agreed to complete the compatibility-preserving Bun v1.4 work before vertical scaling and to exclude a standalone compiled executable because PocketBun remains primarily an npm library with an included executable.
- [x] (2026-08-21 13:15Z) Selected Bun v1.4.0 as the exact baseline; aligned package engines, generated templates, examples, `@types/bun`, README, and both CI pins; added a version-drift guard; and verified root plus generated-template clean installs without rewriting the lockfile format.
- [x] (2026-08-21 13:15Z) Audited the Bun v1.4 breaking changes against PocketBun. Fixed and regression-tested preservation of separate `Set-Cookie` values, pinned Bun-joined duplicate proxy-header handling, and recorded the current status of affected Bun workarounds.
- [x] (2026-08-21 13:15Z) Passed the complete local Milestone 1 gate on Bun v1.4.0: 1,899 tests, formatting, application and package typechecks, lint, version alignment, generated-doc parity, build, and whitespace checks all passed without warnings.
- [x] (2026-08-21 14:00Z) Ran the pinned Bun v1.4.0 hosted matrix: Ubuntu and macOS passed; Windows reproduced Bun issue #27482 with one empty `Bun.spawnSync()` stdout result after 1,896 tests passed. Requested that upstream reopen the issue and replaced the unsafe pipe transport locally without replaying requests.
- [x] (2026-08-21 14:15Z) Passed the complete local gate with file-backed synchronous child output: 1,899 tests, focused JSVM HTTP coverage, formatting, both typechecks, package build, lint, version and docs checks, and whitespace checks all passed.
- [x] (2026-08-21 14:55Z) Ran the second hosted matrix. Ubuntu and macOS passed again, but Windows showed that redirecting `Bun.spawnSync()` stdout to `Bun.file(...)` can also leave the target empty after exit code zero. Changed the child to write its private result file directly, removing spawn stdout from the result path entirely.
- [x] (2026-08-21 14:57Z) Locally implemented Milestone 2: explicit UTC and PocketBase-compatible cron timezone control, close-event-backed logger worker shutdown, four-process isolated tests, and `test:changed`. After a repeat run exposed port-zero flakiness at Bun's default 20 concurrent tests per worker, capped each worker at eight; three full suites then passed 1,906 tests in 28.17, 27.95, and 28.09 seconds, down from the 63.47-second non-isolated baseline.
- [x] (2026-08-21 15:25Z) Ran the third hosted matrix. Ubuntu and macOS passed the isolated suite, and Windows passed 1,903 tests plus the new cron and worker-close coverage, but `Bun.spawnSync()` again returned exit code zero before the child-created result file existed. Removed `spawnSync` from this path: one asynchronous child now reads and atomically publishes private files while the synchronous caller waits without replaying the request. Ten focused local reruns passed.
- [x] (2026-08-21 15:40Z) Completed Milestone 1: hosted run 32498391333 passed on Ubuntu, macOS, and Windows, confirming the asynchronous-child synchronous JSVM HTTP transport on the pinned Bun v1.4.0 baseline; the downstream Playwright E2E job passed too.
- [x] (2026-08-21 15:40Z) Completed Milestone 2: the four-process isolated suite, explicit UTC/cron timezone behavior, and close-event-backed logger worker shutdown passed on Ubuntu, macOS, and Windows without retries.
- [x] (2026-08-21 18:15Z) Completed Milestone 3: replaced the S3 and HTTP request XML regex/DOM fallbacks and the response serializer with `Bun.XML`, preserving PocketBase scalar roots while rejecting the old malformed multi-root and numeric-element output.
- [x] (2026-08-21 18:35 CEST) Completed Milestone 4: local static responses now keep PocketBun's router behavior while using lazy native `Bun.file()` bodies, and the 16 MiB/256-entry byte cache is gone without adding a replacement compatibility layer.
- [x] (2026-08-21 20:30Z) Completed the local Milestone 5 work and gate: documented the native package-maintenance commands, bound the SSR CSRF example to a per-session identifier, retained normal Playwright after the Bun-hosted runner reproduced oven-sh/bun#28609, and passed both complete test modes plus E2E and repository checks.
- [x] (2026-08-21 20:40Z) Completed Milestone 5 after hosted run 32524400031 passed the pinned Bun v1.4.0 Ubuntu, macOS, Windows, and downstream Playwright gates.
- [x] (2026-08-21 22:05Z) Completed Milestone 6: Bun v1.4.0 source and bundled cluster probes, single-worker baselines, the normal CI matrix, and the extended 10,000-message/100-restart/ten-minute matrix passed on Ubuntu, macOS, and Windows. Linux qualified native shared-port serving; macOS and Windows qualified distinct worker ports behind an external proxy.
- [x] (2026-08-22 00:30Z) Completed Milestone 7: the cluster primary, worker roles, CLI surface, leader-first startup, data-directory guard, readiness, bounded same-slot recovery, and graceful/forced shutdown passed the complete local gate and the hosted Ubuntu, macOS, and Windows CI matrix.
- [x] (2026-08-22 09:30Z) Completed Milestone 8: singleton startup gates, existing cross-process cache notifications, primary-atomic rate limits and expiring claims, cross-worker realtime subscriptions/events/auth invalidation, and targeted OAuth2 delivery passed locally and in hosted Ubuntu, macOS, and Windows CI after commit `4dc010eb`.
- [x] (2026-08-22 09:56Z) Locally implemented Milestone 9: one primary-owned backup lease is mirrored to every worker, owner death releases it, restart recycles the full worker set, and restore quiesces every HTTP server before replacing data and starting fresh workers. Both complete 1,935-test modes and the real three-worker lifecycle suite pass.
- [x] (2026-08-22 10:56Z) Completed Milestone 9 after correcting the Linux-only test race exposed by the first matrix. Hosted run 32568697758 passed Ubuntu, macOS, Windows, and downstream Playwright E2E with the asynchronous backup-owner test hook.
- [ ] (2026-08-22 11:08Z) Started Milestone 10 by auditing the existing real-process coverage instead of duplicating it. The main cluster lifecycle test now exercises POSIX `SIGINT`; POSIX `SIGTERM` remains covered by the state/lifecycle test, Windows retains its supported graceful termination path, and forced primary death remains covered by the qualified runtime probe. The four focused lifecycle tests pass locally.
- [ ] (2026-08-22 12:00Z) The first Milestone 10 matrix passed Ubuntu and macOS. Windows completed the cluster state assertions but hit `EBUSY` while immediately deleting its temporary data directory after the primary exited. The state harness now retains and awaits child-output completion, matching the existing lifecycle harness and proving every worker that inherited those pipes has released its database handles before cleanup. The focused state test passes locally; corrected hosted confirmation is pending.
- [ ] Complete the remaining cluster integration tests, performance measurements, documentation, and final release gate in Milestone 10.

## Surprises & Discoveries

- Observation: Bun v1.4 changes in-process cron interpretation from UTC to the host's local timezone, which conflicts with PocketBun's documented and upstream-compatible UTC default unless PocketBun passes an explicit timezone.
  Evidence: `src/tools/cron/cron.ts` currently calls `Bun.cron(job.Expression(), handler)` without options, while `docs/users/differences.md` promises UTC. The v1.4 release adds a final timezone option to both scheduling and parsing, and PocketBun currently omits PocketBase's `setTimezone` API.
- Observation: process-isolated test parallelism is already a measured win without test failures.
  Evidence: on the local Bun v1.4.0 checkout, `bun test --parallel=4` passed 1,898 tests in 30.21 seconds and `bun test --parallel=4 --concurrent` passed the same 1,898 tests in 28.70 seconds, compared with the earlier approximately 64-second concurrent run.
- Observation: four isolated workers combined with Bun's default 20 concurrent tests per worker can overwhelm port-zero listener creation even when an earlier run passes.
  Evidence: one 1,905-test run passed in 28.63 seconds, but an immediate repeat failed 64 listener-heavy tests with `EADDRINUSE`/`EPERM`. Capping each worker at `--max-concurrency=8` produced two consecutive 1,906-test passes in 28.17 and 27.95 seconds with no meaningful speed loss.
- Observation: the eight-test worker cap reduces but does not eliminate local port-zero pressure when full suites run back-to-back.
  Evidence: after the final Milestone 3 single-process gate, the normal four-worker command failed the same 64 listener-heavy tests in 27.93 seconds; an immediate `--only-failures` rerun passed all 1,913 tests in 28.22 seconds. Hosted CI remains stable, but Milestone 5 should treat another recurrence as a test-runner qualification issue rather than adding retries.
- Observation: `Bun.XML` can replace fragile internal parsing, but its generic JavaScript shape is not identical to PocketBun's existing public XML binding and serialization shapes.
  Evidence: S3 XML responses currently use repeated regular-expression helpers in `src/tools/filesystem/internal/s3blob/s3/`, while `src/tools/router/event.ts` uses `DOMParser` plus a regular-expression fallback and a handwritten serializer. Bun parses repeated tags as arrays, exposes namespace attributes, and requires one root for serialization, so fixed-schema normalization must precede deleting compatibility code.
- Observation: Bun v1.4's dynamic `Bun.file()` responses provide lazy transfer/sendfile and common single byte ranges, but not all of Go `http.ServeContent`.
  Evidence: a local `Bun.serve()` probe returned correct `206` responses for closed, suffix, and open-ended single ranges, but emitted no `Last-Modified`, ignored conditional request headers, and returned the full `200` body for a multipart range. The old PocketBun `FileFS()` byte response did not implement those missing behaviors either, and the Admin UI and `pb_public` clients do not require them. Reimplementing `http.ServeContent` would therefore add a large new subsystem without preserving an existing PocketBun contract; the separate `/api/files` path retains its own range-aware implementation.
- Observation: PocketBun's existing gzip middleware consumes and transforms file bodies when the client requests gzip, so Bun's automatic single-range handling applies to identity-encoded responses.
  Evidence: the real Admin UI route returns native `206`/`Content-Range` behavior with `Accept-Encoding: identity`; with gzip accepted, the middleware returns the full compressed `200` representation. Ignoring a range and returning the complete representation is valid HTTP behavior and does not require another file-serving layer.
- Observation: no current npm dependency has a safe Bun v1.4 replacement.
  Evidence: `go-text-template` supplies Go template semantics; TypeScript is used through its compiler API; Playwright supplies real-browser locators, fixtures, assertions, and cross-platform coverage; oxlint/oxfmt have no Bun equivalent; and the PocketBase JavaScript SDK is intentional compatibility coverage.
- Observation: several attractive Bun-native substitutions remain incompatible with PocketBase requirements.
  Evidence: `Bun.Archive` produces tar rather than PocketBase-compatible ZIP backups; `Request.formData()` materializes uploads rather than preserving PocketBun's disk-spooling behavior; `Bun.WebView` is experimental and is not a Playwright replacement; and open Bun S3 issues still block PocketBun metadata, response-header, arbitrary-header/query, conditional-write, and native-copy behavior.
- Observation: Bun v1.4 still does not make `--no-orphans` safe for PocketBun's ephemeral-port server path.
  Evidence: the existing `Bun.serve({ port: 0 })` reproduction still fails with `EADDRINUSE` under Bun v1.4.0 when `--no-orphans` is enabled, so the existing explicit child cleanup remains necessary.
- Observation: Bun v1.4 exposes separate `Set-Cookie` entries during `Headers` iteration, revealing a response-header merge bug that previously replaced all but the final cookie.
  Evidence: the merge in `src/apis/base.ts` used `Headers.set()` for each missing event header. It now uses `append()`, and `src/apis/base.test.ts` asserts that two event cookies survive as two values from `getSetCookie()`.
- Observation: Bun v1.4 joins duplicate ordinary request headers, but PocketBun's trusted proxy parsing already handles the resulting comma-separated value.
  Evidence: a regression test appends two `X-Forwarded-For` values through `Headers`, omits the raw-header escape hatch, and confirms that `RequestEvent.realIP()` selects the expected rightmost address.
- Observation: the Bun v1.4 install did not require a lockfile-format migration.
  Evidence: `bun install` and `bun install --frozen-lockfile` succeeded; the only lockfile changes update `@types/bun` and `bun-types` from 1.3.14 to 1.4.0 while retaining lockfile version 1.
- Observation: `onTestFinished()` now works from `test.concurrent` on Bun v1.4.0, while the watched issue remains open for documentation; `node:inspector` heap profiling and `--no-orphans` with port zero remain blocked.
  Evidence: focused local reproductions passed for concurrent test cleanup, still rejected `HeapProfiler.enable`, and still produced `EADDRINUSE` for the port-zero orphan check. The maintainer watchlist now distinguishes the fixed runtime behavior from the remaining limitations.
- Observation: Bun v1.4.0's advertised Playwright runtime support still fails for PocketBun's current `@playwright/test` 1.58.2 ESM configuration.
  Evidence: `bun --bun playwright test` exits before loading `playwright.config.ts` because it cannot resolve the synthetic `playwright.config.ts.esm.preflight` module, matching open oven-sh/bun#28609. The normal `bun run e2e` path passes all four tests because the installed Playwright CLI keeps its normal Node runtime.
- Observation: the new Bun package-maintenance commands need no PocketBun wrapper or CI service.
  Evidence: `bun pm licenses --prod --json` reports the installed production TypeScript peer as Apache-2.0, `bun audit fix --dry-run` reports no vulnerabilities across 36 packages, `bun dedupe --check` reports no duplicates across 37 packages, and `bun pm diff typescript@5.9.2 5.9.3` produces the expected source/package diff. `bun pm diff` works even though Bun v1.4.0 omits it from the generic `bun pm --help` command list.
- Observation: Bun v1.4.0 regresses or incompletely fixes Windows `Bun.spawnSync()` completion tracked by oven-sh/bun#27482; the problem is broader than captured stdout.
  Evidence: hosted Windows CI first returned exit code zero with empty piped stdout, run 32493618840 did the same while leaving redirected `Bun.file(...)` output empty, and run 32497069829 returned zero before a child-written file existed. The JSVM HTTP path no longer uses `spawnSync`: one asynchronous child atomically publishes its result while the synchronous caller waits, so no successful request is retried.
- Observation: Bun's XML parser is intentionally stricter about declaration placement than PocketBun's old S3 fixtures.
  Evidence: `Bun.XML.parse()` rejects an XML declaration preceded by indentation because declarations are only legal at the start of a document. Trimming leading whitespace in the internal adapters preserves the earlier tolerance without making malformed XML lenient.
- Observation: `Event.XML()` had no built-in PocketBun or Admin UI consumers, and its handwritten structured-value output was not a compatibility contract worth preserving.
  Evidence: the only PocketBun call sites are the public method, its lowercase alias, and tests. PocketBase pins the XML declaration plus `<string>...</string>` for a scalar string, while PocketBun-only multi-field objects produced several document roots and arrays produced invalid numeric element names. A small scalar-root adapter preserves the upstream case while structured values can use Bun's valid single-root document shape directly.
- Observation: Bun's `Worker.terminate()` remains synchronous and returns `void`; the v1.4 worker `close` event is the usable shutdown-completion signal.
  Evidence: Bun v1.4.0's runtime and declarations both return `undefined`/`void` from `terminate()`, while `WorkerEventMap` includes `close`. The log writer now registers the close listener when it creates the worker, calls `terminate()` after its graceful close-or-timeout path, and resolves `close()` only after that event.
- Observation: Bun's preferred fast HTTP clustering path and `node:cluster` are complementary in PocketBun, not competing server implementations.
  Evidence: Bun's cluster guide says explicit `reusePort` is the faster, more limited alternative, while the v1.4 compatibility notes say `node:http`/`node:https` worker sockets are not shared even though `net` and `dgram` handles now are. PocketBun can use `node:cluster` as the cross-platform control plane while workers continue to use `Bun.serve()`: kernel load balancing on one Linux port, or distinct ports behind an external load balancer elsewhere.
- Observation: Bun v1.4.0's `node:cluster` control plane works with native distinct-port `Bun.serve()` workers on macOS, including source and bundled entrypoints.
  Evidence: `bun run test:cluster-runtime` passed argument preservation, distinct IDs/PIDs, 1,000 ordered structured-clone messages, direct and external-proxy traffic to both workers, five same-slot restarts, graceful request and SSE shutdown, and worker exit after a killed primary. The bundled probe passed the same entry/lifecycle checks with a smaller workload. The extended 10,000-message, 100-restart, ten-minute matrix remains a hosted gate.
- Observation: Bun v1.4.0's cluster source already supplies the minimum parent-death behavior PocketBun needs.
  Evidence: at exact commit `34cbb9a40`, `cluster.fork()` delegates to `child_process.fork()` with the configured executable, arguments, environment, and IPC serialization; the worker-side disconnect handler exits immediately when the primary channel disappears unexpectedly. The probe kills the primary and independently confirms that both child PIDs disappear.
- Observation: graceful `Bun.serve().stop()` waits for an open SSE response in a cluster child, while `stop(true)` remains the required bounded fallback.
  Evidence: the macOS probe held an SSE body open, observed that `stop()` remained pending after 150 milliseconds, canceled the client body, and then observed clean worker shutdown. A separate slow request made graceful stop wait approximately 251 milliseconds until the in-flight response completed.
- Observation: forcing every request in a sustained proxy smoke test to send `Connection: close` exhausts short-lived TCP ports on hosted macOS before it tests cluster longevity.
  Evidence: extended run 32528891337 passed its ten-minute probe on Ubuntu and Windows, but macOS failed after four minutes when the test proxy could no longer open a backend socket (`FailedToOpenSocket`). Retaining fresh connections only for worker-distribution assertions and using normal HTTP connection reuse during the sustained phase passed a five-minute local macOS run with 10,000 IPC messages, 100 restarts, 2,692,375 HTTP requests, and 107,695 SSE requests.
- Observation: a synchronous delay in one Linux `reusePort` worker can also delay a request intended for another worker when the kernel first assigns that connection to the blocked listener.
  Evidence: hosted run 32568199007 passed macOS and Windows but timed out an Ubuntu affinity request after it was assigned to the synchronously sleeping backup owner. Replacing the test hook's `sleep(15000)` with an asynchronous timer keeps the lease active without blocking the listener; five focused local reruns complete in about 3.5 seconds each.
- Observation: awaiting the cluster primary process alone is not a sufficient Windows test-cleanup boundary when descendant workers inherit its output pipes.
  Evidence: hosted run 32570752219 passed every cluster state assertion, then Windows returned `EBUSY` deleting the temporary `pb_data`. The lifecycle harness already awaits output-pipe closure after primary exit; applying the same descendant-completion signal to the state harness passes locally without deletion retries or sleeps.
- Observation: Linux-only port sharing does not imply Linux-only clustering.
  Evidence: Bun documents worker handle passing and therefore built-in HTTP load balancing as the missing non-Linux capability. Worker creation, lifecycle events, and ordinary IPC are separate `node:cluster` capabilities. On Windows/macOS, an external reverse proxy can listen on the public endpoint and balance across worker ports without asking Bun to pass a listening socket. This remains an inference to prove with Bun v1.4.0 integration tests on each operating system.
- Observation: The current Bun implementation automatically recognizes cluster workers, but PocketBun should still set `reusePort: true` explicitly.
  Evidence: Bun's server configuration source currently detects the `NODE_UNIQUE_ID` environment set by `cluster.fork()` and defaults cluster-child `Bun.serve()` instances to port reuse. Explicit configuration makes PocketBun's intended data path visible and prevents a future Bun implementation detail from silently changing it.
- Observation: `node:cluster` does not make a stateful PocketBun application multi-process-correct by itself.
  Evidence: it supplies worker creation, IDs, events, exit detection, and IPC. It does not supply PocketBun readiness, restart policy, migration leadership, cron leadership, realtime fan-out, global rate limits, backup exclusion, or coordinated `Bun.serve().stop()`.
- Observation: PocketBun's integer flag parser previously accepted a numeric prefix instead of validating the complete value.
  Evidence: `Number.parseInt("2.5", 10)` silently produced `2`, which would make a mistyped worker count fork processes. Integer flags now require a complete safe-integer string, and focused CLI tests cover fractional and empty values.
- Observation: the cluster primary can resolve the existing `serve` command and its final inherited flags without loading hooks or opening a database.
  Evidence: default command registration is now reusable, and the command parser exposes a non-executing resolver. The real-process ownership test starts a competing primary against the same `pb_data` and rejects it before worker bootstrap.
- Observation: PocketBun's SQLite configuration is already suitable for multi-process access, within SQLite's normal single-writer limit.
  Evidence: `src/tools/dbx/connect_pragmas.ts` configures a 10-second busy timeout, WAL mode, `synchronous=NORMAL`, and foreign keys for every connection. WAL permits concurrent readers from separate processes; writes remain serialized. Each worker will have independent SQLite page caches and log writers, so memory and write contention must be measured rather than assumed.
- Observation: the existing `.notify` mechanism already solves settings and collection-cache invalidation for several application instances sharing one `pb_data` directory.
  Evidence: `src/core/notify_watcher.ts` writes notification markers and watches/polls them, then calls `ReloadSettings()` or `ReloadCachedCollections()`. Cluster IPC must not add a second cache-invalidation path and cause duplicate reloads.
- Observation: realtime delete delivery needs a prepare/commit protocol, not only a post-commit broadcast.
  Evidence: `src/apis/realtime.ts` deliberately computes and dry-caches delete messages before the record and possibly its parent are deleted, because access rules can depend on data that no longer exists after commit. Remote workers must prepare their own subscribers before the writer continues the delete, then send or discard those cached messages after success or failure.
- Observation: OAuth2 has two process-affinity assumptions that ordinary record-event fan-out does not cover.
  Evidence: `src/apis/record_auth_with_oauth2_redirect.ts` finds a realtime client by ID in the local broker, and temporarily stores Apple's returned name in the local `app.store()`. With kernel connection distribution, the redirect and follow-up request may hit workers other than the worker that owns the realtime client.
- Observation: realtime subscription updates have the same process-affinity requirement as OAuth2 redirects.
  Evidence: the SSE connect response creates the client in one worker's broker, but the later `POST /api/realtime` request can be balanced to another worker. Milestone 8 therefore routes subscription updates to the client owner and reconstructs the request/auth context there instead of assuming transport affinity.
- Observation: detecting duplicate OAuth2 client ownership after delivery is too late.
  Evidence: a one-phase broadcast could report the invariant violation only after both owners had sent the callback. The primary now probes every worker without mutating the subscription, rejects duplicate ownership, and delivers exactly once only when one valid owner remains.
- Observation: the built-in password-reset and verification resend guards are also process-local.
  Evidence: `src/apis/record_auth_password_reset_request.ts` and `src/apis/record_auth_verification_request.ts` place expiring keys in `app.store()`. Without coordination, requests routed to different workers can bypass the intended two-minute guard.
- Observation: backup restore and `app.restart()` cannot be allowed to replace only one cluster child.
  Evidence: `src/core/base_backup.ts` moves the shared data directory and then calls `RestartAsync()`. In cluster mode all other workers must first close the old databases, and the primary—not a child with `NODE_UNIQUE_ID`—must restart the whole application.
- Observation: the restore initiator must stop its HTTP server without running the full termination chain before directory replacement.
  Evidence: the official restore endpoint returns `204` and starts restore asynchronously, so the initiator can force-stop `Bun.serve()` after the response. Running `OnTerminate` at that point would also close the app databases needed by the existing restore transaction; leaving the server open would allow new requests during replacement.
- Observation: successful restore does not require replacing the cluster primary.
  Evidence: the primary has no `App`, SQLite connection, hook runtime, or HTTP listener. Retaining it preserves the ownership guard while replacing every child against the restored data; resetting its small transient coordinator preserves the clean in-memory state of process replacement without platform-specific re-execution machinery.
- Observation: native `Bun.serve()` readiness and shutdown should not be inferred from Node `net.Server` cluster events.
  Evidence: Bun's `cluster` compatibility is built around Node APIs, while PocketBun starts a native Bun server. The worker must explicitly tell the primary when migrations, hooks, and `Bun.serve()` have completed, and PocketBun must explicitly invoke its termination hook chain so `server.stop()` runs.
- Observation: SO_REUSEPORT balances TCP connections, not logical HTTP requests.
  Evidence: HTTP keep-alive and SSE connections stay on the worker that accepted them. Benchmarks and docs must use enough independent connections and must not promise even per-request distribution.

## Decision Log

- Decision: complete the Bun v1.4 compatibility and native-runtime work before starting vertical scaling.
  Rationale: the runtime upgrade has an immediate cron correctness issue and several small, independently verifiable simplifications. Landing those first gives the later cluster work a qualified, stable baseline and prevents both workstreams from changing cron, shutdown, static serving, CI, and tests simultaneously.
  Date/Author: 2026-08-21 / Codex and repository owner
- Decision: do not build or plan a standalone compiled executable in this work.
  Rationale: PocketBun remains primarily an npm library that includes an executable. Embedding the Admin UI into a compiled artifact does not advance that distribution model enough to justify another asset-resolution and platform matrix.
  Date/Author: 2026-08-21 / repository owner
- Decision: adopt Bun v1.4 as the project baseline before production code depends on `Bun.XML` or cron timezone options, while keeping individual changes compatible with Bun v1.3 where that happens naturally.
  Rationale: feature-detection fallbacks would preserve two implementations of the very code this work is intended to delete. A clear minimum runtime and CI baseline is simpler. Incidental compatibility is welcome but is not a reason to retain duplicated parsers.
  Date/Author: 2026-08-21 / Codex
- Decision: pin the initial v1.4 baseline and CI to Bun v1.4.0 exactly, declare `>=1.4.0` for consumers, and keep the existing lockfile format.
  Rationale: v1.4.0 is the stable runtime used for qualification and the minimum that exposes the planned native APIs. An exact CI pin makes failures reproducible, while the package engine remains a normal compatible minimum. Bun v1.4 installs the existing lockfile cleanly, so a format-only rewrite would add noise without value.
  Date/Author: 2026-08-21 / Codex
- Decision: implement synchronous JSVM HTTP through one asynchronous child and private atomic request/result files rather than `Bun.spawnSync()` or request retries.
  Rationale: three hosted Windows runs showed that `spawnSync` can return zero after losing piped output, losing redirected output, or before a direct child write is visible. Retrying cannot distinguish a lost response from an unexecuted request and could repeat POST side effects. The caller therefore launches exactly one child and blocks until that child atomically publishes success or error; the parent removes the private directory in `finally`.
  Date/Author: 2026-08-21 / Codex
- Decision: preserve PocketBase behavior around each Bun-native replacement and keep a compatibility adapter when Bun's generic API does not directly match it.
  Rationale: Bun adoption is an implementation choice, while PocketBase-compatible HTTP, cron, backup, upload, S3, XML, and JavaScript APIs are the product contract. The native implementation is accepted only after differential or regression tests prove that contract.
  Date/Author: 2026-08-21 / Codex and repository owner
- Decision: use `Bun.XML` for both parsing and response serialization; do not preserve accidental PocketBun-only malformed output.
  Rationale: native parsing removes every XML extraction regex and correctly handles namespaces, entities, attributes, repeated nodes, empty nodes, nesting, and malformed documents. `Event.XML()` has no built-in consumer, and custom route clients benefit from well-formed output. A scalar adapter retains PocketBase's tested `<string>` behavior and Go/JSVM-style `bool`, `int64`, and `float64` roots; structured data uses Bun's single-root document format without a second serializer.
  Date/Author: 2026-08-21 / Codex and repository owner
- Decision: use native `Bun.file()` bodies directly for local static responses; do not reimplement Go `http.ServeContent` for conditional and multipart-range edge cases.
  Rationale: the native body removes eager whole-file reads and enables lazy streaming/sendfile plus common byte ranges. PocketBun retains path selection, redirects, SPA fallback, hooks, logging, branding, CSP, cache policy, content type, and content length. The missing Go edge cases were not supported by the previous PocketBun implementation and are unnecessary for the static UI/public routes, while file API delivery remains separately range-aware. The old material byte cache is deleted, so no process memory-pressure listener is justified for the remaining small branding strings.
  Date/Author: 2026-08-21 / Codex and repository owner
- Decision: retain Playwright, the ZIP archive implementation, the streaming multipart parser, the custom S3 client, and the current template/compiler/tooling dependencies.
  Rationale: Bun v1.4 does not provide equivalent semantics. Replacing them would either lose compatibility or require more custom code. Revisit the S3 client only when the listed Bun API gaps close, and revisit other components only when a measured or compatibility-driven need appears.
  Date/Author: 2026-08-21 / Codex
- Decision: document Bun's package-maintenance commands directly instead of adding package scripts, and keep Playwright on its normal runtime until oven-sh/bun#28609 is fixed.
  Rationale: the maintenance commands are already short, read-only review operations and do not justify wrappers. The Bun-hosted Playwright experiment fails before PocketBun code runs, while the existing runner passes. Automatic Bun v1.4 memory, stream, connection-reuse, zlib, and security improvements require no PocketBun integration and are not given project-specific performance claims without PocketBun measurements.
  Date/Author: 2026-08-21 / Codex
- Decision: use Bun's process-isolated parallel test runner after cross-platform qualification, but do not add retries by default.
  Rationale: four workers with eight concurrent tests each retain the measured speedup while avoiding the port-zero failures seen at Bun's default per-worker concurrency. Retries would instead conceal races and contradict the purpose of isolation.
  Date/Author: 2026-08-21 / Codex
- Decision: qualify stable Bun v1.4.0 specifically before implementing vertical scaling.
  Rationale: Bun v1.4.0 is now released, but `node:cluster` remains less battle-tested than PocketBun's existing single-process path. PocketBun must finish the higher-priority v1.4 work and then convert cluster source assumptions into executable probes before cluster production code is written.
  Date/Author: 2026-08-02 / Codex and repository owner
- Decision: keep a short cluster runtime probe in the normal cross-platform CI matrix and run its 10,000-message, 100-restart, ten-minute form through a manual qualification workflow.
  Rationale: source/bundled entrypoints, IPC, native serving, replacement, shutdown, proxy routing, and orphan cleanup are runtime contracts worth retaining. Adding ten minutes to every ordinary CI run is not; the extended workflow provides the release evidence without permanently slowing unrelated changes.
  Date/Author: 2026-08-21 / Codex
- Decision: force fresh HTTP connections only while asserting worker distribution; let the extended smoke phase and its test proxy use normal persistent connection reuse.
  Rationale: connection distribution is a bounded assertion, while production HTTP traffic normally reuses connections. Repeatedly tearing down both proxy hops turned the longevity probe into a macOS ephemeral-port exhaustion test and did not add cluster coverage.
  Date/Author: 2026-08-21 / Codex
- Decision: use `node:cluster` for the control plane on every supported OS, explicit `Bun.serve({ reusePort: true })` on one shared Linux port, and distinct predictable worker ports behind an external traffic distributor on Windows/macOS.
  Rationale: this keeps Bun's fastest native Linux path while retaining worker registry, IPC, lifecycle events, and parent-death behavior elsewhere. The PocketBun primary never accepts or proxies HTTP, so it cannot become the scaling bottleneck.
  Date/Author: 2026-08-02 / Codex and repository owner
- Decision: add no npm supervisor dependency and no PM2 integration.
  Rationale: the runtime already provides the required primitives. PocketBun only needs a small policy layer specific to its own lifecycle. systemd, a Windows service host, or the container runtime remains responsible for the cluster primary.
  Date/Author: 2026-08-02 / Codex and repository owner
- Decision: expose one integer CLI flag, `--workers`, with default `1`; require a positive integer and do not add `auto`, dynamic resize, or autoscaling in the first release.
  Rationale: the existing CLI flag parser already supports integers. An automatic CPU-count default can be wasteful because every process duplicates Bun, hooks, SQLite caches, and logging state, and SQLite writes do not scale with worker count. Operators should choose a measured count deliberately.
  Date/Author: 2026-08-02 / Codex
- Decision: on Windows/macOS, `--http=HOST:PORT` in multi-worker mode defines a consecutive backend range from `PORT` through `PORT + workers - 1`; every replacement worker retains its assigned port slot. Require an explicit loopback host, reject port `0`, reject a range above 65535, and print the backend range plus the requirement for an external reverse proxy. On Linux, all workers use the exact configured address with `reusePort: true`.
  Rationale: a stable consecutive range needs no service-discovery protocol or new CLI flag and can be configured directly in ordinary third-party load balancers. Requiring loopback avoids accidentally exposing every backend port. Single-worker `--http` behavior remains unchanged everywhere.
  Date/Author: 2026-08-02 / Codex and repository owner
- Decision: support one PocketBun cluster primary per `pb_data` directory, not arbitrary independent PocketBun processes and not horizontal servers.
  Rationale: the primary's IPC bus is the consistency boundary for transient state. Two unrelated primaries sharing the same database would have separate realtime, rate-limit, and lease state. Add a same-host ownership guard and fail clearly when another live primary owns that data directory.
  Date/Author: 2026-08-02 / Codex
- Decision: the first supported surface is the standard `pocketbun ... serve` CLI, including server-side JavaScript hooks and migrations. Do not add a generic public cluster factory API in the same change.
  Rationale: `cluster.fork()` re-executes an entrypoint; it cannot serialize an arbitrary already-constructed `App` or JavaScript closure. A public package API would need additional lifecycle design. Stabilize the CLI protocol first and document programmatic embedding as unsupported in multi-worker mode for this release.
  Date/Author: 2026-08-02 / Codex
- Decision: one worker has the durable `leader` role and all others have the `follower` role. The primary is never an application leader.
  Rationale: the leader executes migrations and singleton startup/cron work using a normal PocketBun `App`. If it dies, the primary forks a new leader. The primary stays independent of application hooks, SQLite, and server-side JavaScript.
  Date/Author: 2026-08-02 / Codex
- Decision: start the leader alone, wait for explicit readiness, and only then fork followers.
  Rationale: `serveAsync()` already completes bootstrap and migrations before calling `Bun.serve()`. This ordering guarantees followers never read a partly migrated schema. A leader crash rolls back an in-progress SQLite transaction; a crash after commit but before readiness is safe because the replacement leader rechecks migration history.
  Date/Author: 2026-08-02 / Codex
- Decision: followers skip system migrations, application migrations, generated-type refresh, temporary restore-directory cleanup, installer work, and cron startup after the ready leader gate.
  Rationale: those operations are singleton startup responsibilities. Skipping them avoids redundant migration history traffic, duplicate developer SQL logs, filesystem races, and duplicate scheduled jobs. Followers still bootstrap their own database connections, settings, collection cache, hooks, logger, router, and server.
  Date/Author: 2026-08-02 / Codex
- Decision: keep `.notify` as the only settings and collection-cache invalidation mechanism initially.
  Rationale: it already works across processes and is also useful outside cluster mode. Replacing it with IPC would enlarge the change and create a second correctness path. Measure its 100 ms polling fallback before considering a later optimization.
  Date/Author: 2026-08-02 / Codex
- Decision: preserve built-in global semantics with a small typed primary coordinator; do not make arbitrary `app.store()` values distributed.
  Rationale: the public store can contain non-serializable user values and is naturally per worker. Only known PocketBun built-ins need cluster operations: rate-limit consumption, expiring resend/Apple OAuth state, backup leases, realtime routing, restart, and restore.
  Date/Author: 2026-08-02 / Codex
- Decision: keep the one-worker path direct and synchronous wherever it is synchronous today.
  Rationale: clustering is opt-in. When `--workers=1`, PocketBun must not pay IPC, async middleware, protocol, or supervisor overhead and must retain current observable behavior and performance.
  Date/Author: 2026-08-02 / Codex
- Decision: user record/model hooks run only in the worker that performs the operation; singleton cron callbacks run only in the leader; startup and serve hooks run once per worker.
  Rationale: replaying mutation hooks in all workers would duplicate business side effects. Each worker needs its own router and runtime, so `OnBootstrap` and `OnServe` are per worker. Document the role environment so advanced hooks can guard any external startup side effect.
  Date/Author: 2026-08-02 / Codex
- Decision: implement the Milestone 7 control plane with four direct internal modules and no public cluster API or generic RPC abstraction.
  Rationale: the lifecycle needs only process-local context, a closed handshake/shutdown protocol, one primary supervisor, and one worker adapter. Keeping these internal preserves the unchanged programmatic one-worker API and leaves Milestone 8 to add only concrete coordinator operations.
  Date/Author: 2026-08-22 / Codex
- Decision: use an exclusive token-owned file under `pb_data` for primary ownership and exclude it from backup archives.
  Rationale: an atomic native file operation prevents unrelated primaries from creating separate coordination domains without adding a dependency or holding a database transaction for the process lifetime. PID liveness plus a heartbeat permits stale recovery, while invalid or ambiguous guards fail safe with an inspectable path.
  Date/Author: 2026-08-22 / Codex
- Decision: extend the lifecycle protocol with only concrete Milestone 8 operations and keep the normal path local.
  Rationale: primary-owned limiter/expiry state and acknowledged realtime/OAuth2 routing solve the identified built-in consistency gaps without distributing arbitrary app-store values or introducing a generic RPC layer. Dynamic imports and promise handling occur only in configured cluster workers, so `--workers=1` retains its existing synchronous rate-limit path.
  Date/Author: 2026-08-22 / Codex
- Decision: route realtime subscription updates and use two-phase OAuth2 ownership checks.
  Rationale: HTTP load balancing does not preserve affinity with the worker that accepted an SSE stream. Targeted routing preserves PocketBase's client behavior, while a non-mutating OAuth2 probe prevents duplicate callbacks when the broker ownership invariant is violated.
  Date/Author: 2026-08-22 / Codex
- Decision: keep backup exclusion in one token-owned primary lease, mirror only its name into each worker's existing active-backup store key, and release ownership when the worker exits.
  Rationale: this preserves the existing backup API, delete protection, and health response without adding an IPC query to every read or distributing arbitrary user store values. The primary makes overlapping operations atomic, while the unchanged one-worker path remains local.
  Date/Author: 2026-08-22 / Codex
- Decision: retain the primary across cluster restart and restore, but reset its transient coordinator and recycle every worker; during restore, force-stop the initiator's HTTP server through a narrow registered callback before directory replacement.
  Rationale: only workers own durable application state and database connections, so fresh workers plus a fresh limiter/expiry coordinator reproduce process replacement. Keeping the primary avoids unnecessary `execve` and works uniformly across platforms, while stopping only the initiator's server preserves the app state needed by the existing transaction. Recoverable post-quiesce failure also recycles the initiator before service resumes.
  Date/Author: 2026-08-22 / Codex

## Outcomes & Retrospective

Milestone 1 is complete and qualified on Bun v1.4.0. Every declared minimum and CI pin is aligned, version drift is checked automatically, clean installs work without a lockfile-format migration, and the complete local and hosted gates pass. The breaking-change audit found and fixed one response-cookie merge regression and added coverage for Bun-joined duplicate request headers. Three Windows runs showed that `Bun.spawnSync()` can return zero while losing piped output, losing redirected output, or before a direct child result is visible. PocketBun now avoids `spawnSync` for this path and waits for one asynchronous child's atomically published result without retrying potentially mutating HTTP requests; hosted Windows confirms the workaround.

Milestone 2 is also complete and qualified. Cron remains explicitly UTC on every host, accepts PocketBase `Timezone` values through `SetTimezone`/`setTimezone`, validates and schedules in the same selected zone, and safely restarts active handles after a timezone change. Logger shutdown waits for Bun's worker `close` event after termination, and repeated close remains safe. Four isolated Bun test workers, capped at eight concurrent tests each for listener stability, cut the local full-suite time from about 64 to about 28 seconds across repeated successful runs, while `test:changed` provides the requested direct changed-file command. The complete isolated suite passes on hosted Ubuntu, macOS, and Windows without retries, and Playwright E2E passes downstream. When the Bun v1.4 workstream is complete, record the deleted compatibility code, HTTP and cron parity evidence, final test-time result, retained dependencies, and any rejected native substitutions. When the scaling work is complete, add measured single-worker and multi-worker results, the chosen recommended worker counts, memory and SQLite-contention observations, Bun issues found or ruled out, deviations from this design, and the final validation evidence.

Milestone 3 is complete locally. S3 error, copy, multipart-init, and list responses now share a small compact-shape adapter over `Bun.XML.parse()`; the repeated tag regexes are gone. Request XML uses Bun's ordered tree shape to preserve direct-child names and DOM-style recursive text content. Focused fixtures pin default and prefixed namespaces, attributes, entities, singleton/repeated children, empty tags, nested text, checksums, dates, pagination, malformed S3 error preservation, and the route-level 400 response for malformed request XML. `Event.XML()` now uses `Bun.XML.stringify()` with only scalar-root normalization and the required declaration; structured responses use Bun's valid single-root document shape, and invalid multi-root/root-array input fails instead of emitting malformed XML.

Milestone 4 is complete locally. `Event.FileFS()` now returns lazy `Bun.file()` bodies instead of reading and retaining every local static file in a 16 MiB/256-entry byte cache. Bun handles transfer and common uncompressed byte ranges directly; PocketBun keeps content metadata, path resolution, canonical redirects, `pb_public` SPA fallback, Admin UI branding, CSP, and cache policy. Conditional and multipart-range parity with Go `http.ServeContent` is intentionally not reimplemented because these routes did not previously provide it and their clients do not require it. The separate file API delivery path is unchanged.

Milestone 5 is complete locally and on hosted CI. Maintainers now have direct license, audit-fix preview, deduplication, and dependency-diff commands without added scripts. The custom-route CSRF guidance binds tokens to a stable per-session identifier and keeps the secret outside source control. Normal Playwright E2E passes; forcing Playwright itself onto Bun reproduces the open `.esm.preflight` resolver issue, so PocketBun keeps its working runner and watchlist entry. No dependency, runtime wrapper, global-store configuration, pruning step, platform-support claim, or standalone executable work was added.

Milestone 6 is complete without production cluster code. A self-contained Bun-only probe covers source and bundled execution paths, IPC ordering, native shared/distinct-port data paths, external test proxying, readiness, replacement, graceful request/SSE stop, and primary-death cleanup. The short matrix and corrected ten-minute extended matrix pass on Bun v1.4.0 across Ubuntu, macOS, and Windows. Five-run single-worker read/write medians are recorded before request-path edits. The first extended macOS attempt also usefully separated cluster behavior from a probe-induced short-lived-port exhaustion failure; normal connection reuse is both simpler and representative of sustained HTTP traffic.

Milestone 7 is complete locally and on hosted CI. `pocketbun --workers=N serve` now enters a lightweight primary before hooks or databases open, starts the leader before followers, and uses Bun's qualified shared-port or distinct-port topology. A closed token-authenticated lifecycle protocol verifies readiness, the primary restarts the same role and slot under a bounded crash budget, and shutdown reuses PocketBun's existing termination hooks before force-killing stragglers. An exclusive heartbeat guard prevents two cluster primaries from sharing one data directory and is omitted from backups. Real-process tests cover three worker identities, both role replacements, a competing primary, crash-budget exhaustion, one banner, no orphan processes, and the unchanged `--workers=1` path. The same lifecycle passed hosted Ubuntu, macOS, and Windows CI.

Milestone 8 is complete locally and on hosted CI. Only the leader performs migration, restore-temp cleanup, generated-type refresh, installer, and cron startup work; the existing `.notify` watcher keeps settings and collection caches converged in every worker. The primary owns the exact existing rate-limiter algorithm plus narrowly scoped expiring resend and Apple OAuth2 values. Realtime create/update/delete, auth invalidation, and subscription updates cross worker boundaries with local access checks preserved; OAuth2 uses a non-mutating ownership probe before one targeted delivery. A real three-worker test forces distinct producer/consumer PIDs and covers singleton effects, caches, aggregate limits, resend guards, realtime sequencing/no duplicates, auth invalidation, OAuth2 delivery, and Apple handoff. Both complete local suites pass 1,934 tests, and commit `4dc010eb` passed Ubuntu, macOS, and Windows CI.

Milestone 9 is locally complete and awaits hosted cross-platform confirmation. Backup and restore exclusion is primary-atomic and mirrored through the existing active-backup store key, including automatic owner-death release. `app.restart()` recycles every worker under the lightweight primary. Restore validates while serving, then closes all non-initiators, force-stops the initiator's HTTP server, performs the existing replacement transaction, and starts a completely fresh worker set; Windows retains its explicit unsupported restore result without disturbing the cluster. The real three-worker test covers cross-worker exclusion, delete and health state, a concurrent write, owner death, invalid restore recovery, full restart, restored data, new PIDs, and clean shutdown. Both complete local suites pass 1,935 tests; hosted CI is the remaining milestone gate.

The expected result is simpler than a built-in general-purpose process manager: one primary file, one typed IPC protocol, worker-role checks at existing singleton boundaries, and focused adapters for the handful of process-local features. The performance benefit is expected primarily for concurrent reads and CPU-heavy request/hook work. Writes remain serialized by SQLite, each worker adds memory, and the primary-coordinated rate limiter adds an IPC round trip on routes for which a rate-limit rule applies. Those costs must be measured before the feature is described as a performance advantage.

## Context and Orientation

PocketBun is a Bun-native TypeScript port of PocketBase. The standard CLI entrypoint is `bin/pocketbun`, which imports `src/cli.ts`. `src/cli.ts` constructs a `PocketBase`, registers plugin flags, loads server-side JavaScript hooks and migrations, registers the migrate command and static route, and calls `app.start()`. `PocketBase.Start()` in `src/pocketbase.ts` adds the `serve` and superuser commands, while `PocketBase.Execute()` bootstraps the app, listens for SIGINT/SIGTERM, executes the command, and triggers termination hooks.

The current minimum runtime is declared as Bun 1.4.0 in `package.json`, with matching `@types/bun`; `.github/workflows/ci.yml` pins the same exact version for its operating-system jobs. Generated example/template packages carry the same minimum, and `scripts/check_versions.ts` rejects drift among these sources and the README. `bun.lock` remains at format version 1 because Bun v1.4 installs it cleanly; its deliberate Milestone 1 diff contains only the matching Bun type-package updates.

The first workstream touches four runtime paths. Cron now passes explicit timezone options through `src/tools/cron/cron.ts` and `src/tools/cron/schedule.ts`; logger shutdown awaits the worker close event in `src/tools/logger/log_writer.ts`. S3 response modules under `src/tools/filesystem/internal/s3blob/s3/` and request binding in `src/tools/router/event.ts` now use `Bun.XML.parse()` through compatibility adapters, and XML responses use `Bun.XML.stringify()`. `Event.FileFS()` now passes lazy `Bun.file()` bodies directly to Bun while retaining PocketBun's routing and response headers.

The test and maintenance entrypoints are in `package.json`. The configured test command uses four isolated Bun workers with eight concurrent tests each; `scripts/e2e_run.ts` launches Playwright with its normal runtime; build analysis and CPU/heap profiling already use Bun's newer native tooling. The optional `go-text-template` peer dependency, TypeScript compiler dependency, Playwright, oxlint/oxfmt, and PocketBase JavaScript SDK coverage remain in place for the reasons recorded in the Decision Log.

The `serve` command is defined in `src/cmd/serve.ts`. It calls `serveAsync()` from `src/apis/serve.ts`, then waits for termination. `serveAsync()` bootstraps, runs application migrations, builds the router, calls `Bun.serve()`, registers the `pbGracefulShutdown` hook that calls `server.stop()`, starts the first-superuser installer, and prints the startup banner.

Every `BaseApp` in `src/core/base.ts` opens `data.db` and `auxiliary.db` through the PRAGMAs in `src/tools/dbx/connect_pragmas.ts`. It also owns process-local settings and collection caches, a `Cron`, a subscriptions `Broker`, a logger and log-writer worker, and an arbitrary `Store`. SQLite WAL and busy timeout coordinate database files across processes, but these JavaScript objects are not shared.

For this plan, a **primary** is the one `node:cluster` parent process. It has no PocketBun `App`, no HTTP listener, and no SQLite connection. A **worker** is a cluster child that constructs and serves a normal PocketBun app. The **leader** is the one worker allowed to perform singleton startup and scheduled work. A **follower** is any other worker. The **control plane** is primary/worker supervision and IPC. The **data plane** is the native `Bun.serve()` request path. A **lease** is a primary-owned exclusive marker for a bounded operation such as backup. A **quiesce** stops workers from accepting requests and closes their PocketBun state before restore or full restart.

The Bun facts to revalidate are documented at:

- `https://bun.sh/guides/http/cluster`: Bun's explicit `reusePort` multi-process guide, Linux limitation, and faster-but-more-limited characterization.
- `https://bun.sh/docs/runtime/nodejs-compat`: current `node:cluster` compatibility status and the Linux `SO_REUSEPORT` limitation.
- `https://bun.sh/reference/bun/Serve`: the `reusePort` option and server lifecycle API.
- `https://bun.sh/docs/runtime/http/server`: `server.stop()` behavior and native server lifecycle.
- `https://github.com/oven-sh/bun/tree/main/src/js/internal/cluster`: current primary, child, Worker, and handle implementations.
- `https://github.com/oven-sh/bun/blob/main/src/runtime/server/ServerConfig.rs` or its successor path: current native server handling of `NODE_UNIQUE_ID` and port reuse. Source paths move; search the checked-out Bun source if this link changes.

### Scope boundaries

The Bun v1.4 work covers the runtime baseline and CI; explicit UTC cron behavior and PocketBase-compatible timezone control; deterministic logger-worker shutdown; isolated parallel test execution; native XML parsing for fixed S3 schemas and HTTP request binding; native local-file response streaming where HTTP parity holds; safe cache eviction under memory pressure only if such a cache remains; low-risk package license, audit, diff, deduplication, and changed-test workflows; and an experiment running the existing Playwright suite under Bun. It does not cover a standalone compiled executable, replacement of Playwright with WebView, migration from ZIP to tar, replacement of the disk-spooling multipart parser, migration from `bun:sqlite` to `Bun.sql`, replacement of the custom S3 client, production HTTP/3, global outbound request compression, Temporal migration, rebuilding the vendored Admin UI, or speculative use of unrelated v1.4 parsers, terminal, FFI, crypto, or cgroup APIs.

This feature covers vertical scaling on one host, one `pb_data` directory, one cluster primary, and several worker processes. Linux uses native shared-port balancing. Windows and macOS use distinct loopback worker ports and require an operator-managed traffic distributor; PocketBun will not bundle or recommend a runtime dependency for that external role. It does not cover a shared data directory across servers, network filesystems, Postgres, worker threads, arbitrary independently launched PocketBun processes, automatic worker-count tuning, rolling code deployment, zero-downtime schema migration across two versions, PM2, or a general public supervisor library. Domain-specific CPU work can still use Bun workers or other techniques inside application hooks, but that is separate from framework request scaling.

Package consumers that construct an `App` and call `serveAsync()` directly remain single-process in the first release. They must not set undocumented cluster environment variables. A later public factory can be considered after the CLI feature is proven, using a separate ExecPlan and a concrete package-user requirement.

## Plan of Work

### Milestone 1: establish the Bun v1.4 baseline and compatibility guardrails

Record the exact stable Bun v1.4 patch selected for PocketBun. Update `package.json`'s `engines.bun` and `@types/bun`, both platform pins in `.github/workflows/ci.yml`, `create-pocketbun/package.json`, `create-pocketbun/template/simple/package.json`, and the package files under `examples/` so newly generated and documented projects do not claim an older runtime than the library actually uses. Search the repository for every remaining v1.3 minimum rather than relying only on this list. Run `bun install`, inspect the lockfile diff, and keep a Bun v1.4 lockfile migration only when it is required and clean installs of the root package and generated templates prove it works. Do not use nested overrides, catalogs, or other package-file features solely because v1.4 supports them.

Before replacing implementations, turn the relevant v1.4 breaking changes into focused checks. Confirm cron behavior under a non-UTC `TZ`; duplicate request headers and separate `Set-Cookie` values; every `Request` or `Response` clone occurs before body consumption; graceful `server.stop()` waits for active requests without reintroducing the realtime cleanup race; closing `bun:sqlite` databases finalizes cached statements without breaking application shutdown; fetch failures are treated as generic errors rather than relying on an old error class; and current SQL JSON/date binding remains correct. Keep `--no-orphans` disabled because its ephemeral-port reproduction still fails. Record resolved or still-open workarounds in `docs/maintainers/bun-issues-watchlist.md` only when the evidence changes that document.

Run the full repository gate on the chosen Bun v1.4 patch before depending on new APIs. CI must exercise Ubuntu, macOS, and Windows using that same baseline. Fix warnings as failures. Milestone 1 is complete when package metadata, templates, CI, types, lockfile policy, and documentation agree on the Bun minimum; a clean install works; the existing suite passes on all supported platforms; and the breaking-change audit has either passing regression coverage or a recorded, scoped follow-up in a later milestone.

### Milestone 2: fix cron compatibility and adopt low-risk runtime improvements

Update `src/tools/cron/cron.ts` so UTC is stored as the scheduler default and is passed explicitly to every `Bun.cron()` handle. Pass the same timezone to validation in `src/tools/cron/schedule.ts`, so an expression accepted for a timezone is the expression Bun will execute in that timezone. Port the upstream `SetTimezone` behavior and expose the JavaScript-facing `setTimezone` form required by the repository's API naming rules. Reuse the existing JSVM `Timezone` representation or the smallest shared timezone-name helper rather than inventing a second timezone abstraction. Because Bun cron handles capture their timezone when scheduled, changing timezone on a started scheduler must safely restart its handles; changing it before `Start()` only updates stored configuration. Preserve the default UTC behavior and do not implement PocketBase's independently configurable tick interval in this milestone because Bun owns the tick cadence and v1.4 does not expose an equivalent.

Replace the tests that assert `SetTimezone`/`setTimezone` are absent with upstream-derived and Bun-specific regression tests. Cover the default UTC behavior while the process `TZ` is non-UTC, a named zone such as `Asia/Tokyo`, invalid timezone input at the public boundary, changing timezone before and after start, validation using the selected timezone, and one daylight-saving transition. Process-global timezone tests must be serial or run in a child process. Update generated JSVM declarations and remove only the `setTimezone` omission from `src/plugins/jsvm/types_runtime_contract.test.ts`; leave `setInterval` explicitly unsupported and documented.

In `src/tools/logger/log_writer.ts`, register Bun v1.4's worker `close` event when creating the worker and await that completion signal after calling the synchronous `Worker.terminate()` at the end of the existing graceful close-or-timeout path. Add or adjust the smallest shutdown test that proves `close()` waits for the event and repeated calls remain safe. Do not redesign the log protocol.

Update the normal test scripts to use Bun v1.4's process-isolated `--parallel` together with in-file `--concurrent` execution after CI determines a stable worker count. Add a small changed-files command for local iteration and a timing command only if they can be expressed directly in `package.json`; do not create wrapper scripts for one-line Bun commands. Use timings to choose the worker count and retain `test.serial` for tests that mutate process state or shared resources. Do not add default retries. Milestone 2 is complete when cron matches PocketBase's UTC and timezone behavior, logger shutdown is deterministic, all tests pass on every CI platform with isolation, and the new default is measurably faster without increased flakiness.

### Milestone 3: replace handwritten XML parsing with `Bun.XML`

Begin with the fixed S3 response schemas under `src/tools/filesystem/internal/s3blob/s3/`. Replace the repeated `extractXmlTag` and `extractXmlTags` regular expressions in error, copy-object, multipart-upload, and list-object handling with one small internal normalization helper around `Bun.XML.parse()`. The helper must turn Bun's singleton-or-array representation into the exact existing typed S3 values, decode entities, tolerate expected namespaces, preserve empty values, and continue producing the current normalized errors. Add fixture tests for S3-compatible providers, including a default namespace, one and several `Contents`/`CommonPrefixes` elements, escaped keys/messages, empty tags, malformed XML, checksums, dates, and pagination tokens. Do not change request signing, metadata, upload concurrency, list semantics, or public filesystem behavior in the same change.

After the S3 migration is stable, replace `parseXmlBody()` in `src/tools/router/event.ts` with `Bun.XML.parse()` plus a compatibility adapter that preserves the current request-binding shape. Differential tests must cover repeated and singleton children, namespaces and attributes, entity decoding, empty values, nested values, malformed XML, and the exact errors returned by PocketBase-compatible routes. Delete the `DOMParser` and regular-expression fallback only after these tests pass.

Treat `serializeXml()` separately. Compare `Bun.XML.stringify()` against PocketBase's tested scalar output and PocketBun's structured output, especially primitives, arrays, several top-level fields, escaping, and the required XML declaration. Preserve PocketBase's scalar roots with the smallest adapter, but do not preserve accidental PocketBun-only output that is not a well-formed XML document. Milestone 3 is complete when the parsing regexes and handwritten serializer are gone, XML behavior is pinned by focused tests, S3 and request binding retain their shapes, structured responses use Bun's single-root document format, and no dependency or compatibility fallback for Bun v1.3 remains.

### Milestone 4: stream local static files through `Bun.file()`

Change only the local-file body path in `Event.FileFS()` in `src/tools/router/event.ts`. Preserve its path resolution, traversal protection, canonical redirects, index/SPA fallback, router middleware, hooks, logging, content headers, CSP, Admin UI cache policy, and runtime branding. Return a `Bun.file()`-backed response rather than eagerly reading bytes, and allow Bun v1.4 to provide streaming and sendfile behavior where applicable. Do not replace PocketBun routes with Bun directory routes.

Qualify native behavior for `GET`, `HEAD`, content type and length, and common byte ranges. Preserve missing-file handling, directories and canonical redirects, Admin UI branding, CSP, cache headers, and `pb_public` SPA fallback through focused router and live-server tests. Probe conditional and multipart ranges to understand the boundary, but add an adapter only if an existing PocketBun consumer or file-serving contract requires it; these static UI/public routes do not need byte-for-byte Go `http.ServeContent` behavior.

If parity holds without the current 16 MiB/256-entry byte cache, delete that cache and its eviction code. If a disposable byte or branded-asset cache remains for a measured reason, register one process memory-pressure listener that clears only those reconstructible caches; do not call `Bun.gc()` or clear collection, settings, template, or application state. Keep `src/tools/filesystem/filesystem.ts`'s remote/S3 and multipart-range `ServeResponse()` path unless a separate differential test proves an equally small native path. Milestone 4 is complete when local static responses preserve PocketBase-visible behavior, large files are not fully copied into PocketBun's byte cache, and memory-pressure handling is either narrowly implemented or explicitly skipped because no safe material cache remains.

### Milestone 5: finish Bun v1.4 tooling, documentation, and release qualification

Add or document the useful package-maintenance commands with the least permanent machinery. Use `bun pm licenses --prod --json` to inspect production license obligations, `bun pm diff` during dependency updates, `bun audit fix --dry-run` for review rather than automatic mutation, and `bun dedupe --check` for maintenance. Add scripts only for commands that belong in a repeatable release or CI gate; otherwise document them in `docs/maintainers/README.md`. Do not enable the isolated global package store until a clean-install benchmark and direct-binary audit prove that all invoked tools are declared dependencies. Do not add `bun prune --production` until PocketBun has a container or deployment artifact that benefits from it.

Run the existing Playwright Admin UI suite under Bun with the v1.4 Bun-runtime option while retaining `@playwright/test`, its locators, assertions, fixtures, browser installation, and the normal execution path. Promote the Bun-hosted command only if Linux, macOS, and Windows results are equally reliable; otherwise keep it as an optional experiment with the evidence recorded here. Do not replace Playwright with experimental `Bun.WebView`.

Update the custom SSR documentation example to bind `Bun.CSRF` tokens to an authenticated session identifier where one exists. Document automatic v1.4 benefits such as lower runtime overhead, stream/backpressure improvements, connection reuse, zlib improvements, and security hardening only when useful to operators; they require no PocketBun wrapper. Do not claim new FreeBSD, Windows ARM64, older-Linux, or other platform support until a smoke test covers `Bun.serve`, `bun:sqlite`, `Bun.Image`, hooks, and ZIP backup/restore there. Do not move the TypeScript peer range to TypeScript 7 until that compiler is stable and PocketBun's compiler-API usage passes separately.

Record deliberate non-adoptions in `docs/maintainers/bun-issues-watchlist.md` or this plan only where future maintainers need the constraint: the custom S3 client remains until the open Bun metadata/header/conditional/native-copy gaps close; backups remain ZIP; multipart remains disk-spooled; HTTP/3 remains experimental; fetch compression is not enabled globally because it can affect signed requests; `Bun.sql`, Temporal, WebView, and unrelated format/terminal/FFI/crypto APIs are not product work; and `--no-orphans` remains blocked by the port-zero failure. Do not add user-facing documentation noise for internal non-decisions.

Update `CHANGELOG.md` under `Unreleased` for the user-visible cron/timezone, XML correctness, static serving, runtime baseline, and any operational changes. Run the deterministic documentation pipeline and the full repository gate. Milestone 5 is complete when all Bun v1.4 work in Milestones 1 through 4 is shipped and documented, the test/maintenance workflow is stable, retained dependencies and rejected substitutions still have valid reasons, the worktree contains no standalone-executable work, and vertical scaling can start from a clean v1.4 baseline.

### Milestone 6: qualify stable Bun v1.4.0 for clustering

Do not edit PocketBun cluster production code until Milestones 1 through 5 are complete. Use the exact Bun v1.4 patch established there and review its current official docs and source for `node:cluster`, `Bun.serve({ reusePort })`, process IPC, signals, and the normal source/package executable paths.

Create a temporary or committed PocketBun-only runtime probe under `scripts/repro/bun_issues/` only if the behavior is worth keeping as a regression. The probe must establish all of the following across the applicable Linux, Windows, and macOS matrix:

1. `cluster.fork()` re-executes the source CLI entrypoint with the same arguments, supplies distinct worker IDs and PIDs, and supports request/response IPC with plain structured-clone values.
2. On Linux, several children can each call native `Bun.serve({ hostname, port, reusePort: true })` on one port and all receive connections. Verify with `Connection: close` and enough independent clients; do not infer distribution from keep-alive requests.
3. On Windows and macOS, several children can each call native `Bun.serve()` on an assigned loopback port, ordinary HTTP traffic reaches every worker through an external test reverse proxy, and a replacement worker can reclaim the same port slot. The test proxy belongs to the test harness, not PocketBun production code.
4. Native `Bun.serve()` does not require the Node `cluster` round-robin handle path and the primary does not receive or proxy HTTP descriptors on any platform.
5. A custom worker `ready` IPC message works after `Bun.serve()` returns. Do not depend on `cluster.on("listening")` unless the probe proves it for native `Bun.serve()` and it adds value.
6. `await server.stop()` and `await server.stop(true)` behave as documented in a cluster child. Determine how SSE connections affect graceful stop and record the chosen graceful deadline.
7. An unexpected primary IPC disconnect terminates children, or PocketBun can reliably make it do so. Kill the primary with the platform's ungraceful termination mechanism, verify no orphan workers remain, and treat failure as a blocker.
8. Primary termination handlers, child shutdown messages, worker exit/disconnect events, and exit codes work without double handling by `bin/pocketbun`. Test POSIX signals on Linux/macOS and the Windows console/service termination path separately.
9. `cluster.fork()` works both from `bun run src/cli.ts` and from PocketBun's built `dist/src/cli.js`, which is the executable path shipped with the npm library. Standalone compiled executables are outside scope.
10. IPC preserves ordering from one sender, reports send/disconnect failures, and rejects values PocketBun will not send. Use only strings, numbers, booleans, nulls, arrays, and plain objects in the final protocol.
11. The runtime remains stable through at least 10,000 worker messages, 100 worker restarts, and a ten-minute HTTP/realtime smoke run on every supported platform.

If any required behavior fails, reduce the failing case to a standalone Bun reproduction, file or link a Bun issue, add it to `docs/maintainers/bun-issues-watchlist.md`, update `Surprises & Discoveries`, and pause. Do not hide a runtime defect behind a complex PocketBun supervisor.

Milestone 6 is complete when the exact Bun v1.4 release and probe output are recorded in `Artifacts and Notes`, the shared-port path passes on Linux, and the distinct-port control plane and external-proxy test path pass on Windows and macOS. A platform whose Bun v1.4 cluster lifecycle or IPC fails these probes remains explicitly unsupported until Bun fixes it; lack of `reusePort` alone is not grounds to exclude it.

### Milestone 7: add the minimal cluster lifecycle

Create a small PocketBun-only cluster subsystem under `src/internal/cluster/`, with the required non-upstream header comment. Prefer four straightforward files over a framework:

- `protocol.ts` defines discriminated-union messages and validation for untrusted/malformed IPC.
- `context.ts` exposes process-local `disabled`, `leader`, and `follower` state to existing PocketBun internals without importing `node:cluster` throughout the codebase.
- `primary.ts` owns worker creation, roles, readiness, crash policy, IPC routing, the data-directory ownership guard, and full-cluster shutdown/restart.
- `worker.ts` attaches IPC handlers, sends readiness, invokes graceful termination, and exposes coordinator calls used by built-ins.

Add `--workers` as a root persistent integer flag in `src/cli.ts`, defaulting to `1`. Reject zero, negatives, non-integers, and impractically large values that exceed a documented hard safety cap; start with a simple cap such as 256 only to prevent accidental fork bombs, not to recommend that count. `--workers=1` follows the exact current path and does not import or initialize the cluster manager. `--workers>1` is valid only for the `serve` command. Help, version, migrate, superuser, hooks, and server-js commands remain single-process even when a misplaced flag is present; report a clear usage error rather than forking.

Use the existing command parser rather than a second ad hoc parser. Refactor default command registration out of `PocketBase.Start()` if necessary so `src/cli.ts` can add the `serve` command, parse/find the selected command, and enter the primary path before bootstrap, hook loading, migrations, or `app.start()`. Constructing an unbootstrapped `PocketBase` in the primary is acceptable; opening databases or executing user hooks is not. Add a focused command-parser regression test for root flags before and after `serve`.

Before forking, resolve the final `pb_data` path and acquire a same-host ownership guard. Use an atomic lock-directory or exclusive-file operation containing the primary PID, a random owner token, start time, and heartbeat. On collision, use the platform's safe PID-liveness check plus the heartbeat to prove staleness; if the owner may still be live, fail with the owning PID and data directory. If it is provably stale, recover atomically and continue. Remove the guard on graceful exit; prove stale recovery after an ungraceful primary death on every supported OS. A PID-reuse ambiguity must fail safe and explain the exact guard path an operator can inspect. Do not use SQLite transactions as a lifetime lock and do not add a locking package. The guard's purpose is to prevent two unrelated primaries from creating separate consistency domains for one `pb_data` directory.

The primary assigns each worker a stable numeric slot and forks one leader with internal environment identifying its role, slot, address, and an unguessable per-primary token, then waits for `{ kind: "worker.ready", role: "leader", pid, hostname, port }`. On Linux every slot receives the configured address. On Windows/macOS slot zero receives the configured base port, slot one receives base plus one, and so on; require a loopback hostname, reject port zero, and validate the complete range before forking. The worker sends ready only after `serveAsync()` has completed migrations, built hooks/routes, bound `Bun.serve()`, and attached shutdown. The primary then forks the requested followers. Followers send the same message after serving. Do not print a start banner in each worker. The primary prints one concise cluster banner after all initial workers are ready: the shared public address on Linux, or the backend range and external-proxy requirement elsewhere. Log only lifecycle transitions: role, slot, worker ID, PID, exit code/signal, restart delay, and fatal crash-loop decision.

Add an internal `reusePort` field to `ServeConfig` or an equivalent non-public worker context and pass `reusePort: true` in both synchronous and asynchronous `Bun.serve()` constructors only for Linux cluster workers. Other cluster workers receive their assigned address and leave `reusePort` disabled. Ensure the programmatic one-worker API does not expose or accidentally enable half-configured cluster mode.

Implement a bounded restart policy in the primary. Unexpected follower exit creates a new follower. Unexpected leader exit creates a new leader; do not promote a live follower in the first release because it has skipped singleton bootstrap work. Use a short exponential delay with jitter, reset it after a stable uptime, and terminate the primary with a nonzero result after a small documented crash budget, for example five crashes of the same role in 30 seconds. Intentional shutdown/restart/restore exits never consume the crash budget. Keep constants internal until a real need for configuration appears.

On a platform termination event, the primary stops forking, tells every worker to terminate through the existing `PocketBase.Execute()`/`OnTerminate()` path, waits for acknowledgements and exits, then force-kills stragglers after a documented deadline. Do not duplicate server cleanup: the existing `pbGracefulShutdown` hook remains responsible for `server.stop()`, logger flushing, watcher cleanup, and database close. Preserve POSIX signal exit codes through `bin/pocketbun` and the equivalent Windows exit behavior. Test ungraceful primary termination separately because graceful hooks cannot run.

Milestone 7 is complete when a Linux integration test starts at least three workers on one port and Windows/macOS integration tests start three workers on three predictable loopback ports. Each test observes three distinct PIDs through its public test endpoint, receives a single startup banner, kills each role in turn and observes the correct same-slot replacement, cleanly terminates the primary with no orphan workers, rejects a second primary on the same data directory, and shows unchanged behavior with `--workers=1`.

### Milestone 8: make built-in application behavior cluster-correct

#### Singleton startup and scheduled work

Expose the role through the internal cluster context, not scattered environment checks. In `src/core/base.ts`, only the leader runs system migrations, application migrations, generated `types.d.ts` refresh, deletion of the temporary restore directory, `Cron().Start()`, periodic WAL checkpoint/optimize, log cleanup, OTP/MFA cleanup, and autobackup. In `src/apis/serve.ts`, only the leader runs the first-superuser installer. Followers are forked only after the leader ready gate, so skipping migration execution is safe and deliberate. Do not suppress SQL logging globally; avoid duplicate work itself.

Server-side JavaScript files still load in every worker because each worker needs its own route and hook registrations. Mutation hooks execute in the worker handling the mutation. `OnBootstrap` and `OnServe` execute once per worker. `cronAdd` jobs register in every worker's `Cron` object but only the leader starts its scheduler. Set documented read-only environment values such as `POCKETBUN_CLUSTER_WORKER_ID` and `POCKETBUN_CLUSTER_ROLE` for hooks that need to distinguish per-worker startup side effects. Do not expose the primary token.

Keep `src/core/notify_watcher.ts` active in every worker. Add real-process tests proving a settings update and collection create/update/delete performed through one worker are visible through all other workers within the existing notification tolerance. Do not also broadcast cache reloads over cluster IPC.

#### Typed primary coordination

Extend the protocol only for concrete built-ins. Every request/response message has a unique request ID, an operation discriminator, a timeout, and a response carrying success or a plain error shape. Pending worker requests reject on primary disconnect. The primary removes worker-owned leases and pending operations when a worker exits. Never send `App`, `Record`, `Collection`, `Error`, `Request`, `Response`, functions, or class instances through IPC.

Move or export the existing `RateLimiter` algorithm in `src/apis/middlewares_rate_limit.ts` so the same tested implementation can run in the primary. When clustering is disabled, retain the current local synchronous path exactly. When enabled and a rate-limit rule matches, the worker sends `{ limiterId, clientKey, maxRequests, duration }` to the primary and awaits one atomic consume decision. Make only the cluster branch asynchronous. Clear or replace primary limiter state when settings rules change; sending rule parameters with each request prevents the primary from needing an `App`. Preserve `isClientRateLimited()` behavior or explicitly refactor its callers/tests to an async cluster-aware query. Benchmark this IPC round trip because rate limiting is enabled by default in production guidance.

Add narrowly named expiring-state operations for the built-in password-reset and verification resend claims and Apple's OAuth2 name handoff. A claim must be atomic across workers and expire in the primary. A failed email send releases its claim; a successful send retains it for the current two minutes. Apple's name is stored for the current 60 seconds and consumed once by the OAuth2 continuation regardless of which worker handles it. Do not turn the entire `App.store()` into a remote key/value service; document that custom store values are per worker.

#### Realtime and OAuth2 routing

Refactor `src/apis/realtime.ts` into local delivery plus optional cluster publication. Local delivery continues to evaluate each local client's auth, subscription rule, fields, expand, and enrich hooks in that worker. The writer sends a compact internal event containing action, collection ID, record ID, and a lossless plain snapshot sufficient to reconstruct the `Record` without exposing or dropping hidden fields. Add encode/decode tests for auth records, dates, files, relations, JSON, nulls, and deleted records. A forwarded event must never publish itself again.

For create and update, publish only after mutation success. The primary assigns an event ID and forwards once to every other ready worker; each receiver reconstructs the record, performs access checks against its own subscribers, and acknowledges or logs a bounded delivery failure. Realtime delivery remains asynchronous after commit; a slow or dead worker must not fail the successful database write.

For delete, the writer first sends `realtime.delete.prepare` and awaits primary fan-out plus acknowledgements from every ready remote worker. Each receiver reconstructs the pre-delete record and performs the existing dry-cache work while related database rows still exist. The writer then continues the delete. On success it sends `realtime.delete.commit`; on failure it sends `realtime.delete.abort`. Receivers send or discard the dry-cached messages by event ID. Apply timeouts and clean abandoned dry caches when a worker or primary disconnects. A prepare timeout fails the delete with a clear internal error rather than silently losing remote realtime events.

Forward auth-record update/delete and auth-collection secret/delete invalidations so realtime clients connected to other workers update or lose their cached auth exactly as local clients do. Preserve event ordering from each mutation worker. Add a rapid create/update/delete test to catch stale snapshot or re-publication loops.

For OAuth2 redirect delivery, publish a targeted-client message through the primary. Every worker checks its local broker for the client ID; only the owner sends. The result reports delivered, absent, or duplicate ownership. Treat duplicate ownership as an invariant error and absent as the current missing-client behavior. Store Apple's temporary name through the expiring-state operation before delivering the redirect message, so the later auth request can consume it from any worker.

Milestone 8 is complete when real-process tests force the producer and consumer onto different worker PIDs and prove: record create/update/delete SSE delivery; auth invalidation; OAuth2 redirect delivery; Apple name handoff; aggregate rate limits; password-reset and verification resend guards; one migration application; one installer attempt; one cron/autobackup execution; and settings/collection cache reloads. Run the complete state-coordination suite on Linux and at least one distinct-port end-to-end case for every coordinator operation on Windows/macOS. Tests must verify no duplicate SSE event and no duplicate singleton side effect.

### Milestone 9: coordinate backup, restore, and restart

Replace the cluster-mode use of the local `StoreKeyActiveBackup` guard with an exclusive primary lease while keeping the existing local path for one worker. Broadcast lease state to all workers so the backup API, delete protection, and health response see a consistent active operation without an IPC query on every read. The lease records worker ID and backup name; the primary releases it if that worker exits. Concurrent create/restore calls through different workers must produce the same "another backup/restore" outcome as one process.

Normal backup creation may remain in the requesting worker because SQLite transactions and WAL coordinate the database snapshot. Verify that other-worker writes are blocked/retried exactly as intended and that auxiliary logging does not corrupt the archive. Only the leader runs scheduled autobackup, but a manual backup may run in any worker that acquires the lease.

Restore is a cluster-wide state transition:

1. Acquire the global restore lease and validate/download/extract the backup while the cluster still serves traffic.
2. Ask the primary to enter restoring state. It rejects new coordination work, disables worker replacement, and tells all non-initiating workers to force-stop their Bun server, flush/close PocketBun state, acknowledge, and exit.
3. The initiating worker force-stops its own HTTP server after the restore API has already returned its current 204 response, but keeps the `App` state required by the existing restore transaction.
4. After all other database connections are closed, perform the existing directory replacement and rollback logic in `src/core/base_backup.ts`.
5. On success, report to the primary. The primary terminates the remaining worker, releases the ownership guard, and re-executes the original primary entrypoint with its original arguments and clean environment. Do not call child `execve()` with `NODE_UNIQUE_ID`.
6. On recoverable failure after quiescing, revert the directory changes, report failure, and let the primary fork a fresh leader and followers against the restored old data. On unrecoverable rollback failure, log loudly and terminate the whole cluster nonzero for the external service manager.

PocketBun currently rejects backup restore on Windows, and clustering does not change that scope. Keep the existing explicit Windows error unless a separate upstream-compatible restore project changes it. Test cluster-wide restore on Linux and macOS; test the unchanged rejection plus continued cluster health on Windows.

Make `BaseApp.Restart()` and `RestartAsync()` cluster-aware. A restart request from any worker asks the primary to quiesce and recreate the complete worker set; it never replaces only that child. Recycle workers under the existing primary when that reloads all application state, which also works on Windows without `execve`. Re-execute the primary only when restoring data or replacing primary code actually requires it and the platform supports it. This also gives future hook-watch behavior the correct primitive. Preserve current direct `execve` behavior outside cluster mode.

Milestone 9 is complete when tests create a backup while other workers read and write, reject overlapping operations across workers, restore a known database on supported platforms without any worker retaining an old connection, automatically return with the configured worker count and new data, recover from a deliberately failed restore, preserve the existing Windows restore rejection, and prove `app.restart()` replaces every worker without orphaning processes.

### Milestone 10: hardening, performance, documentation, and release gate

Add cross-platform integration coverage adjacent to `src/internal/cluster/` or in one clearly marked PocketBun-only test file. Use actual child processes and a temporary `pb_data`; in-process multiple `BaseApp` objects are insufficient. Tests that mutate process globals, fixed ports, signals, or shared paths must be serial. Run native same-port tests on Ubuntu and distinct-port tests through a small test-only proxy on macOS and Windows. The proxy must use existing test/runtime facilities and must not become a PocketBun dependency. Keep platform-specific restore and signal cases explicit and raise CI timeouts only with evidence.

Use a test-only hook route that returns cluster worker ID/PID and always make probe requests with fresh connections. Do not add worker identity to PocketBase-compatible production API responses. Provide harness helpers to wait for a desired worker, inspect lifecycle output, signal a PID, and assert cleanup. Avoid timing-only assertions; use IPC-visible state or eventual retries with bounded deadlines.

Cover at least these failure cases:

- leader fails during a migration transaction, after migration commit but before ready, and after ready;
- follower fails during a request, while owning an SSE connection, while holding a backup lease, and while waiting for a primary response;
- primary receives POSIX SIGINT, SIGTERM, and SIGKILL or the equivalent Windows graceful and forced termination events;
- a worker ignores graceful shutdown and is force-killed at the deadline;
- a second primary targets the same `pb_data`, then successfully starts after a stale-guard recovery;
- malformed, duplicated, late, and unknown IPC messages;
- cluster primary disconnect during rate-limit, delete-prepare, OAuth2, backup, and restore operations;
- SQLite busy pressure from concurrent writers and WAL checkpoint/autobackup activity;
- long-lived SSE clients reconnect after their worker dies;
- no worker becomes ready, and repeated crashes exhaust the restart budget.

Build a repeatable benchmark wrapper under `scripts/` using the existing upstream benchmark and `scripts/measure_records_scenario.ts` machinery. Linux is the primary performance target because it has native shared-port balancing. Also run a smaller Windows/macOS validation matrix through the intended external proxy so the portable mode has measured overhead. Record five-run medians for one, two, and four workers on the same host and database for:

- health/static and CPU-light HTTP overhead;
- authenticated single-record and list reads;
- a CPU-heavy server-side JavaScript hook route;
- mixed read/write CRUD;
- write-heavy CRUD;
- realtime connections plus record broadcasts;
- rate-limited requests;
- idle and loaded RSS, CPU, file descriptors, SQLite busy/retry counts, and log-write failures.

Keep connection count, request payloads, database contents, Bun version, CPU affinity, and reverse-proxy involvement fixed. Report requests/second plus p50, p95, and p99 latency. Confirm `--workers=1` is within normal run-to-run noise of the pre-change baseline; investigate a repeatable regression above 2%. Multi-worker release readiness requires a repeatable read-heavy or CPU-heavy gain large enough to justify the memory cost; use at least 20% as the minimum signal, not a marketing promise. Do not require writes to scale, but do not recommend a worker count whose mixed/write workload regresses materially or produces lock errors. Profile any unexpected primary CPU cost, especially global rate limiting and realtime fan-out, following `.agents/PERFORMANCE.md`.

Add an optional ten-minute or longer cluster soak command if the integration harness cannot express repeated crashes, SSE reconnects, CRUD, and settings changes cleanly. Do not add a permanent script solely to wrap one command.

Update user documentation through the deterministic docs pipeline, not only the generated `docs/users/going-to-production.md`. Add an overlay under `scripts/docs/overlays/going-to-production/` and the matching operation in `scripts/docs/apply_pocketbun_patches.ts`. Document:

- opt-in `--workers=N`, default `1`, a Linux systemd example, and the corresponding responsibility of a Windows service host or container runtime;
- that the primary supervises workers while the operating-system/container service manager supervises the primary;
- Linux same-port `SO_REUSEPORT`, Windows/macOS consecutive loopback backend ports, example external load-balancer configuration, and TCP-connection rather than per-request balancing;
- WAL concurrent-read benefits, serialized writes, per-worker memory, and measured worker-count guidance;
- one primary per `pb_data`, with horizontal/shared-network-folder deployment unsupported;
- per-worker `app.store()`, per-worker startup/serve hooks, writer-only mutation hooks, leader-only cron, and the role environment variables;
- graceful shutdown/restart/restore behavior and operational logs;
- the exact supported Bun version and each platform's traffic-distribution and process-lifecycle assumptions.

Update CLI help and README only where they provide discoverability; keep detailed operations in Going to Production. Add a concise user-facing `CHANGELOG.md` item under `Unreleased`, never under an already released version. If runtime qualification exposes a Bun limitation or workaround, update `docs/maintainers/bun-issues-watchlist.md`.

Milestone 10 is complete only after focused and full tests, performance evidence, docs regeneration, package typing, build output, and the full repository gate pass without warnings.

## Concrete Steps

Work from `/Users/pekeler/Projects/pocketbun` on `master`. Preserve unrelated user changes. Update this plan after every milestone and whenever evidence changes a decision.

1. Record `bun --version`, update every Bun minimum/type/CI pin named in Milestone 1, run `bun install`, inspect the complete lockfile diff, and prove clean installation in the root package and generated template.
2. Before using v1.4-only APIs, run the existing full suite and add the focused breaking-change checks from Milestone 1. Run them on Ubuntu, macOS, and Windows and update the Bun watchlist only from reproduced evidence.
3. Add the failing non-UTC and timezone API cron tests, update `src/tools/cron/cron.ts` and `src/tools/cron/schedule.ts`, refresh the JSVM public types/contracts, and update the generated user documentation through its source overlays.
4. Await logger-worker termination and add the focused repeated-close/timeout test. Qualify `--parallel --concurrent` on every CI operating system, then update the direct `package.json` test commands and record before/after timing evidence.
5. Add S3 XML fixtures, introduce the smallest `Bun.XML.parse()` normalization helper, migrate each S3 response parser to it, and delete the repeated tag regular expressions when all focused filesystem tests pass.
6. Add public request/response XML compatibility tests, migrate request parsing, and adopt `Bun.XML.stringify()` only if its compatibility adapter is simpler than retaining the serializer.
7. Add focused local static-file route and live-delivery tests, switch `Event.FileFS()` to a direct `Bun.file()` response, and delete the byte cache after existing router behavior and native single-range delivery pass. Add memory-pressure eviction only if a material disposable cache remains.
8. Add only the repeatable package-maintenance commands that belong in CI/release scripts, document the remaining commands for maintainers, and run the existing Playwright suite under Bun as a cross-platform experiment without removing Playwright.
9. Update `CHANGELOG.md` under `Unreleased`, deterministic documentation sources and output, and relevant maintainer notes. Run the full repository gate and update `Progress`, `Surprises & Discoveries`, `Outcomes & Retrospective`, and `Artifacts and Notes` with the Bun v1.4 results. Do not begin cluster implementation until Milestones 1 through 5 are complete.
10. Run the Milestone 6 cluster probes on Linux, Windows, and macOS using the established Bun baseline. If they pass, run the pre-change single-worker benchmark matrix and save commands, host details, medians, latency, and RSS in `Artifacts and Notes` before editing the request path.
11. Add focused failing tests for CLI worker parsing/platform rules, process roles, protocol validation, startup ordering, and lifecycle behavior.
12. Implement `src/internal/cluster/{protocol,context,primary,worker}.ts`, integrate it into `src/cli.ts`, `src/cmd/serve.ts`, and `src/apis/serve.ts`, then satisfy Milestone 7.
13. Add failing cross-worker tests for each built-in state gap, then update `src/core/base.ts`, `src/core/notify_watcher.ts` only if evidence requires it, `src/apis/middlewares_rate_limit.ts`, `src/apis/realtime.ts`, the OAuth2 files, the reset/verification files, and installer startup to satisfy Milestone 8.
14. Add failing cross-worker backup/restore/restart tests, then update `src/core/base_backup.ts`, `src/apis/backup.ts`, `src/apis/health.ts`, and `src/core/base.ts` to satisfy Milestone 9.
15. Run focused tests after each small change. Use `bun test --only-failures --concurrent` for quieter reruns, while keeping shared-process integration tests serial.
16. Add the benchmark/soak support that remains necessary, run the final one/two/four-worker matrix on Linux plus the smaller Windows/macOS proxy matrix, and record results without selectively dropping bad workloads.
17. Update CLI help, deterministic docs overlays, generated docs, `CHANGELOG.md` under `Unreleased`, and the Bun watchlist if needed for clustering.
18. Run `bun run format:fix`, the configured isolated parallel suite, `bun test --concurrent`, `bun run typecheck`, `bun run typecheck:package`, `bun run lint`, `bun run check:versions`, `bun run docs:check`, `bun run build`, and `git diff --check`.
19. Inspect the complete diff for upstream traceability, comments, unnecessary abstractions, single-worker overhead, secret/token leakage, orphan processes, and destructive recovery behavior. Commit only when the repository owner asks or normal task scope at that time includes a commit.

Representative commands will be finalized after the benchmark wrapper and tests exist. They should settle into stable forms similar to:

    bun --version
    bun test src/tools/cron --concurrent
    bun test src/tools/filesystem/internal/s3blob/s3 --concurrent
    bun test src/tools/router/event.test.ts --concurrent
    bun test --parallel=4 --concurrent
    bun pm licenses --prod --json
    bun audit fix --dry-run
    bun dedupe --check
    bun --bun playwright test
    bun test src/internal/cluster --timeout 60000
    bun run scripts/measure_cluster_scenario.ts --workers 1 --scenario read --runs 5
    bun run scripts/measure_cluster_scenario.ts --workers 2 --scenario read --runs 5
    bun run scripts/measure_cluster_scenario.ts --workers 4 --scenario mixed --runs 5
    bun run format:fix
    bun test --concurrent
    bun run typecheck
    bun run typecheck:package
    bun run lint
    bun run check:versions
    bun run docs:check
    bun run build
    git diff --check

Do not invent the final script or test names merely to match these examples. Update this section to the actual stable commands when they exist.

## Validation and Acceptance

The complete plan is accepted only when all of the following are true. Milestones 1 through 5 have their own release gate and must be accepted before cluster work starts.

Bun v1.4 adoption acceptance:

- Every package, generated template, example, type package, CI job, lockfile, and runtime document agrees on the selected Bun v1.4 minimum, and clean installation plus the full repository gate succeeds on Ubuntu, macOS, and Windows.
- A cron expression scheduled with no timezone runs in UTC even when the host process uses a non-UTC timezone. `SetTimezone` and `setTimezone` accept PocketBun's timezone value, named-zone execution matches Bun across a DST boundary, changing a running scheduler safely reschedules jobs, and `setInterval` remains the only documented missing upstream scheduler control.
- Logger shutdown waits for the worker to terminate after graceful close or timeout, repeated close remains harmless, and no test/process worker is left behind.
- The configured isolated parallel test suite passes all tests on every CI platform without default retries and is materially faster than the prior `--concurrent`-only baseline. Tests that mutate process globals or shared resources remain serial.
- S3 XML errors, copy results, multipart upload IDs, object listings, namespaces, entities, empty values, pagination, dates, and malformed responses retain their typed behavior through `Bun.XML`; the old tag-extraction regexes are removed.
- HTTP XML request binding retains its observable shape and errors. XML response serialization uses Bun with PocketBase-style scalar roots and the required declaration; structured input must be a valid single-root Bun XML document.
- Static and Admin UI routes preserve redirects, fallback, hooks, logging, branding, CSP, caching, content metadata, and `GET`/`HEAD`; Bun provides common single-range delivery for identity-encoded responses at the server boundary. Large local files use a `Bun.file()` body without a redundant whole-file cache. Memory-pressure handling clears only reconstructible caches and is omitted when none remain.
- Package license/audit/deduplication commands and the Bun-hosted Playwright experiment have recorded outcomes. No dependency is removed without semantic equivalence, and no new runtime dependency is added.
- Playwright, ZIP backups, disk-spooled multipart uploads, the custom S3 client, `bun:sqlite`, and the vendored Admin UI build strategy remain intact. HTTP/3, global fetch compression, Temporal, WebView replacement, `Bun.sql`, `--no-orphans`, unrelated Bun APIs, and standalone compiled executable work remain outside scope.
- `CHANGELOG.md`, deterministic generated documentation, maintainer notes, type declarations, formatting, tests, typechecks, lint, version checks, docs checks, build, and whitespace checks all pass without warnings. The recorded result identifies every Bun v1.4 item that was adopted, automatically benefited PocketBun, or was deliberately rejected.

Vertical-scaling functional acceptance:

- `--workers=1` is the default and preserves existing CLI, API, logs, migrations, startup, shutdown, and performance behavior on Linux, macOS, and Windows.
- `--workers=N`, for `N > 1`, starts exactly one primary plus N ready workers on every platform that passes the Bun v1.4 qualification.
- Linux workers serve through one address with explicit native `reusePort: true`. Windows/macOS workers serve through the documented consecutive loopback range and are reachable through an external test proxy. The PocketBun primary never proxies HTTP or opens SQLite.
- Only one leader executes migrations, type refresh, temp cleanup, installer, cron, checkpoints, cleanups, and autobackup. Followers begin only after the leader is ready.
- A crashed follower or leader is replaced with the correct role; a crash loop terminates the primary nonzero; a dead primary leaves no workers.
- Platform termination events and full restart drain or force-stop every worker within the documented deadline, flush logs, close databases, and preserve expected exit behavior.
- A live second primary cannot use the same `pb_data`; stale ownership after a crash recovers safely.
- Settings and collection caches converge through the existing `.notify` mechanism.
- Realtime create, update, delete, auth invalidation, and OAuth2 targeted messages cross workers once and preserve access rules, fields, expand, enrich, and delete dry-cache behavior.
- Rate limits and built-in resend cooldowns are application-wide, not multiplied by worker count. Apple's OAuth2 name handoff works across workers.
- Backup exclusion, backup deletion protection, health state, and `app.restart()` are cluster-wide. Restore is cluster-wide on its currently supported platforms and never leaves a worker attached to the old database files; Windows retains its explicit unsupported error.
- Custom `app.store()` remains explicitly per worker; startup/serve, mutation-hook, and cron execution scopes match the documentation.

Performance acceptance:

- The pre-change and post-change single-worker five-run medians differ by no more than 2% without an explained environmental cause or an approved tradeoff.
- On the chosen multi-core Linux reference host, at least one representative read-heavy or CPU-heavy workload improves by at least 20% with two or more workers, with no correctness failures.
- The report includes RSS and SQLite contention. Documentation recommends measured worker counts and does not claim write scaling.
- Rate-limit IPC, realtime fan-out, logging, and primary CPU do not become unmeasured bottlenecks. Any material cost is documented.

Repository acceptance:

- Focused cluster tests and the full existing suite pass on Ubuntu, macOS, and Windows, with only the already documented platform-specific restore/signal exclusions.
- Formatting, application and package typechecks, lint, build, version checks, deterministic docs checks, and whitespace checks pass without warnings.
- Every new PocketBun-only source/test file has the required explanatory header. Existing upstream comments remain intact, and deviations at touched upstream-derived files explain the Bun/process reason.
- `CHANGELOG.md` has one concise entry under `Unreleased`; generated docs were produced through their overlays; no released changelog section was edited for this feature.
- No runtime dependency was added.

## Idempotence and Recovery

The Bun baseline update and package-maintenance checks are repeatable. Inspect rather than blindly accept lockfile changes; `bun audit fix --dry-run`, `bun dedupe --check`, and license reporting must not mutate dependencies. XML and static-file migrations proceed one schema/path at a time with focused tests passing before old code is deleted, so a failed step can be reverted without a data migration. Cron timezone changes affect only in-memory scheduling and store no persistent state. Test and CI script changes can be returned to `--concurrent` if a platform exposes an isolation defect, with the evidence recorded before retrying.

All Bun v1.4 probes and HTTP tests use temporary directories, dynamic ports, fixed fixtures, and cleanup in `finally`. They must not write to a user's `pb_data`, contact a real S3 bucket, rewrite vendored Admin UI assets, or leave browsers/workers running. Add a static-file compatibility adapter only when a real PocketBun contract requires behavior Bun does not provide.

Runtime probes and benchmarks must use temporary directories and explicit ports and must clean up only processes they created. Every integration harness records child PIDs, terminates them in `finally`, and verifies they are gone. Never use broad process-name kills.

The primary ownership guard must be safe after normal exit, ungraceful platform termination, power loss, and PID reuse. Creation is atomic; stale recovery uses the recorded token, heartbeat, and platform PID-liveness evidence before moving or deleting the exact guard path. Failure to prove staleness stops startup rather than risking two primaries.

Worker startup is retryable. The leader migration transaction provides database rollback; after a committed migration, history makes replay a no-op. Followers are disposable. IPC operations use IDs so late or duplicate responses can be ignored safely. Realtime delete prepare state has an expiry and is explicitly committed or aborted. Worker-owned leases disappear on worker exit.

Graceful shutdown is idempotent: a second signal shortens the wait and force-stops remaining workers, while repeated shutdown messages do not trigger the PocketBun termination hook chain twice. Restore preparation is non-destructive until every other worker is quiesced. Existing directory-revert logic remains the recovery path after replacement begins. If revert cannot be proven successful, stop the cluster and require operator inspection rather than restarting against uncertain data.

The feature is opt-in. If deployment problems appear, setting `--workers=1` returns to the old architecture without converting data or removing a schema table. Do not store cluster coordination in PocketBun's application databases. The only persistent cluster artifact is the recoverable ownership guard under `pb_data`, and it must not be included in backups.

## Artifacts and Notes

Initial repository state when this plan was written:

    Date: 2026-08-02
    Branch: master
    Commit: cd656a7e Improve migration execution logs
    PocketBun version: 0.39.10-pocketbun.0
    Bun minimum and CI baseline: 1.3.14
    Runtime dependencies: none

Current relevant Bun documentation says:

    Bun.serve reusePort: multiple processes may bind one port for load balancing.
    Explicit reusePort clustering: Linux only; Windows/macOS ignore it.
    node:cluster: implemented but not battle-tested; descriptor passing is incomplete.
    Linux node:cluster HTTP load balancing: SO_REUSEPORT.

Bun v1.4 adoption audit snapshot:

    Date: 2026-08-21
    Branch: master
    Commit before plan revision: 0b7f0421
    Local Bun: 1.4.0
    Declared Bun minimum and CI baseline: 1.3.14
    bun test --parallel=4: 1,898 pass, 0 fail, 30.21 seconds
    bun test --parallel=4 --concurrent: 1,898 pass, 0 fail, 28.70 seconds

    Adopt first: explicit cron timezone and SetTimezone, awaited worker termination,
                 isolated parallel tests, Bun.XML parsing, Bun.file static bodies.
    Adopt if still useful: memory-pressure cache eviction, package maintenance checks,
                           Playwright hosted by Bun.
    Retain: Playwright, ZIP archive, multipart spooler, custom S3, bun:sqlite,
            go-text-template, TypeScript compiler API, oxlint, and oxfmt.
    Excluded: standalone compiled executable, WebView replacement, tar backups,
              experimental HTTP/3, global fetch compression, Temporal/Bun.sql rewrites,
              --no-orphans, and unrelated v1.4 APIs.

Milestone 1 local qualification:

    Date: 2026-08-21
    Base commit: f727b2de
    Local Bun: 1.4.0 (34cbb9a40)
    Declared consumer minimum: >=1.4.0
    CI pins and @types/bun: 1.4.0
    bun install: passed; lockfile remained format version 1
    bun install --frozen-lockfile: passed
    generated template clean install and `pocketbun --help`: passed
    bun test --concurrent: 1,899 pass, 0 fail, 7 snapshots,
                           10,111 expect() calls across 242 files in 63.47 seconds
    bun run format: passed
    bun run typecheck: passed
    bun run typecheck:package: passed, including build and consumer declarations
    bun run lint: 0 warnings, 0 errors
    bun run check:versions: passed
    bun run docs:check: passed
    git diff --check: passed
    Hosted CI run 32487391130:
      Ubuntu: passed in 1m34s
      macOS: passed in 1m41s
      Windows: 1,896 pass, 2 skip, 1 fail in 586.27 seconds;
               jsvm http client sync send received empty Bun.spawnSync stdout
      E2E: skipped because Windows failed
    Local file-backed sync result test: 1 pass, 0 fail in 2.27 seconds
    Local full suite after workaround: 1,899 pass, 0 fail in 65.29 seconds
    Local format, application/package typechecks, build, lint, versions,
      generated docs, and whitespace checks after workaround: passed
    Hosted Windows confirmation of the file-backed transport: pending commit push

    Hosted CI run 32493618840:
      Ubuntu: passed in 1m41s
      macOS: passed in 1m47s
      Windows: 1,896 pass, 2 skip, 1 fail in 590.43 seconds;
               child exited zero but stdout redirected to Bun.file was empty
      E2E: skipped because Windows failed
    Local child-written result test: 1 pass, 0 fail in 2.26 seconds
    Hosted CI run 32497069829:
      Ubuntu: passed in 1m10s
      macOS: passed in 1m13s
      Windows: 1,903 pass, 2 skip, 1 fail in 170.18 seconds;
               Bun.spawnSync returned zero before the child-created file existed
      E2E: skipped because Windows failed
    Local asynchronous-child result test: 10 consecutive passes, 0 fail
                                           in 22.42 seconds
    Local full suite after workaround: 1,906 pass, 0 fail in 28.34 seconds
    Local format, application/package typechecks, build, lint, versions,
      generated docs, and whitespace checks after workaround: passed
    Hosted CI run 32498391333:
      Ubuntu checks: passed in 1m06s
      macOS checks: passed in 1m04s
      Windows checks: passed in 3m49s
      Ubuntu Playwright E2E: passed in 1m09s
    Milestone 1 hosted confirmation: complete
    Milestone 2 hosted confirmation: complete

    Breaking-change audit: SQL reads and realtime cleanup were already fixed in
                            b48cece1 and 0b7f0421. Separate Set-Cookie values exposed
                            and prompted one merge fix. Joined duplicate proxy headers,
                            clone ordering, SQLite close, fetch error handling, and SQL
                            binding are compatible or covered. onTestFinished concurrent
                            cleanup now works. Port-zero --no-orphans and inspector heap
                            profiling remain unavailable and documented.

Milestone 2 local qualification:

    Date: 2026-08-21
    Bun: 1.4.0 (34cbb9a40)
    Default and CI test command:
      bun test --parallel=4 --concurrent --max-concurrency=8
    First stable full run: 1,906 pass, 0 fail, 10,133 expect() calls
                           across 242 files in 28.17 seconds
    Immediate repeat: 1,906 pass, 0 fail, 10,133 expect() calls
                      across 242 files in 27.95 seconds
    Exact package-script run: 1,906 pass, 0 fail, 10,133 expect() calls
                              across 242 files in 28.09 seconds
    Final gate run: 1,906 pass, 0 fail, 10,133 expect() calls
                    across 242 files in 28.85 seconds
    Legacy single-process comparison: 1,906 pass, 0 fail
                                      across 242 files in 64.14 seconds
    Uncapped repeat rejected: 1,800 pass, 64 fail from port-zero
                              EADDRINUSE/EPERM listener failures
    bun test --changed --parallel=4 --concurrent: 1,302 pass, 0 fail
                                                   across 126 affected files
                                                   in 25.22 seconds
    Focused cron, JSVM contract, logger, and sync HTTP tests: passed
    bun run format: passed
    bun run typecheck: passed
    bun run typecheck:package: passed, including build and consumer declarations
    bun run lint: 0 warnings, 0 errors
    bun run check:versions: passed
    bun run docs:check: passed
    Hosted isolated-test and worker-close confirmation: run 32498391333 passed

Milestone 3 local qualification:

    Date: 2026-08-21
    Bun: 1.4.0 (34cbb9a40)
    S3 XML parsing: Bun compact shape plus one-or-many/local-name normalization
    Request XML parsing: Bun ordered tree plus recursive DOM-style text content
    Focused S3 and router XML fixtures: passed
    Malformed S3 XML: AggregateError retains SyntaxError and ResponseError
    Malformed routed request XML: standard 400 JSON error response retained
    XML extraction regexes and DOMParser fallback: removed
    Bun.XML.stringify qualification:
      string: PocketBase-compatible <string> root retained by scalar adapter
      boolean and numbers: Go/JSVM-style bool/int64/float64 roots
      null: XML declaration only, matching Go's nil encoding
      structured values: native compact single-root document shape
      object with several roots and root arrays: rejected instead of malformed output
      result: handwritten serializer and escape helper removed
    Full local repository gate:
      bun test --concurrent: 1,913 pass, 0 fail, 7 snapshots,
                             10,165 expect() calls across 242 files
      four-worker test command: first back-to-back run reproduced the known
                                64-test port-zero pressure failure; immediate
                                --only-failures run passed 1,913 tests in 28.22 seconds
      bun run format: passed
      bun run typecheck: passed
      bun run typecheck:package: passed, including build and consumer declarations
      bun run lint: 0 warnings, 0 errors
      bun run check:versions: passed
      bun run docs:check: passed
      git diff --check: passed

Milestone 4 local qualification:

    Date: 2026-08-21
    Bun: 1.4.0 (34cbb9a40)
    Native Bun.file probe:
      ordinary GET/HEAD and single closed/suffix/open ranges: passed
      Last-Modified and conditional request handling: not provided
      multipart byte ranges: ignored with a full 200 response
    Local file body: direct lazy Bun.file response
    Native range coverage: Admin UI asset through the real server with identity encoding
    Deliberate non-adoption: no Go http.ServeContent compatibility layer for
      conditional or multipart ranges; prior PocketBun static routes did not provide them
    Removed cache: 16 MiB / 256 whole-file entries and all eviction code
    Memory-pressure listener: omitted; no material disposable byte cache remains
    Focused router, live Bun.serve, Admin UI, and pb_public-style tests: passed
    bun test --concurrent: 1,915 pass, 0 fail, 7 snapshots,
                           10,185 expect() calls across 242 files in 62.02 seconds
    bun run test: 1,915 pass, 0 fail, 10,185 expect() calls
                  across 242 files in 27.95 seconds
    bun run format:fix: passed
    bun run typecheck: passed
    bun run typecheck:package: passed, including build and consumer declarations
    bun run lint: 0 warnings, 0 errors
    bun run check:versions: passed
    bun run docs:check: passed
    git diff --check: passed

Milestone 5 local qualification:

    Date: 2026-08-21
    Bun: 1.4.0 (34cbb9a40)
    Package maintenance:
      bun pm licenses --prod --json: TypeScript 5.9.3, Apache-2.0
      bun audit fix --dry-run: no vulnerabilities across 36 packages
      bun dedupe --check: no duplicates across 37 packages
      bun pm diff typescript@5.9.2 5.9.3: passed, source/package diff produced
    Playwright:
      bun run e2e: 4 passed in 3.7 seconds
      bun --bun playwright test: failed before config load with
        playwright.config.ts.esm.preflight resolution error; oven-sh/bun#28609
      decision: retain normal Playwright runtime; no Bun-hosted script or CI path added
    SSR CSRF guidance:
      generation and verification use the same stable per-session sessionId
      csrfSecret remains outside source control
      deterministic generated-doc assertions: passed
    Deliberate non-adoptions:
      no global virtual store, production prune step, platform expansion,
      TypeScript 7 change, standalone executable, or replacement dependency
    bun run test: 1,915 pass, 0 fail, 10,185 expect() calls
                  across 242 files in 29.21 seconds
    bun test --concurrent: 1,915 pass, 0 fail, 7 snapshots,
                           10,185 expect() calls across 242 files in 64.95 seconds
    bun run format:fix: passed
    bun run typecheck: passed
    bun run typecheck:package: passed, including build and consumer declarations
    bun run lint: 0 warnings, 0 errors
    bun run check:versions: passed
    bun run docs:check: passed
    git diff --check: passed

Milestone 5 hosted qualification:

    Commit: fc483d6f6d3263b3bbfa112442e2fedc67e25956
    Hosted CI run 32524400031:
      Ubuntu checks: passed
      macOS checks: passed
      Windows checks: passed
      Ubuntu Playwright E2E: passed
    Milestone 5 hosted confirmation: complete

Milestone 6 qualification complete:

    Date: 2026-08-21
    Host: MacBook Pro, Apple M2 Max, 12 cores, 32 GiB RAM,
          macOS arm64 / Darwin 25.5.0
    Bun: 1.4.0 (34cbb9a40)
    Command: bun run test:cluster-runtime
    Source entrypoint:
      distinct worker IDs/PIDs and argument preservation: passed
      ordered plain-value IPC: 1,000 messages passed
      native distinct worker ports and external test proxy: both workers reached
      same-slot replacement: 5 restarts passed
      slow-request graceful stop: passed, approximately 251 ms
      SSE graceful stop: remained pending until client cancellation, then passed
      unexpected primary death: both worker PIDs exited
      two-second smoke: 8,633 HTTP and 345 SSE requests passed
    Bundled entrypoint:
      entrypoint, IPC, ports/proxy, replacement, stop, and smoke checks: passed
      100 ordered messages, 1 restart, 4,250 HTTP and 170 SSE requests
    Extended hosted gate:
      bun run test:cluster-runtime --extended
      Short matrix run 32528050568: Ubuntu, macOS, and Windows passed
      Extended run 32528891337: Ubuntu and Windows passed
      First macOS attempt: probe exhausted short-lived TCP ports after four
                            minutes because both proxy hops forced Connection:
                            close; this was test-induced, not a cluster failure
      Corrected local macOS stress: 10,000 IPC messages, 100 restarts,
                                     five-minute smoke, 2,692,375 HTTP and
                                     107,695 SSE requests passed
      Corrected extended run 32530714864 at commit 7a8f9a48:
        Ubuntu: passed the full ten-minute probe
        macOS: passed the full ten-minute probe
        Windows: passed the full ten-minute probe

    Pre-change single-worker benchmark:
      Raw artifact: .tmp/milestone6-single-worker-baseline.json
      Command per run: bun run scripts/measure_records_scenario.ts
                       --scenario <name> --duration-ms 10000 --concurrency 10
      Runs: 5 per scenario; medians below
      list-records:
        20,971.2 requests/second
        p50 0.401 ms, p95 0.829 ms, p99 1.621 ms
        idle RSS 72.19 MiB, peak RSS 121.92 MiB
      create-organizations-rule:
        15,991.7 requests/second
        p50 0.424 ms, p95 0.974 ms, p99 7.059 ms
        idle RSS 83.97 MiB, peak RSS 163.11 MiB
      request-path production edits after this baseline: none

    Local repository gate:
      bun run test:cluster-runtime: passed
      bun run test: 1,915 pass, 0 fail, 10,185 expect() calls
                    across 242 files in 27.95 seconds
      bun test --concurrent: 1,915 pass, 0 fail, 7 snapshots,
                             10,185 expect() calls across 242 files in 64.34 seconds
      bun run format:fix: passed
      bun run typecheck: passed
      bun run typecheck:package: passed, including build and declarations
      bun run lint: 0 warnings, 0 errors
      bun run check:versions: passed for both CI workflow pins
      bun run docs:check: passed
      bun run build: passed
      git diff --check: passed

Milestone 7 local qualification:

    Date: 2026-08-22
    Bun: 1.4.0 (34cbb9a40)
    Public CLI: --workers=<1..256>, serve only for counts above one
    Primary: no hooks, bootstrap, HTTP listener, or SQLite connection
    Startup: leader ready before followers are forked
    Linux data plane: explicit Bun.serve({ reusePort: true }) on one address
    macOS/Windows data plane: consecutive loopback backend ports
    Ownership: exclusive .pocketbun-cluster.lock with PID, token, start time,
               one-second heartbeat, fail-safe collision, and stale recovery
    Recovery: same role and slot; five crashes per role in 30 seconds is fatal
    Shutdown: ten-second graceful deadline followed by a two-second force deadline
    Focused parser, protocol, context, guard, and lifecycle tests:
      38 pass, 0 fail, 173 expect() calls in 3.08 seconds
    Real-process lifecycle coverage:
      three distinct workers, one banner, follower and leader same-slot replacement,
      competing-primary rejection, crash-budget exhaustion, graceful cleanup,
      no orphan PIDs, and unchanged --workers=1 behavior
    bun run test: 1,928 pass, 0 fail, 10,268 expect() calls
                  across 246 files in 25.78 seconds
    bun test --concurrent: 1,928 pass, 0 fail, 7 snapshots,
                           10,268 expect() calls across 246 files in 67.66 seconds
    bun run format:fix and bun run format: passed
    bun run typecheck: passed
    bun run typecheck:package: passed, including build and declarations
    bun run lint: 0 warnings, 0 errors
    bun run check:versions: passed
    bun run docs:check: passed
    git diff --check: passed
    Hosted Ubuntu/macOS/Windows lifecycle confirmation: passed after commit 8f5dc4d8

Milestone 8 local qualification:

    Date: 2026-08-22
    Bun: 1.4.0 (34cbb9a40)
    Singleton role: migrations, restore-temp cleanup, generated types, installer,
                    and Cron.Start run only in disabled/leader roles
    Shared durable cache state: existing pb_data/.notify watcher in every worker
    Primary transient state: aggregate rate limiter; token-owned expiring claims;
                             one-shot Apple OAuth2 values
    Realtime: remote subscription routing; lossless record snapshots; create/update
              fan-out; acknowledged delete prepare/commit/abort; auth invalidation
    OAuth2: non-mutating all-worker ownership probe followed by one targeted delivery
    Focused final OAuth/protocol/OTP/state qualification: 44 pass, 0 fail
    Real-process state coverage: three workers; one migration, installer, and cron effect;
                                 settings/collection convergence; aggregate limits;
                                 resend claims; remote subscribe/create/update/delete;
                                 no duplicate SSE; auth invalidation; OAuth2/Apple handoff
    bun run test: 1,934 pass, 0 fail, 10,341 expect() calls
                  across 248 files in 25.59 seconds
    bun test --concurrent: 1,934 pass, 0 fail, 7 snapshots,
                           10,341 expect() calls across 248 files in 68.15 seconds
    bun run format:fix and bun run format: passed
    bun run typecheck: passed
    bun run typecheck:package: passed, including build and declarations
    bun run lint: 0 warnings, 0 errors
    bun run check:versions: passed
    bun run docs:check: passed
    git diff --check: passed
    Hosted Ubuntu/macOS/Windows state-coordination confirmation: passed after commit 4dc010eb

Milestone 9 local qualification:

    Date: 2026-08-22
    Bun: 1.4.0 (34cbb9a40)
    Backup exclusion: one token-owned primary lease mirrored through StoreKeyActiveBackup
    Owner failure: worker exit releases the lease and clears the surviving worker mirrors
    Restart: app.restart() resets transient coordination and recycles every worker
    Restore preparation: validate and extract while serving; stop non-initiators; force-stop
                         the initiator HTTP server while retaining its restore transaction state
    Restore completion: reset transient coordination and recycle all workers against restored
                        data; keep the lightweight primary and data-directory ownership guard
    Recovery: invalid archives leave the live worker set unchanged; recoverable post-quiesce
              failures recycle the initiator and repopulate every slot; rollback failure is fatal
    Windows: restore remains explicitly unsupported and leaves all workers healthy
    Focused backup/base/protocol/coordinator qualification: 70 pass, 0 fail, 286 expect() calls
    Real-process state coverage: global health/delete exclusion; overlapping backup rejection;
                                 concurrent settings write; owner SIGKILL lease recovery;
                                 invalid restore; app.restart full PID replacement; known-data
                                 restore with all-new PIDs; configured three-worker recovery
    bun run test: 1,935 pass, 0 fail, 10,371 expect() calls
                  across 248 files in 25.86 seconds
    bun test --concurrent: 1,935 pass, 0 fail, 7 snapshots,
                           10,371 expect() calls across 248 files in 69.84 seconds
    bun run format:fix and bun run format: passed
    bun run typecheck: passed
    bun run typecheck:package: passed, including build and declarations
    bun run lint: 0 warnings, 0 errors
    bun run check:versions: passed
    bun run docs:check: passed
    bun run build: passed
    git diff --check: passed
    Hosted run 32568199007:
      macOS and Windows: passed
      Ubuntu: one test-only affinity timeout while the selected reusePort worker synchronously slept
      Correction: asynchronous hook timers; 5 focused passes and the complete 1,935-test concurrent suite pass locally
    Hosted run 32568697758:
      Ubuntu checks: passed
      macOS checks: passed
      Windows checks: passed
      Ubuntu Playwright E2E: passed
    Hosted Ubuntu/macOS/Windows backup/lifecycle confirmation: complete

Current PocketBun coordination inventory:

    SQLite database truth              already cross-process through WAL/busy timeout
    Settings/collection cache reload   already cross-process through pb_data/.notify
    Subscriptions broker               process-local; must fan out/reconstruct events
    OAuth2 realtime client lookup      process-local; must route targeted message
    Apple OAuth2 temporary name        process-local; must use expiring coordinator state
    Rate limiter                       process-local; must make consumption primary-atomic
    Reset/verification resend guards   process-local; must make claims primary-atomic
    App Store for user hooks           remains process-local and documented
    Cron and autobackup                 process-local; start leader only
    Installer                          process-local; run leader only
    Migration/temp startup work        process-local invocation; run leader only
    Backup active marker               primary lease mirrored into each worker
    Restore and app.restart             primary-coordinated full-worker recycle
    Logger/log writer                  per worker; SQLite coordinates, measure contention

Add the exact Bun qualification transcript, reproduction links, benchmark host, commands, raw result paths, five-run medians, RSS, SQLite contention, and final test counts here as work proceeds. Keep short extracts in this plan and store bulky machine-readable output under ignored `.tmp/` paths or the established benchmark artifact location.

## Interfaces and Dependencies

No runtime dependency is permitted. Use Bun, Web, and Bun-supported `node:` APIs only: `node:cluster`, `node:process`, `node:fs`/`node:fs/promises`, and the existing Bun server and SQLite APIs.

The Bun v1.4 work uses these native interfaces directly and keeps adapters internal:

    Bun.cron(expression, callback, { tz: timezoneName })
    Bun.cron.parse(expression, { tz: timezoneName })
    Bun.XML.parse(xml)
    Bun.XML.stringify(value)
    Bun.file(absolutePath)
    new Response(Bun.file(absolutePath), responseInit)
    await worker.terminate()

Use the actual v1.4 type signatures after updating `@types/bun`; the conceptual signatures above describe intent rather than authorizing casts around type errors. If a memory-pressure listener remains useful after cache removal, use Bun's documented process event directly and register it once. Do not export XML normalization, static cache controls, or Bun-specific cron handles from `index.ts`. The public scheduler surface should gain PocketBase-compatible `SetTimezone` and JavaScript-facing `setTimezone`; the stored value is an IANA timezone name with UTC as the default.

The project remains an npm library with the executable supplied by that package. Do not add compiled-asset lookup, `$bunfs` paths, `Bun.isStandaloneExecutable` branches, or standalone build outputs.

The initial public CLI contract is:

    --workers int    number of PocketBun HTTP worker processes (default 1)

The exact flag placement follows the root persistent-flag behavior, so both of these remain equivalent if the current parser supports them:

    pocketbun --workers=4 serve
    pocketbun serve --workers=4

On Linux these workers all bind the configured `--http` address with `reusePort`. On Windows/macOS the configured port is the first loopback backend port and subsequent workers use consecutive ports. For example, `--workers=4 serve --http=127.0.0.1:9000` produces backends `127.0.0.1:9000` through `127.0.0.1:9003`, which the operator places behind a separate public reverse proxy or load balancer.

Do not export cluster internals from `index.ts` in this release. Internal process context should expose only what PocketBun built-ins need, conceptually:

    type ClusterRole = "disabled" | "leader" | "follower";
    function clusterRole(): ClusterRole;
    function clusterWorkerId(): number | null;
    function clusterEnabled(): boolean;

The IPC envelope must be a closed discriminated union. Use a protocol version in the initial handshake so workers from a mismatched executable fail immediately instead of exchanging partially compatible messages. Conceptually:

    type Envelope =
      | { version: 1; kind: "worker.ready"; role: "leader" | "follower"; workerId: number; pid: number; hostname: string; port: number }
      | { version: 1; kind: "worker.stopped"; workerId: number }
      | { version: 1; kind: "coordinator.request"; requestId: string; workerId: number; operation: CoordinatorOperation }
      | { version: 1; kind: "coordinator.response"; requestId: string; ok: boolean; value?: boolean | string | null; error?: { message: string } }
      | { version: 1; kind: "coordinator.delivery"; requestId: string; operation: CoordinatorDeliveryOperation }
      | { version: 1; kind: "coordinator.delivery-result"; requestId: string; workerId: number; ok: boolean; value?: string; error?: { message: string } }
      | { version: 1; kind: "control.shutdown"; force: boolean }
      | { version: 1; kind: "control.restart" }
      | { version: 1; kind: "control.quiesce"; reason: "restore" | "restart" };

Keep concrete operation variants beside this union and validate both directions. Do not add a generic RPC framework, service container, event emitter abstraction, external serialization library, or distributed-store interface. The smallest native implementation that passes the acceptance tests is the intended design.

Revision note, 2026-08-02 / Codex: Replaced the completed PocketBase v0.39.10 upgrade plan with a deferred implementation plan for vertical scaling. The plan records the agreed Bun `node:cluster` control plane, native Linux `reusePort` data plane, PocketBun process-local correctness inventory, lifecycle and IPC design, backup/restore recovery, performance work, documentation, and release acceptance criteria.

Revision note, 2026-08-02 / Codex: Corrected the implementation gate to stable Bun v1.4.0 and separated clustering from Linux-only port sharing. Added the portable Windows/macOS design using predictable consecutive loopback worker ports behind an external traffic distributor, plus cross-platform qualification, lifecycle, test, documentation, and acceptance requirements.

Revision note, 2026-08-21 / Codex: Made the Bun v1.4 compatibility and native-runtime audit the active first workstream and moved the existing vertical-scaling plan to Milestones 6 through 10. Added executable milestones for the runtime/CI baseline, cron UTC and timezone compatibility, logger shutdown, isolated parallel tests, `Bun.XML`, `Bun.file`, cache pressure, package maintenance, Playwright-on-Bun qualification, documentation, and full acceptance. Recorded the retained dependencies and native substitutions that would sacrifice PocketBase compatibility. Explicitly excluded a standalone compiled executable because PocketBun remains an npm library with an included executable.

Revision note, 2026-08-21 / Codex: Recorded the locally complete Bun v1.4.0 baseline implementation and breaking-change audit. Added the exact install and validation evidence, the response-cookie regression found during qualification, the request-header guard, retained lockfile-format decision, and hosted cross-platform CI as the sole remaining Milestone 1 acceptance item.

Revision note, 2026-08-21 / Codex: Recorded the first hosted Bun v1.4.0 matrix and its Windows-only recurrence of oven-sh/bun#27482. Chose a private file for synchronous child results instead of retrying requests, updated the watchlist after the upstream reopening request, and kept Windows confirmation as the remaining Milestone 1 gate.

Revision note, 2026-08-21 / Codex: Recorded the second Windows failure showing that `Bun.spawnSync()` stdout redirected to `Bun.file(...)` can also disappear, moved the result write into the child, and kept hosted confirmation as the final Milestone 1 gate. Recorded the locally complete Milestone 2 cron, worker-close, isolated-test, changed-file, documentation, and timing evidence; cross-platform CI remains its final gate.

Revision note, 2026-08-21 / Codex: Recorded the third Windows failure showing that `Bun.spawnSync()` can return zero before even a direct child-created file exists. Removed `spawnSync` from synchronous JSVM HTTP, retained a single non-retried request through an asynchronous child and atomically published private files, and kept one further Windows run as the Milestone 1 and 2 acceptance gate.

Revision note, 2026-08-21 / Codex: Recorded successful hosted run 32498391333 across Ubuntu, macOS, Windows, and downstream Playwright E2E. Marked Milestones 1 and 2 complete after the asynchronous-child JSVM HTTP transport, isolated test workflow, cron timezone behavior, and worker-close shutdown all passed their cross-platform acceptance gates.

Revision note, 2026-08-21 / Codex: Completed Milestone 3 with native Bun XML parsing for fixed S3 schemas and request binding, including normalization and malformed-input coverage. After reviewing consumers with the repository owner, also adopted native Bun response serialization: PocketBase scalar roots remain supported, while undocumented PocketBun multi-root and numeric-element output is treated as a porting bug rather than a compatibility contract.

Revision note, 2026-08-21 / Codex: Completed Milestone 4 by replacing local static-file byte loading and the bounded whole-file cache with direct lazy `Bun.file()` responses. After reviewing the actual consumers with the repository owner, removed the proposed Go `http.ServeContent` compatibility layer: Admin UI and `pb_public` routes retain their routing, headers, and common native uncompressed range behavior without owning conditional and multipart-range machinery they did not previously provide.

Revision note, 2026-08-21 / Codex: Completed Milestone 5 locally with direct Bun license/audit/dedupe/dependency-diff maintenance guidance, per-session CSRF documentation, and the final local repository gate. Retained the normal Playwright runtime after `bun --bun playwright test` reproduced open oven-sh/bun#28609 despite Bun 1.4's advertised support; added the issue to the watchlist and left hosted CI as the final gate before clustering.

Revision note, 2026-08-21 / Codex: Closed Milestone 5 after hosted run 32524400031 passed on Ubuntu, macOS, Windows, and Playwright E2E. Started Milestone 6 without production cluster code: added a short cross-platform source/bundled `node:cluster` runtime probe plus a manual extended workflow, passed the local macOS probe, and recorded five-run single-worker read/write throughput, latency, and RSS baselines.

Revision note, 2026-08-21 / Codex: Recorded successful short cluster qualification on all hosted platforms and the first extended run's Ubuntu/Windows passes. Diagnosed the macOS failure as probe-induced short-lived-port exhaustion from forcing `Connection: close` across both proxy hops, retained fresh connections for distribution assertions only, and passed a five-minute corrected macOS stress run beyond the previous failure point. The corrected hosted extended matrix remains the Milestone 6 gate.

Revision note, 2026-08-21 / Codex: Closed Milestone 6 after corrected extended run 32530714864 passed its 10,000-message, 100-restart, ten-minute probe on Ubuntu, macOS, and Windows at commit 7a8f9a48. Bun v1.4.0 is qualified for native shared-port cluster serving on Linux and the planned distinct-port/external-proxy topology on macOS and Windows; Milestone 7 production implementation can begin from the recorded single-worker baselines.

Revision note, 2026-08-22 / Codex: Implemented Milestone 7's minimal production cluster lifecycle with an internal four-module control plane, strict `--workers` parsing, pre-bootstrap command resolution, explicit Bun serving topology, leader-first readiness, same-slot crash recovery, bounded shutdown, and a backup-excluded data-directory ownership guard. Recorded complete local real-process and repository gates; hosted Ubuntu, macOS, and Windows confirmation remains the milestone gate before Milestone 8.

Revision note, 2026-08-22 / Codex: Closed Milestone 7 after the lifecycle commit passed hosted Ubuntu, macOS, and Windows CI. Implemented Milestone 8 locally with leader-only singleton work, primary-atomic limiter/expiry state, acknowledged realtime fan-out and subscription routing, and probe-then-deliver OAuth2 routing. Recorded the complete 1,934-test local gates and real three-worker state evidence; hosted cross-platform confirmation remains the milestone gate.

Revision note, 2026-08-22 / Codex: Closed Milestone 8 after commit `4dc010eb` passed hosted Ubuntu, macOS, and Windows CI. Implemented Milestone 9 locally with a worker-owned primary backup lease and mirrored health/delete state, owner-death cleanup, full-worker `app.restart()`, and restore quiescence that force-stops every HTTP server before directory replacement. Kept the stateless primary across restore instead of re-executing it, and recorded the complete 1,935-test local gates; hosted cross-platform confirmation remains the milestone gate.

Revision note, 2026-08-22 / Codex: Recorded Milestone 9 hosted run 32568199007: macOS and Windows passed, while Ubuntu exposed a test-only interaction between a synchronous 15-second hook delay and kernel `reusePort` connection assignment. Changed the test hook to hold the primary backup lease asynchronously so every listener remains responsive, then passed five focused lifecycle reruns and the complete concurrent suite locally; corrected hosted confirmation remains the milestone gate.

Revision note, 2026-08-22 / Codex: Closed Milestone 9 after corrected hosted run 32568697758 passed the complete Ubuntu, macOS, Windows, and downstream Playwright E2E matrix at commit `bb15bad4`. Cluster-wide backup exclusion, owner-death recovery, restart, supported-platform restore, and Windows restore rejection are now qualified; Milestone 10 is the remaining hardening, performance, documentation, and release gate.

Revision note, 2026-08-22 / Codex: Started Milestone 10 with POSIX `SIGINT` coverage in the existing real-process lifecycle test. Recorded hosted run 32570752219: Ubuntu and macOS passed, while Windows completed the cluster behavior and failed only because the state harness deleted its temporary data immediately after primary exit. Reused the lifecycle harness's output-pipe completion signal so cleanup waits for all descendants without adding sleeps or filesystem retries; corrected hosted confirmation remains pending.
