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

The repository owner intends to deploy cluster mode in production as soon as practical, so passing the inherited PocketBase compatibility suite is necessary but not sufficient for release. Multi-worker release is blocked until Milestone 10 also passes deliberate process-failure tests against one shared `pb_data`, sustained SQLite contention, long-running stateful soaks, primary-coordinator load measurements, and the complete operational/documentation gate. A flaky cluster result is a failed qualification until its cause is understood; default retries must not convert unexplained failures into release evidence.

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
- [x] (2026-08-22 11:08Z) Started Milestone 10 by auditing the existing real-process coverage instead of duplicating it. The main cluster lifecycle test now exercises POSIX `SIGINT`; POSIX `SIGTERM` remains covered by the state/lifecycle test, Windows retains its supported graceful termination path, and forced primary death remains covered by the qualified runtime probe. The four focused lifecycle tests pass locally.
- [x] (2026-08-22 12:00Z) Corrected Milestone 10 teardown qualification passed hosted run 32571549616 on Ubuntu, macOS, Windows, and downstream Playwright E2E. The state harness now awaits descendant output-pipe closure before deleting its temporary database, eliminating the Windows `EBUSY` race without sleeps or filesystem retries.
- [x] (2026-08-22 12:00Z) Added real-process coverage for an SSE-owning worker dying: a low-level client observes the disconnect, the primary replaces the worker, and a fresh connection resubscribes and receives a mutation produced by another worker. Corrected hosted run 32572636371 passed Ubuntu, macOS, Windows, and downstream Playwright E2E.
- [x] (2026-08-22 12:21Z) The first SSE reconnect matrix passed Ubuntu and macOS. Windows completed the reconnect scenario, then exposed that the later backup-owner-death check sampled only one asynchronously cleared worker mirror before sending the next backup to an arbitrary worker. The harness now waits for `canBackup=true` on every current PID; five focused local reruns and corrected hosted run 32572636371 pass.
- [x] (2026-08-22 13:00Z) Added a real-process forced-stop case in which a follower enters but never completes `onTerminate`; the primary reaches its existing ten-second deadline, kills it, and recreates the full worker set. Hosted run 32573179866 showed that `Bun.spawn().kill("SIGTERM")` terminates the Windows primary directly instead of reaching its JS signal handler, so the corrected test now uses `app.restart()` to exercise the same bounded worker-stop path portably. The same run showed that mirrored backup-idle state alone does not guarantee the first real backup after a hard-killed owner; the test now requires bounded eventual success of the idempotent named backup on the surviving leader and preserves the last response on failure. Corrected hosted run 32573835408 passed Ubuntu, macOS, Windows, and downstream Playwright E2E at commit `f5dd61f3`.
- [x] (2026-08-22 13:07Z) Completed hosted qualification of the leader migration transaction, post-commit/pre-ready, and post-ready failure boundaries. Run 32574869343 passed Ubuntu, macOS, Windows, and downstream Playwright E2E at commit `e855e24e`.
- [x] (2026-08-22 13:22Z) Completed hosted qualification of follower transaction rollback and pending-primary-response death. Run 32575568119 passed Ubuntu, macOS, Windows, and downstream Playwright E2E at commit `19ada7d0`.
- [x] (2026-08-22 14:30Z) Recorded hosted run 32577240713: Ubuntu and macOS passed, while Windows exposed a held-backup HTTP 400 and a retained ownership guard after forced primary death. Later diagnostic runs qualified the backup path and showed that the guard was the correct Windows forced-death result rather than a production cleanup defect.
- [x] (2026-08-22 14:45Z) Ran an early production-like smoke benchmark with the exact current PocketBun commit and Bun 1.4.0 on one clean two-vCPU Ubuntu host, driven from a second clean host. The two reported vCPUs are SMT siblings on one physical core, so this is directional evidence rather than the final scaling benchmark. One worker delivered about 617 req/s and two workers about 769 req/s on the high-concurrency JavaScript route (+24.6%, with p95 improving about 22%); the read-only author-filter route improved only about 5% and its 320 ms single-worker median is effectively unchanged from the historical 334 ms result. Both workers received traffic, so the small gain is not a routing failure. The later physical-core and DB-free controls below supersede this early result.
- [x] (2026-08-22 15:20Z) Applied the first Windows-diagnostic batch and passed the real primary-death matrix, focused cluster suite, complete 1,938-test concurrent suite, and configured four-process suite locally. The held-backup failure now reports its response body and hook error/stack instead of encouraging a retry-based workaround. The batch also tested an in-flight-heartbeat hypothesis for the retained guard; the next hosted run disproved that hypothesis, so the unnecessary serialization is removed below.
- [x] (2026-08-22 15:20Z) Re-ran the clustered public collection update against both a copied and freshly seeded database on a clean two-worker Ubuntu deployment; both returned HTTP 200 and converged. Added public `PATCH /api/collections/{name}` coverage targeted through a follower and verified the changed rule through every worker PID. The earlier 400 is not reproducible in a clean process; the independently discovered benchmark-app cleanup leak is corrected below.
- [x] (2026-08-22 15:20Z) Restored upstream-compatible graceful CLI semantics: handled SIGINT/SIGTERM shutdown returns exit status zero. A real Ubuntu systemd service now reports `Result=success` and `ExecMainStatus=0`, and the single-worker and cluster real-process tests pin the new contract.
- [x] (2026-08-22 15:20Z) Fixed benchmark fixture cleanup to run normal app termination hooks instead of only resetting bootstrap state. The previously hanging `list-posts25k-author-check` command now prints its result and exits normally with all watchers/logger resources closed.
- [x] (2026-08-22 15:30Z) Hosted run 32580868631 passed Ubuntu and macOS, and Windows passed the formerly failing backup scenario. Its only failure was the unchanged final guard assertion in the primary-death matrix. The root cause is now clear: `Bun.spawn().kill("SIGTERM")` force-terminates Windows children without dispatching their JavaScript signal handlers, a behavior already observed in run 32573179866. The test incorrectly expected that forced death to execute the primary's graceful `finally` block. Windows now explicitly uses `SIGKILL` for this death boundary and asserts that the surviving guard names the dead primary; POSIX still performs and verifies graceful cleanup.
- [x] (2026-08-22 15:31Z) Closed the corrected primary-death and backup qualification after hosted run 32581531550 passed Ubuntu, macOS, Windows, and downstream Playwright E2E at commit `20560496`.
- [x] (2026-08-22 15:31Z) Added real-process coverage for both leader and follower never-ready crash-budget exhaustion plus malformed protocol version, duplicate-ready, and late-result IPC. Every offending worker is removed and replaced in the same role/slot, and the no-ready cases leave no worker or ownership guard. Focused and complete local qualification passed, followed by the complete hosted Ubuntu, macOS, and Windows run `32583720130`.
- [x] (2026-08-22 16:30Z) Added shared-SQLite pressure across every worker with concurrent transactional writes, reads, WAL checkpoints, manual backup, real autobackup callback, writer death, later checkpoint/backup, restart, and restore. Ubuntu reproduced `SQLiteError: locking protocol` in the old live-file backup transaction. Backups now archive sequential on-disk `VACUUM INTO` snapshots without live WAL/SHM files; exact final counts/checksums, rollback, archive integrity, and recovery pass locally and in 20 clean Ubuntu repetitions. Hosted run `32583720130` passed Ubuntu, macOS, and Windows; a fresh three-worker run on the dedicated Ubuntu host passed all 101 assertions in 7.87 seconds.
- [x] (2026-08-24) Accepted PocketBase v0.40's Windows backup-restore contract instead of adding a PocketBun-only relaunch mechanism. Upstream still returns `restore is not supported on Windows`, its restart path still relies on Unix `execve`, and the unchanged vendored Admin UI explicitly warns that restore works only on UNIX-based systems. PocketBun therefore keeps the same explicit error while backup creation, archive upload/download/extraction coverage, and continued cluster health remain supported on Windows.
- [x] (2026-08-23) Required stateful Linux soaks passed independently: the two-worker run completed 61,362 CRUD/SQLite cycles and the four-worker run completed 62,783 cycles. Both continuously checked settings convergence, shared rate limits, readable backups, worker/SSE recovery, a full restart, correctness checksums, and resource stability for 60 minutes. The two-worker summary held 50–51 descriptors and 64.2–76.83 MiB primary RSS; the four-worker summary held 88 descriptors and 65.95–80.93 MiB primary RSS. A redundant four-worker confirmation was discarded when its test-only one-second rate-limit window straddled a wall-clock boundary; the harness now uses five seconds so that assertion is deterministic.
- [x] A first four-worker five-hour attempt on the dedicated Ubuntu host stopped at 4m32s during the second deliberate worker kill. It recorded 4,852 completed cycles, three readable backups, 0.73–1.94 ms probe latency, and 88–106 descriptors before the soak harness incorrectly let one `ConnectionRefused` during PID collection escape instead of applying its existing 20-second replacement deadline. This was not qualification evidence, but it produced the retry/diagnostic harness fix used by the later successful soaks.
- [x] Closed the older pre-v0.40 primary-RSS investigation as superseded release evidence. The later v0.40 two-worker and four-worker five-hour soaks completed every functional and integrity assertion with stable worker RSS and descriptors; their primary first-to-fifth-hour median increases were only 4.9 MiB and 17.0 MiB. Together with the focused forced-GC realtime test, this rules out the serious retained-message leak and shows no operationally unbounded resource growth during the qualification window. A very slow primary-only leak cannot be disproved from RSS alone, so retain the modest trend as a production-monitoring observation rather than an open release task.
- [x] The corrected four-worker 15-minute memory smoke passed 14,868 CRUD/SQLite cycles, periodic shared-rate-limit checks, seven worker/SSE recoveries, eight readable backup snapshots, and no full restart. Synthetic request logging and retained records were bounded so they could not masquerade as a process leak. Aggregate RSS warmed from 378.57 to a 444–472 MiB plateau; primary RSS held around 73–77 MiB and the largest worker around 97–108 MiB after warm-up; descriptors held at 90; sampled latency was 1.27–2.72 ms. This preliminary evidence was followed by the successful complete two- and four-worker soaks above.
- [x] (2026-08-23) Resolved the realtime retained-heap defect exposed by the primary-pressure probe. `waitForRealtimeMessages()` created a new `Promise.race()` for every SSE message against the same never-settled abort and max-lifetime promises; JavaScript retains the losing reactions, so each message stayed reachable until its connection ended. Channel queues were empty, ruling out the slow-consumer queue hypothesis. The replacement waiter removes its losing abort listener and clears both timers per message. On the dedicated host, a 32-subscriber one-worker reproduction fell from 88 MiB retained heap after forced GC at two minutes to 9.7 MiB (zero-subscriber control: 8.7 MiB), then completed cleanly. The reusable soak harness now supports zero-or-more realtime clients and forced-GC measurements; rerun the affected multi-worker pressure/soak evidence with the fix.
- [x] (2026-08-23) Corrected the early scaling result on the dedicated Ubuntu host. With the single worker pinned to CPU 0 and two workers constrained to CPUs 0 and 2 (different physical cores), the external 128-way `GET /api/collections/demo2/records?page=1&perPage=30` run improved from 6,791 to 11,253 req/s (+65.7%); both workers consumed essentially equal CPU time. The same client and host measured `/api/health` at +73.8%, so the remaining sublinear gap is not primarily SQLite or the cluster coordinator. The earlier ~20% gain was a one-physical-core/SMT result and is not representative cluster-scaling evidence.
- [x] (2026-08-23) Added a real-process rollback regression: two workers persist a SQLite row, terminate, and a new `--workers=1` process reads that exact row from the same `pb_data` directory. This exercises the documented no-conversion rollback path rather than assuming it from the single-worker baseline.
- [x] (2026-08-23) Extended the real-process realtime test with adversarial cross-client isolation before and after owner replacement. A regular-user record subscriber and a superuser OAuth2 subscriber are pinned to different workers; each receives only its intended cross-worker event. After the regular user's owner is killed and replaced, its authenticated resubscription still receives the record update while the superuser receives none, and token-key invalidation still clears only that new client authentication state.
- [x] (2026-08-23) Hosted run `32646102124` passed Ubuntu, macOS, Windows, and downstream E2E for the cluster rollback and cross-client realtime isolation regressions. The preceding all-platform failure was only an unused local test variable; commit `769ec026` removed it before this clean run.
- [x] (2026-08-23) A controlled local M2 Max (8 performance + 4 efficiency cores, 32 GiB) macOS proxy-topology read series was monotonic: the 128-way authenticated `posts25k` list workload measured 481.8 req/s with one worker, 752.7 with two (+56.2%), 975.5 with four (+102.5%), and 1,251.8 with eight (+159.8%). Each run used a fresh seeded fixture and the existing load client through a round-robin loopback proxy. This is useful multi-core evidence but not a substitute for Linux native shared-port acceptance or five-run medians.
- [x] (2026-08-23) External Linux DB-free control: the dedicated two-physical-core host (`2.29.1.67`, CPUs 0/2) was driven for 30 seconds at concurrency 128 from separate host `2.29.7.192`. A CPU-only JavaScript hook route measured 2,324.3 req/s with one worker and 4,523.3 with two (+94.6%); p50 fell from 53.7 ms to 27.7 ms. This rules out cluster dispatch as the explanation for the earlier unindexed SQLite list result. The final public matrix will instead use all available vCPUs without affinity, report the 1/2/4/8 curve, and use an external load-generator host.
- [x] (2026-08-23) Upgraded the compatibility target and vendored Admin UI to PocketBase v0.40.0. Ported command-error propagation, quoted download names, COOP, `Record.GetInt64`, `Store.Keys`, log truncation/deletion, JSON v2 observable changes, low-level filesystem writer/delete hooks, generated JSVM declarations, and the upstream live-backup design. Bun already enables SQLite defensive mode natively, so no duplicate DSN emulation was added.
- [x] (2026-08-23) Extended the v0.40 live-backup algorithm across cluster workers. A real three-worker test forces the backup owner, deleting worker, and uploading worker onto distinct PIDs after the auxiliary snapshot begins; the archive retains the deleted pre-snapshot file and metadata, excludes the new file, and leaves the live filesystem on the opposite side of both mutations. The test exposed and fixed a worker-ID-versus-slot routing bug and then passed three complete repetitions with 342 assertions.
- [x] (2026-08-23) Targeted performance checks proved that cluster mode is not a regression and uses multiple workers effectively: the local M2 Max read workload scaled monotonically through one/two/four/eight workers, while the externally driven Linux CPU-only route reached +94.6% on two physical cores. Defer the complete PocketBase baseline and matched PocketBun benchmark matrix until the remaining cluster release gate is complete.
- [x] (2026-08-23) Replaced stale production guidance with an unprivileged, reverse-proxy-first deployment, a valid cluster-aware systemd unit, concrete macOS/Windows multi-backend proxy configuration, and current v0.40 live-backup guarantees. The deterministic docs checker pins the critical commands and semantics.
- [x] (2026-08-23) Passed the complete local release gate after rate-limit batching: both full test modes passed 1,958 tests, and version alignment, application and package typechecks, build, lint, generated-doc parity, upstream mapping, whitespace checks, and four Admin UI E2E tests all passed without warnings.
- [x] (2026-08-23) Closed the primary-pressure gate on the dedicated four-vCPU Linux host with an external load generator. An uncoordinated control handled 13,363 req/s, but the first cluster-wide rate-limit implementation fell to 1,238 req/s (101.07 ms p50) despite only about 5% primary CPU because each request paid an individual Bun process-IPC round trip; one local limiter handled 14,754 req/s. Batching concurrent per-worker decisions while retaining primary order raised the four-worker result to 27,980 req/s (4.02 ms p50, 9.65 ms p95), distributed across all workers, with the primary below 20% CPU while workers saturated. A matched realtime run delivered every one of 672,320 expected events to 32 subscribers exactly while sustaining 2,101 mutations/s at 1.65 ms p50; workers saturated before the primary.
- [x] (2026-08-24) Passed two independent five-hour soaks on exact production commit `64232b14`. The two-worker run completed 326,909 shared-SQLite cycles, and the four-worker/one-physical-core stress run completed 303,096; each survived about 149 worker/SSE replacements and nine full restarts, created and verified 150 live backups, kept every aggregate rate check exact, finished with both database integrity checks `ok`, and left no orphan processes. Worker RSS and descriptor medians remained stable. Primary RSS rose from first-hour to fifth-hour medians by 4.9 MiB with two workers and 17.0 MiB with four, so retain the already-deferred primary-RSS observation without calling it a demonstrated leak. The apparent request-latency rise came from the harness's intentional full-table `COUNT`/`SUM` over more than 300,000 rows.
- [x] (2026-08-24) Recorded the fresh PocketBase v0.40.0 baseline on the dedicated four-vCPU/two-physical-core host using Go 1.27.0: five complete 150-scenario runs, 750 zero-error scenario results, and an 83m39s clean service run. The median whole-run sum was 682.251 seconds; the sum of per-scenario medians was 681.335 seconds. Raw results and checksummed median/mean summaries are retained locally under `/private/tmp/pb_v040_full_5x_20260824T2215Z`; defer the matched full PocketBun suite until the remaining cluster release work is closed.
- [x] (2026-08-24) Ran one directional PocketBase v0.40 benchmark on the rebooted two-vCPU host using exact upstream benchmark revision `05625dc2` and Go 1.27.0. All 150 scenarios completed with zero errors in 23m33s. Its summed scenario time was 18.307 minutes versus the old v0.36.5 five-run mean of 21.678 minutes (15.6% lower), and its scenario geometric-mean ratio was 0.60. Treat that only as direction: the current upstream harness's shared global HTTP client replaced the old per-request transport, so the result does not isolate PocketBase runtime changes.
- [x] (2026-08-24) Diagnosed repeated Ubuntu coordination failures from hosted runs `32669876437` and `32694650269` on the dedicated Linux host. The state sampler was not the cause: full lifecycle diagnostics showed that five deliberate follower deaths across different slots could enter the role-wide 30-second crash budget quickly enough to terminate the primary. Crash history and exponential backoff are now tracked per slot, so repeated failure of one slot still terminates the cluster while independent worker replacements do not combine into a false crash loop. The state test retains targeted sampling and now reports response plus primary lifecycle diagnostics on failure. The exact Ubuntu CI command then passed three consecutive 1,958-test runs on the same host that reproduced the defect; the existing same-slot no-ready test still exhausts the corrected budget and terminates the primary.
- [x] (2026-08-24) Passed the current revision through hosted Ubuntu, macOS, Windows, and downstream E2E after scoping crash history and exponential backoff per worker slot.
- [x] (2026-08-24) The final static correctness audit found two bounded but genuine long-uptime/pressure defects before release: primary-owned expiring resend/OAuth2 entries were only removed when the same key was touched again, and both IPC send wrappers treated a `false` backpressure result as failure even though the completion callback could later report that the queued mutating message succeeded. Primary expiry now matches the eager single-process timer contract without stale timers deleting replacements, and both IPC directions await the authoritative callback. Focused cluster tests, the direct 1,960-test suite, the four-process 1,960-test suite, format, application/package typechecks and build, lint, generated-doc parity, upstream mapping, and version alignment all pass.
- [x] (2026-08-24) Prepared the final benchmark gate without running the deferred PocketBun matrix. The PocketBun benchmark server now launches the requested real Linux cluster instead of silently staying single-worker, records worker count and the exact upstream benchmark revision, and passed a two-worker readiness/routing/shutdown smoke. Refreshed the vendored benchmark harness to `05625dc2`, fixed its previously ineffective PocketBase version pin, recorded the source revision in a tracked file, aligned the TypeScript requester with upstream's shared 2,000-idle-connection client, and replaced the Bun 1.4-incompatible `Bun.file().readLines()` result parser call with the simple text parser these small reports need.
- [x] (2026-08-24) Rewrote the Unreleased changelog as an explicit major operational upgrade notice. It now leads with the Bun 1.4 minimum, PocketBase v0.40 compatibility, opt-in cluster topology and rollback, backup capacity requirements, production preparation, and grouped operator/developer changes instead of presenting the release as a flat patch list.
- [x] (2026-08-24) Passed the final two-worker, two-hour steady-state Linux memory soak on exact production commit `b6547967` without worker replacement, cluster restart, or forced garbage collection. The same two worker PIDs completed 126,853 shared-SQLite cycles and 240 resource samples while realtime clients rotated independently, every shared-rate check remained exactly seven allowed and one limited, live backups and final assertions passed, and the service exited cleanly. After the 15-minute warm-up, aggregate RSS had a 305.81 MiB median and 2.24 MiB/hour fitted slope; the primary median was 73.12 MiB with a negative slope, worker medians were 116.59 and 115.94 MiB, and descriptors held a median of 57 with no upward trend. Fifteen-minute worker-sum medians plateaued from 229.53 MiB in the second bucket to 234.14 MiB in the last, providing no evidence of serious or operationally unbounded retention.
- [x] (2026-08-24) Passed the final 60-minute four-worker fault soak on exact production commit `b6547967`. It completed 62,086 shared-SQLite cycles while repeatedly replacing workers and SSE owners, performed the scheduled full-cluster restart and live backups, kept every shared rate check at exactly seven allowed and one limited, completed the harness's final database/checksum/archive assertions, and exited through systemd with status zero. Descriptors finished at 91 versus 93 initially; primary RSS finished at 83.07 MiB and the largest current worker at 109.74 MiB. The checksummed raw log is retained on the qualification host at `/root/pocketbun-artifacts/b6547967/final-fault-60m/soak.log` (`2eb84096...002eedb`).
- [x] (2026-08-24) Used the first multi-worker benchmark attempt as a correctness pressure gate instead of accepting noisy data. All five one-worker runs passed 750 scenario rows, but the first two-worker run reproducibly recycled healthy workers during a 100-user cascade delete. Linux signal tracing proved that the primary sent `SIGTERM` when a legitimate realtime delivery result arrived after its four-second caller timeout and no longer had a pending map entry. Results without a pending request are now harmlessly ignored while responses attempting to resolve another worker's live request remain fatal. The primary now limits realtime delivery/fan-out to workers that have actually owned a subscription, which removes remote-worker work but does not remove the source worker's per-record coordinator request. A delayed-delivery real-process regression crosses the timeout without changing any PID, all 14 focused cluster tests pass, and the same remote cascade completed 100 user deletes in 9.56 seconds plus 97 organization deletes in 24.81 seconds with zero errors and both original workers intact.
- [x] (2026-08-24) Replaced per-record cluster realtime coordination with transaction batching while preserving PocketBase's per-record SSE events and two-phase delete authorization. Every transaction now sends one acknowledged pre-commit delete-snapshot batch and one asynchronous commit/abort batch; bursty create/update/auth delivery shares the same ordered batching path. PocketBase's best-effort failure boundary is restored: transport failures are logged and cannot turn a committed delete into the misleading required-relation 400. Live realtime-client presence is propagated to every worker only as the final optimization, and an unknown presence state conservatively keeps IPC enabled.
- [x] (2026-08-24) Fixed the separately reproduced overlapping top-level async transaction defect. Main and auxiliary transactions now use async-context-local state plus serialized transaction connections, nested transactions retain their existing behavior, unrelated root reads cannot see uncommitted writes, and a deterministic overlap regression proves a failed second request cannot be committed by the first.
- [x] (2026-08-25) Classified the post-fix realtime soak signal without changing production behavior. The original timeout immediately followed a deliberately injected follower `SIGKILL`, not the earlier successful controlled restart. The harness now reports the expected action, record, iteration, source worker, client worker and ID, explicitly records both fault types, and waits for actual SSE EOF instead of mistaking a buffered chunk for worker-death closure. An accelerated ten-minute rerun passed 8,811 create/update/delete cycles, 46 forced worker crashes, four controlled restarts, exact shared-rate checks, backups, and final integrity verification with no missing event or orphan. Realtime remains best-effort across an uncontrolled process crash; controlled restart and steady-state losses remain release blockers if the retained diagnostics ever observe one.
- [x] (2026-08-25) Reran the complete upstream 150-scenario workload externally as the compatibility and performance suite, superseding another co-located-only rerun. Five complete runs each of PocketBase and PocketBun with one, two, and four workers produced 3,000 zero-error scenario rows with matching checksums and exact source provenance.
- [ ] Publish the external PocketBase/PocketBun performance matrix only after Bun 1.4.1 qualification and the native HTTP/2 decision. On the same four-vCPU application host, `GOMAXPROCS=1/2/4` and PocketBun one/two/four workers give summed five-run per-scenario medians of 1,461.6/788.7/699.1 seconds for PocketBase versus 519.8/494.6/468.2 seconds for PocketBun. The four selected high-concurrency scenarios total 52.94/17.01/14.19 seconds versus 16.42/8.80/7.06 seconds. These rows measure application parallelism rather than hard CPU affinity because runtime helper threads remain free to use the host. One PocketBase two-processor attempt returned a single HTTP 500 among 1,000 concurrent auth refreshes; preserve it as an invalid artifact, while its replacement and all ten accepted 150-scenario files have zero errors and matching checksums. The identical external driver had zero load errors and p95 client CPU below 73%. Four-worker PocketBun repeatability remains materially noisier, and the upstream result format has no per-request latency percentiles, so do not yet turn these into README claims.
- [x] (2026-08-25) Isolated the remaining organization-create regression before optimizing it. Across matched one/two/four application lanes, PocketBun's no-rule five-run medians are 47.89/48.01/50.93 ms versus PocketBase's 27.25/16.83/18.06 ms; the rule medians are 41.62/43.91/40.45 ms versus 29.17/27.84/23.38 ms. A warmed local single-process CPU profile completed 81,972 creates in five seconds and attributed about half of sampled time to the prepared SQLite insert, with no individual TypeScript frame above 3%. The focused cold probe is currently contaminated by asynchronous fixture watcher work and cannot yet distinguish cold-path compilation from request work.
- [x] (2026-08-25) Corrected the focused fixed-count measurement boundary: warm-up requests no longer consume the requested measured iteration count, every helper can wait through the upstream two-second post-rule-update settling period, and reports include measured wall time and actual throughput. Five settled fresh-process local runs put the no-rule cold/warm medians at 13.79/4.19 ms and the rule medians at 16.33/5.02 ms for 50 requests; the separate Linux control put a fully cold handler at 49.25 ms and the same handler after 100 real creates at 7.14 ms.
- [x] (2026-08-25) Rejected the first production candidate after an exact external two-worker A/B. Moving the known no-remote-client test ahead of record snapshot encoding changed the no-rule median only from 48.35 to 47.98 ms (0.8%) and changed the rule median from 40.00 to 42.15 ms (-5.4%) across five alternating zero-error runs, so it was removed. A second no-recipient hook guard changed the focused Linux cold median by only about 2% and was also removed without committing production code.
- [x] (2026-08-25) Added a visible symmetric warmup to both complete benchmark runners. Before timing, each target runs the same selected scenarios with at most 100 requests per scenario through the existing external-client path, retains the normal collection-convergence pauses, discards the result, and then clears all disposable data at the measured `create` boundary without restarting the application. The cap is recorded in every result and can be set to zero for cold diagnostics. The temporary PocketBase Go patch compiled and ran; a four-worker PocketBun smoke completed all 150 warmup scenario shapes in 5m22s with zero load errors, then started the normal measured suite with fresh data. One four-worker create-only smoke produced 16.62/21.54 ms organization rows and the full-shape smoke produced 20.73/14.30 ms, so the required five-run median remains the acceptance evidence rather than either favorable single sample.
- [x] (2026-08-25) Classified the warmed external comparison as a steady-state benchmark rather than a cold-start measurement and retained five repetitions. The accepted pre-warmup external matrix already provides a cheap repeatability check: using only its first three runs changes each lane's summed per-scenario median by just 0.1% to 1.7%, but changes 14 to 22 of the 150 individual scenario medians by more than 5% and two to nine by more than 10%. Scenario coefficient of variation reaches 20.7% to 32.6%, with the four-worker PocketBun p90 at 22.6%; the focused warmed organization series also contains a roughly two-times outlier. Three runs would be adequate only for a coarse aggregate, not the per-scenario no-regression claim required here.
- [x] (2026-08-25) Completed one exact-commit, externally driven, four-worker full-suite warmup diagnostic on `7c85af85`. All 154 warmup and 154 measured external batches completed with zero errors, all 150 measured scenarios reported zero errors, and all workers exited cleanly. The measured scenario sum was 474.9 seconds versus the earlier unwarmed four-worker five-run per-scenario-median sum of 468.2 seconds (+1.4%): 90 scenarios were individually faster, while 20 were more than 5% slower, so warmup does not make every already-long scenario faster and the one-run aggregate is indistinguishable from normal variation. The intended short organization cases improved from 50.93/40.45 ms to 24.25/30.27 ms (-52%/-25%), but remain directionally slower than the old unwarmed PocketBase medians; only the matched warmed five-run matrix can establish the final comparison.
- [x] (2026-08-25) Completed the matching one-run PocketBase v0.40.0 warmup diagnostic on the same host, external client, benchmark revision, and 100-request cap with Go 1.27 and `GOMAXPROCS=4`. Its 154 warmup and 154 measured external batches and all 150 scenarios completed with zero errors. PocketBase summed 698.6 seconds versus its earlier unwarmed 699.1-second five-run-median sum (-0.1%), confirming no aggregate warmup gain beyond noise. Against the simultaneous warmed PocketBun result, PocketBun's sum is 32.0% lower (1.47x faster), its scenario geometric mean is 1.66x faster, and it wins 119 of 150 scenarios. It remains more than 5% slower in 23 scenarios: notably organization creation is 24.25 versus 15.33 ms and 30.27 versus 14.94 ms (1.58x/2.03x slower), while permission creation is 1.68x/2.07x slower. Warmup fixes the original cold-burst distortion but does not complete Milestone 11.
- [x] (2026-08-25) Measured the four-worker organization tiering curve at 50, 150, 300 and 600 warmup creates per rule variant with five fresh processes per level. The no-rule/rule five-run medians fell from 21.11/26.30 ms at 50 to 12.94/14.76 ms at 150, then 10.76/13.51 ms at 300 and 12.38/12.98 ms at 600. DFG compilation appeared only sporadically at 300 and materially at 600 without a corresponding performance step, so the useful gain is ordinary workload warming and largely plateaus by 150-300 requests; manufacturing FTL or universal DFG state is unnecessary.
- [x] (2026-08-25) Identified and controlled the external client's low-concurrency worker skew. The default LIFO keep-alive scheduling let a concurrency-ten batch repeatedly reuse its newest subset of a previously enlarged socket pool; the complete 15,150-request warmup sent 45.5% of requests to slot 0 and only 13.2% to slot 3, with 78 of 154 batches using one worker. On an isolated four-worker Linux listener, a 100-socket control followed by five 100-request/concurrency-ten batches omitted one worker under LIFO and divided each FIFO batch exactly like the whole pool (25/30/24/21). The benchmark client now uses the standard agent's FIFO scheduling for both HTTP and HTTPS, preserving keep-alive while rotating requests through its existing connections.
- [x] (2026-08-25) Validated the revised 300-request symmetric default in five alternating four-lane runs. All 140 measured scenarios completed without error; PocketBun's summed create median was 34.0 seconds versus PocketBase's 47.1 seconds. The no-rule organization median improved to 16.23 versus 18.68 ms (13.1% faster), but the rule variant was 20.55 versus 19.32 ms (6.3% slower), and rule-based permission creation was 12.45 versus 10.67 ms (16.6% slower). Every 4,100-request PocketBun warmup batch reached all four workers; aggregate shares remained between about 20% and 28%, while high-volume measurement settled near 25% each. This validates the methodology and rejects the favorable first rule sample as noise; Milestone 11 remains open on the shared rule-evaluation path.
- [x] (2026-08-26) Completed the exact-`6103dc49` overnight matrix. Benchmark-only eager JSC caused severe short-scenario compile stalls and is rejected. At one lane PocketBun beat PocketBase's organization rows by 34.8%/32.5% and its create-suite sum by 61.8%; at two lanes it beat the no-rule row by only 2.1%, lost the rule row by 14.5%, and beat the suite sum by 40.0%, localizing the remaining target to multi-lane rule evaluation. The two-worker five-hour soak passed 299,089 cycles. The four-worker soak ran about three hours before losing one event immediately after a controlled restart; diagnostics identify concurrent whole-set worker-presence broadcasts as the stale-routing race described below, so the run is useful failure evidence rather than qualification.
- [ ] Finish ordered realtime-presence qualification on exact commit `a2776b42`: the deterministic ordering regression, complete local gate, and hosted CI passed. A four-worker accelerated restart stress survived about 50 controlled restarts in ten minutes; fresh two-worker and four-worker fault soaks then ran for 60 minutes, completed 63,180 and 57,518 shared-SQLite cycles, exercised worker replacement and controlled restart, kept every shared-rate assertion exact, passed final backup/integrity checks, and exited cleanly without a missing steady-state or controlled-restart event. The later fixed-PID two-worker soak also passed 322,103 cycles over five hours with exact rate decisions, backups, final verification, 62-66 descriptors, 78.58 MiB final primary RSS, and 129.42 MiB largest-worker RSS; an oversubscribed four-worker fixed-PID run is now in progress on the same two-vCPU host.
- [x] (2026-08-26) Rejected aggressive benchmark-only JSC tiering and narrowed the remaining rule-path target. `BUN_JSC_forceEagerCompilation=1` introduced severe compile stalls rather than shortening warmup. A warmed 100,000-iteration component probe measured dummy create-context construction at 1.30 microseconds/request and the complete create-rule check at 2.22 microseconds/request (including 0.24 microseconds for the bare SQLite predicate), far too little to explain the roughly four-millisecond 50-request external gap. Do not add a rule-plan cache or JavaScript rule evaluator without new profile evidence; next distinguish scenario-order/lock-convoy effects under the real two-lane Linux topology.
- [x] (2026-08-26) Rechecked the remaining request-body create-rule cost and rejected another production shortcut. Across five fresh local profiles of 10,000 warmed creates, the rule added about 10.9 microseconds/request over the no-rule path; samples were distributed across context construction, the cached filter AST/resolver, and the extra SQLite predicate rather than one material TypeScript hotspot. Replacing the synthetic one-row CTE with an equivalent direct predicate improved the long local microprofile by 5.3% and the exact local HTTP burst by only 2.4%, but an alternating five-run two-worker Linux A/B moved the relevant rule median from 45.62 to 47.12 milliseconds while the unchanged no-rule control moved 10% in the opposite direction. The shortcut was removed. Treat these 25-50-request rows as high-variance outcomes and use the complete matched matrix before selecting another production target.
- [x] (2026-08-26) Rejected external connection priming after the real Linux A/B contradicted the connection-pinned Mac simulation. Five alternating fresh four-worker runs kept the no-rule organization median effectively unchanged at 18.97 versus 18.83 milliseconds, while the request-body-rule median regressed from 24.09 to 27.55 milliseconds. Although each 100-request prime reached all four workers, the following 50-request FIFO batch could still omit a worker, and distributing the small write burst more broadly added SQLite writer contention. The priming code was removed. The first two unprimed matrix rounds likewise show that the remaining short-create losses are not rule-specific; quantify the 25-request permission path at one, two, and four workers before considering any production coordination.
- [x] (2026-08-26) Isolated the 25-request permission rows and rejected the direct-predicate shortcut a second time. Fresh one/two/four-worker no-rule medians were 10.70/10.61/10.07 milliseconds and request-rule medians were 13.36/12.50/15.97 milliseconds, so the small write itself does not regress as workers are added. In a separate alternating four-worker A/B the shortcut appeared to improve the raw rule median from 13.49 to 12.08 milliseconds, but the unaffected no-rule control moved from 12.85 to 10.81 at the same time; the within-run rule/no-rule median ratios were effectively identical at 1.149 versus 1.146. The candidate was removed. Use the existing 500/250-request create-latency probes under the real external-client topology for further comparisons instead of optimizing from 25-request noise.
- [x] (2026-08-26) Corrected the focused create-latency probes to use the configured external load generator and ran one high-sample one/two/four-lane round. The previous probes only reported external-load metadata while issuing their 500/250 requests over loopback. With the corrected path, one-worker PocketBun beat one-processor PocketBase in every case: organization no-rule/rule completed in 89.32/90.09 versus 101.93/108.78 milliseconds, and permission no-rule/rule in 43.95/47.13 versus 47.72/52.43. PocketBase improved at two and four processors, reaching 62.47/60.16 and 29.42/31.13 milliseconds at four, while PocketBun regressed to 84.97/100.76 and 62.92/56.10. Rules are therefore not the root cause; the remaining create-path target is cross-process SQLite write serialization/lock contention. First prove that routing the same four-worker run to one worker removes the regression, then measure a minimal cross-worker write admission mechanism before changing production code.
- [x] (2026-08-26) Repeated the write-routing diagnosis with 5,000 organization and 2,500 permission writes per variant and five fresh processes per shape. Four shared-port workers improved organization medians from 711.03/837.73 to 676.24/709.40 milliseconds, but regressed the smaller permission writes from 363.22/436.25 to 439.45/496.17. Four running workers with every request confined to slot 0 produced 729.43/859.52 and 327.53/464.77, close enough to one worker to rule out material idle-cluster overhead. Concurrent SQLite writers therefore hurt the smallest low-concurrency writes, while parallel validation still benefits organization writes; proxying every mutation to one worker is not a general fix. Use a disposable coordinator-admission A/B to decide whether a FIFO around only the actual SQLite statement can preserve the CPU gain while removing lock collisions.
- [x] (2026-08-26) Rejected primary-coordinated admission around each SQLite record write. A disposable candidate reused the existing atomic coordinator claim/release path only around `statement.run()`, leaving validation parallel, but its first four-worker sample nearly doubled organization time to 1,300/1,291 milliseconds and did not improve permissions at 520/551 milliseconds. The extra IPC round trips cost more than SQLite's native writer arbitration, so the remaining repetitions were stopped and the candidate was removed. Next test whether a short native busy timeout plus asynchronous lock retries prevents one contended synchronous SQLite call from blocking an entire worker; retain it only with zero errors and a long-contention correctness strategy.
- [x] (2026-08-26) Rejected shorter SQLite busy waits after both candidate levels. Applying a two-millisecond busy timeout globally with fast async retries improved the four-worker medians by 3.4%-6.2%, but could make unwrapped raw writes fail during long transactions. A production-safe variant shortened the timeout only around async record statements, restored the normal ten seconds synchronously, and retained an eleven-second retry horizon; its five-run medians were 664.68/693.30 milliseconds for organizations and 441.05/464.39 for permissions versus 676.24/709.40 and 439.45/496.17 at baseline. The first directly comparable rows therefore changed by only +1.7% and -0.4%; the larger rule-row movement is confounded by the corrected probe clearing records between variants. The extra PRAGMAs and retry policy are not justified, so native SQLite arbitration remains unchanged for this release.
- [x] (2026-08-26) Established the corrected sustained-create baseline with five clean PocketBase/PocketBun runs at one, two, and four lanes, deleting each disposable scenario's rows before the next rule variant. PocketBun is 23.5%-28.2% faster across all four one-lane variants, but at two lanes it is 12.3%/12.6% slower for organization writes and 65.5%/50.2% slower for permission writes; at four lanes it is 21.5%/24.8% and 51.7%/54.9% slower. This removes growing-table and rule-order confounds and isolates the regression to sustained cross-process SQLite writes.
- [x] (2026-08-26) Rejected automatic WAL checkpoint contention as that write-scaling cause. A disposable five-run two/four-worker candidate set `wal_autocheckpoint=0`; six of eight medians regressed by 1.3%-14.7%, one was effectively flat, and only the two-worker permission-rule row improved by 5.1%. The exact source file was restored. Keep PocketBase's normal checkpoint policy and do not add a cluster checkpoint scheduler.
- [x] (2026-08-26) Rejected the no-remote-realtime-client early return again with the corrected high-sample probe. It changed two-worker medians by 0% to +4.6%, was effectively flat for four-worker organizations, and regressed four-worker permissions by 5.4%-11.0%. The exact source file was restored; retain the current conservative publication path.
- [x] (2026-08-26) Isolated the remaining write curve below PocketBun's HTTP/model/hook/rule/realtime layers. Five fresh 50,000-row prepared-insert runs against one WAL database produced medians of 79,975 writes/s from one Bun process, 75,746 from two (-5.3%), and 63,992 from four (-20.0%). This raw cross-process `bun:sqlite` penalty explains most of the sustained permission regression, while organization validation recovers some throughput in parallel. PocketBase instead runs concurrent request work in one Go process and serializes writes through its one-connection `NonconcurrentDB`. Closing this gap would require a new cross-process writer architecture; do not disguise it with unsafe durability settings, per-write coordinator IPC, or a benchmark-specific route before release.
- [x] (2026-08-26) Rejected `SQLITE_OPEN_NOMUTEX` after qualifying its thread-safety boundary and measuring both layers. SQLite documents it as removing same-connection mutexes while retaining safe use of separate connections, which matches PocketBun's synchronous process-confined application handles. It improved the raw four-process median from 781 to 709 milliseconds, but the five-run application A/B was mixed: the eight two/four-worker scenario medians ranged from 9.1% faster to 8.0% slower, with four-worker organizations effectively flat and no consistent permission gain. The exact source file was restored; keep Bun's default serialized connection mode because the raw saving does not survive the compatible request path.
- [x] (2026-08-26) Rejected a primary-owned SQLite writer before designing a production protocol. A disposable `node:cluster` ceiling test gave each of one/two/four request processes a pipelined acknowledged IPC path to one prepared statement in the primary. On the exact Linux benchmark host, four request processes with ten aggregate in-flight writes sustained a 43,463 writes/s median, 32.1% below the existing four-process direct-WAL result of 63,992 writes/s. The probe transported only slot/index integers and an acknowledgement; real record state, errors, transaction ownership, hooks, and crash recovery would add cost and substantial compatibility risk. Do not add a writer subsystem or proxy mutations for this release.
- [x] (2026-08-26) Shortened the symmetric warmup without changing its request count or production JIT policy. Each short organization and permission variant now expands to the configured target in one untimed batch instead of rerunning the whole scenario, eliminating repeated rule updates and two-second convergence waits. A local target-300 create suite fell from 156.19 to 85.58 seconds, all 1,967 tests pass, and the generated PocketBase Go patch builds and enters the same warmup successfully.
- [ ] Finish the corrected Linux scaling matrix before judging cluster efficiency. Its first target-300/FIFO round changed PocketBun's one-to-two-worker 150-scenario speedup from the obsolete matrix's 1.05x to 1.59x, with aggregate request shares of 48.08%/51.92%. On the same current round, PocketBun's 114 read scenarios improved 1.82x versus PocketBase's 1.79x, then improved another 1.14x from two to four workers on the host's SMT threads versus PocketBase's 1.11x. PocketBun aggregate four-worker shares were 24.73%/24.46%/25.36%/25.45%. During the complete four-worker measured phase, the primary averaged 0.11% CPU and the workers averaged 35.57%-38.51% each; during a 50-second CPU-bound read, every worker used about one full logical CPU while the external client used about 1%. This rules out primary saturation, persistent worker imbalance, and load-generator saturation. Preserve five-run medians and hard-affinity evidence before closing the gate; worker count alone does not cap Bun helper threads to the corresponding CPU count.
- [x] (2026-08-26) Measured two, three, and four workers on the whole four-vCPU/two-physical-core host with five externally driven 100,000-request samples of both a CPU-only hook and a public SQLite read. CPU-route medians were 4,395/6,044/6,402 req/s, 28.53/20.26/17.82 ms p50, 34.67/28.22/37.67 ms p95, 237%/345%/398% server CPU, and 309/426/562 MiB RSS. DB-read medians were 10,162/12,399/13,029 req/s, but the external client reached 96%-97% CPU at three/four workers, so that final ceiling is less authoritative. Aggregate request shares stayed within 47.5%-52.5% at two workers, 32.1%-35.1% at three, and 23.5%-25.6% at four; the primary remained around 0.1% CPU. Four workers therefore maximize measured throughput, while the fourth SMT worker adds only about 5%-6%, consumes about 135 MiB more RSS, and worsens CPU-route tail latency. Use four for the public maximum-throughput four-vCPU benchmark, but document three as a latency/memory-efficiency option on two-core/four-thread hosts. The whole-host result is clear enough that an affinity control is unnecessary.
- [ ] Complete Milestone 11: make both organization-create scenarios at least 5% faster than matched PocketBase at one, two, and four application lanes, without weakening SQLite durability, changing request/response or hook/realtime behavior, or regressing the broader create and full benchmark suites.

