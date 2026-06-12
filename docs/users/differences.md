---
layout: default
title: PocketBun Differences From PocketBase
permalink: /differences.html
---

# PocketBun Differences From PocketBase

This page tracks user-relevant differences between PocketBase and PocketBun.

Notation used in examples:

- `e` refers to the hook or route event parameter (for example: `onBootstrap((e) => { ... })` or `routerAdd("GET", "/path", (e) => { ... })`).

Quick links:

- [PocketBase To PocketBun Migration Checklist](#pocketbase-to-pocketbun-migration-checklist)
- [Runtime And Distribution](#runtime-and-distribution)
- [CLI Defaults And Paths](#cli-defaults-and-paths)
- [Server-Side JavaScript Plugin Naming](#server-side-javascript-plugin-naming)
- [Hooks API And Module Loading](#hooks-api-and-module-loading)
- [Migration Hook Behavior](#migration-hook-behavior)
- [Async API Extensions](#async-api-extensions)
- [Operational Differences](#operational-differences)
- [Cron Scheduling](#cron-scheduling)
- [PocketBase Docs Topics That Do Not Apply Directly](#pocketbase-docs-topics-that-do-not-apply-directly)
- [Intentional Omissions](#intentional-omissions)

## PocketBase To PocketBun Migration Checklist

Use this as a quick migration recipe for an existing PocketBase project.

1. Switch executable and update flow.
   - Replace `pocketbase` commands with `pocketbun`.
   - There is no PocketBase-style binary self-update command; update via package manager.
2. Create (or convert to) a Bun project.
   - Option A: convert your existing project directory:
     - initialize package metadata: `bun init`
     - add PocketBun dependency: `bun add pocketbun`
   - Option B: scaffold a new PocketBun project and copy your existing data/code:
     - create project: `bun create pocketbun my-app`
     - copy your PocketBase `pb_*` directories into the new project (`pb_data`, `pb_hooks`, `pb_migrations`, optional `pb_public`)
3. Keep the project layout, but verify startup working directory.
   - Keep `pb_data`, `pb_hooks`, `pb_migrations`, and optional `pb_public`.
   - PocketBun resolves default paths from current working directory (CWD), so start from your project root or pass explicit dirs.
4. Move hooks as-is, then fix hook-chain calls.
   - In handlers that call `e.next()`, return/await it:
     - sync: `return e.next()`
     - async: `const err = await e.next(); if (err) return err; ...`
   - This is especially important for `onBootstrap` when using async startup paths.
   - If you see `OnBootstrap hook didn't fail but the app is still not bootstrapped`, this is usually the cause.
   - In `.pb.ts` hooks, use standard `import` for neighboring files and dependencies when needed.
5. Keep API clients and route assumptions.
   - Existing client SDK usage should continue to work with the same API base paths (`/api/`, `/_/`).
6. If you embed PocketBun programmatically, prefer server-side JavaScript package API names.
   - Prefer `RegisterServerJS*` / `MustRegisterServerJS*` and `ServerJSConfig`.
   - `RegisterJSVM*` / `MustRegisterJSVM*` and `JSVMConfig` remain aliases because PocketBase's upstream JavaScript extension package is named `jsvm`.
   - `RegisterHooksPlugin*` / `MustRegisterHooksPlugin*` remain aliases for compatibility with released PocketBun versions.
7. Run a migration smoke test before deploying.
   - Start: `pocketbun serve --dev`
   - Verify health: `GET /api/health`
   - Verify custom hooks/routes and auth flows you use in production.
   - If you have older generated collection/schema migrations, update them to use `app.forMigrations()` as described below.
8. If you used PocketBase's automatic HTTPS mode, put PocketBun behind a reverse proxy.
   - Run PocketBun on HTTP, for example `pocketbun serve --http 127.0.0.1:8090`.
   - Terminate HTTPS in Caddy, NGINX, Traefik, a load balancer, or another reverse proxy.
9. Review the sections below for details.
   - Use this checklist for the quick pass, then check each section in this page only where your app uses that feature.

## Runtime And Distribution

PocketBase:

- distributed as a Go binary
- updated via binary release flow

PocketBun:

- distributed as npm/Bun package
- updated via package manager (`bun update pocketbun`)
- CLI binary name is `pocketbun`

## CLI Defaults And Paths

PocketBase defaults are resolved relative to executable location.
PocketBun resolves defaults from current working directory.

Default paths in PocketBun CLI:

- `./pb_data`
- `./pb_hooks` and `./pb_migrations` (derived from `pb_data` unless explicitly set)
- `./pb_public` (unless explicitly set)

This prevents accidental writes into `node_modules`-adjacent paths when used as package dependency.

## Server-Side JavaScript Plugin Naming

PocketBase's upstream JavaScript extension package uses `jsvm` naming because it runs code in an embedded JavaScript VM. PocketBun runs hooks and JavaScript migrations with Bun, so PocketBun's preferred package API names use `ServerJS`:

- preferred: `RegisterServerJS*`, `MustRegisterServerJS*`, `ServerJSConfig`
- upstream-parity aliases: `RegisterJSVM*`, `MustRegisterJSVM*`, `JSVMConfig`
- released compatibility aliases: `RegisterHooksPlugin*`, `MustRegisterHooksPlugin*`

All names map to the same server-side JavaScript registration behavior.

## Hooks API And Module Loading

PocketBun supports PocketBase-style lowercase server-side JavaScript naming and keeps Go-style aliases where applicable. The uppercase aliases exist only for older PocketBun hooks and should be treated as legacy compatibility names; new `pb_hooks` and `pb_migrations` code should use the lowercase names used by PocketBase JavaScript docs and `pb_data/types.d.ts`.

- preferred hook object names: `bindFunc`, `bind`, `unbind`, `length`, `trigger`
- legacy alias hook object names: `BindFunc`, `Bind`, `Unbind`, `Length`, `Trigger`
- app method style: prefer `$app.onServe()`; `$app.OnServe()` remains accepted as a legacy compatibility alias
- `pb_hooks` global hook bindings intentionally mirror PocketBase's upstream JavaScript hooks (so there is no global `onServe(...)`)

To update older PocketBun hooks and migrations automatically, run:

```sh
pocketbun server-js upgrade-source
```

The command scans `./pb_hooks` and `./pb_migrations` by default. Use `pocketbun server-js upgrade-source --check` in CI to fail when legacy names remain, or pass explicit files/directories to limit the rewrite. The fixer rewrites JavaScript/TypeScript member access and object-literal keys such as `e.Record.GetString(...)`, `$app.OnServe()`, `app.RunInTransaction(...)`, `record.GetDateTime(...)`, `form.Validate()`, `apiErr.RawData()`, `validationErr.SetMessage(...)`, and `{ Func, Id, Priority }`; updates released package aliases such as `RegisterHooksPlugin*`, `RegisterJSVM*`, `JSVMConfig`, and `TemplateLangGo`; and updates old generated collection migrations to use `app.forMigrations()`. It does not rewrite comments, strings, or class constructor identifiers such as `new ApiError(...)`, `new ValidationError(...)`, or `new RecordUpsertForm(...)`. Run it with a clean working tree and review the diff before committing.

For `pb_hooks` module loading:

- `.pb.ts` supports ESM imports from local files and dependencies (`node_modules`)
- `.pb.js` supports `require(...)`

For code-first `BaseApp` usage:

- built-in route middlewares are available as package exports (for example `RequireGuestOnly`, `SkipSuccessActivityLog`)
- you can bind them directly in `onServe` routes with `e.Router.GET(...).bind(...)`

## Migration Hook Behavior

PocketBase generated collection migrations save collections through the normal app save path. That means custom model/collection hooks can run when old migrations are replayed on a fresh database.

PocketBase does not acknowledge this as a bug; the upstream position is that model save hooks and validations are intentionally part of `save`. PocketBun disagrees for generated schema migrations because historical migrations should not depend on current application/business hooks. This is the same class of replay hazard described by Rails in [Using Models in Your Migrations](https://guides.rubyonrails.org/v3.2/migrations.html#using-models-in-your-migrations).

PocketBun generated JS collection migrations use `app.forMigrations()` instead. The returned app view skips user hooks registered after app construction while preserving PocketBun system hooks required for collection persistence, table sync, cache reloads, and view updates.

For older generated collection/schema migrations, update the migration to use a migration app view:

```js
migrate((app) => {
  const migrationApp = app.forMigrations()

  const collection = migrationApp.findCollectionByNameOrId("posts")
  collection.fields.add(new TextField({
    name: "slug",
    required: false,
  }))

  return migrationApp.save(collection)
}, (app) => {
  const migrationApp = app.forMigrations()

  const collection = migrationApp.findCollectionByNameOrId("posts")
  collection.fields.removeByName("slug")

  return migrationApp.save(collection)
})
```

For generated collection snapshots, use:

```js
return app.forMigrations().importCollections(snapshot, false)
```

Migration rule: migrations must be able to run years later with the current app code.

- Use `app.forMigrations()` for collection/schema changes.
- Use `app.forMigrations().importCollections(snapshot, false)` for generated collection snapshots.
- Use SQL for record, data, and settings changes. If SQL is not enough, keep the transformation logic inside the migration and work with the persisted data shape.
- Do not use current app behavior from migrations: no normal record/settings `app.save(...)`, forms, services, or hook-driven helpers.

## Async API Extensions

PocketBun keeps sync-compatible APIs but adds async alternatives for I/O-heavy paths.

| Area | PocketBase-compatible sync API | PocketBun async extension |
| --- | --- | --- |
| Archive helpers | `Create`, `Extract` | `CreateAsync`, `ExtractAsync` |
| App bootstrap/serve | `app.bootstrap()`, `serve(...)` | `app.bootstrapAsync()`, `serveAsync(...)` |
| Migration helper | `migrate(...)` | `migrateAsync(...)` |
| Server-side JavaScript register | `RegisterServerJS(...)` | `RegisterServerJSAsync(...)` |
| Filesystem factories | `NewFilesystem()` | `NewFilesystemAsync()` |
| Server-side JavaScript helpers | `$http.send(...)`, `$os.readFile(...)` | `$http.sendAsync(...)`, `$os.readFileAsync(...)` |

## Operational Differences

### HTTPS

PocketBase can run a public HTTPS server directly with automatic Let's Encrypt certificates:

- `pocketbase serve example.com`
- `pocketbase serve --https 0.0.0.0:443`

PocketBun does not include PocketBase's built-in automatic HTTPS/Let's Encrypt server mode. The equivalent PocketBun deployment pattern is to run PocketBun over HTTP and terminate HTTPS in a reverse proxy such as Caddy, NGINX, Traefik, a platform load balancer, or a CDN edge.

Recommended PocketBun backend command:

```sh
pocketbun serve --http 127.0.0.1:8090
```

Minimal Caddy example:

```caddyfile
example.com {
  reverse_proxy 127.0.0.1:8090
}
```

The `pocketbun serve` domain arguments, the `--https` flag, and programmatic `ServeConfig.httpsAddr` / `ServeConfig.certificateDomains` settings are intentionally unsupported and return an explanatory error instead of starting a server.

### Activity logs

PocketBun persists activity logs through a background worker to reduce main-thread blocking.

## Cron Scheduling

PocketBun app cron scheduling uses Bun's native `Bun.cron(...)` scheduler and interprets cron expressions in UTC.

- the `$app.cron().setInterval(...)` and `$app.cron().setTimezone(...)` APIs are not available in PocketBun
- programmatic cron setup is expression-based; pass the cron string directly to `cronAdd(...)` or `add(...)`
- cron expression validation follows Bun's parser, so PocketBun accepts a wider grammar than PocketBase, including named months/weekdays and Sunday as `7`
- the Admin UI cron management pages do not rely on per-job timezone settings and assume UTC for built-in backup scheduling
- if your hook code calls `setInterval(...)` or `setTimezone(...)`, remove those calls; in-process cron expressions are interpreted in UTC regardless of the server's local timezone

### Thumbnails

PocketBun uses Bun's built-in `Bun.Image` for image resizing. Output bytes may differ from the PocketBase Go image stack.

- Newly generated thumbnails are intentionally stored as WebP (`Content-Type: image/webp`) for every supported source image format.
- PocketBase preserves some source formats and falls back to PNG for WebP; PocketBun does not preserve that output-format parity.
- `WxH`, `WxHt`, and `WxHb` thumbnails follow `Bun.Image` exact-size resize behavior instead of PocketBase's center/top/bottom crop positioning.
- Thumbnail file keys still follow PocketBase naming, so rely on `Content-Type` instead of the thumb key extension.

### Templates

PocketBun `$template` helper supports common PocketBase template patterns.

For closer Go `text/template` parity, install optional `go-text-template`.

### Server-Side JavaScript `$filepath`

PocketBun exposes the same `$filepath` method names as PocketBase, but it does not fully match Go `path/filepath` edge cases.

- `glob(...)` and `match(...)` are backed by Bun's glob engine. Common PocketBase patterns work, and PocketBun also supports Bun-specific patterns such as `**` even though they are outside Go's documented `filepath.Match` syntax.
- `walk(...)` and `walkDir(...)` behave like real filesystem traversals and keep lexical depth-first ordering, but the surrounding path helpers follow Bun/Node path semantics in some edge cases.
- `base(...)`, `split(...)`, `splitList(...)`, `join(...)`, and `rel(...)` have edge-case differences because they follow Bun/Node path helper behavior.
- In particular, `splitList(...)` is not Go-compatible; it splits on the path separator instead of the OS path-list separator.
- Examples of edge-case differences:
  - `base("")` and `base("/")` differ from Go `filepath.Base(...)`
  - `split("foo")` yields `[".", "foo"]` instead of `["", "foo"]`
  - `join()` yields `"."` instead of `""`
  - `rel(path, path)` may yield `""` instead of `"."`

### Server-Side JavaScript RequestEvent Request/Response Surface

For custom routes, `e` below means the route event parameter passed to `routerAdd(..., (e) => { ... })`.

PocketBun supports the common PocketBase custom-route access patterns:

- `e.response.header().set(...)`
- `e.request.pathValue(...)` and `e.request.setPathValue(...)`
- `e.request.url.path`
- `e.request.url.query().get(...)`
- `e.request.header.get(...)`

Incompatibilities in this area:

- Go `http.Request` form helpers are not implemented on `e.request` (`formFile`, `parseForm`, `parseMultipartForm`, `formValue`, `postFormValue`).
  - use `e.findUploadedFiles(...)`, `e.bindBody(...)`, or `e.requestInfo().body` instead.
- Go `http.ResponseWriter` write primitives are not implemented (`e.response.write(...)`, `e.response.writeHeader(...)`).
  - use route event helpers (`e.json`, `e.string`, `e.html`, `e.xml`, `e.blob`, `e.noContent`, `e.redirect`).

### SQL placeholders and dbx rewriting

PocketBun supports dbx-style query marker rewriting for SQLite helpers.
Logged placeholder formats can differ while query behavior is compatible.

### Dev SQL logging format

In `--dev` mode, PocketBun prints SQL logs using a Bun-native format based on
the executed rewritten SQL (`[X.XXms] <sql>`). The exact formatting may differ
from PocketBase and is informational only.

### Windows behavior

- `HooksWatch` restart behavior has no effect on Windows.
- filesystem/process timing can differ from Unix-like systems.

## PocketBase Docs Topics That Do Not Apply Directly

These upstream topics are either intentionally excluded or need reinterpretation for PocketBun:

- all `go-*` extension docs pages (PocketBun is JS/TS extension-first)
- binary self-update workflow for PocketBase executable
- built-in `serve [domain]` automatic HTTPS instructions; use a reverse proxy for TLS termination instead
- operational assumptions tied to standalone Go binary path semantics
- some upstream docs response examples may use slightly different sample keys than runtime output (for example health sample `status` vs runtime `code`)

These are not bugs in PocketBun docs; they are product-level differences.

## Intentional Omissions

Intentionally not provided in PocketBun:

- PocketBase binary self-update command/plugin workflow
- Go extension workflow as first-class user path

Deferred until demand:

- Dart SDK-specific docs
