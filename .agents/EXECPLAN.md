# Add Vertical Scaling with Bun `node:cluster`

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. This document follows `.agents/PLANS.md`.

Implementation is deliberately paused until stable Bun v1.4.0 is released. Do not start changing production code merely because this plan exists. Resume only after v1.4.0 is available and Milestone 1's runtime qualification passes.

## Purpose / Big Picture

PocketBun currently runs one Bun process and one JavaScript event loop. A single process is already competitive with PocketBase, but a server with several CPU cores cannot use those cores for parallel HTTP request handling. After this work, an operator will be able to run:

    pocketbun --workers=4 serve --http=127.0.0.1:8090

One lightweight primary process will supervise four PocketBun worker processes. On Linux, every worker will call the existing native `Bun.serve()` implementation on the same address with `reusePort: true`, and the kernel will distribute incoming TCP connections with `SO_REUSEPORT`. On Windows and macOS, where Bun cannot share that listening port, workers will bind predictable consecutive loopback ports and an operator-provided reverse proxy or load balancer will distribute traffic across them. The primary will not proxy HTTP or open PocketBun's SQLite databases. It will supervise worker lifecycles and coordinate only the process-local state that must be shared for correctness.

The operator will still supervise the one cluster primary with systemd, a Windows service host, Docker, or an equivalent operating-system service manager. No npm process manager or PocketBun-specific daemon dependency will be added. The default remains one process (`--workers=1`) on every operating system. Multi-worker mode is opt-in. Linux has the zero-extra-hop shared-port path; Windows and macOS require the external traffic distributor.

Success is observable, not architectural: several worker process IDs must answer through one public endpoint; read-heavy throughput must improve on a multi-core machine; migrations and scheduled work must run once; realtime, OAuth2 redirects, rate limits, backups, settings reloads, and shutdown must behave as one PocketBun application; and killing a worker must not take down the service.

## Progress

- [x] (2026-08-02 16:00Z) Confirmed the agreed direction: Bun `node:cluster` for supervision and IPC, native same-port `Bun.serve({ reusePort: true })` on Linux, predictable per-worker ports behind an external traffic distributor on Windows/macOS, and an external service manager for the primary.
- [x] (2026-08-02 16:00Z) Audited PocketBun startup, migrations, SQLite configuration, cron, realtime, rate limiting, backup/restore, settings notifications, OAuth2 redirect state, email resend guards, logging, docs generation, CI, and benchmark tooling.
- [x] (2026-08-02 16:00Z) Recorded the current Bun documentation and source-level assumptions that must be revalidated with stable Bun v1.4.0.
- [x] (2026-08-02 16:00Z) Replaced the completed PocketBase v0.39.10 upgrade plan with this deferred, self-contained implementation plan.
- [x] (2026-08-02 16:30Z) Corrected the gate to Bun v1.4.0 and expanded the plan beyond Linux port sharing: Windows/macOS use predictable worker ports behind an external traffic distributor, subject to v1.4 qualification.
- [ ] Wait for stable Bun v1.4.0; update the PocketBun Bun baseline separately or at the start of this work, then complete the runtime qualification in Milestone 1 on Linux, Windows, and macOS.
- [ ] Implement the cluster primary, worker roles, CLI surface, startup ordering, one-primary guard, readiness, shutdown, and crash recovery in Milestone 2.
- [ ] Make built-in process-local behavior cluster-correct in Milestone 3: migrations, bootstrap cleanup, cron, installer, settings/collection caches, rate limits, email cooldowns, OAuth2 redirects, and realtime.
- [ ] Make backup, restore, and application restart cluster-wide in Milestone 4.
- [ ] Complete cross-platform integration tests, failure tests, performance measurements, documentation, and the full repository gate in Milestone 5.

## Surprises & Discoveries

- Observation: Bun's preferred fast HTTP clustering path and `node:cluster` are complementary in PocketBun, not competing server implementations.
  Evidence: Bun's cluster guide says explicit `reusePort` is the faster, more limited alternative, while its compatibility page says `node:cluster` HTTP load balancing is Linux-only because handles cannot be passed between workers. PocketBun can use `node:cluster` as the cross-platform control plane while workers continue to use `Bun.serve()`: kernel load balancing on one Linux port, or distinct ports behind an external load balancer elsewhere.