## Surprises & Discoveries

- Observation: Bun v1.4 already enables SQLite defensive mode on every `bun:sqlite` connection.
  Evidence: Bun's v1.4 binding calls `sqlite3_db_config(..., SQLITE_DBCONFIG_DEFENSIVE, 1, ...)`, and a local probe rejected the same writable-schema and journal mutations PocketBase v0.40's `_defensive=1` DSN protects. PocketBun therefore needs no additional pragma or connection wrapper.
- Observation: the generated JSVM filesystem declarations promised lowercase methods that the returned `System` object did not provide.
  Evidence: a real hook could call `$app.newFilesystem()` but `fsys.upload` was undefined. Direct aliases now live on `System.prototype`, the new writer/delete hook events expose lowercase fields, a focused test covers the writer/hook surface, and the real cluster hook uses those public names.
- Observation: the first cross-worker backup mutation could not reach a healthy backup owner because two primary identifiers were conflated.
  Evidence: the coordinator lease correctly stored `cluster.Worker.id`, but the primary looked it up in a map keyed by worker slot. The primary now finds the ready worker by `worker.id`; three full real-process repetitions preserve and exclude the intended files.
- Observation: individual Bun process-IPC round trips can serialize a high-throughput cluster-wide rate-limited route long before the primary consumes a CPU core.
  Evidence: four workers handled only 1,238 req/s at 101.07 ms p50 while the primary averaged about 5% CPU; the equivalent single-worker local limiter handled 14,754 req/s. Ordered per-worker batching raised the cluster path to 27,980 req/s at 4.02 ms p50 and 9.65 ms p95, with traffic distributed across all four workers and the primary below 20% CPU while workers saturated.
