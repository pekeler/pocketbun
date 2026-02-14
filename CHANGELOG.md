# Changelog

## 0.36.3-pocketbun.1 (Unreleased)

- Improved JSVM route-event compatibility for PocketBase custom routes by adding `RequestEvent` request/response surface support for `e.response.header().set(...)`, `e.request.pathValue(...)`, `e.request.setPathValue(...)`, `e.request.url.path`, `e.request.url.query().get(...)`, and `e.request.header.get(...)`.
- Implemented the new JSVM request compatibility wrappers with lazy access and caching to keep route hot-path overhead low when `e.request` compatibility fields are not used.
- Added regression tests for route-hook request/response compatibility (including path values, query/header getters, and empty-string fallback semantics).
- Documented this compatibility area and remaining limitations in `docs/users/differences.md`, including supported alternatives for unimplemented Go form/write primitives.

## 0.36.3-pocketbun.0 - 2026-02-13

- Upgraded PocketBun compatibility target to PocketBase `v0.36.3` and synced vendored Admin UI assets.
- Added `Accept-Encoding: identity` to S3 signed requests (unless explicitly set) to avoid transparent decompression/zeroed content-length edge cases.
- Synced JSVM generated TypeScript declarations to upstream `v0.36.3` while preserving PocketBun async helper typings (for example `$http.sendAsync(...)` and `$os.readFileAsync(...)`).

## 0.36.2-pocketbun.6 - 2026-02-12

- Implemented functional SMTP and sendmail delivery paths so mailer sends now execute real transport flows (including SMTP AUTH and sendmail command execution) instead of placeholder behavior.
- Improved PocketBase parity for record field resolution, template rendering, and random-by-regex generation by aligning additional edge cases and upstream-compatible parsing behavior.

## 0.36.2-pocketbun.5 - 2026-02-12

- Fixed OTP/MFA cron cleanup hooks to skip teardown-time execution when the app is not bootstrapped and to handle async cleanup rejections without leaking unhandled errors.
- Added a regression test to ensure OTP/MFA cleanup cron jobs don’t emit unhandled promise rejections after bootstrap reset.
- Aligned `RestartAsync` behavior with PocketBase terminate-and-reexec flow: it now triggers terminate hooks with `IsRestart=true`, attempts process re-exec with the current argv/env, and re-bootstraps only when re-exec fails.
- Aligned sync `Restart` behavior with PocketBase terminate-and-reexec flow by triggering `OnTerminate` with `IsRestart=true` before attempting process re-exec.
- Added restart regression coverage for re-exec argument wiring and failed re-exec fallback bootstrap behavior.
- Changed PocketBun CLI default directory resolution to use the current working directory (`./pb_data`, sibling `./pb_hooks`/`./pb_migrations`, and `./pb_public`) so package-managed entrypoints don’t write under `node_modules`; removed `--dir ./pb_data` template/example script workarounds and added regression coverage for npm-style CLI paths.
- Expanded GitHub Actions CI coverage to run format/lint/typecheck/tests on a Linux/macOS/Windows matrix and split Playwright E2E into a dedicated Ubuntu job.
- Completed OAuth2 provider compatibility parity across all implemented providers by porting provider-specific `FetchAuthUser` mappings and raw-user fetch flows (including verified-email gating, active-account checks, id_token validation, GraphQL/userinfo/header-specific requests, and fallback email resolution), and added regression coverage for each provider (Google, GitHub, GitLab, OIDC, Apple, Microsoft, Discord, Facebook, Bitbucket, Box, Linear, Lark, Gitea, Kakao, Instagram Login, Gitee, Notion, mailcow, monday.com, LiveChat, Patreon, Yandex, X/Twitter, WakaTime, VK, Trakt, Planning Center, Twitch, Spotify, and Strava).

## 0.36.2-pocketbun.4 - 2026-02-10

- Fixed CLI `--version` output to resolve PocketBun version from package metadata in installed environments instead of showing `(untracked)`.
- Added a regression test to ensure PocketBun version resolution stays stable.

## 0.36.2-pocketbun.3 - 2026-02-10

- Fixed JSVM migration/runtime compatibility so JS migrations can use collection helper constructors (`newCollection`, `newBaseCollection`, `newViewCollection`, `newAuthCollection`) and mapped method access consistently.
- Aligned migration execution transaction flow with PocketBase-style tx-app handling in the migrations runner.
- Added/updated JSVM regression tests covering migration helper constructor loading and lower-camel mapped collection helper access.
- Fixed multipart record create parsing to use clone-based form-data parsing in the record CRUD path, avoiding Bun `undefined is not a function` failures on project/file creates.
- Added a regression test for multipart create fallback behavior when multipart parsing fails on the primary request object.
- Fixed realtime SSE stability on Bun by adding periodic SSE keepalive comments and setting Bun server `idleTimeout` to the supported max (`255s`) so idle realtime streams are not closed prematurely.
- Clarified advanced example realtime instructions to use authenticated subscriptions (`Authorization` header), wildcard topic subscription (`projects/*`), and expected `204 No Content` on subscribe requests.

## 0.36.2-pocketbun.2 - 2026-02-09

- Fixed CLI command resolution for runnable leaf commands so positional args are handled correctly (for example, `superuser upsert <email> <password>`).
- Added a regression test for positional-argument handling in the CLI compatibility shim.
- Updated the `create-pocketbun` simple template to avoid embedding default superuser credentials in `package.json` and to use `bun run pocketbun superuser upsert ...` directly.

## 0.36.2-pocketbun.1 - 2026-02-09

- Added npm package metadata (`license`, `repository`, `bugs`, `homepage`) to improve npm listing details.

## 0.36.2-pocketbun.0 - 2026-02-09

- Initial public npm release of `pocketbun`.
