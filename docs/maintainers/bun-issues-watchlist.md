# Bun Issue Watchlist (PocketBun)

Last updated: 2026-02-27

This file tracks Bun issues that matter for PocketBun compatibility and workaround cleanup.

When any issue below is fixed upstream:
1. upgrade Bun in a focused branch,
2. remove the linked PocketBun workaround/deviation,
3. run full verification (`bun run format:fix`, `bun test --concurrent`, `bun run typecheck`, `bun run lint`),
4. keep removal only if compatibility/stability remains intact.

## Active Watchlist

| Area | Issue link | Status | Linux repro | PocketBun impact / workaround location |
| --- | --- | --- | --- | --- |
| `Bun.serve` `idleTimeout` capped at 255 | Canonical: https://github.com/oven-sh/bun/issues/15589 (our duplicate: https://github.com/oven-sh/bun/issues/27470) | open (canonical) | yes | We pin server idle timeout to `255` in `src/apis/serve.ts` (`defaultServerIdleTimeoutSeconds`) and use it in both `Bun.serve(...)` call sites. |
| Default idle-timeout behavior for SSE/quiet streams docs clarity | https://github.com/oven-sh/bun/issues/27479 | open | yes | Related to the same server timeout deviation in `src/apis/serve.ts`. |
| Multipart binary truncation at null byte in `Request.formData()` | Canonical: https://github.com/oven-sh/bun/issues/26740 (our duplicate: https://github.com/oven-sh/bun/issues/27478) | open (canonical) | yes | No dedicated fallback parser workaround remains after 2026-02-27 sweep; keep watching for upstream resolution/regression in multipart handling. |
| `bun:sqlite` PRAGMA parameter binding docs gap | https://github.com/oven-sh/bun/issues/27480 | open | yes | Docs concern; no runtime workaround expected in PocketBun. |
| `bun:sqlite` WAL sidecar cleanup docs/behavior clarity | https://github.com/oven-sh/bun/issues/27481 | open | no (macOS repro only in our runs) | We explicitly disable persistent WAL sidecars in `src/tools/dbx/connect_pragmas.ts` (`SQLITE_FCNTL_PERSIST_WAL`). |
| Windows `Bun.spawnSync` intermittent empty/invalid stdout | https://github.com/oven-sh/bun/issues/27482 | open | no (Windows-specific) | Sync HTTP helper retries are in `src/plugins/jsvm/binds.ts` (`runSyncFetch`, `maxAttempts = 10`). |

## PocketBun Internal Candidate (Not Filed Yet)

- Multipart parsing after request body has already been touched/consumed:
  - current mitigation: parse from `request.clone()` where needed in `src/internal/compat/request_form_data.ts` and call sites like `src/apis/record_crud.ts`.
  - keep under observation; open a dedicated Bun issue if we can produce a stable upstream repro.

## Quick Status Check Commands

```bash
gh api 'search/issues?q=repo:oven-sh/bun+is:issue+author:pekeler' --jq '.items[] | [.number, .state, .title, .html_url] | @tsv'
gh api 'search/issues?q=repo:oven-sh/bun+is:issue+idleTimeout+255+Bun.serve' --jq '.items[0:10] | .[] | [.number,.state,.title,.html_url] | @tsv'
gh api 'search/issues?q=repo:oven-sh/bun+is:issue+Request.formData+null+byte+multipart' --jq '.items[0:10] | .[] | [.number,.state,.title,.html_url] | @tsv'
```