- Observation: a coordinator result can legitimately arrive after its caller timeout under cascading realtime-delete pressure.
  Evidence: the two-worker benchmark's 100-user cascade generated enough prepare/commit traffic for the primary's four-second delivery timer to expire. `strace` then recorded the primary repeatedly sending `SIGTERM` to healthy workers as their now-unmatched acknowledgements arrived. An unmatched result cannot resolve or mutate any pending operation, so ignoring it is safer than recycling the worker; a mismatched result for an existing request remains a protocol violation. Tracking workers that have owned subscriptions removes unnecessary primary-to-worker delivery, but the source still sends one coordinator request per record. A later instrumented four-worker reproduction captured `PocketBun cluster coordinator request timed out after 5000ms` from `realtime.prepare`, proving that per-record IPC pressure remains the underlying defect.
- Observation: the upstream benchmark's in-process load generator is useful for compatibility but biases application and cluster capacity measurements.
  Evidence: PocketBase starts its client workload in a goroutine inside the application and documents that both share one VPS. PocketBun's mechanical port runs the client in one HTTP worker, asymmetrically consuming that worker while the same process also serves requests. Established application benchmarks use a separate load-generator role and monitor it for CPU and network saturation; public PocketBase/PocketBun results therefore require one identical external client while the upstream suite remains a regression workload.
- Observation: organization creation is a stable PocketBun regression caused primarily by first-use work in this unusually short opening benchmark, not by its warmed SQLite write throughput.
  Evidence: the four-lane no-rule scenario measured 50.93 ms for PocketBun versus 18.06 ms for PocketBase, and the rule scenario is slower at every matched lane. After correcting the helper to wait the upstream two seconds and measure 50 requests in addition to any warm-ups, five local fresh-process no-rule totals fell from a 13.79 ms median to 4.19 ms after 100 creates; the rule totals fell from 16.33 to 5.02 ms. On Linux, a disposable phase-control harness measured the fully cold handler at a 49.25 ms median, generic HTTP prewarming at 40.71 ms, save-path prewarming at 24.36 ms, both at 13.33 ms, and 100 actual create warm-ups at 7.14 ms. This justifies a visible, symmetric workload warmup in the benchmark harness, not synthetic production writes.
- Observation: warmed organization creation is dominated by the actual database write rather than one obvious TypeScript helper.
  Evidence: `bun run profile:inspector:list -- --scenario create-organizations --duration-ms 5000 --concurrency 10 --warmup-requests 100 --interval-us 100` completed 81,972 requests on the local M2 Max. About 50% of sampled time was the `bun:sqlite` prepared statement `run()` called from `BaseApp.persistRecord`; JSON serialization was about 2.3%, and no individual PocketBun frame exceeded 3%. Cluster mode also currently calls `encodeClusterRealtimeRecord()` before discovering that no remote realtime client exists, which is redundant work worth measuring but too small to assume as the complete fix.
- Observation: `bun:jsc.optimizeNextInvocation()` cannot replace workload warmup.
  Evidence: Bun documents that the hint does nothing until its target function has already run enough for baseline JIT compilation and that DFG compilation happens asynchronously. On the real Linux organization-create path, 0-25 prior creates left every selected frame unoptimized and the hint had no effect; after 50 and 75 creates, five-run medians were effectively unchanged at 8.26 versus 8.21 ms and 7.43 versus 7.41 ms. The hint would also require maintaining a list of individual function objects while leaving their transitive callees untouched.
- Observation: the 100-request warmup setting is a per-scenario cap, not a minimum, and cluster JIT state is per worker.
  Evidence: each organization variant still sends only its original 50 requests and each permission variant only 25. Across four workers that is an idealized 12.5 and 6.25 requests per variant before accounting for connection-level `SO_REUSEPORT` imbalance. However, the complete warmup produced 15,150 external requests, including 1,150 record creates before measurement, or about 288 creates per worker if evenly distributed. WebKit's current defaults use execution-counter thresholds of 500 for baseline JIT, 1,000 for DFG and 64,000 for FTL, with a normal function entry adding 15; common create/router/save/evaluator functions should therefore receive enough work for baseline and probably DFG, while scenario-specific functions, shapes and inline caches may not. The harness needs per-worker evidence before increasing an already five-and-a-half-minute warmup.
- Observation: external benchmark distribution depends on the load generator's keep-alive scheduling as well as `SO_REUSEPORT`.
  Evidence: high-concurrency batches and forced fresh connections reached all four Linux workers, proving the shared listener was healthy, while later concurrency-ten batches became pinned to the LIFO agent's most recently returned sockets. FIFO reused the same sockets with no reconnect overhead but rotated every controlled low-concurrency batch across all four workers in the pool. Scenario-level worker counts must remain visible so a future client/runtime change cannot silently invalidate scaling claims.
- Observation: PocketBase's realtime contract is per model event, but cluster transport does not need to be per event.
  Evidence: a cascade that deletes one parent and 2,000 related records can legitimately produce 2,001 separately authorized SSE delete events. Remote workers must prepare delete access checks before commit because rules may reference a parent that disappears at commit, but the snapshots can travel in one acknowledged pre-commit batch and the outcomes in one asynchronous post-commit batch. Create/update loops and transactional batch APIs have the same burst problem; raw SQL updates bypass model hooks and do not synthesize per-record realtime events.

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
- Observation: `bun:test` reports a deliberately reset in-process `fetch()` response body as a test failure even when the reader rejection is handled.
  Evidence: killing the worker that owned a test `fetch()` SSE stream produced `ECONNRESET` outside the assertion flow. Using Bun's `node:http` compatibility API for this one fault-injection client exposes the same disconnect through the stream's normal error/close path and lets the test verify reconnect behavior without a subprocess or retry delay.
- Observation: replacement readiness and one healthy worker do not prove every process-local backup-state mirror has converged after the backup owner dies.
  Evidence: hosted run 32572008206 passed the new Windows SSE death/reconnect assertions, then a subsequent backup reached a worker whose local `@activeBackup` mirror still held the crashed operation and returned 400. The primary intentionally clears surviving mirrors asynchronously on owner exit; waiting for each current PID's health state matches that convergence contract and avoids masking the race with a backup retry.
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
- Observation: PocketBase's inherited suite does not automatically qualify PocketBun's process cluster even though PocketBase uses multiple CPU cores.
  Evidence: PocketBase scales concurrent work inside one Go process, where goroutines share caches, brokers, lifecycle state, and coordination memory. PocketBun cluster workers are separate Bun processes with independent heaps, stores, subscription brokers, SQLite connections, and log writers; only the primary protocol and `.notify` files connect the state that must converge.
- Observation: Bun's process-isolated parallel test command is a faster compatibility gate, not a shared-database cluster stress test.
  Evidence: ordinary tests construct isolated applications and temporary databases. The dedicated real-process files under `src/internal/cluster/` are the tests that deliberately share one `pb_data`, route traffic across worker PIDs, kill processes, and inspect cluster invariants. Test count alone therefore cannot measure cluster confidence.
- Observation: all three leader migration failure boundaries can be exercised through PocketBun's existing public extension lifecycle without a production-only fault API.
  Evidence: a temporary JavaScript migration exits one leader after transactional schema/data changes, a temporary `onServe` hook exits the replacement after migration commit but before `worker.ready`, and the existing identity route proves readiness before the test kills the third leader. External marker files preserve the PID at each boundary even though the database transaction rolls back.
- Observation: killing a coordinator-requesting follower cannot cancel work that the primary has already delivered to another worker.
  Evidence: the realtime client owner entered a held subscription hook before the source follower was killed. After the source process disappeared, releasing the hook still completed the subscription locally even though the source HTTP request rejected and could receive no primary response. This is the normal ambiguous-outcome boundary of distributed requests, not a partial coordinator failure; callers may retry only operations whose contract is idempotent or otherwise deduplicated.
- Observation: the same ambiguous-outcome rule applies when the primary dies after completing an operation but before the source worker accepts its response.
  Evidence: a test hook intercepted the selected coordinator response before PocketBun's worker listener for rate limiting, realtime delete preparation, OAuth2 delivery, backup acquisition, and restore begin. Killing the primary at that boundary closed every source request and child process. A new primary recovered the real stale ownership guard after its three-second heartbeat proof and started with no inherited limiter, delivery, backup lease, or restore transition. Tests must therefore prove recovery invariants rather than assume that a disconnected caller means the operation did not run.
- Observation: the first production-like cluster benchmark was CPU-topology constrained and did not meet the intended scaling value.
  Evidence: Linux reported two logical CPUs but both belonged to the same physical core. The high-concurrency JavaScript route gained 24.6% from a second worker and the read-only author-filter route gained about 5%, despite traffic and CPU time being distributed across both workers. This cannot qualify scaling; it required a reference host with distinct physical cores.
- Observation: the new four-vCPU dedicated Ubuntu host exposes two physical AMD EPYC-Milan cores with two SMT threads each, not four physical cores.
  Evidence: Linux maps logical CPUs 0 and 1 to one core and CPUs 2 and 3 to the other. Pin one-worker and two-worker acceptance runs to CPUs 0 and 2 so they use separate cores; the controlled external-client scaling check is repeatable on this host with that same affinity. Label four-worker stress and soak results as SMT-assisted, and use a larger host if four-physical-core scaling remains necessary.
- Observation: controlled one-to-two-worker read scaling on separate physical cores meets the release target; the earlier ~20% result was not a general cluster limitation.
  Evidence: the external 128-way collection-read workload rose from 6,791 req/s with one worker pinned to CPU 0 to 11,253 req/s with two workers constrained to CPUs 0 and 2 (+65.7%). The two workers accumulated 3,203 and 3,196 CPU jiffies during a 30-second collection-read window, showing balanced delivery. `/api/health` rose from about 15,048 to 26,149 req/s (+73.8%), so most remaining sublinearity is common HTTP/client/kernel overhead rather than SQLite reads or primary coordination.
- Observation: a repeated `Promise.race()` against a pending connection-lifetime promise retains every losing reaction until the connection closes.
  Evidence: each realtime message raced the next channel read against the same abort and max-lifetime promises. The message won, but its race reactions remained attached to those two pending promises. At 32 subscribers the retained forced-GC heap was 88 MiB at two minutes; the client channels all had zero queued messages, ruling out a delivery backlog. Replacing the race with a waiter that removes its abort listener and clears its timers after each result reduced the matched result to 9.7 MiB (8.7 MiB with no subscribers).
- Observation: the original transaction-wrapped live-file backup is not safe under independent cluster writers and checkpoints.
  Evidence: the first Ubuntu pressure run produced a transient checkpoint collision; the second reproduced `SQLiteError: locking protocol` when the manual backup transaction committed after other workers wrote and checkpointed. The same scenario had passed ten times on macOS, demonstrating why a real Linux shared-database gate is required.
- Observation: Bun's `Database.serialize()` is not an acceptable clustered-backup mechanism even though it produces a coherent SQLite image.
  Evidence: it allocates an in-memory byte copy proportional to each database's full size. A production database may be larger than available RAM, so a routine backup could terminate PocketBun through OOM. The existing asynchronous ZIP helper also collected every archive input and the final ZIP in memory, so replacing only the database copy would not remove the unbounded-memory failure mode.
- Observation: the standard auxiliary database is independent activity-log storage.
  Evidence: `src/migrations/1640988000_aux_init.ts` creates `_logs`; `src/apis/logs.ts` only queries that table and the unchanged Admin UI consumes that API independently. A slightly different capture time cannot corrupt `data.db` or crash the Admin UI, though a restored audit trail can be marginally incomplete around the backup boundary.
- Observation: ZIP64 entry metadata and streaming extraction support backups with an individual database above 4 GiB without a database-sized JavaScript allocation.
  Evidence: the repeatable `scripts/backup_zip64_qualification.ts` fixture creates 65 SQLite `zeroblob(64 MiB)` rows (a 4,366,721,024-byte `data.db`), plus an independent random `pb_data` file and an auxiliary-log row. On the dedicated Ubuntu host, it produced a 48,485,680-byte compressed ZIP in 135.34 seconds; the `data.db` central-directory entry had the ZIP64 64-bit size field even though the small compressed archive did not need a ZIP64 archive-end record. It then changed all three live states, restored in 10.27 seconds, reopened the databases, checked both SQLite integrity checks, and verified the original main row, auxiliary log, and file CRC. Backup-stage RSS was 126 MB, final RSS 100 MB, and `/usr/bin/time -v` recorded 254,500 KiB peak RSS—well below the 4.36 GiB database. This is an explicit capacity qualification, not a routine CI test.
- Observation: random test listener ports must not overlap Linux's ephemeral client-port range during connection-heavy repetitions.
  Evidence: two otherwise healthy Ubuntu repetitions selected ports still used transiently by local outgoing connections and failed startup with `EADDRINUSE`. The state harness now probes consecutive ports below the default ephemeral range before starting workers; this is test isolation, not a production listener change.
- Observation: the historical `posts25k` result is not a controlled Bun v1.4 performance comparison.
  Evidence: the current one-worker median was 320 ms versus the old 334 ms median, a roughly 4% difference within the noise and methodology changes accumulated since the old run. Isolate Bun 1.3 versus 1.4 on the same current PocketBun commit, fixture, host, client, and run order before attributing any change to Bun 1.4.
- Observation: direct cluster state tests had not covered the public collection API path seen failing during the smoke run.
  Evidence: one contaminated two-worker smoke process returned HTTP 400 after committing `PATCH /api/collections/posts25k`; the equivalent one-worker request and two clean clustered reproductions returned 200. The state harness now exercises the public route and verifies convergence through every worker PID, while the smoke benchmark resource leak is fixed independently.
- Observation: graceful PocketBun shutdown and service-manager success were different contracts.
  Evidence: stopping the first production-like transient systemd service shut PocketBun down but systemd classified the primary's signal-derived exit status 143 as a failed unit. PocketBun now returns zero after handling graceful shutdown, matching upstream, and a real systemd stop reports success.