- Observation: Linux-only port sharing does not imply Linux-only clustering.
  Evidence: Bun documents worker handle passing and therefore built-in HTTP load balancing as the missing non-Linux capability. Worker creation, lifecycle events, and ordinary IPC are separate `node:cluster` capabilities. On Windows/macOS, an external reverse proxy can listen on the public endpoint and balance across worker ports without asking Bun to pass a listening socket. This remains an inference to prove with Bun v1.4.0 integration tests on each operating system.
- Observation: The current Bun implementation automatically recognizes cluster workers, but PocketBun should still set `reusePort: true` explicitly.
  Evidence: Bun's server configuration source currently detects the `NODE_UNIQUE_ID` environment set by `cluster.fork()` and defaults cluster-child `Bun.serve()` instances to port reuse. Explicit configuration makes PocketBun's intended data path visible and prevents a future Bun implementation detail from silently changing it.
- Observation: `node:cluster` does not make a stateful PocketBun application multi-process-correct by itself.
  Evidence: it supplies worker creation, IDs, events, exit detection, and IPC. It does not supply PocketBun readiness, restart policy, migration leadership, cron leadership, realtime fan-out, global rate limits, backup exclusion, or coordinated `Bun.serve().stop()`.
- Observation: PocketBun's SQLite configuration is already suitable for multi-process access, within SQLite's normal single-writer limit.
  Evidence: `src/tools/dbx/connect_pragmas.ts` configures a 10-second busy timeout, WAL mode, `synchronous=NORMAL`, and foreign keys for every connection. WAL permits concurrent readers from separate processes; writes remain serialized. Each worker will have independent SQLite page caches and log writers, so memory and write contention must be measured rather than assumed.
- Observation: the existing `.notify` mechanism already solves settings and collection-cache invalidation for several application instances sharing one `pb_data` directory.
  Evidence: `src/core/notify_watcher.ts` writes notification markers and watches/polls them, then calls `ReloadSettings()` or `ReloadCachedCollections()`. Cluster IPC must not add a second cache-invalidation path and cause duplicate reloads.
- Observation: realtime delete delivery needs a prepare/commit protocol, not only a post-commit broadcast.
  Evidence: `src/apis/realtime.ts` deliberately computes and dry-caches delete messages before the record and possibly its parent are deleted, because access rules can depend on data that no longer exists after commit. Remote workers must prepare their own subscribers before the writer continues the delete, then send or discard those cached messages after success or failure.
- Observation: OAuth2 has two process-affinity assumptions that ordinary record-event fan-out does not cover.
  Evidence: `src/apis/record_auth_with_oauth2_redirect.ts` finds a realtime client by ID in the local broker, and temporarily stores Apple's returned name in the local `app.store()`. With kernel connection distribution, the redirect and follow-up request may hit workers other than the worker that owns the realtime client.
- Observation: the built-in password-reset and verification resend guards are also process-local.
  Evidence: `src/apis/record_auth_password_reset_request.ts` and `src/apis/record_auth_verification_request.ts` place expiring keys in `app.store()`. Without coordination, requests routed to different workers can bypass the intended two-minute guard.
- Observation: backup restore and `app.restart()` cannot be allowed to replace only one cluster child.
  Evidence: `src/core/base_backup.ts` moves the shared data directory and then calls `RestartAsync()`. In cluster mode all other workers must first close the old databases, and the primary—not a child with `NODE_UNIQUE_ID`—must restart the whole application.
- Observation: native `Bun.serve()` readiness and shutdown should not be inferred from Node `net.Server` cluster events.
  Evidence: Bun's `cluster` compatibility is built around Node APIs, while PocketBun starts a native Bun server. The worker must explicitly tell the primary when migrations, hooks, and `Bun.serve()` have completed, and PocketBun must explicitly invoke its termination hook chain so `server.stop()` runs.
- Observation: SO_REUSEPORT balances TCP connections, not logical HTTP requests.
  Evidence: HTTP keep-alive and SSE connections stay on the worker that accepted them. Benchmarks and docs must use enough independent connections and must not promise even per-request distribution.

