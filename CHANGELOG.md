# Changelog

## Unreleased

- Now compatible with PocketBase `v0.40.1` [release notes](https://github.com/pocketbase/pocketbase/releases/tag/v0.40.1) (upstream commit `bc8ffed4`).
  - OAuth2 provider updates now preserve omitted fields such as existing client secrets when the provider name is unchanged.
  - Includes PocketBase's malformed UTF-8 replacement behavior and refreshed Admin UI; Bun already replaces malformed bytes when decoding them into JavaScript strings.
- Added `serveAsync(app, { workers: N })`, allowing custom TypeScript entrypoints to use the same supervised cluster mode as PocketBun's included executable.

## 0.40.0-pocketbun.0 - 2026-08-28

This is a **major operational release**, even though PocketBun's PocketBase-aligned version number cannot express that clearly. It raises the minimum Bun version to 1.4 and introduces an optional multi-process deployment model. Before upgrading a production system, create and verify a current backup, install Bun 1.4, and review [Going to Production](docs/users/going-to-production.md) and [PocketBun Differences From PocketBase](docs/users/differences.md).

### Compatibility and upgrade requirements

- **Bun `v1.4.0` or newer is now required.** Older Bun releases are no longer supported.
- Now compatible with PocketBase `v0.40.0` [release notes](https://github.com/pocketbase/pocketbase/releases/tag/v0.40.0) (PocketBase commit `50f5f83a`).
  - Backups no longer hold a transaction while compressing the data directory, while storage-file tracking keeps live backup archives consistent.
  - Added log deletion, bounded log data/message storage, `record.getInt64(...)`, `store.keys()`, quoted download filenames, stronger default security headers, and the updated Admin UI.
- PocketBun still starts with one worker unless `--workers` is explicitly set. Enabling or disabling cluster mode does not convert application data, so an existing deployment can adopt it gradually and return to `--workers=1` without a data migration.

### Vertical scaling

- Added opt-in `--workers=N` vertical scaling for read-heavy applications with spare CPU capacity. Linux workers share one native listening address; macOS and Windows workers use predictable consecutive loopback ports behind an operator-managed reverse proxy.
- One lightweight primary now supervises worker startup, same-slot crash recovery, crash-loop protection, and graceful shutdown, while preventing multiple independent PocketBun instances from concurrently using the same `pb_data` directory.
- Workers coordinate migrations, scheduled work, rate limits, email resend guards, realtime subscriptions and events, auth invalidation, OAuth2 redirects, backups, restores, and application restarts as one PocketBun application.
- Cluster-wide rate limits batch concurrent decisions while preserving the configured application-wide allowance, avoiding one IPC round trip per request on busy routes.
- Cluster coordination treats IPC backpressure as queued work, promptly expires transient resend and OAuth2 state, and prevents overlapping backup operations or stale database connections after restore and restart.
- Large cascading writes retain every PocketBase realtime event while batching cluster transport per transaction; realtime delivery failures no longer turn successful deletes into misleading HTTP errors, and workers without live remote realtime clients skip the transport entirely.
- Fixed a rare missed realtime event immediately after a controlled full-cluster restart by keeping worker-presence updates in order.
- Concurrent async requests now have isolated SQLite transactions, preventing one request from accidentally committing another request's work when their transaction lifetimes overlap.
- Async record saves now yield between short SQLite lock retries, keeping other requests responsive during write contention without changing synchronous transaction or raw-SQL behavior.

### Backups and production operation

- Backups now use disk-backed SQLite snapshots and streaming ZIP64 archives. Large databases are no longer copied into JavaScript memory, archives are no longer limited to 4 GiB entries, and clustered writes and WAL checkpoints can continue while snapshots are created.
- Live storage-file tracking follows PocketBase v0.40's backup boundary across every worker, keeping files deleted during the database snapshot available to the archive and excluding files uploaded after that boundary.
- Keep roughly three times the size of `pb_data` free during a worst-case local backup. Existing PocketBase and PocketBun backup archives remain restorable on supported platforms. As in PocketBase, restoring a backup is not supported on Windows.
- Graceful CLI shutdown now exits successfully after `SIGINT` or `SIGTERM`, so service managers no longer report a normal stop as a failure.
- Production guidance now covers reverse-proxy TLS, systemd, worker topology, memory and SQLite scaling tradeoffs, live backups, and immediate rollback to one worker.

### Bun 1.4 and runtime improvements

- Fixed multiple-cookie responses on Bun 1.4 so every `Set-Cookie` header is preserved.
- Fixed synchronous server-side JavaScript HTTP requests intermittently failing on Windows with Bun 1.4.
- Fixed the superuser SQL endpoint for read queries on Bun 1.4.
- Fixed realtime disconnect cleanup on Bun 1.4 so clients are removed before their SSE streams close.
- Fixed realtime SSE connections retaining one Promise reaction per delivered message until disconnect, preventing long-lived busy streams from growing their worker heap.
- Local static files now use Bun's lazy file bodies instead of a whole-file memory cache, reducing retained memory for large files.
- Improved XML handling for S3-compatible storage and custom XML endpoints, including native single-root response serialization, namespaces, entities, repeated and empty values, and malformed-input errors.

### Developer experience

- Added PocketBase-compatible `$app.cron().setTimezone(...)` support while keeping UTC as the default on every host.
- Clarified custom-route CSRF guidance so cookie-authenticated forms bind tokens to a stable per-session identifier.
- Faster test runs now isolate files across four Bun worker processes, with `bun run test:changed` available for focused local checks.

## 0.39.11-pocketbun.0 - 2026-08-14

- Now compatible with PocketBase `v0.39.11` [changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md#v03911) (upstream commit `5d217ddb`).
  - Corrects Admin UI API previews for record creation, OAuth2 authentication, and realtime subscriptions.
  - Includes Admin UI keyboard, drag-and-drop, collection duplication, file handling, and search filter improvements.
- Fixed trusted-proxy IPv6 normalization so equivalent address formats no longer trigger duplicate new-location login alerts.

## 0.39.10-pocketbun.1 - 2026-08-07

- Improved dev migration logs to name each applied or reverted migration, batch history checks, and avoid no-op transactions.
- Fixed OTP authentication and request limiting so configured OTP durations are honored in seconds instead of milliseconds.

## 0.39.10-pocketbun.0 - 2026-07-30

- Now compatible with PocketBase `v0.39.10` [changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md#v03910) (upstream commit `0a74d2f2`).
  - Restores non-zero CLI failure behavior when command callbacks throw unexpectedly.
  - Includes Admin UI loading and layout improvements for the logs chart.

## 0.39.9-pocketbun.0 - 2026-07-23

- Now compatible with PocketBase `v0.39.9` [changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md#v0399) (upstream commit `0cbfc046`).
  - Speeds up large filter string literal parsing while aligning control character, escaped quote, and backslash handling.
  - Includes the Admin UI fix for `Shift + Click` range selection in Firefox.

## 0.39.8-pocketbun.0 - 2026-07-20

- Now compatible with PocketBase `v0.39.8` [changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md#v0398) (upstream commit `cc4e8570`).
  - Properly resets server-side JavaScript `$app` assignments after hooks, route handlers, and middlewares finish.
  - Includes Admin UI improvements for number inputs and `Shift + Click` range selection.

## 0.39.7-pocketbun.0 - 2026-07-17

- Now compatible with PocketBase `v0.39.7` [changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md#v0397) (upstream commit `636b7e28`).
  - Includes upstream fixes for import-collection field review and View collection wildcard validation and error messages.
  - PocketBun is not affected by the Go-specific internal worker panic because its promise-based workers already catch synchronous throws and rejected promises.

## 0.39.6-pocketbun.0 - 2026-07-08

- Now compatible with PocketBase `v0.39.6` [changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md#v0396) (upstream commit `de3c3f71`).
  - Includes upstream Microsoft OAuth2 email-claim extraction options, sendmail `Cc`/`Bcc` handling, and Admin UI updates.
- Fixed REST record creation when a create rule references fields from the record being created, such as `ownerId = @request.auth.id`.

## 0.39.5-pocketbun.0 - 2026-06-29

- Now compatible with PocketBase `v0.39.5` [changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md#v0395) (upstream commit `667a7650`).
  - Includes upstream Admin UI fixes for long URL field display, the restored fullscreen editor option, and TinyMCE preload.

## 0.39.4-pocketbun.1 - 2026-06-15

- Added deploy-ready server hook bundling with `pocketbun hooks build` and `registerServerJSAsync({ bundleHooks: true })`, so hooks can import shared workspace packages and JSON without copying the original package tree into production artifacts.

## 0.39.4-pocketbun.0 - 2026-06-15

- Now compatible with PocketBase `v0.39.4` [changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md#v0394) (upstream commit `507ecb2`).
  - Includes upstream OAuth2 code exchange validation, first implicit presentable relation-field sorting, and minor Admin UI fixes.

## 0.39.3-pocketbun.5 - 2026-06-12

- Fixed server-side JavaScript `new Record(collection, data)` and `record.set(...)` field setters when records are built from JSVM-wrapped collections, including transaction callback apps.
- Hardened server-side JavaScript runtime compatibility so generated JSVM objects expose PocketBase-style names directly instead of relying on recursive object facades.

## 0.39.3-pocketbun.4 - 2026-06-12

- Fixed CLI help spacing for long subcommands such as `pocketbun server-js upgrade-source`.
- Fixed `pocketbun server-js upgrade-source` so it no longer rewrites non-PocketBun uppercase keys such as HTTP headers or `globalThis.secrets.*` names.

## 0.39.3-pocketbun.3 - 2026-06-12

- Replaced `pocketbun server-js lowercase` with `pocketbun server-js upgrade-source`, which updates deprecated server-side JavaScript compatibility aliases, package aliases, template language config, and old generated collection migrations while preserving formatting.
- Fixed remaining server-side JavaScript type/runtime mismatches so generated hook and migration declarations match the lowercase runtime API, including app, record, form, API error, validation error, `DateTime`, field `help`, `RequestInfo`, `Cookie`, `Command`, and `SubscriptionMessage.writeSSE(...)` names.
- Documented uppercase server-side JavaScript compatibility aliases as deprecated, expanded `pocketbun server-js upgrade-source` coverage for the audited runtime/type surface, and updated generated declaration comments plus docs/examples to use lowercase server-side JavaScript helpers.
- Added lower-camel preferred names for the PocketBun package API while keeping released Go-style names as deprecated compatibility aliases, including app construction, server-side JavaScript registration, migrate command setup, route middlewares, static file serving, CLI command helpers, and public `App`/`BaseApp` methods such as `save`, `runInTransaction`, `createBackup`, and `recordQuery`.

## 0.39.3-pocketbun.2 - 2026-06-12

- `pocketbun server-js lowercase` now preserves existing indentation, spacing, blank lines, and quote style while rewriting names.

## 0.39.3-pocketbun.1 - 2026-06-12

- Fixed command help output so `migrate --help` lists supported actions and superuser commands show examples.
- Aligned server-side JavaScript hooks and migrations with PocketBase's lowercase API while preserving compatibility for existing PocketBun code:
  - Lowercase app, record, DateTime, hook handler, and route middleware names now match the generated `pb_data/types.d.ts` declarations, including transaction callback `txApp` values.
  - Uppercase Go-style names remain available as deprecated aliases, and the docs now steer new code toward PocketBase-style lowercase names.
  - Package embedders can now use `registerServerJS*` and `ServerJSConfig` for server-side JavaScript setup; `RegisterJSVM*`, `RegisterHooksPlugin*`, and `RegisterServerJS*` remain compatibility aliases.
  - `pocketbun server-js lowercase` can rewrite older uppercase hook and migration code, with `--check` and `--dry-run` modes for CI and review.
  - Hook runtime compatibility wrappers no longer rely on `Proxy`, improving performance with cached facades and concrete route request adapters.
- Upgrade notes from `v0.39.3-pocketbun.0`:
  - Run `pocketbun server-js lowercase` in a clean working tree to update older uppercase hook and migration API usage; use `pocketbun server-js lowercase --check` in CI.
  - For package embeds, prefer `registerServerJS*`, `mustRegisterServerJS*`, and `ServerJSConfig`; `RegisterJSVM*`, `RegisterHooksPlugin*`, and `RegisterServerJS*` remain compatibility aliases.
  - Remove explicit `TemplateLangGo` migration generation config or switch it to `templateLangJS`; PocketBun now generates JavaScript migrations only.
  - Review older generated collection/schema migrations before fresh-database replay and use `app.forMigrations()` for collection persistence.
- Changed migration generation to JavaScript-only: omitted `TemplateLang` now generates `.js` files by default, and explicit Go template generation now fails fast instead of producing migrations PocketBun cannot run.
- Reduced duplicate dev-mode SQL logs during server startup.
- Clarified how to create collections in JavaScript migrations.

## 0.39.3-pocketbun.0 - 2026-06-09

- Now compatible with PocketBase `v0.39.3` [changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md#v0393) (upstream commit `465cfb5`).
  - Includes upstream Admin UI fixes for file field `maxSelect` changes, top-modal record save shortcuts, number field settings validation, and normalized field settings validation messages/tooltips.

## 0.39.2-pocketbun.0 - 2026-06-08

- Now compatible with PocketBase `v0.39.2` [changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md#v0392) (upstream commit `aee115a9`).
  - Includes upstream Admin UI fixes for records-list sorting, date-input editing, SQL console affected-rows display, and SQL console `ALTER`/`REPLACE` write-query handling.

## 0.39.1-pocketbun.0 - 2026-06-04

- Now compatible with PocketBase `v0.39.1` [changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md#v0391) (upstream commit `5631d9b1`).
  - Includes upstream realtime hidden-field delivery for superuser subscribers, cron panic recovery, and Admin UI multiple-select wrapping fixes.

## 0.39.0-pocketbun.0 - 2026-05-29

- Now compatible with PocketBase `v0.39.0` [changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md#v0390).
  - Adds the upstream Admin UI SQL console, automated-backup error alerts for superusers, logs/records list polish, OIDC option field registration, refreshed default email template text, and dependency updates.

## 0.38.2-pocketbun.1 - 2026-05-25

- Hardened release process.

## 0.38.2-pocketbun.0 - 2026-05-22

- Now compatible with PocketBase `v0.38.2` [changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md#v0382).
  - Adds upstream realtime connection max-lifetime handling, extra realtime connected-user IP checks, and the Admin UI records-list pagination fix.

- Release publishing now leaves `package.json` and `CHANGELOG.md` on the released version instead of automatically starting the next PocketBun patch iteration.
- Hosted docs now deploy from PocketBun release tags instead of every `docs/` push, so the published docs stay aligned with the latest release.

## 0.38.1-pocketbun.2 - 2026-05-16

- JSVM custom routes can now use `$apis.requireAuth()` and the other `$apis` middleware helpers directly without an `unsupported middleware type` error, including in generated TypeScript declarations.
- Docs now show the PocketBun package version in the header from generated docs metadata, and `bun run check:versions` verifies both `package.json` against `pocketbase_tag.txt` and the generated docs version metadata.
- The npm package no longer includes local `bin/pb_data` database files, and installed apps can refresh JSVM hook declarations from the packaged type snapshot instead of relying on the caller's working directory.

## 0.38.1-pocketbun.1 - 2026-05-16

- Requires Bun `v1.3.14` or newer; generated file thumbnails now use Bun's built-in `Bun.Image` and are stored as WebP, so PocketBun no longer installs `sharp`.
- Preserves PocketBase JSVM `Timezone("EET")` behavior on Linux runtimes whose ICU data doesn't expose that tzdb alias directly.

## 0.38.1-pocketbun.0 - 2026-05-15

- Now compatible with PocketBase `v0.38.1` [changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md#v0381).
  - Includes upstream fixes for realtime auth invalidation after credential/secret changes, collection index normalization, UI extension top-level `await`, and Admin UI validation/error display polish.

## 0.38.0-pocketbun.1 - 2026-05-09

- Runtime settings and collection change notifications now reload reliably on macOS even when filesystem watcher events are coalesced.

## 0.38.0-pocketbun.0 - 2026-05-09

- Now compatible with PocketBase `v0.38.0` [changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md#v0380).
  - Includes upstream `v0.37.5` compatibility fixes for password field change detection, safer email-change confirmation validation, and duplicate relation id handling during record expand.
  - Adds superuser IP/CIDR allowlists, rate-limit excluded IP/CIDR settings, runtime settings/collection state notifications across app instances, corrected Office document content types, the Admin UI refresh, and the default CSP media-preview fix.

- Synced the vendored Admin UI and generated docs snapshot to the new upstream target.

## 0.37.4-pocketbun.2 - 2026-04-28

- Fixed generated JS collection migrations so `app.forMigrations()` keeps synchronous app save, delete, and import behavior during migration replay, while nested auth email template diffs preserve unchanged fields.

## 0.37.4-pocketbun.1 - 2026-04-28

- Generated JS collection migrations now use `const migrationApp = app.forMigrations()` so schema changes skip user hooks while preserving PocketBun system hooks required for collection persistence. Existing generated collection/schema migrations should be updated to use `migrationApp.findCollectionByNameOrId(...)`, `migrationApp.save(collection)`, `migrationApp.delete(collection)`, and `app.forMigrations().importCollections(...)` for snapshots so fresh database replays do not run current business hooks.
- Fixed generated JS migrations that update auth collection options so `unmarshal(...)` preserves typed collection option models before `migrationApp.save(collection)`.

## 0.37.4-pocketbun.0 - 2026-04-27

- Now compatible with PocketBase `v0.37.4` [changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md#v0374).
  - Includes the upstream security fix for OAuth2 account linking, OAuth2 provider updates for Bitbucket/GitHub/GitLab/Gitea-Forgejo, SMTP IPv6 formatting, failed password-auth timing hardening, and the latest Admin UI polish.

## 0.37.3-pocketbun.1 - 2026-04-24

- `pocketbun serve` now clearly rejects PocketBase's automatic HTTPS mode and documents the recommended reverse-proxy setup for TLS.
- Fixed installed package typings so TypeScript consumers can import `pocketbun` without allowing `.ts` import extensions.

## 0.37.3-pocketbun.0 - 2026-04-23

- Now compatible with PocketBase `v0.37.3` [changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md#v0373).
  - Includes the upstream Admin UI fixes for total-count reloads on back/forward navigation, TinyMCE floating dialog positioning while scrolling, API rule field wrapping, view-query sample loading feedback, and minor light-theme style polish.

- File downloads now handle HTTP byte ranges more correctly, including suffix ranges, proper `416 Range Not Satisfiable` responses, and real multipart byte-range responses.

## 0.37.2-pocketbun.0 - 2026-04-20

- Now compatible with PocketBase `v0.37.2` [changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md#v0372).
  - Includes the upstream Admin UI fixes for Firefox auto-expanding inputs, dark-theme readability, log attribute rendering, and the Safari popover freeze workaround.

## 0.37.1-pocketbun.0 - 2026-04-19

- Now compatible with PocketBase `v0.37.1` [changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md#v0371).
  - Includes the upstream Admin UI hotfixes for number field normalization, opening collections in a new tab with middle click, and setting the collection name in the page title on initial load.

## 0.37.0-pocketbun.0 - 2026-04-19

- Now compatible with PocketBase `v0.37.0` [changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md#v0370).
  - Includes the rewritten PocketBase Admin UI refresh and the new UI-facing compatibility surface it depends on.

- Requires Bun `v1.3.12` or newer; app cron expressions are interpreted in UTC, now follow Bun's wider cron parser, and the old `setInterval(...)` / `setTimezone(...)` cron APIs have been removed.
- The package root now re-exports the upstream-style JSVM bind helpers like `BindCore(...)` and `BindApis(...)`, making custom JSVM integrations easier to wire up.
- JSVM `$filepath.glob(...)`, `match(...)`, `walk(...)`, and `walkDir(...)` now behave like real filesystem helpers, with the remaining Go `filepath` edge-case differences documented in the user guide; template `LoadFS(...)` supports nested glob patterns via Bun's native glob scanner.
- Common write-heavy API requests are now faster, including rule-heavy JSON create flows and some request-layer overhead on the normal `serve()` path.
- Autogenerated collection and field ids now use Bun's native CRC32 implementation, matching UTF-8 semantics for non-ASCII names while simplifying PocketBun's internal zip writer.
- Maintainer tooling now includes better Bun-native profiling and verification helpers, including targeted CPU/heap profiling commands, `bun run agent-script`, `bun run test:randomize`, and normal typecheck/lint coverage for the `scripts/` tree.
- The custom-route and SSR docs now point at `Bun.CSRF` as a practical building block.

## 0.36.9-pocketbun.0 - 2026-04-09

- Now compatible with PocketBase `v0.36.9` [changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md#v0369).
  - OAuth2 avatar imports mapped to file fields now reject loopback/private targets instead of probing internal network addresses.
  - Discord OAuth2 now prefers `global_name` for `AuthUser.Name` and avoids legacy `username#0` / empty-avatar URL artifacts.
- Settings updates now reliably persist cleared or replaced SMTP passwords, matching the upstream `v0.36.9` secret-handling fix.
- JSVM `$apis.static(...)` now accepts `$os.dirFS(...)` / `fs.FS` roots in addition to plain directory strings, matching the documented upstream usage.

## 0.36.8-pocketbun.0 - 2026-03-28

- Now compatible with PocketBase `v0.36.8` [changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md#v0368).
  - PocketBun already avoided the OAuth2 client-secret serialization issue.
- PocketBun now requires Bun `v1.3.11` or newer, aligning the package, examples, and CI with the Bun fixes PocketBun now relies on.
- JSVM sync HTTP flows are now more reliable on Windows with the Bun `v1.3.11` baseline.

## 0.36.7-pocketbun.0 - 2026-03-17

- Now compatible with PocketBase `v0.36.7` [changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md#v0367).
  - Rate limits now reset in a more predictable fixed-window way, so limits like "X requests per Y seconds" behave more intuitively and line up better with what the Admin UI communicates.
- Large file uploads now use dramatically less memory and reliably support much bigger uploads, bringing PocketBun much closer to PocketBase for real-world file handling.
- Large file and backup downloads now stay effectively flat in memory instead of buffering the whole file in RAM, making file serving much more production-friendly.

## 0.36.6-pocketbun.0 - 2026-03-07

- Now compatible with PocketBase `v0.36.6` [changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md#v0366).
  - View schemas now preserve integer-only number fields more accurately.
  - Includes upstream fixes for list-rule edge cases and `Store.GetOrSet(...)` races.
- JSVM typings now include the documented `unmarshal(...)` helper out of the box.

## 0.36.5-pocketbun.2 - 2026-03-01

- Fixed packaged `serveAsync` asset resolution so the Admin UI and installer redirects no longer return 404 in installed `pocketbun` and `create-pocketbun` projects.
- Multipart uploads are simpler and more reliable on current Bun versions.

## 0.36.5-pocketbun.1 - 2026-02-26

- Expanded JSVM/dbx compatibility for documented `newQuery(...)` and `select(...)` flows, including named binds, missing-row handling, query builder chains, cursor iteration, unions/fragments, and missing helpers like `info()` and `model()`.
- Added the global JSVM `unmarshal(data, dst)` declaration to generated types and expanded the docs with side-by-side DBX and `bun:sqlite` guidance.

## 0.36.5-pocketbun.0 - 2026-02-21

- Now compatible with PocketBase `v0.36.5` [changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md#v0365).
  - Collection and field names now behave better in the Admin UI while using IME input.

## 0.36.4-pocketbun.0 - 2026-02-18

- Now compatible with PocketBase `v0.36.4` [changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md#v0364).
  - `Bearer` auth prefixes are now accepted case-insensitively.
  - JSVM now includes `$filesystem.s3(...)` and `$filesystem.local(...)` bindings.
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

- Now compatible with PocketBase `v0.36.3` [changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md#v0363).
  - S3 file responses are more reliable when object-storage compression is enabled.
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
- Now compatible with PocketBase `v0.36.2` [changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md#v0362).