- Observation: PocketBase v0.40 still does not support built-in backup restore on Windows, even though its public production and backup-API pages omit the platform restriction.
  Evidence: upstream `core/backup_restore.go` returns `restore is not supported on Windows`, `BaseApp.Restart()` still relies on Unix `execve`, and the v0.40 Admin UI restore confirmation explicitly says that backup restore works only on UNIX-based systems. PocketBun serves that Admin UI unchanged.
- Observation: benchmark source provenance matters independently of the PocketBase version under test.
  Evidence: the failed small-host runs used PocketBun's older vendored `request.go`, which creates a new Go `http.Transport` for every request. A clean external sampler observed 56,462 loopback `ESTABLISHED` rows, exactly two rows for each of the 28,231 usable client ports, plus 57,101 descriptors in one process and thousands of failed requests. The successful big-host launcher instead ran `upstream:sync:benchmarks` first and used upstream revision `05625dc2`; its requester has one shared global client and caps idle connections at 2,000 specifically to avoid VPS ephemeral-port limits. The Go 1.27.0 binary, Bun 1.4.0 binary, PocketBase v0.40 module, runner, Ubuntu release, libc, systemd limits, and socket settings otherwise match byte-for-byte or semantically. Raw failure diagnostics are retained under `/private/tmp/pb_v040_ccx13_single_strict_20260824T080205Z`.
- Observation: the benchmark sync and reporting paths themselves had drifted before the final release matrix.
  Evidence: the sync script used `\s` in an awk regular expression, which awk treated literally, so it printed a successful v0.40 pin message while leaving the upstream development pseudo-version untouched. The PocketBun runner also ignored cluster worker counts, and the summary parser called `Bun.file().readLines()`, which is unavailable in Bun 1.4. The sync now verifies the actual pinned module line and records the full benchmark commit; the runner launches the requested Linux workers; the small result parser reads the file text directly.
- Observation: a `false` return from Node-compatible process IPC is backpressure, not an authoritative delivery failure.
  Evidence: Node's `ChildProcess.send()` contract explicitly returns `false` both for a closed channel and when queued-message backlog crosses its threshold, while the callback reports completion. PocketBun removed pending requests immediately on `false`; a queued `backup.acquire` could therefore succeed in the primary after the requesting worker had reported failure, leaving an unseen lease. Both directions now rely on the callback, with a focused false-return/successful-callback regression test.
- Observation: a no-restart realtime soak must rotate clients without rotating workers.
  Evidence: the first steady-state attempt completed about 30 minutes of CRUD, backups, exact rate checks, and stable worker PIDs before every untouched SSE connection reached PocketBase's intentional `MaxTimeout = 30 minutes`. The harness now reconnects clients at 25 minutes; closure before that boundary still fails, and worker PID continuity remains the memory qualification invariant.
- Observation: whole-set realtime-presence snapshots must not be broadcast concurrently.
  Evidence: the exact-`6103dc49` four-worker soak lost one event immediately after a controlled restart opened four SSE connections concurrently. Each worker correctly reported its first live client, but the primary processed those reports independently: a newer complete worker-ID set could be delivered before an older incomplete snapshot and then be overwritten locally. A source worker could consequently conclude that it had no remote realtime recipients and skip the event IPC fast path. Presence mutations, broadcasts, worker-exit removal, and the initial snapshot that admits a ready worker must share one ordered sequence; the initiating SSE connection remains unacknowledged until its own presence update is delivered.

## Decision Log

- Decision: match PocketBase v0.40 by keeping built-in backup restore unsupported on Windows.
  Rationale: PocketBun's compatibility target and unchanged vendored Admin UI both expose the Unix-only contract. A PocketBun-specific Windows close/replace/relaunch protocol would add a hidden capability, rollback risk, and another service-manager contract without fixing a PocketBase compatibility gap. Windows users can still create, upload, download, inspect, and manually restore backups while PocketBun is stopped.
  Date/Author: 2026-08-24 / repository owner and Codex
- Decision: upgrade to PocketBase v0.40.0 before finishing the cluster release gate, but keep the complete public benchmark matrix deferred until correctness and operations work are otherwise done.
  Rationale: the upgrade is required for the release and changes backup behavior central to cluster qualification. Testing the upstream changes together avoids qualifying an obsolete backup path, while final benchmark numbers should not be published from code that can still change for correctness.
  Date/Author: 2026-08-23 / Codex and repository owner
- Decision: follow PocketBase v0.40's `VACUUM INTO` and storage-mutation boundary, extend it cluster-wide, and keep deleted-file tracking active until PocketBun's streamed ZIP is complete.
  Rationale: both projects now avoid long transaction-held compression. PocketBun materializes both database snapshots before its streaming archive walk, so stopping deletion tracking immediately after the main snapshot could lose a referenced file before the walk reaches it. The stronger tracking window costs temporary disk I/O, not database locks or database-sized RAM, and the archive layout remains backward compatible.
  Date/Author: 2026-08-23 / Codex
- Decision: batch concurrent cluster-wide rate-limit decisions per worker while keeping every decision in the primary.
  Rationale: granting local token blocks could exceed PocketBase's exact application-wide rule at worker boundaries. Batching only collapses IPC round trips: the primary still applies the existing limiter synchronously in message and array order, so aggregate allowance and replacement-rule behavior remain unchanged while the measured high-throughput regression disappears.
  Date/Author: 2026-08-23 / Codex
- Decision: batch cluster realtime transport without coalescing PocketBase-visible record events.
  Rationale: realtime clients may legitimately receive every record mutation in a cascade or application batch, but one transaction does not need thousands of coordinator request/response cycles. Remote workers normally need one acknowledged preparation batch before delete commit so they can evaluate access rules against pre-delete data; commit/abort and create/update delivery can then use ordered asynchronous batches without delaying the initiating HTTP response. PocketBase treats realtime preparation and broadcast as best-effort, logging failures without rejecting the database mutation, so PocketBun must retain that failure boundary rather than making SSE transport transactional. This fixes the general burst problem rather than optimizing only the no-subscriber benchmark.
  Date/Author: 2026-08-24 / repository owner and Codex
- Decision: use live worker realtime presence only as a conservative transport fast path.
  Rationale: transaction batching fixes the correctness and request-amplification defect regardless of subscriber count. The primary additionally propagates the set of workers with live realtime connections before acknowledging a new connection, allowing a source worker to skip IPC only when it knows that no other worker has a recipient. Unknown or stale state always sends extra IPC instead of risking a missed event, and disconnect/update failures can therefore reduce performance but not correctness.
  Date/Author: 2026-08-24 / repository owner and Codex
- Decision: use an external load-generator host for public PocketBase/PocketBun performance and scaling results.
  Rationale: the upstream benchmark intentionally runs its client in the application process on the same VPS. That is valuable as a shared compatibility workload but consumes application capacity and penalizes PocketBun's worker topology differently from PocketBase's Go scheduler. Public comparisons will keep the application host fixed and drive both products with the same monitored external client; co-located results will be labeled separately.
  Date/Author: 2026-08-24 / repository owner and Codex
- Decision: warm both benchmark targets symmetrically before publishing their measured results.
  Rationale: the repository owner wants PocketBun faster across all published scenarios, and the organization-create investigation proved that the unusually short opening burst primarily measures first-use JIT work rather than production steady state. The harness therefore runs the same selected scenarios untimed through the same external client, caps longer scenarios at 300 requests, and expands each short organization and permission variant to 300 requests in one batch. It then starts the measured `create` phase by clearing warmup data without restarting either server. Results record the configured target/cap, and setting it to zero preserves an explicit cold-run mode. Publish these as steady-state results, disclose the warmup, and explicitly note that they do not measure first-request or cold-start performance. Milestone 11 still requires both measured organization medians to be at least 5% below PocketBase at one, two, and four application lanes.
  Date/Author: 2026-08-25 / repository owner and Codex
- Decision: retain five independent runs for the final public matrix.
  Rationale: the existing external five-run artifacts show that three runs are enough to stabilize only the summed aggregate. Depending on the application lane, a first-three median differs from the five-run median by more than 5% for 14 to 22 scenarios and by more than 10% for two to nine scenarios. Because acceptance and publication include per-scenario comparisons, reducing to three could turn noise into a false win or regression. Reconsider only if the final warmed artifacts themselves show materially lower per-scenario variation across all six target/lane combinations.
  Date/Author: 2026-08-25 / repository owner and Codex
- Decision: do not impose a global measured-request minimum on the upstream suite merely to make every row scale.
  Rationale: concurrency-one scenarios cannot use multiple workers by definition, while create scenarios mutate data consumed by later work and delete scenarios have a finite seeded set. The corrected client already balances sustained requests across Linux workers and concurrent read scenarios scale nearly two-times from one to two workers. Treat short create/delete rows as latency and compatibility measurements, not scaling claims; change their lifecycle only if repeated current results show a specific variance problem that can be fixed without changing downstream data.
  Date/Author: 2026-08-26 / repository owner and Codex
- Decision: do not trade PocketBase compatibility or durability for the organization-create target.
  Rationale: `PRAGMA synchronous=OFF`, acknowledging an HTTP response before the record commit, combining independent requests into one transaction, skipping observable validation/hooks/realtime behavior, or special-casing the benchmark collection could win the benchmark by changing the product contract. The work must instead remove redundant work or shorten the common compatible implementation, one measured change at a time.
  Date/Author: 2026-08-25 / Codex
- Decision: reject the no-recipient realtime shortcut as an organization-create optimization.
  Rationale: five alternating external two-worker runs found only a 0.8% no-rule movement and a 5.4% rule regression, while the broader early-hook guard moved the focused Linux cold median by only about 2%. Both are at or below noise and cannot explain the PocketBase gap, so retaining either would add production branches without meeting the plan's measured-change threshold.
  Date/Author: 2026-08-25 / Codex

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
- Decision: snapshot `data.db` and `auxiliary.db` sequentially with on-disk `VACUUM INTO`, stream the archive to disk, and exclude their live WAL, SHM, and journal sidecars.
  Rationale: a process-local transaction cannot block independent cluster connections and can fail with SQLite's locking-protocol error while checkpoints and writes continue. `Database.serialize()` was rejected because its full in-memory copies can OOM a production server. `VACUUM INTO` is available through Bun's public SQL API, creates standard restorable SQLite files without JavaScript-sized copies, and needs no external SQLite shell. SQLite's online-backup API is lower-CPU and incremental but is not exposed by Bun; do not add a system dependency for it. The standard auxiliary database contains independent logs, so a sequential capture is safe for the first release. True parallel captures would require dedicated workers/processes, would only narrow rather than eliminate the timing gap, and are deferred until this path is pressure-qualified. Streaming ZIP output is mandatory because the prior helper loaded all input files and the completed archive into memory. The new temporary snapshot increases worst-case free-disk-space needs to roughly three times the data-directory size. This is not an atomic whole-directory snapshot: concurrent uploads/deletions can fall on either side of the database capture, so document that applications requiring strict database/file alignment must pause writes themselves.
  Date/Author: 2026-08-22 / Codex
- Decision: retain the primary across cluster restart and restore, but reset its transient coordinator and recycle every worker; during restore, force-stop the initiator's HTTP server through a narrow registered callback before directory replacement.
  Rationale: only workers own durable application state and database connections, so fresh workers plus a fresh limiter/expiry coordinator reproduce process replacement. Keeping the primary avoids unnecessary `execve` and works uniformly across platforms, while stopping only the initiator's server preserves the app state needed by the existing transaction. Recoverable post-quiesce failure also recycles the initiator before service resumes.
  Date/Author: 2026-08-22 / Codex
- Decision: treat multi-worker production confidence as a separate release gate; do not infer it from PocketBase compatibility tests or Bun's process-isolated parallel test suite.
  Rationale: PocketBase's Go concurrency shares one process, whereas PocketBun cluster correctness depends on IPC, process-local cache/broker/store convergence, independent SQLite connections, and recovery from operating-system process death. Before release, require deterministic shared-`pb_data` fault tests, sustained SQLite pressure, stateful two-worker and four-worker Linux soaks, primary bottleneck measurements, and matched current PocketBase/PocketBun benchmarks.
  Date/Author: 2026-08-22 / repository owner and Codex
- Decision: keep deterministic startup fault injection in temporary test migrations and hooks rather than adding cluster fault controls to production code.
  Rationale: the normal migration, `onServe`, readiness, and process-exit surfaces reach the exact transaction/commit/ready boundaries. Reusing them tests the real application lifecycle and avoids shipping an inactive testing protocol or environment-variable branch.
  Date/Author: 2026-08-22 / Codex
- Decision: exercise follower transaction and pending-response death in the existing shared-data state harness, using a realtime subscription update for the pending operation.
  Rationale: the harness already provides stable worker affinity, a shared SQLite database, a realtime client owner, PID replacement, and cleanup. Realtime subscription replacement is idempotent, so the test can prove both that an already-delivered operation may finish after its source dies and that retry from the replacement is safe without inventing a production-only coordinator operation or risking duplicate side effects.
  Date/Author: 2026-08-22 / Codex
- Decision: simulate a lost coordinator response in a temporary server-side JavaScript hook instead of adding a primary pause or fault-injection branch to production.
  Rationale: the hook records outgoing request IDs, intercepts only the armed matching response before the existing worker listener, and leaves all other IPC untouched. The real primary must fully execute each concrete operation and send its response before the test kills it, giving one deterministic cross-platform boundary for all five cases while keeping production code and protocol unchanged.
  Date/Author: 2026-08-22 / Codex
- Decision: require at least a 60% two-worker gain for a representative read-only workload on dedicated physical cores before presenting cluster mode as a performance advantage.
  Rationale: a second worker consumes nearly another worker's memory and substantially expands operational complexity. The earlier 20% floor was only enough to prove that work was distributed; the production goal requires a gain large enough to justify those costs. CPU-heavy results remain diagnostic, while read-only API traffic is the release scaling criterion.
  Date/Author: 2026-08-22 / repository owner and Codex

## Outcomes & Retrospective

Milestone 1 is complete and qualified on Bun v1.4.0. Every declared minimum and CI pin is aligned, version drift is checked automatically, clean installs work without a lockfile-format migration, and the complete local and hosted gates pass. The breaking-change audit found and fixed one response-cookie merge regression and added coverage for Bun-joined duplicate request headers. Three Windows runs showed that `Bun.spawnSync()` can return zero while losing piped output, losing redirected output, or before a direct child result is visible. PocketBun now avoids `spawnSync` for this path and waits for one asynchronous child's atomically published result without retrying potentially mutating HTTP requests; hosted Windows confirms the workaround.

Milestone 2 is also complete and qualified. Cron remains explicitly UTC on every host, accepts PocketBase `Timezone` values through `SetTimezone`/`setTimezone`, validates and schedules in the same selected zone, and safely restarts active handles after a timezone change. Logger shutdown waits for Bun's worker `close` event after termination, and repeated close remains safe. Four isolated Bun test workers, capped at eight concurrent tests each for listener stability, cut the local full-suite time from about 64 to about 28 seconds across repeated successful runs, while `test:changed` provides the requested direct changed-file command. The complete isolated suite passes on hosted Ubuntu, macOS, and Windows without retries, and Playwright E2E passes downstream. When the Bun v1.4 workstream is complete, record the deleted compatibility code, HTTP and cron parity evidence, final test-time result, retained dependencies, and any rejected native substitutions. When the scaling work is complete, add measured single-worker and multi-worker results, the chosen recommended worker counts, memory and SQLite-contention observations, Bun issues found or ruled out, deviations from this design, and the final validation evidence.

Milestone 3 is complete locally. S3 error, copy, multipart-init, and list responses now share a small compact-shape adapter over `Bun.XML.parse()`; the repeated tag regexes are gone. Request XML uses Bun's ordered tree shape to preserve direct-child names and DOM-style recursive text content. Focused fixtures pin default and prefixed namespaces, attributes, entities, singleton/repeated children, empty tags, nested text, checksums, dates, pagination, malformed S3 error preservation, and the route-level 400 response for malformed request XML. `Event.XML()` now uses `Bun.XML.stringify()` with only scalar-root normalization and the required declaration; structured responses use Bun's valid single-root document shape, and invalid multi-root/root-array input fails instead of emitting malformed XML.

Milestone 4 is complete locally. `Event.FileFS()` now returns lazy `Bun.file()` bodies instead of reading and retaining every local static file in a 16 MiB/256-entry byte cache. Bun handles transfer and common uncompressed byte ranges directly; PocketBun keeps content metadata, path resolution, canonical redirects, `pb_public` SPA fallback, Admin UI branding, CSP, and cache policy. Conditional and multipart-range parity with Go `http.ServeContent` is intentionally not reimplemented because these routes did not previously provide it and their clients do not require it. The separate file API delivery path is unchanged.

Milestone 5 is complete locally and on hosted CI. Maintainers now have direct license, audit-fix preview, deduplication, and dependency-diff commands without added scripts. The custom-route CSRF guidance binds tokens to a stable per-session identifier and keeps the secret outside source control. Normal Playwright E2E passes; forcing Playwright itself onto Bun reproduces the open `.esm.preflight` resolver issue, so PocketBun keeps its working runner and watchlist entry. No dependency, runtime wrapper, global-store configuration, pruning step, platform-support claim, or standalone executable work was added.

Milestone 6 is complete without production cluster code. A self-contained Bun-only probe covers source and bundled execution paths, IPC ordering, native shared/distinct-port data paths, external test proxying, readiness, replacement, graceful request/SSE stop, and primary-death cleanup. The short matrix and corrected ten-minute extended matrix pass on Bun v1.4.0 across Ubuntu, macOS, and Windows. Five-run single-worker read/write medians are recorded before request-path edits. The first extended macOS attempt also usefully separated cluster behavior from a probe-induced short-lived-port exhaustion failure; normal connection reuse is both simpler and representative of sustained HTTP traffic.

Milestone 7 is complete locally and on hosted CI. `pocketbun --workers=N serve` now enters a lightweight primary before hooks or databases open, starts the leader before followers, and uses Bun's qualified shared-port or distinct-port topology. A closed token-authenticated lifecycle protocol verifies readiness, the primary restarts the same role and slot under a bounded crash budget, and shutdown reuses PocketBun's existing termination hooks before force-killing stragglers. An exclusive heartbeat guard prevents two cluster primaries from sharing one data directory and is omitted from backups. Real-process tests cover three worker identities, both role replacements, a competing primary, crash-budget exhaustion, one banner, no orphan processes, and the unchanged `--workers=1` path. The same lifecycle passed hosted Ubuntu, macOS, and Windows CI.

Milestone 8 is complete locally and on hosted CI. Only the leader performs migration, restore-temp cleanup, generated-type refresh, installer, and cron startup work; the existing `.notify` watcher keeps settings and collection caches converged in every worker. The primary owns the exact existing rate-limiter algorithm plus narrowly scoped expiring resend and Apple OAuth2 values. Realtime create/update/delete, auth invalidation, and subscription updates cross worker boundaries with local access checks preserved; OAuth2 uses a non-mutating ownership probe before one targeted delivery. A real three-worker test forces distinct producer/consumer PIDs and covers singleton effects, caches, aggregate limits, resend guards, realtime sequencing/no duplicates, auth invalidation, OAuth2 delivery, and Apple handoff. Both complete local suites pass 1,934 tests, and commit `4dc010eb` passed Ubuntu, macOS, and Windows CI.

Milestone 9 is complete locally and on hosted CI. Backup and restore exclusion is primary-atomic and mirrored through the existing active-backup store key, including automatic owner-death release. `app.restart()` recycles every worker under the lightweight primary. Restore validates while serving, then closes all non-initiators, force-stops the initiator's HTTP server, performs the existing replacement transaction, and starts a completely fresh worker set; Windows retains its explicit unsupported restore result without disturbing the cluster. The real three-worker test covers cross-worker exclusion, delete and health state, a concurrent write, owner death, invalid restore recovery, full restart, restored data, new PIDs, and clean shutdown. Corrected hosted run 32568697758 passed Ubuntu, macOS, Windows, and downstream Playwright E2E.

Milestone 10's production-correctness gates are complete. The exact-`de04f6b2` one-hour soak's lone realtime timeout followed a deliberately injected follower `SIGKILL`; its earlier controlled restart completed normally, and all preceding rate, database, backup, and integrity activity remained healthy. An accelerated diagnostic soak then passed 46 forced worker replacements and four controlled restarts without a missing event. The improved harness will make any recurrence attributable to an exact action, source, client, iteration, and fault type; no production presence/IPC change is justified by the current evidence.

