# Changelog

## 0.36.7-pocketbun.0 (Unreleased)

- Upgraded PocketBun compatibility target to PocketBase `v0.36.7`, synced the vendored Admin UI assets, and ported the upstream fixed-window rate limiter change. Upstream notes: [PocketBase v0.36.7 changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md#v0367).
- Reworked multipart upload handling to spool uploaded files to temp storage instead of materializing repeated in-memory copies, reduced request-body reread overhead on upload routes, and raised Bun's server request cap so PocketBun can accept large uploads before its own body/file limits apply.

## 0.36.6-pocketbun.0 - 2026-03-07

- Upgraded PocketBun compatibility target to PocketBase `v0.36.6`, synced vendored Admin UI assets, and ported the upstream view/list-rule/runtime deltas. Upstream notes: [PocketBase v0.36.6 changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md#v0366).
- Removed the temporary local JSVM `unmarshal(...)` typing-gap workaround now that upstream `v0.36.6` ships the declaration in generated types.

## 0.36.5-pocketbun.2 - 2026-03-01

- Updated CI workflows to run on Bun `1.3.10` (from `1.3.8`) so automated checks and E2E runs use the latest Bun fixes/performance improvements.
- Removed the multipart `Request.formData()` fallback reconstruction workaround and now use Bun's native parser path directly (with clone-based preserve-body behavior), plus updated regression coverage around the new behavior.
- Fixed packaged `serveAsync` Admin UI asset path resolution so `/_/` and installer redirects (for example `/_/#/pbinstal/...`) no longer return 404 in installed/create-pocketbun projects.

## 0.36.5-pocketbun.1 - 2026-02-26

- Completed a broad JSVM/dbx compatibility sweep for documented `newQuery(...)` and `select(...)` flows, including `execute()`, named `bind({:token})`, `one()` missing-row behavior, query-builder chains, context/hook APIs, unions/fragments, `LikeExp.escape`, `rows()` cursor iteration, and missing `SelectQuery` helpers (`info`, `model`).
- Improved JSVM/dbx internals by aligning `withExecHook` coverage across query resolvers, exposing query metadata fields (for example `lastError`), and caching SQL-template parameter-name extraction to reduce repeated bind overhead.
- Added the missing JSVM global `unmarshal(data, dst)` declaration to generated `pb_data/types.d.ts` and documented the related upstream typing gap in `docs/users/differences.md`.
- Expanded `docs/users/extend.md` database guidance with side-by-side DBX-first and direct `bun:sqlite` examples, plus practical differences (placeholders, missing-row behavior, result mapping, and migration/perf tradeoffs).
- Added direct regression coverage for non-DBX runtime compatibility shims (`cast`, `request_body`, `slog`, `validation`) to reduce hidden drift risk in shared auth/request/validation paths.

## 0.36.5-pocketbun.0 - 2026-02-21

- Upgraded PocketBun compatibility target to PocketBase `v0.36.5` and synced vendored Admin UI assets. Upstream notes: [PocketBase v0.36.5 changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md#v0365).

- Fixed release tagging to pass an explicit tag message, avoiding editor prompts when signed tags are enabled.

## 0.36.4-pocketbun.0 - 2026-02-18

- Upgraded PocketBun compatibility target to PocketBase `v0.36.4` and synced vendored Admin UI assets. Upstream notes: [PocketBase v0.36.4 changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md#v0364).

- Fixed advanced `pb_hooks` examples/docs to use supported `routerAdd(..., middleware)` (instead of global `onServe(...)`), including a built-in `$apis.requireGuestOnly()` middleware example, eliminating related TypeScript errors and runtime confusion.

- Re-exported built-in route middlewares at the package entrypoint (for example `RequireGuestOnly`, `SkipSuccessActivityLog`) and added a code-first `OnServe` middleware usage example in `examples/advanced/main.ts`.

- Fixed JSVM `$app.save(...)` in hooks/migrations to support collections with async field interceptors (for example file fields), preventing sync-save panic errors and preserving PocketBase-compatible save behavior.

- Fixed `new Record(collection, data)` / `NewRecord(collection, data)` initialization to apply field setters for provided values (matching PocketBase `NewRecord + Load` behavior), so auth passwords and other setter-backed fields are normalized correctly.

- Fixed JSVM `request.pathValue(name)` to decode percent-encoded route params while safely falling back to raw values on malformed escapes, and preserved `setPathValue` roundtrip behavior for values containing `%`.


## 0.36.3-pocketbun.5 - 2026-02-17

- Added JSVM-compatible lowercase hook APIs across `BaseApp`, `Hook`, and `TaggedHook` (for example `on*`, `bindFunc`, `unbind`, `length`, `trigger`) while keeping Go-style names as aliases.
- Added `onRecordRequestOTPRequest` / `OnRecordRequestOTPRequest` aliases to match JSVM OTP hook naming.
- Clarified `pb_hooks` docs and advanced example to show `.pb.ts` imports and route middleware chaining via `onServe(...).bindFunc(...)`.

## 0.36.3-pocketbun.4 - 2026-02-17

- Fixed `pb_hooks` module loading to execute `.pb.ts` files from their real paths, so relative imports (for example `import "./foo.ts"`) and dependency imports resolve correctly.

## 0.36.3-pocketbun.3 - 2026-02-15

- Simplified `--dev` SQL logging to a Bun-native format (`[X.XXms] <sql>`) and reduced SQL logging overhead when dev logging is disabled.
- Fixed `/api/backups` list response keys to match PocketBase (`key`, `size`, `modified`), resolving Admin UI backup row rendering issues.
- Fixed `/api/oauth2-redirect` JSON handling to ignore the `user` field, matching PocketBase behavior.
- Fixed collection API response shape by flattening type-specific options at the top level, resolving Admin UI collection edit failures.
- Documented intentional compatibility differences in `docs/users/differences.md`.

## 0.36.3-pocketbun.2 - 2026-02-14

- Disabled persistent SQLite WAL sidecars so `-wal` and `-shm` files are cleaned up on graceful shutdown.

## 0.36.3-pocketbun.1 - 2026-02-14

- Improved JSVM route compatibility for custom routes by adding support for common `e.request` and `e.response` helpers used by PocketBase hooks.
- Documented supported JSVM compatibility behavior and current limitations in `docs/users/differences.md`.

## 0.36.3-pocketbun.0 - 2026-02-13

- Upgraded PocketBun compatibility target to PocketBase `v0.36.3` and synced vendored Admin UI assets. Upstream notes: [PocketBase v0.36.3 changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md#v0363).
- Added `Accept-Encoding: identity` to S3 signed requests by default to avoid transparent decompression edge cases.
- Synced JSVM generated TypeScript declarations to upstream `v0.36.3` while preserving PocketBun async helper typings.

## 0.36.2-pocketbun.6 - 2026-02-12

- Implemented functional SMTP and sendmail delivery paths so mail sending uses real transport flows.
- Improved PocketBase parity for record field resolution, template rendering, and random-by-regex behavior.

## 0.36.2-pocketbun.5 - 2026-02-12

- Fixed OTP/MFA cleanup hooks to avoid teardown-time errors and async rejection leaks.
- Aligned `Restart` and `RestartAsync` with PocketBase terminate-and-reexec behavior.
- Changed default CLI directories to current working directory paths (`./pb_data`, `./pb_hooks`, `./pb_migrations`, `./pb_public`) to avoid writes under `node_modules`.
- Completed OAuth2 provider parity across all implemented providers.

## 0.36.2-pocketbun.4 - 2026-02-10

- Fixed CLI `--version` output to resolve the package version correctly in installed environments.

## 0.36.2-pocketbun.3 - 2026-02-10

- Fixed JSVM migration/runtime compatibility so JS migrations can use collection helper constructors consistently.
- Fixed multipart record create parsing fallback behavior on Bun for file-upload flows.
- Improved realtime SSE stability with keepalive comments and a Bun-compatible max idle timeout (`255s`).
- Clarified advanced realtime example usage for authenticated subscriptions and expected subscribe responses.

## 0.36.2-pocketbun.2 - 2026-02-09

- Fixed CLI runnable leaf command resolution so positional arguments are handled correctly.
- Updated the `create-pocketbun` template to avoid default superuser credentials in `package.json`.

## 0.36.2-pocketbun.1 - 2026-02-09

- Added npm package metadata (`license`, `repository`, `bugs`, `homepage`) to improve package listing details.

## 0.36.2-pocketbun.0 - 2026-02-09

- Initial public npm release of `pocketbun` with compatibility target PocketBase `v0.36.2`. Upstream notes: [PocketBase v0.36.2 changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md#v0362).
