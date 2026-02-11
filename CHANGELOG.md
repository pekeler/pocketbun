# Changelog

## 0.36.2-pocketbun.5 (Unreleased)

- Fixed OTP/MFA cron cleanup hooks to skip teardown-time execution when the app is not bootstrapped and to handle async cleanup rejections without leaking unhandled errors.
- Added a regression test to ensure OTP/MFA cleanup cron jobs don’t emit unhandled promise rejections after bootstrap reset.
- Aligned `RestartAsync` behavior with PocketBase terminate-and-reexec flow: it now triggers terminate hooks with `IsRestart=true`, attempts process re-exec with the current argv/env, and re-bootstraps only when re-exec fails.
- Aligned sync `Restart` behavior with PocketBase terminate-and-reexec flow by triggering `OnTerminate` with `IsRestart=true` before attempting process re-exec.
- Added restart regression coverage for re-exec argument wiring and failed re-exec fallback bootstrap behavior.
- Ported Google OAuth2 `FetchAuthUser` mapping behavior (including verified-email-only assignment and strict user payload parsing) to match PocketBase provider semantics.
- Added Google OAuth2 provider regression tests for verified-email mapping and invalid payload/type handling.
- Ported GitHub OAuth2 `FetchAuthUser` mapping behavior, including provider-specific ID/login mapping and optional primary-email fallback via the `/user/emails` API with insufficient-scope status handling.
- Added GitHub OAuth2 provider regression tests for profile mapping, private-email fallback, and invalid payload handling.
- Ported GitLab OAuth2 `FetchAuthUser` mapping behavior with provider-specific field extraction and token/expiry wiring matching PocketBase semantics.
- Added GitLab OAuth2 provider regression tests for profile mapping and invalid payload/type handling.
- Ported OIDC OAuth2 `FetchAuthUser` and id_token claim handling behavior, including `email_verified` gating, audience checks, optional issuer allow-list validation, and optional JWKS signature validation.
- Added OIDC OAuth2 provider regression tests for user mapping, id_token claim parsing, audience/issuer enforcement, UserInfo endpoint fallback, and JWKS signature validation.
- Ported Apple OAuth2 `FetchAuthUser` and id_token claim handling behavior, including verified-email gating plus issuer/audience/signature validation aligned with Apple flow.
- Added Apple OAuth2 provider regression tests for profile mapping and id_token validation edge cases (empty token, missing expiration, invalid issuer, invalid signature).

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