No known production-correctness issue remains open. The external benchmark matrix itself is complete and zero-error, while publishing still requires the documented measurement caveats to be resolved. Windows built-in restore remains an accepted compatibility exclusion, and modest RSS fluctuations remain a production-monitoring observation rather than separate implementation work. No unexplained steady-state or controlled-restart failure may be waived by adding a default retry.

The result remains intentionally smaller than a general-purpose process manager: one primary file, one typed IPC protocol, worker-role checks at existing singleton boundaries, and focused adapters for the handful of process-local features. The performance benefit is primarily for concurrent reads and CPU-heavy request/hook work. Writes remain serialized by SQLite, each worker adds memory, and exact cluster-wide rate limiting requires primary coordination; ordered batches keep that coordination from imposing one IPC round trip per request.

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

Update the custom SSR documentation example to bind `Bun.CSRF` tokens to an authenticated session identifier where one exists. Document automatic v1.4 benefits such as lower runtime overhead, stream/backpressure improvements, connection reuse, zlib improvements, and security hardening only when useful to operators; they require no PocketBun wrapper. Do not claim new FreeBSD, Windows ARM64, older-Linux, or other platform support until a smoke test covers `Bun.serve`, `bun:sqlite`, `Bun.Image`, hooks, ZIP backup, and that platform's documented restore contract. Do not move the TypeScript peer range to TypeScript 7 until that compiler is stable and PocketBun's compiler-API usage passes separately.

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

PocketBun rejects built-in backup restore on Windows because PocketBase v0.40's restore and process-replacement implementation is Unix-only. This is the accepted compatibility contract: do not add a PocketBun-specific Windows close/replace/relaunch design while the unchanged upstream Admin UI warns that restore only works on UNIX-based systems. Test cluster-wide restore on Linux and macOS; on Windows, pin the explicit unsupported error, archive compatibility, and continued cluster health. Manual offline replacement of `pb_data` remains available when PocketBun is stopped.

Make `BaseApp.Restart()` and `RestartAsync()` cluster-aware. A restart request from any worker asks the primary to quiesce and recreate the complete worker set; it never replaces only that child. Recycle workers under the existing primary when that reloads all application state, which also works on Windows without `execve`. Re-execute the primary only when restoring data or replacing primary code actually requires it and the platform supports it. This also gives future hook-watch behavior the correct primitive. Preserve current direct `execve` behavior outside cluster mode.

Milestone 9 is complete when tests create a backup while other workers read and write, reject overlapping operations across workers, restore a known database on supported platforms without any worker retaining an old connection, automatically return with the configured worker count and new data, recover from a deliberately failed restore, and prove `app.restart()` replaces every worker without orphaning processes. Windows in-process restore is an accepted PocketBase-compatible platform exclusion; its explicit rejection and continued cluster health are qualifying behavior.

### Milestone 10: hardening, performance, documentation, and release gate

Add cross-platform integration coverage adjacent to `src/internal/cluster/` or in one clearly marked PocketBun-only test file. Use actual child processes and a temporary `pb_data`; in-process multiple `BaseApp` objects are insufficient. Tests that mutate process globals, fixed ports, signals, or shared paths must be serial. Run native same-port tests on Ubuntu and distinct-port tests through a small test-only proxy on macOS and Windows. The proxy must use existing test/runtime facilities and must not become a PocketBun dependency. Keep platform-specific restore and signal cases explicit and raise CI timeouts only with evidence.

Use a test-only hook route that returns cluster worker ID/PID and always make probe requests with fresh connections. Do not add worker identity to PocketBase-compatible production API responses. Provide harness helpers to wait for a desired worker, inspect lifecycle output, signal a PID, and assert cleanup. Avoid timing-only assertions; use IPC-visible state or eventual retries with bounded deadlines.

Treat cluster qualification as three complementary layers. The inherited PocketBase tests remain the compatibility layer and must continue passing unchanged. Deterministic real-process tests under `src/internal/cluster/` are the coordination layer: several workers share one temporary `pb_data`, faults are injected at named boundaries, and tests assert database and protocol invariants rather than only HTTP availability. A required Linux soak is the longevity layer: it repeats valid traffic and faults long enough to expose lock accumulation, stale state, leaked descriptors, unbounded memory, orphan processes, and rare ordering failures. Passing one layer never substitutes for another.

Cover at least these failure cases:

- leader fails during a migration transaction, after migration commit but before ready, and after ready;
- follower fails during a request, during a database write transaction, while owning an SSE connection, while holding a backup lease, and while waiting for a primary response;
- primary receives POSIX SIGINT, SIGTERM, and SIGKILL or the equivalent Windows graceful and forced termination events;
- a worker ignores graceful shutdown and is force-killed at the deadline;
- a second primary targets the same `pb_data`, then successfully starts after a stale-guard recovery;
- malformed, duplicated, late, and unknown IPC messages;
- cluster primary disconnect during rate-limit, delete-prepare, OAuth2, backup, and restore operations;
- SQLite busy pressure from concurrent writers and WAL checkpoint/autobackup activity;
- long-lived SSE clients reconnect after their worker dies;
- two simultaneously connected, differently authorized SSE clients on different workers never receive each other's realtime event or auth state, including after the owner worker is replaced;
- no worker becomes ready, and repeated crashes exhaust the restart budget.

For the leader migration boundaries, use a test migration with durable markers so the test can distinguish entry, committed state, and readiness. Killing the leader inside the transaction must leave no partial schema/data and the replacement must apply the migration exactly once. Killing it after commit but before `worker.ready` must let the replacement observe migration history, avoid duplicate side effects, and start followers only after the new leader is ready. A post-ready leader failure must retain the already qualified same-role replacement behavior.

For database and coordinator failures, test outcomes rather than sleeps. An interrupted write must roll back or commit exactly once, never partially mutate records, and subsequent writes must succeed. A worker waiting for rate-limit, delete-prepare, OAuth2, backup, restore, or another coordinator response must reject promptly when the primary disappears; it must not hang until the outer test timeout. After the service manager equivalent starts a fresh primary on the same `pb_data`, no old lease, pending delivery, temporary restore transition, or stale ownership guard may block normal work. Use one table-driven harness around the closed protocol where possible instead of separate bespoke supervisors.

Exercise the ownership guard through real processes, not only its unit helper: start a competing primary while the owner is alive and observe rejection, kill the owner without its release path, verify all children disappear, then start a new primary after the heartbeat becomes provably stale. The new primary must recover the exact guard file and serve normally without manual deletion. Invalid or ambiguous guard contents must continue to fail safe.

Add an adversarial cross-worker realtime-isolation case to the existing real-process state harness. Connect two authenticated clients to different worker PIDs with non-overlapping record-specific subscriptions, then create, update, and delete the separately subscribed records. Assert that the intended client receives each event exactly once and the other receives none; also invalidate one client's auth and prove the other remains authenticated. Repeat after replacing the owner worker. This rules out accidental client-ID/owner routing cross-talk rather than merely proving that a single client can receive a cross-worker event; existing realtime access-rule tests remain the compatibility coverage for record authorization.

Add a shared-database pressure scenario with enough independent connections to reach every worker. Run concurrent readers and writers while forcing WAL checkpoints and manual/autobackup creation, then kill a writer and recycle workers. Record attempted, committed, and rolled-back operation IDs so acceptance is based on final counts and a deterministic checksum. No successful write may be lost or duplicated, interrupted transactions must not leave partial rows, HTTP must remain responsive within the existing ten-second SQLite busy timeout, and later checkpoint/backup/write operations must recover without persistent `SQLITE_BUSY`, `SQLITE_LOCKED`, corrupt archives, or log-write failures.

Keep the existing repeatable benchmark wrapper under `scripts/` for release preparation after PocketBun upgrades to the then-current PocketBase version. Until cluster correctness is otherwise complete, Linux targeted checks are sufficient: prove that workers receive traffic, cluster mode does not regress the selected request path, and the primary remains responsive under rate-limit and realtime fan-out pressure. Do not spend time on the full PocketBase/PocketBun matrix or Windows/macOS proxy benchmarks before that upgrade.

- health/static and CPU-light HTTP overhead;
- authenticated single-record and list reads;
- a CPU-heavy server-side JavaScript hook route;
- mixed read/write CRUD;
- write-heavy CRUD;
- realtime connections plus record broadcasts;
- rate-limited requests;
- idle and loaded RSS, CPU, file descriptors, SQLite busy/retry counts, and log-write failures.

When the final benchmark work resumes, keep connection count, request payloads, database contents, Bun version, CPU affinity, and reverse-proxy involvement fixed. Report requests/second plus p50, p95, and p99 latency. Confirm `--workers=1` is within normal run-to-run noise of a controlled current-code baseline; investigate a repeatable regression above 2%. On a host with dedicated physical cores, two workers must improve a representative read-only API workload by at least 60% over one worker before cluster mode is presented as a performance advantage. Also record CPU-heavy scaling, but do not substitute an artificial hook workload for the read-only API criterion. Require monotonic one/two/four-worker read scaling and explain sublinear four-worker efficiency. Do not require writes to scale, but do not recommend a worker count whose mixed/write workload regresses materially or produces lock errors. Profile any unexpected primary CPU cost, especially global rate limiting and realtime fan-out, following `.agents/PERFORMANCE.md`.

Add one repeatable stateful soak command under `scripts/` only if the integration harness cannot express it cleanly. This is a required release gate, not an optional diagnostic. Run at least 60 minutes with two workers and 60 minutes with four workers on matching clean Linux hosts; the runs may proceed concurrently. Mix authenticated and guest CRUD, list/read traffic, settings and collection changes, several long-lived realtime clients with sequence checks, rate-limited requests, manual backup, autobackup/checkpoint activity, periodic follower and leader kills, full restart, and at least one ungraceful primary death followed by stale-guard recovery. Use normal persistent HTTP connections for sustained traffic and additional independent connections for worker distribution.

The soak must continuously assert invariants: expected record IDs/count/checksum; settings and collection convergence on every PID; no duplicate realtime sequence and successful reconnect after the owning worker dies; exactly-once singleton effects; eventual backup success and readable archives; the configured worker count after every recovery; and no orphan PIDs at completion. Sample primary/worker RSS, CPU, file descriptors or Windows handles where available, event-loop stalls, SQLite busy/locked errors, log-write failures, and request latency throughout the run. Memory, handles, and latency must settle rather than trend upward without bound. Any correction to cluster coordination or database lifecycle after a soak failure invalidates the earlier soak and requires the affected soak to be rerun from the beginning.

Two matching clean Ubuntu Hetzner instances are available out of band for soak and final benchmarks; keep their addresses and credentials out of this tracked plan. Record anonymized CPU, memory, kernel, filesystem, Bun, PocketBase, and Go versions plus raw artifact paths. After all correctness work is complete, use the two-agent benchmark split requested by the repository owner: one agent runs the current PocketBase release on one host, one runs PocketBun on the other, and the root agent fixes fixture, client, connection count, duration, and collection data so the results are directly comparable. Do not start the final benchmark while correctness changes can still alter the request or coordination paths.

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

The cluster hardening portion of Milestone 10 is complete only after the deterministic fault matrix, shared-SQLite pressure scenario, both required Linux soaks, focused and full tests, targeted primary-load evidence, operational documentation, docs regeneration, package typing, build output, and the full local and hosted repository gates pass without unexplained retries or warnings. The final matched benchmark gate resumes only after that point, alongside the PocketBase upgrade. There must be no known reproducible cluster data-loss, deadlock, orphan-process, stale-state, or unbounded-resource defect at release.

### Milestone 11: make organization record creation faster than PocketBase

The benchmark name “Creating organizations” means creating ordinary records in the benchmark's `organizations` collection; it does not mean changing PocketBase collection schemas. Each of its two scenarios sends 50 unauthenticated JSON `POST /api/collections/organizations/records` requests with ten requests in flight. The first collection has an empty create rule and the second evaluates `@request.body.name != ''`. Before every timed burst, the benchmark updates the rule, counts existing records, and waits two seconds. The accepted comparison uses one external load-generator host, one fixed application host, five runs, and matched PocketBase `GOMAXPROCS=1/2/4` versus PocketBun one/two/four workers. Both targets first run the same selected scenarios untimed with a 300-request target/cap; the short organization and permission variants expand to the target in one batch, after which the measured `create` phase clears warmup data without restarting the application.

The focused four-worker tiering curve compared 50, 150, 300 and 600 organization creates per rule variant across five fresh processes at each level, recording every serving slot and selected `bun:jsc.numberOfDFGCompiles()` counters. Most of the improvement arrived at 150 requests, 300 offered a smaller gain, and 600 did not consistently improve further even when rule helper functions reached DFG. The matched external control nevertheless required 300 to move both organization rows below PocketBase, so use 300 as the default target/cap and do not force FTL or universal DFG state. Treat those counts as record-create/rule-evaluation requests, not collection-rule updates: the collection update itself runs once in the benchmark-controller worker and is outside the timed request burst.

Reuse that benchmark-only worker-slot signal to qualify Linux load distribution; do not add a second harness. The external client must record per-worker request counts separately for warmup and measurement, both per scenario and across the complete suite, and report each worker's share plus the maximum/minimum ratio. `SO_REUSEPORT` assigns TCP connections rather than individual HTTP requests, so persistent connections and low-concurrency scenarios are not expected to split evenly: a concurrency-one scenario may correctly use one worker, and 25-request scenarios can be visibly noisy. Require every worker to participate in high-volume/high-concurrency scenarios and inspect aggregate four-worker balance for persistent dominance by one slot. Use the observed distribution to choose the warmup request count; a total-request target is insufficient if one worker remains below the intended tiering threshold.

First make the existing focused tools reproduce that exact boundary. Extend `scripts/measure_records_scenario.ts` and the shared setup in `scripts/profile_scenarios.ts` only as needed to support the upstream two-second settling period and to report total wall time for a fixed request count. Keep `scripts/profile_inspector_records_list.ts` as the CPU profiler; do not create another profiler. Run five fresh-process measurements for `create-organizations` and `create-organizations-rule` with 50 requests, concurrency 10, no HTTP warm-up, and a two-second settle. Run a second five-run series with 100 untimed HTTP warm-ups before the same 50 measured requests. This separates first-use cost from sustained request cost and establishes the need for the public benchmark's symmetric warmup. Record p50, p95, p99, total time, worker CPU, SQLite busy/retry counts, and which worker served each request for one, two, and four workers.

Use three diagnostic controls to locate the cost before editing production code. The HTTP-only control returns the same approximate JSON response size without touching a model or SQLite. The save control constructs the same `organizations` record and calls the normal `App.Save()` path without HTTP parsing or response serialization. The raw-write control executes the already prepared equivalent insert against a disposable database. These controls are diagnostics, not alternate production routes, and should live in the existing profiling scripts or temporary ignored files. Compare their cold and warmed totals on the same Bun version and host. The gap between raw write and normal save bounds model validation, field interceptors, hook dispatch, realtime handling, and record export; the gap between normal save and the complete request bounds routing, request parsing, enrichment, public export, JSON serialization, and HTTP transport.

Capture a warmed CPU profile and, if the fresh 50-request gap remains material, a cold profile only after the fixture has settled. Attribute native `bun:sqlite` time to `BaseApp.persistRecord()` separately from JavaScript self-time. Inspect the actual request path in `src/apis/record_crud.ts`, `src/forms/record_upsert.ts`, `src/core/base.ts`, `src/core/record_model.ts`, `src/apis/record_helpers.ts`, `src/apis/realtime.ts`, and `src/tools/router/event.ts` against `.upstream/pocketbase/apis/record_crud.go`, `.upstream/pocketbase/forms/record_upsert.go`, and the upstream model persistence path. Do not optimize a frame merely because it appears in a profile; require either a meaningful share of the end-to-end gap or a direct A/B improvement in the exact external scenario.

Apply the smallest measured changes one at a time. The first candidate is the already identified no-recipient realtime work in `src/apis/realtime.ts`: when cluster presence proves that no remote worker owns a realtime client, return before `DBExport()`, `JSON.stringify()`, UUID allocation, or publish-queue work. Unknown or stale presence must continue to take the safe send path, so this cannot lose an event. After that, use the profile to choose among the common save pipeline, record export, hook fast paths, enrichment, response serialization, or HTTP handling. If promise/microtask overhead around the synchronous `bun:sqlite` write is material, add a fast path only when the existing hook objects can prove that every applicable handler is synchronous and built-in; any user or unknown handler must retain the current asynchronous path. Do not add a speculative framework, cache, queue, worker thread, new dependency, or benchmark-collection special case.

Treat SQLite as a boundary, not an excuse. The warmed local profile currently attributes about half its samples to the prepared insert, but PocketBun already caches that statement and uses PocketBase's WAL, `synchronous=NORMAL`, busy timeout, and cache settings. Measure raw inserts before changing SQL construction or connection use. Reject `synchronous=OFF`, cross-request transaction batching, delayed acknowledgement, and any worker-count recommendation that merely hides lock contention. If the prepared insert itself consumes most of the remaining gap after redundant JavaScript work is removed, isolate Bun 1.4.0 versus 1.4.1 and report the runtime limitation rather than weakening the database contract.

After each retained change, rerun both exact and warmed organization scenarios five times. Keep a change only when the median improvement exceeds normal run-to-run noise, behavior tests remain green, and no paired control regresses materially. Then run the permission-create and post-create scenarios because they share the same machinery, followed by the complete 150-scenario matrix. Re-run the affected cluster soak only if production request, save, hook, realtime, or database code changed; a profiling-script-only change needs no soak.

Milestone 11 is complete when both organization scenarios have zero errors and PocketBun's five-run median total is at least 5% lower than matched PocketBase at one, two, and four application lanes. The response status and JSON shape, created row values and count, create-rule decision, validation errors, model/record hook order and count, realtime event content and ordering, and durability after immediate process termination must still match PocketBase. The warmed series must not regress more than 2%, the permission/post create scenarios must not regress more than 2%, and the full repository gate plus the affected Linux cluster soak must pass before the final public benchmark is rerun.

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
16. Finish the deterministic fault matrix in `src/internal/cluster/`: migration-boundary leader death, transaction and pending-response follower death, coordinator-operation primary death, no-ready/crash-budget behavior, stale-guard process recovery, and late/duplicate/malformed IPC cleanup. Keep fixtures shared and table-driven where that shortens the harness.
17. Add the shared-SQLite pressure scenario and prove final operation counts/checksums, rollback, checkpoint/manual-backup/autobackup recovery, and absence of persistent busy/locked failures before adding longer load.
18. Add only the repeatable soak support that is necessary, then run the required 60-minute two-worker and four-worker Linux soaks. Preserve complete raw logs and resource samples outside git, summarize invariant results here, and rerun an affected soak from the beginning after any correctness fix.
19. After correctness is frozen, update the benchmark wrapper and use the two matching clean Ubuntu hosts concurrently: repeat the current PocketBase benchmark on one and run PocketBun with one, two, and four workers on the other. Use identical client settings and fixtures, then run the smaller Windows/macOS proxy matrix and record every workload without selectively dropping regressions.
20. Profile primary CPU and response latency during rate-limit-heavy and realtime fan-out workloads. Optimize only a measured bottleneck and repeat the relevant deterministic tests, soak, and benchmark after a request-path change.
21. Update CLI help, deterministic docs overlays, generated docs, `CHANGELOG.md` under `Unreleased`, and the Bun watchlist if needed for clustering. Include deployment supervision, topology, connection affinity, worker-hook semantics, SQLite limits, measured worker guidance, recovery, monitoring, and the immediate `--workers=1` rollback.
22. Run `bun run format:fix`, the configured isolated parallel suite, `bun test --concurrent`, `bun run typecheck`, `bun run typecheck:package`, `bun run lint`, `bun run check:versions`, `bun run docs:check`, `bun run build`, and `git diff --check` locally, then pass normal and manual hosted Ubuntu, macOS, and Windows workflows without unexplained retries or warnings.
23. Inspect the complete diff and evidence for upstream traceability, comments, unnecessary abstractions, single-worker overhead, secret/token leakage, orphan processes, destructive recovery behavior, unexplained flakes, and every production-confidence acceptance item. Do not release with a known reproducible cluster correctness failure. Commit only when the repository owner asks or normal task scope at that time includes a commit.
24. Add the upstream-equivalent two-second settle and fixed-count wall-time reporting to the existing focused scenario helper. Record five fresh-process exact and warmed baselines for both organization scenarios before changing production code.
25. Run the HTTP-only, normal-save, and raw-prepared-insert controls plus settled CPU profiles. Record how much of the PocketBase gap belongs to transport, the compatible save pipeline, synchronous SQLite, and first-use work; do not retain diagnostic production instrumentation.
26. Move the known no-remote-realtime-client check ahead of cluster record snapshot encoding, add focused presence/event regressions, and keep it only if the exact external A/B measurement improves. Apply any further optimization singly to the largest remaining measured compatible hotspot.
27. After every production change, run the organization create/rule tests, record hook/realtime compatibility tests, and five-run exact plus warmed benchmark. Reject changes that merely shift time, alter durability/observable behavior, or improve less than measurement noise.
28. Once both organization scenarios beat PocketBase by at least 5% at one/two/four lanes, run create-permissions, create-posts, the full validation suite, and the affected Linux cluster soak. Fix or revert any regression above 2%.
29. Rerun the complete external PocketBase/PocketBun matrix only after Bun 1.4.1 and the HTTP/2 decision are final. Replace the provisional result artifacts and README claims only with that zero-error final matrix.

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
- Two differently authorized SSE clients on distinct workers remain isolated: neither can receive the other's realtime records or auth-state changes before or after worker replacement.
- Rate limits and built-in resend cooldowns are application-wide, not multiplied by worker count. Apple's OAuth2 name handoff works across workers.
- Backup exclusion, backup deletion protection, health state, and `app.restart()` are cluster-wide. Restore is cluster-wide on its currently supported platforms and never leaves a worker attached to the old database files; Windows retains its explicit unsupported error.
- Custom `app.store()` remains explicitly per worker; startup/serve, mutation-hook, and cron execution scopes match the documentation.

