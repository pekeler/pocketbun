# Bun Issue Watchlist (PocketBun)

Last updated: 2026-08-21

This file tracks Bun issues that matter for PocketBun compatibility and workaround cleanup.

When any issue below is fixed upstream:
1. upgrade Bun in a focused branch,
2. remove the linked PocketBun workaround/deviation,
3. run full verification (`bun run format:fix`, `bun test --concurrent`, `bun run typecheck`, `bun run lint`),
4. keep removal only if compatibility/stability remains intact.

## Active Watchlist

| Area | Issue link | Status | PocketBun impact / note |
| --- | --- | --- | --- |
| `Bun.serve` `idleTimeout` capped at 255 | Canonical: https://github.com/oven-sh/bun/issues/15589 (our duplicate: https://github.com/oven-sh/bun/issues/27470, docs follow-up: https://github.com/oven-sh/bun/issues/27479) | canonical open; docs issue closed | We still pin server idle timeout to `255` in `src/apis/serve.ts` (`defaultServerIdleTimeoutSeconds`) and keep realtime SSE comment heartbeats in `src/apis/realtime.ts`. Local Bun `1.4.0` repro still throws `Bun.serve expects idleTimeout to be 255 or less` for `idleTimeout: 300`. |
| `bun:sqlite` PRAGMA parameter binding docs gap | https://github.com/oven-sh/bun/issues/27480 | open | This is a docs/SQLite-syntax gap, not a Bun runtime fix candidate. PocketBun now uses the table-valued `pragma_table_info(?)` form in `src/core/db_table.ts` so the lookup stays parameterized without inline SQL quoting. |
| Streaming / temp-file-backed multipart parsing for `Bun.serve` uploads | Canonical: https://github.com/oven-sh/bun/issues/18701 (our duplicate: https://github.com/oven-sh/bun/issues/28188) | canonical open; our duplicate closed | PocketBun still needs `src/internal/compat/request_form_data.ts` because Bun does not yet expose a native streaming/temp-file-backed multipart server API for large uploads. |
| `bun:test` `onTestFinished()` concurrent-test restriction | https://github.com/oven-sh/bun/issues/29236 | open | Fixed at runtime in Bun `1.4.0`: a local `test.concurrent(...)` repro can register `onTestFinished()` successfully. The issue remains open for its documentation follow-up. PocketBun can reconsider its earlier `try/finally` choice when touching those tests, but there is no reason to churn working cleanup code solely for this fix. |
| Windows `Bun.spawnSync` intermittent empty/invalid stdout | https://github.com/oven-sh/bun/issues/27482 | closed; reopening requested for Bun `1.4.0` regression | Bun `1.4.0` Windows CI reproduced an empty stdout result after the issue was considered fixed. The synchronous JSVM HTTP client now returns each child result through a private temporary file because retrying a completed mutating request could duplicate side effects. |
| Bun native S3 metadata / header parity | https://github.com/oven-sh/bun/issues/29595, https://github.com/oven-sh/bun/issues/17339, https://github.com/oven-sh/bun/issues/19301, https://github.com/oven-sh/bun/issues/16048 | open | A 2026-04-12 spike against Bun `1.3.12` showed that native S3 still can't replace PocketBun's `src/tools/filesystem/internal/s3blob/*` adapter cleanly. PocketBun stores `metadataOriginalName` in S3 object metadata via `src/tools/filesystem/filesystem.ts`, but Bun native S3 still lacks write-side user metadata support (`#17339`), `stat()` / HEAD readback of response headers and `x-amz-meta-*` (`#19301`), broader custom S3 header/query passthrough (`#16048`), and first-class server-side copy / non-redirect response behavior (`#29595`). |

## PocketBun Internal Candidate (Not Filed Yet)

- `bun --no-orphans` prevents ephemeral `Bun.serve({ port: 0 })` listeners from starting:
  - 2026-08-21 repro against Bun `1.4.0`: `bun -e 'const s = Bun.serve({ port: 0, fetch() { return new Response("ok"); } }); console.log(s.port); s.stop();'` succeeds, while adding `--no-orphans` still fails with `EADDRINUSE`.
  - keep `--no-orphans` off PocketBun tests and E2E commands until this is fixed because they intentionally use port `0` test servers; prefer it only for local wrapper scripts where a Bun parent owns long-lived descendants.
- Multipart parsing after request body has already been touched/consumed:
  - current mitigation: native `Request` objects use request-scoped multipart caching in `src/internal/compat/request_form_data.ts`; non-`Request` doubles still fall back to `clone()` when available.
  - keep under observation; open a dedicated Bun issue if we can produce a stable upstream repro.

## Recently Resolved / Retired

| Area | Issue link | Status | PocketBun action |
| --- | --- | --- | --- |
| Multipart binary truncation at null byte in `Request.formData()` | Canonical: https://github.com/oven-sh/bun/issues/26740 (our duplicate: https://github.com/oven-sh/bun/issues/27478) | closed in Bun `1.3.11` | No dedicated fallback parser workaround remains. Local Bun `1.3.12` repro still preserves `[31,139,8,0]` exactly. |
| `bun:test` `mock()` / `spyOn()` disposal typings | https://github.com/oven-sh/bun/issues/29234 | closed in Bun `1.3.14` | Removed the PocketBun test casts that were only needed for the old typings; the project now uses `@types/bun` `1.4.0`. |
| Default idle-timeout behavior for SSE/quiet streams docs clarity | https://github.com/oven-sh/bun/issues/27479 | closed | Bun docs were updated, but the runtime cap from issue `#15589` is still active so the PocketBun server workaround remains. |
| `bun:sqlite` WAL sidecar cleanup docs/behavior clarity | https://github.com/oven-sh/bun/issues/27481 | closed | Keep the explicit `SQLITE_FCNTL_PERSIST_WAL` call in `src/tools/dbx/connect_pragmas.ts` for deterministic cleanup that matches PocketBase expectations. |

## Quick Status Check Commands

```bash
gh api 'search/issues?q=repo:oven-sh/bun+is:issue+author:pekeler' --jq '.items[] | [.number, .state, .title, .html_url] | @tsv'
gh api repos/oven-sh/bun/issues/15589 --jq '[.number, .state, .title, .html_url] | @tsv'
gh api repos/oven-sh/bun/issues/26740 --jq '[.number, .state, .title, .html_url] | @tsv'
gh api repos/oven-sh/bun/issues/18701 --jq '[.number, .state, .title, .html_url] | @tsv'
gh api repos/oven-sh/bun/issues/29236 --jq '[.number, .state, .title, .html_url] | @tsv'
gh api repos/oven-sh/bun/issues/16048 --jq '[.number, .state, .title, .html_url] | @tsv'
gh api repos/oven-sh/bun/issues/17339 --jq '[.number, .state, .title, .html_url] | @tsv'
gh api repos/oven-sh/bun/issues/19301 --jq '[.number, .state, .title, .html_url] | @tsv'
gh api repos/oven-sh/bun/issues/29595 --jq '[.number, .state, .title, .html_url] | @tsv'
```
