# Bun Issue Watchlist (PocketBun)

Last updated: 2026-04-12

This file tracks Bun issues that matter for PocketBun compatibility and workaround cleanup.

When any issue below is fixed upstream:
1. upgrade Bun in a focused branch,
2. remove the linked PocketBun workaround/deviation,
3. run full verification (`bun run format:fix`, `bun test --concurrent`, `bun run typecheck`, `bun run lint`),
4. keep removal only if compatibility/stability remains intact.

## Active Watchlist

| Area | Issue link | Status | PocketBun impact / note |
| --- | --- | --- | --- |
| `Bun.serve` `idleTimeout` capped at 255 | Canonical: https://github.com/oven-sh/bun/issues/15589 (our duplicate: https://github.com/oven-sh/bun/issues/27470, docs follow-up: https://github.com/oven-sh/bun/issues/27479) | canonical open; docs issue closed | We still pin server idle timeout to `255` in `src/apis/serve.ts` (`defaultServerIdleTimeoutSeconds`) and keep realtime SSE comment heartbeats in `src/apis/realtime.ts`. Local Bun `1.3.12` repro still throws `Bun.serve expects idleTimeout to be 255 or less` for `idleTimeout: 300`. |
| `bun:sqlite` PRAGMA parameter binding docs gap | https://github.com/oven-sh/bun/issues/27480 | open | This is a docs/SQLite-syntax gap, not a Bun runtime fix candidate. PocketBun now uses the table-valued `pragma_table_info(?)` form in `src/core/db_table.ts` so the lookup stays parameterized without inline SQL quoting. |
| Streaming / temp-file-backed multipart parsing for `Bun.serve` uploads | https://github.com/oven-sh/bun/issues/28188 | open | PocketBun still needs `src/internal/compat/request_form_data.ts` because Bun does not yet expose a native streaming/temp-file-backed multipart server API for large uploads. |

## PocketBun Internal Candidate (Not Filed Yet)

- Multipart parsing after request body has already been touched/consumed:
  - current mitigation: native `Request` objects use request-scoped multipart caching in `src/internal/compat/request_form_data.ts`; non-`Request` doubles still fall back to `clone()` when available.
  - keep under observation; open a dedicated Bun issue if we can produce a stable upstream repro.

## Recently Resolved / Retired

| Area | Issue link | Status | PocketBun action |
| --- | --- | --- | --- |
| Multipart binary truncation at null byte in `Request.formData()` | Canonical: https://github.com/oven-sh/bun/issues/26740 (our duplicate: https://github.com/oven-sh/bun/issues/27478) | closed in Bun `1.3.11` | No dedicated fallback parser workaround remains. Local Bun `1.3.12` repro still preserves `[31,139,8,0]` exactly. |
| Windows `Bun.spawnSync` intermittent empty/invalid stdout | https://github.com/oven-sh/bun/issues/27482 | closed | Removed the JSVM sync-fetch retry loop from `src/plugins/jsvm/binds.ts`, restored sync-path coverage in `src/plugins/jsvm/binds.test.ts`, and CI now pins Bun `1.3.12`, which still includes the Windows subprocess pipe fix. |
| Default idle-timeout behavior for SSE/quiet streams docs clarity | https://github.com/oven-sh/bun/issues/27479 | closed | Bun docs were updated, but the runtime cap from issue `#15589` is still active so the PocketBun server workaround remains. |
| `bun:sqlite` WAL sidecar cleanup docs/behavior clarity | https://github.com/oven-sh/bun/issues/27481 | closed | Keep the explicit `SQLITE_FCNTL_PERSIST_WAL` call in `src/tools/dbx/connect_pragmas.ts` for deterministic cleanup that matches PocketBase expectations. |

## Quick Status Check Commands

```bash
gh api 'search/issues?q=repo:oven-sh/bun+is:issue+author:pekeler' --jq '.items[] | [.number, .state, .title, .html_url] | @tsv'
gh api repos/oven-sh/bun/issues/15589 --jq '[.number, .state, .title, .html_url] | @tsv'
gh api repos/oven-sh/bun/issues/26740 --jq '[.number, .state, .title, .html_url] | @tsv'
gh api repos/oven-sh/bun/issues/28188 --jq '[.number, .state, .title, .html_url] | @tsv'
```