Production-confidence acceptance:

- The inherited compatibility suite and Bun's process-isolated parallel suite remain green, but neither is counted as evidence for cross-process ordering by itself.
- Real-process tests sharing one `pb_data` pass every named migration, transaction, worker/primary death, pending coordinator, ownership-guard, IPC, restart, backup, restore, realtime, and no-ready failure boundary. Assertions use durable state or bounded eventual outcomes, not timing alone.
- Concurrent writers/readers plus WAL checkpoints, manual backup, and autobackup finish with the exact committed record set and checksum, no partial transaction, a valid backup, continued writes after worker death, and no persistent busy/locked condition.
- Two-worker and four-worker Linux soaks each run for at least 60 minutes with all online invariants intact, no unexplained request or log errors, the configured worker count after recovery, no orphan process, and no unbounded RSS/handle/latency trend.
- Killing the primary during every coordinated operation rejects pending work within its documented bound. A fresh primary recovers the stale guard and shared database without inheriting a lease or half-finished transition.
- Rate-limit-heavy and realtime fan-out measurements include primary CPU and latency; any saturation or material regression is either fixed and requalified or blocks release.
- No cluster CI or soak flake is waived by retry. A bounded retry is acceptable only when the operation is explicitly safe to repeat and eventual recovery is the contract being tested; its initial failure and final outcome remain visible in evidence.
- At release review there is no known reproducible cluster correctness, data-loss, deadlock, orphan-process, or unbounded-resource defect. The documented rollback to `--workers=1` has been exercised against the same data without conversion.

Performance acceptance:

- The pre-change and post-change single-worker five-run medians differ by no more than 2% without an explained environmental cause or an approved tradeoff.
- On a Linux reference host with dedicated physical cores, a representative read-only API workload improves by at least 60% from one to two workers, continues to improve monotonically through four workers, and has no correctness failures. CPU-heavy hook scaling is reported separately rather than used as a substitute.
- The report includes RSS and SQLite contention. Documentation recommends measured worker counts and does not claim write scaling.
- Rate-limit IPC, realtime fan-out, logging, and primary CPU do not become unmeasured bottlenecks. Any material cost is documented.
- Both upstream organization-create scenarios complete with zero errors and PocketBun's five-run median is at least 5% faster than matched PocketBase at one, two, and four application lanes on the same external topology.
- Exact fresh-process and warmed organization diagnostics are both recorded. The upstream comparison records and applies the same visible warmup to PocketBase and PocketBun, and the focused helper waits the same two seconds after collection changes before attributing time to the request path.
- Organization-create response, database, rule, validation, hook, realtime, and durability behavior remains PocketBase-compatible. No SQLite durability setting is weakened and no independent requests are combined into one transaction.
- Warmed organization throughput, permission/post creation, and the complete suite show no unexplained regression above 2%; any shared production-path change passes the affected Linux cluster soak.

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

Milestone 10 migration-boundary local qualification:

    Date: 2026-08-22
    Bun: 1.4.0 (34cbb9a40)
    Fault 1: leader process exited with code 91 after transactional schema/data writes
    Fault 2: replacement leader exited with code 92 from onServe after migration commit
             and before worker.ready
    Fault 3: ready leader was killed and replaced in the same leader slot
    Durable evidence: three distinct marker PIDs; neither pre-ready PID appeared in a
                      ready-leader message; leader ready preceded follower ready
    Final database: one cluster_migration_fault row and one matching _migrations row
    Production changes: none; temporary migration and hook fixtures only
    Focused reruns: 10 pass, 0 fail, 110 expect() calls in 13.66 seconds
    Complete lifecycle file: 6 pass, 0 fail, 44 expect() calls in 14.11 seconds
    bun run test: 1,937 pass, 0 fail, 10,391 expect() calls
                  across 248 files in 32.82 seconds
    bun test --concurrent: 1,937 pass, 0 fail, 7 snapshots,
                           10,391 expect() calls across 248 files in 83.14 seconds
    bun run format:fix: passed
    bun run typecheck: passed
    bun run lint: 0 warnings, 0 errors
    git diff --check: passed
    Hosted run 32574869343: Ubuntu, macOS, Windows, and Playwright E2E passed

Milestone 10 follower-failure local qualification:

    Date: 2026-08-22
    Bun: 1.4.0 (34cbb9a40)
    Fault 1: follower process exited with code 93 from inside runInTransaction after
             inserting a test effect row
    Transaction outcome: the replacement and every other worker observe zero interrupted
                         rows; a later transaction commits one row and converges everywhere
    Fault 2: another follower was killed after the realtime client owner entered a held
             coordinator delivery and before the primary could respond to the source
    Coordinator outcome: the source HTTP request rejected; the owner completed the already
                         delivered subscription update; the replacement repeated the
                         idempotent update successfully with HTTP 204
    Production changes: none; temporary hook routes and marker files in the existing
                        real-process state harness only
    Focused reruns: 5 pass, 0 fail, 310 expect() calls in 25.14 seconds
    bun test --concurrent: 1,937 pass, 0 fail, 7 snapshots,
                           10,398 expect() calls across 248 files in 88.29 seconds
    bun run format:fix: passed
    bun run typecheck: passed
    bun run lint: 0 warnings, 0 errors
    Hosted run 32575568119: Ubuntu, macOS, Windows, and Playwright E2E passed

Milestone 10 primary-death local qualification:

    Date: 2026-08-22
    Bun: 1.4.0 (34cbb9a40)
    Boundaries: rate-limit.consume-batch, realtime.prepare, oauth2.deliver,
                backup.acquire, restore.begin
    Injection: temporary hook records each outgoing coordinator request and intercepts
               only the armed matching response before PocketBun's worker listener
    Failure outcome: SIGKILL primary; source HTTP request rejects; every old worker exits
                     through IPC-parent disconnect; no orphan remains
    Recovery outcome: the next production primary waits for and atomically replaces the
                      dead owner's real guard, starts two workers, and completes the same
                      operation or the restore-equivalent backup lease operation
    Production changes: none; one temporary hook fixture in the lifecycle test
    Focused reruns: 5 pass, 0 fail, 230 expect() calls in 76.38 seconds
    Complete lifecycle file: 7 pass, 0 fail, 90 expect() calls in 29.61 seconds
    bun test --concurrent: 1,938 pass, 0 fail, 7 snapshots,
                           10,444 expect() calls across 248 files in 102.55 seconds
    bun run format:fix: passed
    bun run typecheck: passed
    bun run lint: 0 warnings, 0 errors
    git diff --check: passed
    Hosted Ubuntu/macOS/Windows qualification: completed in the later current-revision matrix

PocketBase v0.40 compatibility and live-backup qualification:

    Upstream tag/commit: v0.40.0 / 50f5f83a
    Backup boundary: main VACUUM INTO; cluster-wide new/delete file tracking;
                     auxiliary VACUUM INTO; streamed ZIP/ZIP64 archive
    Memory model: disk-backed database snapshots and streaming archive entries;
                  no database-sized JavaScript buffer
    Compatibility: standard PocketBase data.db/auxiliary.db/storage ZIP layout;
                   old PocketBase and PocketBun archives remain restorable
    Real-process mutation test: backup owner, deleter, and uploader on three distinct PIDs;
                                deleted file plus attrs retained; new file excluded;
                                live filesystem reflects the inverse final state
    Fault found: backup owner worker ID was incorrectly used as a slot-map key
    Corrected repetition: 3 pass, 0 fail, 342 expect() calls in 20.45 seconds
    Upstream file mapping audit: 0 missing source files, 0 missing test files
    JSVM declaration/runtime contract: 5 pass, 0 fail, 1,710 expect() calls
    CI-style four-process release qualification: 1,957 pass, 0 fail,
                                                 10,599 expect() calls in 49.09 seconds
    Typecheck, package build/types, lint, format, docs, version alignment,
    and upstream mapping audit: passed
    Hosted Ubuntu/macOS/Windows qualification: completed in the later current-revision matrix

Milestone 10 primary-pressure qualification:

    Date/host: 2026-08-23; dedicated four-vCPU Ubuntu host driven externally
    Uncoordinated four-worker control: 13,363.2 req/s
    Single-worker local rate limiter: 14,753.9 req/s; 8.88 ms p50
    Original four-worker global limiter: 1,238.1 req/s; 101.07 ms p50;
                                         about 5% active primary CPU
    Cause: one Bun process-IPC request/response round trip per HTTP request
    Fix: workers queue concurrent decisions while a batch is in flight; the primary
         applies every request synchronously in received array order with the existing
         limiter, preserving exact application-wide limits
    Corrected four-worker limiter: 27,980.1 req/s; 4.02 ms p50; 9.65 ms p95;
                                   all four workers used; primary below 20% CPU
    Concurrent correctness: 24 real clustered requests; exactly 8 allowed and 16 rejected
    Realtime control without subscribers: 5,424.6 mutations/s
    Realtime with 32 subscribers: 2,101.0 mutations/s; 1.65 ms p50; 4 ms p95;
                                  21,010 events delivered to each subscriber,
                                  672,320 of 672,320 expected events total
    Interpretation: rate-limit IPC was a material bottleneck and is removed; realtime
                    fans out exactly and workers saturate before the primary
    Post-fix full tests: both modes 1,958 pass, 0 fail, 10,604 expect() calls
    Build, package/application types, lint, formatting, docs, mapping, and E2E: passed

Milestone 10 first production-smoke and Windows-correction batch:

    Date: 2026-08-22
    Hosted run 32577240713: Ubuntu and macOS passed; Windows failed the held
                                backup with HTTP 400 and retained the final guard
    Initial guard hypothesis: serialized heartbeat drain; disproved by the next
                              identical Windows failure and removed
    Backup diagnostics: held-backup hook error/stack, HTTP body, and captured primary
                        stdout/stderr are preserved on failure; no automatic retry added
    Public collection update: HTTP 200 on copied and fresh two-worker Ubuntu fixtures;
                              new public PATCH plus all-worker convergence regression passes
    Graceful service stop: real Ubuntu systemd Result=success, ExecMainStatus=0
    Benchmark cleanup: list-posts25k-author-check exits normally after result output
    Focused cluster/state suite: 8 pass, 0 fail, 153 expect() calls in 34.25 seconds
    bun test --concurrent: 1,938 pass, 0 fail, 7 snapshots,
                           10,443 expect() calls across 248 files in 99.93 seconds
    Configured isolated suite: 1,938 pass, 0 fail, 10,443 expect() calls
                               across 248 files in 44.55 seconds
    bun run format:fix: passed
    bun run typecheck: passed
    bun run lint: 0 warnings, 0 errors
    git diff --check: passed
    Hosted run 32580868631: Ubuntu/macOS passed; Windows backup passed and only the
                            final forced-death guard expectation failed
    Corrected invariant: Bun force-terminates a spawned Windows child for SIGTERM,
                         so its dead-owner guard remains for stale recovery; POSIX
                         graceful shutdown still removes the guard
    Hosted run 32581531550: Ubuntu, macOS, Windows, and downstream Playwright E2E passed
                            at commit 20560496; corrected primary-death and backup
                            qualification complete
    Smoke host topology: two reported vCPUs are SMT siblings on one physical core
    JavaScript route: one worker about 617 req/s; two about 769 req/s (+24.6%)
    Author-filter route: one about 500.5 req/s; two about 525.4 req/s (+5.0%)
    Single-worker author-filter client median: 320 ms versus historical 334 ms
    Interpretation: routing and parallel execution work, but this host cannot establish
                    physical-core scaling and the baseline improvement is not compelling
    Final requirement: dedicated physical cores, controlled Bun 1.3/1.4 baseline,
                       >=60% one-to-two-worker representative read-only gain, and
                       monotonic one/two/four-worker read scaling

Milestone 10 no-ready and IPC local qualification:

    Date: 2026-08-22
    Never-ready roles: leader and follower each exhaust five pre-ready deaths within
                       the bounded crash budget; no worker or ownership guard remains
    Invalid IPC: malformed protocol version, duplicate worker.ready, and late unknown
                 coordinator.delivery-result each remove the sender
    Recovery: every invalid-IPC sender is replaced with a new PID in the same role/slot,
              returning the cluster to two healthy workers
    Production changes: none; injection uses only a temporary hook fixture
    Focused cluster file: 8 pass, 0 fail, 113 expect() calls in 33.87 seconds
    Complete concurrent suite: 1,939 pass, 0 fail, 7 snapshots,
                               10,466 expect() calls across 248 files in 103.33 seconds
    bun run format: passed
    bun run typecheck: passed
    bun run lint: 0 warnings, 0 errors
    git diff --check: passed
    Hosted qualification: completed in the later current-revision matrix
    Linux qualification host: Ubuntu kernel 7.0, 16 GiB memory, AMD EPYC-Milan,
                              four dedicated vCPUs mapped to two physical cores with SMT2;
                              logical CPUs 0 and 2 are on separate cores

Milestone 10 shared-SQLite pressure and backup correction:

    Date: 2026-08-22
    Traffic: three real workers, targeted transactional two-row writes and reads through
             every PID, repeated TRUNCATE checkpoints, manual backup, the real leader
             autobackup job, one mid-transaction leader death, later writes/checkpoints,
             backup-owner death, full restart, and restore
    Invariants: acknowledged operation count and checksum exact on every worker; crashed
                operation absent; no partial pair; extracted SQLite integrity_check=ok;
                manual and automatic snapshots contain only complete acknowledged ops;
                later backup/restart/restore succeed; no persistent busy/locked or log error
    Original Linux failure: manual backup returned HTTP 400 with SQLiteError
                            "locking protocol" at transaction commit while independent
                            workers wrote and checkpointed
    Rejected correction: Bun SQLite serialize() froze data.db and auxiliary.db before ZIP
                         creation. It was discarded before release because its peak RAM is
                         proportional to database size.
    Replacement: standard on-disk SQLite snapshots created sequentially with `VACUUM INTO`,
                 streamed ZIP entries, and excluded live WAL, SHM, and journal sidecars.
                 This needs temporary disk space for the original database, its snapshot,
                 and the ZIP; document the resulting roughly 3x worst-case data-directory
                 free-space requirement. The separate ZIP64 qualification creates a 4.36 GiB
                 database, verifies the ZIP64 entry plus main/auxiliary/file restore state,
                 and records a 254,500 KiB peak RSS on the dedicated Ubuntu host.
    Local focused backup/archive/state gate: 46 pass, 0 fail, 112 expect() calls
    Complete local concurrent suite: 1,940 pass, 0 fail, 7 snapshots,
                                     10,503 expect() calls across 248 files in 113.22 seconds
    Final state file after restored-snapshot assertion: 1 pass, 0 fail, 101 expect() calls
    bun run format: passed
    bun run typecheck: passed
    bun run lint: 0 warnings, 0 errors
    git diff --check: passed
    Local pre-correction pressure repetition: 10 pass, 0 fail on macOS; insufficient to
                                              qualify the Linux cross-process boundary
    Clean Ubuntu corrected repetition: 20 pass, 0 fail, 1,900 expect() calls in 153.77 seconds
    Harness correction: probe consecutive ports below Linux's default ephemeral range;
                        discarded EADDRINUSE runs were listener-selection failures, not
                        product or SQLite qualification evidence
    Hosted Ubuntu/macOS/Windows qualification: completed in the later current-revision matrix

Milestone 11 organization-create baseline and initial profile:

    Accepted external five-run medians, PocketBase / PocketBun:
      no rule, 1 lane: 27.247601 ms / 47.894895 ms (PocketBun 1.76x slower)
      no rule, 2 lanes: 16.828999 ms / 48.009931 ms (PocketBun 2.85x slower)
      no rule, 4 lanes: 18.060064 ms / 50.925602 ms (PocketBun 2.82x slower)
      body rule, 1 lane: 29.165727 ms / 41.623145 ms (PocketBun 1.43x slower)
      body rule, 2 lanes: 27.838016 ms / 43.906913 ms (PocketBun 1.58x slower)
      body rule, 4 lanes: 23.377920 ms / 40.448636 ms (PocketBun 1.73x slower)
    Raw accepted reports:
      benchmarks/results/pb_compare_20260824T220243Z_external/raw/
    Local exact-shape diagnostic, M2 Max, Bun 1.4.0, 50 requests/concurrency 10:
      command: bun run scripts/measure_records_scenario.ts --scenario <scenario>
               --iterations 50 --concurrency 10 --warmup-requests <0|100> --settle-ms 2000
      no rule, no warm-up total ms: 12.120, 14.417, 13.785, 12.820, 14.435; median 13.785
      no rule, 100 warm-ups total ms: 4.193, 4.324, 8.055, 3.939, 4.067; median 4.193
      body rule, no warm-up total ms: 14.363, 17.300, 15.813, 16.330, 16.578; median 16.330
      body rule, 100 warm-ups total ms: 5.230, 4.794, 5.018, 4.604, 6.020; median 5.018
    Disposable Linux phase controls, 50 requests/concurrency 10, five-run medians:
      fully cold handler: 49.254 ms
      100 generic HTTP warm-ups: 40.711 ms
      100 normal App.Save warm-ups: 24.360 ms
      both generic HTTP and App.Save warm-ups: 13.326 ms
      100 actual record-create warm-ups: 7.136 ms
      warmed normal App.Save: about 2.2 ms; warmed raw prepared insert: about 0.94 ms
      SaveSync did not improve the warmed normal-save path and is not a viable fast-path candidate
    Warmed local inspector profile:
      command: bun run profile:inspector:list -- --scenario create-organizations
               --duration-ms 5000 --concurrency 10 --warmup-requests 100
               --interval-us 100
      completed: 81,972 requests
      largest exclusive sample: bun:sqlite prepared statement run, about 50%
      JSON stringify: about 2.3%; no individual PocketBun frame above 3%
    Exact external two-worker no-recipient realtime A/B, five alternating zero-error runs:
      baseline no-rule median: 48.350 ms; early-presence-guard median: 47.976 ms (+0.8%)
      baseline body-rule median: 40.003 ms; early-presence-guard median: 42.152 ms (-5.4%)
      conclusion: rejected and removed; no production diff retained
      local copies: /private/tmp/org-realtime-guard-2w/
      server copies: /root/pocketbun-artifacts/b5fc5ef4/org-realtime-guard-2w-rerun/
    Profile caveat: Bun's inspector attributed suspended async request roots and synchronous
                    notify polling as exclusive time in short cold captures. Phase-controlled
                    wall time is the reliable cold/warm evidence; use CPU profiles only for
                    the settled sustained path.

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

