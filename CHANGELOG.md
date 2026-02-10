# Changelog

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
