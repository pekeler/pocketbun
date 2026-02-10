# Changelog

## 0.36.2-pocketbun.3 (Unreleased)

- Fixed JSVM migration/runtime compatibility so JS migrations can use collection helper constructors (`newCollection`, `newBaseCollection`, `newViewCollection`, `newAuthCollection`) and mapped method access consistently.
- Aligned migration execution transaction flow with PocketBase-style tx-app handling in the migrations runner.
- Added/updated JSVM regression tests covering migration helper constructor loading and lower-camel mapped collection helper access.

## 0.36.2-pocketbun.2 - 2026-02-09

- Fixed CLI command resolution for runnable leaf commands so positional args are handled correctly (for example, `superuser upsert <email> <password>`).
- Added a regression test for positional-argument handling in the CLI compatibility shim.
- Updated the `create-pocketbun` simple template to avoid embedding default superuser credentials in `package.json` and to use `bun run pocketbun superuser upsert ...` directly.

## 0.36.2-pocketbun.1 - 2026-02-09

- Added npm package metadata (`license`, `repository`, `bugs`, `homepage`) to improve npm listing details.

## 0.36.2-pocketbun.0 - 2026-02-09

- Initial public npm release of `pocketbun`.