Revision note, 2026-08-22 / Codex: Closed Milestone 9 after corrected hosted run 32568697758 passed the complete Ubuntu, macOS, Windows, and downstream Playwright E2E matrix at commit `bb15bad4`. Cluster-wide backup exclusion, owner-death recovery, restart, and supported-platform restore are qualified. At that point the inherited Windows restore rejection remained a pending product decision; the 2026-08-24 decision below supersedes that status and accepts the PocketBase-compatible exclusion. Milestone 10 is the remaining hardening, performance, documentation, and release gate.

Revision note, 2026-08-22 / Codex: Started Milestone 10 with POSIX `SIGINT` coverage in the existing real-process lifecycle test. Recorded hosted run 32570752219: Ubuntu and macOS passed, while Windows completed the cluster behavior and failed only because the state harness deleted its temporary data immediately after primary exit. Reused the lifecycle harness's output-pipe completion signal so cleanup waits for all descendants without adding sleeps or filesystem retries; corrected hosted confirmation remains pending.

Revision note, 2026-08-22 / Codex: Closed the Windows cleanup correction after hosted run 32571549616 passed Ubuntu, macOS, Windows, and downstream E2E. Continued Milestone 10 with a low-level SSE fault-injection client that proves a client can observe worker death, reconnect after replacement, resubscribe through another worker, and resume event delivery; local focused qualification passes and hosted confirmation remains pending.

Revision note, 2026-08-22 / Codex: Recorded hosted run 32572008206: Ubuntu and macOS passed, while Windows completed SSE reconnect and then exposed an under-specified backup-owner-death wait. Changed the test boundary from one arbitrary healthy mirror to all three current worker PIDs, added the failed backup response body to future diagnostics, and passed five focused local reruns; corrected hosted confirmation remains pending.

Revision note, 2026-08-22 / Codex: Closed the SSE reconnect and backup-state convergence corrections after hosted run 32572636371 passed Ubuntu, macOS, Windows, and downstream E2E. Added the smallest remaining shutdown-failure test: one follower proves it entered a deliberately non-returning termination hook, after which the primary enforces its existing ten-second deadline and leaves no worker process behind. Focused and complete local suites, format, typecheck, and lint pass; hosted qualification remains pending.

Revision note, 2026-08-22 / Codex: Recorded hosted run 32573179866: Ubuntu and macOS passed, while Windows exposed two test-boundary assumptions. `Bun.spawn().kill("SIGTERM")` killed the primary immediately rather than invoking its JS handler, so the portable forced-stop test now triggers `app.restart()`, which uses the same production ten-second worker deadline. Backup mirrors all converged after owner death, but the immediate next real backup returned 400; the recovery assertion now waits for the idempotent named backup itself to succeed on the surviving leader within a bounded deadline and retains the last failure for diagnostics. Focused and complete local gates pass.

Revision note, 2026-08-22 / Codex: Raised Milestone 10 to an explicit production-confidence release gate at the repository owner's request. Distinguished inherited single-process PocketBase compatibility from PocketBun's multi-process coordination risks, made shared-database fault injection and 60-minute two-worker and four-worker Linux soaks mandatory, added primary saturation and current PocketBase comparison work, and required no known reproducible correctness or unbounded-resource defect before release.

Revision note, 2026-08-22 / Codex: Closed the forced-stop and backup-recovery correction after hosted run 32573835408 passed Ubuntu, macOS, Windows, and downstream E2E at commit `f5dd61f3`. Added deterministic leader migration-boundary coverage using only temporary JavaScript migration and hook fixtures: transaction death, post-commit/pre-ready death, and post-ready replacement now pass ten focused reruns and the complete 1,937-test local concurrent gate; hosted qualification remains pending.

Revision note, 2026-08-22 / Codex: Added deterministic follower death coverage to the existing shared-data state harness without production changes. A process exit inside `runInTransaction` rolls back fully and permits later writes; a follower killed while awaiting an already-routed realtime subscription loses its HTTP response while the idempotent owner operation may still finish, and the replacement safely repeats it. Five focused runs and the complete 1,937-test local concurrent gate pass; hosted qualification remains pending.

Revision note, 2026-08-22 / Codex: Closed the leader and follower failure checkpoints after hosted runs 32574869343 and 32575568119 passed Ubuntu, macOS, Windows, and downstream E2E at commits `e855e24e` and `19ada7d0`. Added a table-driven primary-death matrix for rate limiting, realtime preparation, OAuth2 delivery, backup acquisition, and restore begin. A temporary hook loses only the armed response after the real primary completes it; SIGKILL then proves request and worker disconnect, real stale-guard replacement, and clean coordinator recovery without production fault controls. Five local matrices and the complete lifecycle file pass; hosted qualification remains pending.

Revision note, 2026-08-22 / Codex: Recorded the first production-like cluster smoke and hosted run 32577240713. Tested a Windows guard-release heartbeat hypothesis, restored successful exit status for graceful CLI/systemd shutdown, fixed benchmark-app resource termination, and pinned a clean public collection update through every worker. Kept the Windows held-backup 400 open and added exact error/body/process diagnostics rather than a retry. Raised the performance acceptance target to at least 60% one-to-two-worker read scaling on dedicated physical cores, with a controlled Bun 1.3/1.4 baseline and monotonic one/two/four-worker results.

Revision note, 2026-08-22 / Codex: Recorded hosted run 32580868631: Ubuntu and macOS passed, and Windows passed the formerly failing backup scenario. The sole failure disproved the heartbeat-unlink hypothesis and exposed an already-known test contradiction: Bun force-terminates spawned Windows children for `kill("SIGTERM")`, so the primary cannot execute graceful guard cleanup. Removed the speculative production change; Windows now explicitly tests forced death and a valid dead-owner guard, while POSIX retains the graceful-removal assertion. Hosted confirmation remains pending.

Revision note, 2026-08-22 / Codex: Closed the corrected primary-death and backup qualification after hosted run 32581531550 passed Ubuntu, macOS, Windows, and downstream E2E at commit `20560496`. Added local real-process leader/follower no-ready crash-budget coverage plus malformed-version, duplicate-ready, and late-result IPC replacement checks without production fault controls. Recorded that the new four-vCPU Ubuntu host has two physical EPYC-Milan cores with SMT, so CPUs 0 and 2 support a clean one-to-two-worker comparison while four-worker results must be labeled SMT-assisted.

Revision note, 2026-08-22 / Codex: Added deterministic shared-SQLite pressure to the real three-worker state harness. Ubuntu reproduced a genuine `SQLiteError: locking protocol` in transaction-wrapped live-file backups that ten macOS repetitions missed. Replaced the live database/WAL archive race with disk-backed sequential `VACUUM INTO` snapshots and excluded sidecars, preserving streamed compression without a cluster-wide write gate. Exact counts/checksums, interrupted-writer rollback, manual and real autobackup archive integrity, later checkpoints/backups, restart, and restore pass in 20 clean Ubuntu repetitions. A dedicated 4.36 GiB `data.db` qualification additionally verified ZIP64 entry metadata, streamed restore, main/auxiliary/file rollback, SQLite integrity, 135.34-second backup time, 10.27-second restore time, and 254,500 KiB peak RSS. Also moved probed test listeners below the ephemeral client-port range after connection-heavy reruns exposed two unrelated `EADDRINUSE` selections; hosted cross-platform confirmation remains pending.

Revision note, 2026-08-23 / Codex: Upgraded PocketBun to PocketBase v0.40.0 and ported the optimized live-backup boundary instead of qualifying the prior backup implementation for release. Extended new/delete storage tracking across workers while keeping sequential disk-backed database snapshots and streamed ZIP64 output. A real three-PID mutation test exposed a worker-ID/slot lookup defect in the first routing implementation; the corrected test passed three complete repetitions and proves the backup retains a deleted pre-snapshot file and excludes a post-snapshot upload. Also aligned v0.40 logs, security headers, CLI errors, JSON behavior, filesystem/JSVM APIs, Record/Store helpers, vendored UI, version metadata, changelog, and user documentation. The full local repository, package, docs, and upstream-mapping gates pass; hosted cross-platform qualification remains pending.

Revision note, 2026-08-24 / Codex: Accepted PocketBase v0.40's explicit Unix-only built-in restore behavior on Windows because PocketBun serves the upstream Admin UI unchanged; removed the planned PocketBun-specific Windows relaunch implementation. Closed the older RSS investigation as superseded by successful v0.40 two-worker and four-worker five-hour soaks plus the focused realtime retained-heap fix, while retaining modest primary RSS growth as a production-monitoring observation rather than claiming that RSS alone disproves every possible slow leak. Recorded the green current hosted matrix and narrowed the remaining release work to one four-worker 60-minute soak of the post-soak per-slot crash-budget revision, the no-known-correctness review, and then the deferred matched PocketBun benchmark suite.

Revision note, 2026-08-24 / Codex: Audited every remaining plan checkbox and made the non-blocking benchmark work explicit. The additional same-class PocketBase v0.40 run produced no data because the strict upstream per-request transport exhausted loopback ephemeral ports; require matched transport methodology before comparing it with v0.36.5. The release blockers remain the final current-revision soak and correctness review, followed by the already-deferred public PocketBun benchmark matrix.

Revision note, 2026-08-24 / Codex: Added a separate two-hour steady-state memory qualification with no worker replacement, cluster restart, or forced GC. Extended the existing Linux soak harness with an independently disableable full-restart interval and per-PID worker RSS samples so this run can distinguish long-lived worker retention from primary growth and warm-up effects.

Revision note, 2026-08-24 / Codex: Corrected the small-host PocketBase benchmark diagnosis after the requested reboot and a byte-for-byte installation comparison. The failed job used PocketBun's stale per-request-transport benchmark snapshot, while the successful big-host launcher had synced upstream revision `05625dc2` with its shared global client. Reopened only one directional same-class v0.40 run using that exact suite; retained the complete four-vCPU five-run baseline as the release reference.

Revision note, 2026-08-24 / Codex: Completed the static no-known-correctness-failure audit and fixed two issues at their narrow ownership boundaries: coordinator TTL entries now expire eagerly without stale-timer overwrite races, and primary/worker IPC sends now trust the completion callback instead of misclassifying queued backpressure as failure. Added focused regressions and passed both complete test modes plus all local package, docs, mapping, type, format, and lint gates. The first no-restart soak clarified that PocketBase intentionally closes SSE at 30 minutes, so the harness now rotates clients at 25 minutes without replacing workers; both final soaks must restart on the resulting exact revision.

Revision note, 2026-08-24 / Codex: Prepared the deferred final benchmark gate while exact-commit soaks ran. Refreshed and pinned benchmark source `05625dc2`, fixed source provenance and the Bun 1.4 result parser, aligned the PocketBun requester with upstream's shared client, and made the PocketBun benchmark server honor real Linux cluster worker counts. The directional two-vCPU PocketBase v0.40 run completed all 150 scenarios without error; its apparent improvement over the old v0.36.5 run remains methodology-contaminated and is not release comparison evidence.

Revision note, 2026-08-24 / Codex: Closed the final fault-injection soak on exact production commit `b6547967`: four workers completed 62,086 shared-database cycles, repeated worker/SSE replacement, the scheduled full restart, live backups, exact global rate limiting, and final integrity assertions in 60 minutes with a clean systemd exit. The fixed-PID two-hour memory soak remains the sole correctness gate before the final benchmark matrix.

Revision note, 2026-08-24 / Codex: Closed the final correctness gate with a successful fixed-PID two-hour soak on exact production commit `b6547967`. Both workers stayed alive for all 126,853 shared-database cycles; rate limiting, realtime client rotation, live backups, descriptors, and final assertions remained healthy. Post-warm-up RSS medians plateaued with only a 2.24 MiB/hour aggregate fit and a negative primary slope, providing no evidence of serious or operationally unbounded retention. The first benchmark matrix then correctly rejected three `/js` 404 rows because the repository-wide `pb_hooks/` ignore rule had omitted the upstream benchmark fixture from the exact source archive; track that fixture and restart the entire matrix rather than accepting or splicing the other 147 rows.

Revision note, 2026-08-24 / Codex: The first valid multi-worker benchmark run exposed a real cascade-delete pressure bug before release. A four-second delivery timeout removed a pending request, then the valid late acknowledgement was mistaken for unsolicited IPC and the healthy target worker was terminated. Unknown completed/timed-out results are now ignored because they cannot affect live state; worker-mismatched live results remain fatal. Realtime publish/prepare delivery is also limited to workers that have actually owned a subscription, eliminating thousands of pointless round trips in the no-client benchmark and normal no-realtime deployments. A real delayed-result regression, the focused cluster suite, and the remote cascade workload all pass without worker replacement; restart the complete benchmark matrix only after the full local and hosted gates qualify this new revision.

Revision note, 2026-08-24 / Codex: The subsequent exact benchmark reproduction showed that primary-side target filtering had not removed the source worker's per-record coordinator requests: `realtime.prepare` still timed out after five seconds and produced an HTTP 400. Fixed the general problem by isolating overlapping async transactions, batching all transaction delete preparations and outcomes without coalescing logical events, restoring PocketBase's best-effort realtime failure semantics, and finally adding conservative live-client presence propagation so confirmed no-recipient workers skip transport. A real two-worker test observes one five-event prepare batch and one five-event commit batch even when preparation failure is injected; all 1,964 local tests and the format, type, and lint gates pass. Hosted CI, current-revision soak, and focused Linux cascade confirmation remain before rerunning either benchmark matrix.

Revision note, 2026-08-24 / Codex: Exact commit `de04f6b2` passed hosted Ubuntu, macOS, Windows, and E2E CI. Its Linux two-worker batching regression was pressure-scaled to 2,001 deletes while retaining an active remote-worker presence and an injected preparation error; it still emitted only one prepare and one commit transport batch, returned success, and finished in 827 ms rather than approaching the former five-second per-record timeout. A five-minute exact-revision soak then passed 4,563 cycles with two real SSE clients, five worker replacements, exact shared rate decisions, live backups, and final integrity checks. The promoted one-hour fault/restart soak is running from `/root/pocketbun-artifacts/de04f6b2/soak/60m.log` on the qualification host.

Revision note, 2026-08-25 / Codex: Replaced the proposed representative external subset with the complete upstream 150-scenario workload. Timed request descriptors are prepared by the unchanged scenario controller and executed in batches on a separate two-vCPU load host, including the 300 concurrent writes in each mixed read/write case; this avoids one forwarding RPC per measured request and preserves the suite's concurrency. PocketBase and PocketBun both passed a zero-error external auth smoke. The application host is now running five interleaved rounds of PocketBase and PocketBun at one, two, and four workers (`pocketbun-external-full-de04f6b2-r3.service`), while the load host records per-batch request rate, CPU, RSS, target, and errors (`pocketbun-external-load-de04f6b2.service`).

Revision note, 2026-08-25 / Codex: The external matrix completed all 20 runs in 4h44m with 3,000/3,000 zero-error scenario rows and 3,080/3,080 zero-error remote timed batches. Five-run scenario medians put PocketBase/PocketBun-1w/2w/4w summed Completed time at 699.1/519.8/494.6/468.2 seconds; selected high-concurrency routes and simple reads scale strongly, while the aggregate is dominated by low-concurrency and SQLite-bound work. Keep the four-worker variability, absent latency percentiles, and unmeasured network headroom visible before publishing. Separately, the exact-revision one-hour fault soak failed at 2,472 seconds after 22 deliberate worker kills when one realtime event exceeded the ten-second deadline. This contradicts the prior closed-gate language and reopens realtime replacement diagnosis as a release blocker.

Revision note, 2026-08-25 / Codex: Classified the lone realtime timeout as adjacent to a deliberately injected follower `SIGKILL`, after an earlier controlled cluster restart had passed. The old harness could also accept a buffered SSE chunk as proof that the killed worker's stream had closed. The harness now waits for EOF and emits exact action/record/source/client/iteration and fault/restart diagnostics. An accelerated exact-production-code rerun passed 8,811 full realtime cycles, 46 crash replacements, four controlled restarts, backups, shared rate checks, and final integrity verification. Treat realtime delivery across an uncontrolled process crash as best-effort; retain steady-state and controlled-restart delivery as release gates.

Revision note, 2026-08-25 / Codex: Completed the missing PocketBase application-parallelism calibration on the same external-load topology. Five accepted runs each at `GOMAXPROCS=1` and `2`, plus the earlier five default four-processor runs, establish the 1/2/4 PocketBase totals of 1,461.6/788.7/699.1 seconds alongside PocketBun's 519.8/494.6/468.2 seconds. A single two-processor attempt had one auth-refresh HTTP 500 and was preserved but excluded; its replacement passed. All ten accepted new artifacts have 150 zero-error scenarios and verified hashes. Defer public tables until Bun 1.4.1 is qualified and decide whether its explicit `Bun.serve({ http2: true })` support should become PocketBun's HTTP/1-fallback server default and a separately fair protocol benchmark.

Revision note, 2026-08-25 / Codex: Added Milestone 11 after the matched external matrix showed that both organization-create scenarios remain slower than PocketBase at every one/two/four-lane comparison. The plan requires a settled exact-workload baseline, separate warmed measurements, HTTP/save/raw-insert controls, and one-at-a-time profile-driven changes. Acceptance is a zero-error five-run median at least 5% faster than PocketBase at every matched lane, with unchanged request, database, hook, realtime, and durability behavior and no broader create regression. The known no-recipient cluster snapshot encoding is the first small candidate, not an assumed complete fix; unsafe SQLite settings, cross-request batching, hidden benchmark warm-up, and benchmark-specific production paths are explicitly rejected.

Revision note, 2026-08-25 / Codex: Corrected the focused fixed-count/warm-up boundary and added the upstream two-second settling period across the existing profiling helpers. Settled local and Linux phase controls show that the short opening organization burst is dominated by first-use request/save compilation: 100 actual creates reduce the disposable Linux 50-request handler median from 49.25 to 7.14 ms. Rejected and removed both no-recipient realtime candidates after an exact five-run external A/B moved the no-rule median only 0.8% and regressed the rule median 5.4%; no production optimization remains from this pass.

Revision note, 2026-08-25 / Codex: Replaced the earlier prohibition on public benchmark warmup after the repository owner accepted a symmetric workload-based method. Both runners now execute the selected scenario sequence untimed with a configurable 100-request cap, through the same external load service used for measurement, and retain all existing collection-convergence pauses. The measured `create` phase clears warmup data in the same live process. A four-worker PocketBun smoke executed all 150 capped scenario shapes with zero errors before starting measurement, the equivalent generated PocketBase Go path compiled and completed its capped create warmup, and `bun:jsc.optimizeNextInvocation()` was rejected because it cannot optimize genuinely cold functions and produced no measured gain.

Revision note, 2026-08-25 / Codex: Classified the symmetric warmed external results as disclosed steady-state measurements, with cold-start behavior explicitly outside the primary comparison. Reused the accepted five-run matrix as the cheapest repeatability test: three-run aggregate totals are close, but 14 to 22 individual scenario medians per lane move by more than 5% relative to five runs and scenario variation reaches 20.7% to 32.6%. Retain five runs because the release gate is scenario-level, not merely aggregate-level.

Revision note, 2026-08-25 / Codex: Ran one complete externally driven four-worker PocketBun diagnostic with the new symmetric warmup. All 308 external batches and 150 measured scenarios passed without error. The 474.9-second measured sum is 1.4% above the old 468.2-second four-worker median sum and therefore flat within established noise; 90 scenarios improved, while 20 regressed by more than 5%. The short organization rows improved by 52% and 25%, confirming the cold-JIT diagnosis, but the result does not support claiming that every scenario improves or replacing the matched five-run warmed matrix.