## Decision Log

- Decision: wait specifically for stable Bun v1.4.0 and qualify that exact version before implementation.
  Rationale: the user intentionally deferred the project until Bun v1.4. `node:cluster` is documented as implemented but not battle-tested, so PocketBun should convert source assumptions into executable probes on the runtime it will support.
  Date/Author: 2026-08-02 / Codex and repository owner
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

## Outcomes & Retrospective

No implementation has started. The plan is intentionally paused at the Bun release gate. When the work is complete, replace this paragraph with measured single-worker and multi-worker results, the chosen recommended worker counts, memory and SQLite-contention observations, Bun issues found or ruled out, deviations from this design, and the final validation evidence.

The expected result is simpler than a built-in general-purpose process manager: one primary file, one typed IPC protocol, worker-role checks at existing singleton boundaries, and focused adapters for the handful of process-local features. The performance benefit is expected primarily for concurrent reads and CPU-heavy request/hook work. Writes remain serialized by SQLite, each worker adds memory, and the primary-coordinated rate limiter adds an IPC round trip on routes for which a rate-limit rule applies. Those costs must be measured before the feature is described as a performance advantage.

## Context and Orientation

PocketBun is a Bun-native TypeScript port of PocketBase. The standard CLI entrypoint is `bin/pocketbun`, which imports `src/cli.ts`. `src/cli.ts` constructs a `PocketBase`, registers plugin flags, loads server-side JavaScript hooks and migrations, registers the migrate command and static route, and calls `app.start()`. `PocketBase.Start()` in `src/pocketbase.ts` adds the `serve` and superuser commands, while `PocketBase.Execute()` bootstraps the app, listens for SIGINT/SIGTERM, executes the command, and triggers termination hooks.

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

This feature covers vertical scaling on one host, one `pb_data` directory, one cluster primary, and several worker processes. Linux uses native shared-port balancing. Windows and macOS use distinct loopback worker ports and require an operator-managed traffic distributor; PocketBun will not bundle or recommend a runtime dependency for that external role. It does not cover a shared data directory across servers, network filesystems, Postgres, worker threads, arbitrary independently launched PocketBun processes, automatic worker-count tuning, rolling code deployment, zero-downtime schema migration across two versions, PM2, or a general public supervisor library. Domain-specific CPU work can still use Bun workers or other techniques inside application hooks, but that is separate from framework request scaling.

Package consumers that construct an `App` and call `serveAsync()` directly remain single-process in the first release. They must not set undocumented cluster environment variables. A later public factory can be considered after the CLI feature is proven, using a separate ExecPlan and a concrete package-user requirement.

## Plan of Work

### Milestone 1: qualify stable Bun v1.4.0

Do not edit PocketBun cluster production code until stable Bun v1.4.0 exists. First update `package.json`'s `engines.bun`, `@types/bun`, Bun lockfile, and `.github/workflows/ci.yml` to v1.4.0 or a later v1.4 patch chosen during the normal runtime-upgrade process. Record the exact version in this plan. Review that release's notes and current official docs for `node:cluster`, `Bun.serve({ reusePort })`, process IPC, signals, and compiled executables.

Create a temporary or committed PocketBun-only runtime probe under `scripts/repro/bun_issues/` only if the behavior is worth keeping as a regression. The probe must establish all of the following across the applicable Linux, Windows, and macOS matrix:

