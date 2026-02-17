# Changelog

## 0.36.3-pocketbun.4 (Unreleased)

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

- Upgraded PocketBun compatibility target to PocketBase `v0.36.3` and synced vendored Admin UI assets.
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

- Initial public npm release of `pocketbun`.