Revision note, 2026-08-25 / Codex: Completed the identical one-run warmed PocketBase v0.40.0 comparison with Go 1.27 and four application processors. All 308 external batches and 150 measured scenarios passed. PocketBase remained flat at 698.6 seconds versus its old 699.1-second median sum; PocketBun's warmed 474.9-second sum is 32.0% lower and wins 119 scenarios, but remains more than 5% slower in 23. Organization creation is still 1.58x and 2.03x slower and permission creation 2.07x and 1.68x slower, so symmetric warmup improves the comparison methodology without satisfying the all-scenarios performance target.

Revision note, 2026-08-25 / Codex: Added benchmark-only per-response worker-slot and selected JSC DFG diagnostics, then ran a five-repetition four-worker warmup curve at 50/150/300/600 requests per organization-rule variant. Most of the gain arrives by 150 requests and does not correlate with DFG compilation. The complete external trace exposed a separate client artifact: the default LIFO keep-alive agent concentrated low-concurrency batches on its newest sockets. An isolated Linux control reproduced the omission under LIFO and achieved stable four-worker rotation with FIFO, so the benchmark client now keeps connections alive but schedules its free socket pool FIFO.

Revision note, 2026-08-25 / Codex: Changed the symmetric benchmark default from a 100-request cap to a 300-request target/cap. Longer scenarios remain capped; the short organization and permission variants repeat in normal whole-scenario batches until they reach the target. PocketBase receives the identical generated-Go warmup sequence. The measured create phase still clears the disposable warmup records without restarting either application. A matched 150-request control left PocketBun's no-rule organization row 27% slower; at 300, the first matched four-worker run made the no-rule and rule rows 8.5% and 7.4% faster than PocketBase, pending the required five-run median.

Revision note, 2026-08-26 / Codex: The five-run four-lane warmup qualification replaced the favorable first sample with stable evidence. PocketBun wins no-rule organization creation by 13.1% and the complete create suite by 27.8%, but remains 6.3% slower on rule-based organization creation and 16.6% slower on rule-based permission creation. FIFO warmup distribution reaches every worker in every batch and is acceptably balanced in aggregate, so connection skew no longer explains the rule gap. Started an exact-`6103dc49` overnight queue containing diagnostic eager JSC, the missing one/two-lane paired create matrix, and fresh two/four-worker five-hour fault soaks that include the later cluster delivery and realtime batching fixes.

Revision note, 2026-08-26 / Codex: Completed the hosted soak portion and hosted CI of ordered-presence qualification on exact commit `a2776b42`. The corrected coordinator passed the deterministic regression, complete local gate, an accelerated four-worker restart test, and independent 60-minute two/four-worker fault soaks without steady-state or controlled-restart realtime loss. Rejected eager JSC after it caused severe benchmark stalls, and measured create-rule construction/evaluation in isolation at only a few microseconds per request, ruling out a speculative rule-plan cache as the explanation for the external multi-lane gap. Started a five-hour fixed-worker soak and a five-run, warmed, externally driven PocketBase/PocketBun 1/2/4-lane matrix for additional exact-revision stability and repeatability evidence; these remain diagnostic until Bun 1.4.1 and HTTP/2 qualification are final.

Revision note, 2026-08-26 / Codex: Replaced repeated short-scenario warmup passes with one expanded untimed batch for each organization and permission variant, identically in PocketBase and PocketBun. This preserves the 300-request target while avoiding repeated collection-rule updates and cooldowns, reducing a local create-suite warmup from 156.19 to 85.58 seconds. The complete local test suite passes and the generated PocketBase Go benchmark patch builds and starts the warmup successfully.

Revision note, 2026-08-26 / Codex: Kept all three benchmark hosts occupied without overlapping measured workloads. The four-vCPU host continues the exact-`a2776b42` five-run target-300 full matrix; exact-`a7d28af2` target-600 work is queued behind it with five paired one/two/four-lane create runs and, only if they are error-free, one paired full run at each lane. The two-vCPU soak host continues its exact-`a2776b42` two-worker five-hour steady run and has an oversubscribed four-worker five-hour steady run queued behind it; the third host remains the common external load generator.

Revision note, 2026-08-26 / Codex: Reprioritized the release gate around scaling and stopped the queued target-600 matrix because worker count alone did not hard-limit Bun helper threads to the claimed CPU count. The first corrected target-300/FIFO round already shows that the earlier scaling failure was primarily a client connection-distribution artifact: PocketBun's read group improved 1.82x from one to two workers with 48.08%/51.92% aggregate request shares, matching PocketBase's prior 1.81x. Concurrency-one, create, password-hash, and delete groups remain intentionally separate from the read-scaling claim. Attached five-second process CPU sampling to the remaining active matrix; retain the full five-run and four-worker evidence before publication.

Revision note, 2026-08-26 / Codex: Completed the first fully corrected one/two/four-lane round. PocketBase's read group scaled 1.79x then 1.11x; PocketBun's same group scaled 1.82x then 1.14x, so there is no remaining comparative read-scaling deficit in this sample. PocketBun's complete-suite sums were 515.5/323.9/296.0 seconds versus PocketBase's 1,456.1/798.3/707.4 seconds. Four-worker PocketBun traffic split 24.73%/24.46%/25.36%/25.45%; the primary averaged 0.11% CPU, and every worker saturated one logical CPU during the longest CPU-bound read while the external client remained idle. The modest two-to-four gain is therefore consistent with adding the SMT siblings of two already-used physical cores, not leader or routing overhead. Keep the remaining rounds for medians, and use hard affinity before labeling worker counts as exact used-vCPU counts because native Bun helpers can consume CPU outside the request worker.

Revision note, 2026-08-26 / Codex: Completed the production-realistic two/three/four-worker comparison on the four-vCPU host with five 100,000-request samples per workload and balanced external traffic. The CPU-only route reached 4,395/6,044/6,402 req/s, while server CPU reached 237%/345%/398%; the primary remained effectively idle. Four workers maximize throughput, but the fourth SMT worker adds only 5.9%, costs about 136 MiB median RSS, and raises p95 from 28.22 to 37.67 milliseconds versus three workers. Recommend four workers for public maximum-throughput results and three as a latency/memory-efficiency option on this two-core/four-thread shape; no affinity follow-up is needed.

Revision note, 2026-08-26 / Codex: Located the multi-lane create bottleneck with three fresh high-sample runs per lane and matched PocketBase instrumentation. Skipping only PocketBun's prepared `statement.run()` while retaining export, hooks, realtime preparation, and response handling makes the four-worker organization variants 17–19% faster than PocketBase; no cluster realtime IPC is sent in this no-subscriber workload and every write succeeds on its first application-level attempt. PocketBun's exact statement call rises from about 0.024 ms at one worker to 0.28 ms at four. PocketBase's corresponding `Execute()` is slower—about 0.049 ms at one processor and 0.65 ms at four—but Go parks each waiting goroutine, whereas synchronous `bun:sqlite` stalls the whole request worker while SQLite obtains the shared WAL writer lock. The remaining gap is therefore scheduling around SQLite contention, not rule evaluation, the surrounding TypeScript path, application retries, or primary/realtime IPC. A disposable `busy_timeout=0` plus immediate asynchronous retry control reduced four-worker medians from 675.5/699.1/459.7/494.5 ms to 536.6/577.1/297.5/333.3 ms for the two organization and permission variants, all with zero errors; this proves that blocking lock waits are causal but not that retry polling is a safe production solution. Retain synchronous SQLite and its existing lock semantics. The repository owner rejected asynchronous retry, writer-admission IPC, and worker-thread plumbing as too complex and dangerous for this optimization; do not implement them. Keep the diagnostic evidence, seek only a materially simpler native option, and otherwise accept this write-scaling limit. Do not retain the diagnostic instrumentation.

Revision note, 2026-08-26 / Codex: Corrected the SQLite-throughput interpretation after the repository owner observed that relocating a queue cannot by itself change steady-state throughput. Five measured 100,000-row raw autocommit runs, with the production WAL/pragmas and a permanently full writer queue, put Bun at 31,999 writes/s with one process and 12,303 with four; matched Go/modernc at four processors and ten writer goroutines reached only 11,053. PocketBun therefore has more raw four-lane commit capacity than PocketBase even though its complete four-worker create route is slower. Go's advantage is its ability to keep ten lightweight request goroutines runnable around the serialized database boundary on four scheduler threads; a PocketBun process can expose only one blocked SQLite call, and adding equivalent queue depth requires whole Bun processes. Six/eight/ten raw Bun processes recovered modestly to 12,566/13,680/13,559 writes/s, but unchanged application medians did not improve for organization creation (4/6/8/10 workers: 683/697/735/734 ms no-rule and 712/709/750/745 ms with a rule). The ten persistent client connections reached only six or seven of eight/ten `SO_REUSEPORT` workers, and oversubscription added duplicated-runtime, CPU, and scheduling costs; some permission variants improved, confirming that extra workers can hide blocking when enough gain remains. Treat the gap as coarse process/event-loop scheduling and connection-affinity overhead around a faster Bun SQLite driver, not deficient SQLite commit throughput. Do not add production coordination or async database machinery for this benchmark.

Revision note, 2026-08-26 / Codex: Reopened the SQLite wait policy after confirming that PocketBun already ports PocketBase's increasing lock-retry schedule for normal model writes. A five-pair four-worker A/B changed only `busy_timeout` from 10,000 to 200 milliseconds. All 150,000 measured creates succeeded, every normal write completed on its first attempt, and scenario medians moved in mixed directions from -3.3% to +2.2%, establishing no ordinary-load throughput cost or gain. Under a deliberately held three-second WAL writer lock with 40 concurrent creates distributed across all four workers, three clean paired runs had zero write or health errors. At 10,000 milliseconds, none of 120 health requests completed before lock release and median/p95 health latency was 1.83/2.92 seconds. At 200 milliseconds, a median 99 of 120 completed while the lock was still held and median/p95 fell to 0.92/2.01 seconds. The 13 bounded attempts plus existing backoff total about 9.95 seconds when every attempt consumes the full 200 milliseconds, closely preserving a ten-second overall write horizon. Do not change the global pragma yet: raw SQL, transaction boundaries, migrations, and some maintenance paths do not all use the async model retry wrapper and would expose `SQLITE_BUSY` after 200 milliseconds. Next consider a scoped 200-millisecond attempt only for the existing async model-write retry boundary, retaining 10,000 for synchronous and unwrapped operations; require the same held-lock result and transaction correctness tests before any production change.

Revision note, 2026-08-26 / Codex: Measured the ordinary four-worker contention tail with five rotating runs each at `busy_timeout` 10,000/5/2/1 milliseconds while retaining PocketBun's production retry intervals. All 300,000 creates succeeded. Five milliseconds was effectively neutral overall (+1.5% summed time); two milliseconds was 8.5% slower and one millisecond 25.7% slower. The cause is now measured rather than inferred: one millisecond forced only about 0.98% of organization writes and 0.46% of permission writes into a second attempt, but each incurred the existing first backoff of about 100 milliseconds. Interestingly, one millisecond cut every scenario's p50 and p95 despite reducing total throughput, because it freed the event loops for the other 99% of requests while penalizing the small retried tail. A lower SQLite wait therefore can improve scheduler responsiveness, but the PocketBase-derived 50–1,000 millisecond retry schedule is too coarse for sub-millisecond WAL contention. Do not lower the production timeout in isolation. If this work continues, measure one minimal short-first jittered/increasing retry schedule with an explicit ten-second overall deadline, scoped only to async model writes; retain it only if it improves both completed throughput and high-percentile latency without exposing `SQLITE_BUSY` or changing synchronous/raw DB behavior.

Revision note, 2026-08-26 / Codex: Completed the requested causality experiment with five alternating four-worker pairs, 75,000 measured creates per mode, and exact source `2eb4bcc2`. The disposable candidate used `busy_timeout=0`, always yielded on lock contention (including a timer turn for the initial zero-millisecond retry), then applied jittered 1/2/4/8/16/32/64-millisecond delays capped by an explicit ten-second deadline. All 150,000 creates completed with zero errors. Median summed time fell 9.7%, from 2,517.421 to 2,274.088 milliseconds: organization/no-rule and organization/rule each improved 5.2%, permission/no-rule improved 20.2%, and permission/rule improved 15.5%. Candidate attempts averaged 1.18/1.20/1.15/1.15 per call, proving that ordinary contention actually returned to the event loop rather than remaining inside SQLite; p95 improved in all four scenarios, while organization p50 rose slightly. Persistent connections still landed unevenly on `SO_REUSEPORT` workers, including one two-worker baseline sample, but the candidate won four of five organization/no-rule pairs and every other pair, so assignment does not explain the result. This confirms synchronous SQLite lock waiting is a material part of the multi-worker create gap and explains why the one-millisecond-timeout test was misleading: over 99% of its writes never yielded, while the few that did paid the inherited roughly 100-millisecond first sleep. The experiment is not a production patch. Any retained implementation must scope the short attempt policy to existing asynchronous model-write retries, leave synchronous/raw/transaction/migration behavior at 10,000 milliseconds, pass held-lock and transaction correctness coverage, and then repeat the matched external five-run benchmark.

Revision note, 2026-08-26 / Codex: Followed the adaptive-retry result with the requested short fixed-yield comparison: two counter-ordered four-worker samples each at 10, 50, and 200 milliseconds, `busy_timeout=0`, and the same ten-second overall deadline. All 90,000 measured creates succeeded. Against the immediately preceding 2,517.421-millisecond five-run baseline sum, the two-sample averages were 2,751.058 milliseconds at 10 milliseconds (9.3% slower), 3,720.305 at 50 (47.8% slower), and 5,028.624 at 200 (99.8% slower); the adaptive 0/1/2/4/8/16/32/64-millisecond candidate remains best at 2,274.088 (9.7% faster). Longer sleeps reduced repeat frequency—average attempts fell from roughly 1.06–1.10 at 10 milliseconds to 1.01 at 200—but occupied the benchmark's closed-loop request slots long after the sub-millisecond writer conflict had cleared. Fixed 10/50/200-millisecond waits are therefore rejected for ordinary contention; retain the short adaptive schedule as the only production candidate worth qualifying.

Revision note, 2026-08-27 / Codex: Ran the requested short full-suite comparison on the four-vCPU host with the external load generator and symmetric 300-request warmup. The global `busy_timeout=0` diagnostic retained the adaptive 0/1/2/4/8/16/32/64-millisecond asynchronous model-write retry and otherwise exposed zero immediately to synchronous, raw, transaction, migration, and maintenance paths. All 150 result rows and all 308 external warmup/measurement batches completed without error, including mixed read/write and cascade-delete scenarios. Because the first stored ten-second control predated the consolidated short-scenario warmup, repeated one exact-current ten-second PocketBun control; it also passed all rows and batches. Single-run sums were 283.385 seconds for PocketBun/global-zero, 294.834 seconds for PocketBun/10,000 milliseconds, and 707.377 seconds for the matching four-processor PocketBase control. Global zero improved PocketBun's full sum by 3.9% and its create group by 22.7%; auth and read moved by only +0.4% and +1.1%, delete improved 0.6%, and custom/hook work improved 16.5%. PocketBun/global-zero was 2.50x faster than PocketBase overall versus 2.40x for the normal timeout. This is promising directional evidence, not the release result: only one run per new PocketBun mode was requested, established scenario-level noise exceeds these small non-create movements, and global zero remains unsafe for unwrapped paths despite this workload passing. Use these results to justify a scoped async-model-write implementation and correctness qualification, not a global production pragma change.

Revision note, 2026-08-27 / Codex: Rejected a production-wide `busy_timeout=0` after qualifying the exact candidate against the cluster correctness suite before starting the proposed one-hour soak. The full benchmark's zero errors did not cover PocketBase-compatible synchronous JSVM transactions under sustained shared-database pressure. The cluster state test failed deterministically in three consecutive runs when a contended raw insert inside `$app.runInTransaction(...)` immediately returned a generic HTTP 400 after worker recovery. The synchronous transaction API cannot yield to the event loop, and safely replaying an entire transaction callback is impossible because it may contain non-database side effects. Preserving its current wait behavior with timeout zero would require low-level synchronous retry handling across raw database, prepared-query, transaction, migration, and maintenance execution paths, defeating the proposed simplicity and increasing compatibility risk. Reverted the candidate completely; retain the 10,000-millisecond connection timeout for this release. The adaptive async result remains useful evidence for a future scoped optimization, but create performance is already faster than PocketBase in aggregate and does not justify that complexity before release.

Revision note, 2026-08-27 / Codex: Implemented an uncommitted scoped candidate for review: only asynchronous record persistence temporarily sets its active connection to `busy_timeout=0` for the synchronous statement attempt, restores the shared 10,000-millisecond default in `finally` before yielding, and retries with the measured jittered 0/1/2/4/8/16/32/64-millisecond schedule for up to ten seconds. Raw SQL, synchronous APIs and JSVM transactions, migrations, and maintenance retain the default timeout. Focused retry, bootstrap, transaction, and cluster-pressure tests pass, as do formatting, typecheck, and lint. One matched four-worker external full-suite run completed all 150 scenarios with zero errors: the scoped candidate summed 284.030 seconds versus 283.385 for global zero and 294.834 for the normal timeout. Its create group was 26.872 seconds, only 1.1% slower than global zero and 21.9% faster than normal. The safe-scoping overhead therefore retained essentially all measured create gain in this sample; require repeated A/B evidence and a one-hour contention soak before accepting the production change.

Revision note, 2026-08-27 / Codex: Retracted the apparent 4.8x scoped-candidate regression after controlled testing showed that the local comparison was confounded by variable desktop load and run order. On an idle Linux host, eight counterbalanced processes running the exact five-file workload all passed; candidate and baseline medians were 5.05 and 4.99 seconds. A temporary cluster-only gate also passed the full suite, but was rejected because it withheld the responsiveness benefit from single-worker servers and stopped ordinary tests from exercising the critical path. The candidate now applies to every asynchronous record persistence operation while raw/synchronous SQL, transactions, migrations, and maintenance retain the 10,000-millisecond timeout. The repository-standard full run passed 1,970 tests with the original per-test timeouts. A single-worker integration test holds the WAL writer lock on a second connection and verifies that the event loop can release it, finish the save, and restore the 10,000-millisecond policy; helper coverage verifies restoration after every failed attempt. On the controlled Linux held-lock probe, the candidate completed 120/120 health requests before lock release versus 0/120 for baseline, while both completed all 40 writes. Retain the candidate for the remaining repeated external benchmark and one-hour contention soak; accept it only if those gates preserve correctness and the measured create gain.

Revision note, 2026-08-27 / Codex: Reduced the focused current-candidate A/B from five to three counterbalanced external full-suite pairs. Three pairs are sufficient to decide this isolated 22%-create improvement; retain five-run per-scenario medians for the public comparison where scenario-level fluctuations matter. The exact candidate is now running fresh one-hour two-worker and four-worker stateful fault soaks. Both exercise ordinary asynchronous record writes, transactions/raw SQL, realtime delivery, rate limits, backups, checkpoints, worker replacement, and controlled restart. Accept the retry change only when both exit cleanly with their final integrity assertions.

Revision note, 2026-08-27 / Codex: Prepared an isolated eight-vCPU Ubuntu host with the exact Bun 1.4.0 and Go 1.27.0 toolchains for the final external-load benchmark expansion. After the four-worker soak, run three accepted zero-error complete-suite samples for PocketBase `GOMAXPROCS=5/6/7/8` and PocketBun `--workers=5/6/7/8`, using a 1,000-request symmetric warmup target/cap and a separate load generator; preserve raw outputs, toolchain/source hashes, load-generator telemetry, and per-configuration median summaries under a new `benchmarks/results/` batch. The existing committed `pb_compare_20260824T220243Z_external` batch already contains matching external PocketBase/PocketBun v0.40.0 data for 1/2/4 lanes on a four-vCPU host. Present the host boundary explicitly: these values compare configured parallelism, not a single-machine hard-affinity scaling curve.

Revision note, 2026-08-27 / Codex: Added an eight-worker production-shape gate before any eight-worker benchmark claim. The prepared eight-vCPU host will run a five-minute eight-worker fault preflight and, only on success, a one-hour eight-worker stateful fault soak immediately after the current four-worker candidate soak. This keeps the server occupied without overlapping benchmark load, and avoids turning the planned 5–8-worker benchmark matrix into the first meaningful stability test of the eight-worker topology.