1. `cluster.fork()` re-executes the source CLI entrypoint with the same arguments, supplies distinct worker IDs and PIDs, and supports request/response IPC with plain structured-clone values.
2. On Linux, several children can each call native `Bun.serve({ hostname, port, reusePort: true })` on one port and all receive connections. Verify with `Connection: close` and enough independent clients; do not infer distribution from keep-alive requests.
3. On Windows and macOS, several children can each call native `Bun.serve()` on an assigned loopback port, ordinary HTTP traffic reaches every worker through an external test reverse proxy, and a replacement worker can reclaim the same port slot. The test proxy belongs to the test harness, not PocketBun production code.
4. Native `Bun.serve()` does not require the Node `cluster` round-robin handle path and the primary does not receive or proxy HTTP descriptors on any platform.
5. A custom worker `ready` IPC message works after `Bun.serve()` returns. Do not depend on `cluster.on("listening")` unless the probe proves it for native `Bun.serve()` and it adds value.
6. `await server.stop()` and `await server.stop(true)` behave as documented in a cluster child. Determine how SSE connections affect graceful stop and record the chosen graceful deadline.
7. An unexpected primary IPC disconnect terminates children, or PocketBun can reliably make it do so. Kill the primary with the platform's ungraceful termination mechanism, verify no orphan workers remain, and treat failure as a blocker.
8. Primary termination handlers, child shutdown messages, worker exit/disconnect events, and exit codes work without double handling by `bin/pocketbun`. Test POSIX signals on Linux/macOS and the Windows console/service termination path separately.
9. `cluster.fork()` works both from `bun run src/cli.ts` and from PocketBun's built `dist/src/cli.js`. If PocketBun officially supports compiled standalone executables by then, add a compiled-executable probe; otherwise record that compiled clustering is outside the release scope.
10. IPC preserves ordering from one sender, reports send/disconnect failures, and rejects values PocketBun will not send. Use only strings, numbers, booleans, nulls, arrays, and plain objects in the final protocol.
11. The runtime remains stable through at least 10,000 worker messages, 100 worker restarts, and a ten-minute HTTP/realtime smoke run on every supported platform.

If any required behavior fails, reduce the failing case to a standalone Bun reproduction, file or link a Bun issue, add it to `docs/maintainers/bun-issues-watchlist.md`, update `Surprises & Discoveries`, and pause. Do not hide a runtime defect behind a complex PocketBun supervisor.

Milestone 1 is complete when the exact Bun v1.4 release and probe output are recorded in `Artifacts and Notes`, the shared-port path passes on Linux, and the distinct-port control plane and external-proxy test path pass on Windows and macOS. A platform whose Bun v1.4 cluster lifecycle or IPC fails these probes remains explicitly unsupported until Bun fixes it; lack of `reusePort` alone is not grounds to exclude it.

### Milestone 2: add the minimal cluster lifecycle

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

Milestone 2 is complete when a Linux integration test starts at least three workers on one port and Windows/macOS integration tests start three workers on three predictable loopback ports. Each test observes three distinct PIDs through its public test endpoint, receives a single startup banner, kills each role in turn and observes the correct same-slot replacement, cleanly terminates the primary with no orphan workers, rejects a second primary on the same data directory, and shows unchanged behavior with `--workers=1`.

### Milestone 3: make built-in application behavior cluster-correct

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

Milestone 3 is complete when real-process tests force the producer and consumer onto different worker PIDs and prove: record create/update/delete SSE delivery; auth invalidation; OAuth2 redirect delivery; Apple name handoff; aggregate rate limits; password-reset and verification resend guards; one migration application; one installer attempt; one cron/autobackup execution; and settings/collection cache reloads. Run the complete state-coordination suite on Linux and at least one distinct-port end-to-end case for every coordinator operation on Windows/macOS. Tests must verify no duplicate SSE event and no duplicate singleton side effect.

### Milestone 4: coordinate backup, restore, and restart

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

Milestone 4 is complete when tests create a backup while other workers read and write, reject overlapping operations across workers, restore a known database on supported platforms without any worker retaining an old connection, automatically return with the configured worker count and new data, recover from a deliberately failed restore, preserve the existing Windows restore rejection, and prove `app.restart()` replaces every worker without orphaning processes.

### Milestone 5: hardening, performance, documentation, and release gate

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

Milestone 5 is complete only after focused and full tests, performance evidence, docs regeneration, package typing, build output, and the full repository gate pass without warnings.

## Concrete Steps

Work from `/Users/pekeler/Projects/pocketbun` on `master`. Preserve unrelated user changes. Update this plan after every milestone and whenever evidence changes a decision.

1. After stable Bun v1.4.0 is released, record the exact `bun --version`, update the Bun baseline files, inspect current official docs/source, and run the Milestone 1 probes on Linux, Windows, and macOS.
2. Run the pre-change single-worker benchmark matrix and save commands, host details, medians, latency, and RSS in `Artifacts and Notes` before editing the request path.
3. Add focused failing tests for CLI worker parsing/platform rules, process roles, protocol validation, startup ordering, and lifecycle behavior.
4. Implement `src/internal/cluster/{protocol,context,primary,worker}.ts`, integrate it into `src/cli.ts`, `src/cmd/serve.ts`, and `src/apis/serve.ts`, then satisfy Milestone 2.
5. Add failing cross-worker tests for each built-in state gap, then update `src/core/base.ts`, `src/core/notify_watcher.ts` only if evidence requires it, `src/apis/middlewares_rate_limit.ts`, `src/apis/realtime.ts`, the OAuth2 files, the reset/verification files, and installer startup to satisfy Milestone 3.
6. Add failing cross-worker backup/restore/restart tests, then update `src/core/base_backup.ts`, `src/apis/backup.ts`, `src/apis/health.ts`, and `src/core/base.ts` to satisfy Milestone 4.
7. Run focused tests after each small change. Use `bun test --only-failures --concurrent` for quieter reruns, while keeping shared-process integration tests serial.
8. Add the benchmark/soak support that remains necessary, run the final one/two/four-worker matrix on Linux plus the smaller Windows/macOS proxy matrix, and record results without selectively dropping bad workloads.
9. Update CLI help, deterministic docs overlays, generated docs, `CHANGELOG.md` under `Unreleased`, and the Bun watchlist if needed.
10. Run `bun run format:fix`, `bun test --concurrent`, `bun run typecheck`, `bun run typecheck:package`, `bun run lint`, `bun run check:versions`, `bun run docs:check`, `bun run build`, and `git diff --check`.
11. Inspect the complete diff for upstream traceability, comments, unnecessary abstractions, single-worker overhead, secret/token leakage, orphan processes, and destructive recovery behavior. Commit only when the repository owner asks or normal task scope at that time includes a commit.

Representative commands will be finalized after the benchmark wrapper and tests exist. They should settle into stable forms similar to:

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

The feature is accepted only when all of the following are true.

Functional acceptance:

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
    Backup active marker               process-local; replace with cluster lease
    Restore and app.restart             process-local exec; make primary-wide
    Logger/log writer                  per worker; SQLite coordinates, measure contention

Add the exact Bun qualification transcript, reproduction links, benchmark host, commands, raw result paths, five-run medians, RSS, SQLite contention, and final test counts here as work proceeds. Keep short extracts in this plan and store bulky machine-readable output under ignored `.tmp/` paths or the established benchmark artifact location.

## Interfaces and Dependencies

No runtime dependency is permitted. Use Bun, Web, and Bun-supported `node:` APIs only: `node:cluster`, `node:process`, `node:fs`/`node:fs/promises`, and the existing Bun server and SQLite APIs.

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
      | { version: 1; kind: "request"; requestId: string; operation: CoordinatorOperation }
      | { version: 1; kind: "response"; requestId: string; ok: boolean; value?: unknown; error?: { message: string } }
      | { version: 1; kind: "realtime.event"; eventId: string; event: RealtimeEnvelope }
      | { version: 1; kind: "control.shutdown"; force: boolean }
      | { version: 1; kind: "control.restart" }
      | { version: 1; kind: "control.quiesce"; reason: "restore" | "restart" };

Keep concrete operation variants beside this union and validate both directions. Do not add a generic RPC framework, service container, event emitter abstraction, external serialization library, or distributed-store interface. The smallest native implementation that passes the acceptance tests is the intended design.

Revision note, 2026-08-02 / Codex: Replaced the completed PocketBase v0.39.10 upgrade plan with a deferred implementation plan for vertical scaling. The plan records the agreed Bun `node:cluster` control plane, native Linux `reusePort` data plane, PocketBun process-local correctness inventory, lifecycle and IPC design, backup/restore recovery, performance work, documentation, and release acceptance criteria.

Revision note, 2026-08-02 / Codex: Corrected the implementation gate to stable Bun v1.4.0 and separated clustering from Linux-only port sharing. Added the portable Windows/macOS design using predictable consecutive loopback worker ports behind an external traffic distributor, plus cross-platform qualification, lifecycle, test, documentation, and acceptance requirements.
