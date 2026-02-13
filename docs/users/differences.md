---
layout: default
title: PocketBun Differences From PocketBase
permalink: /differences.html
---

# PocketBun Differences From PocketBase

This page tracks user-relevant differences between PocketBase and PocketBun.

Quick links:

- [Runtime And Distribution](#runtime-and-distribution)
- [CLI Defaults And Paths](#cli-defaults-and-paths)
- [Hooks Plugin Naming](#hooks-plugin-naming)
- [Async API Extensions](#async-api-extensions)
- [Operational Differences](#operational-differences)
- [PocketBase Docs Topics That Do Not Apply Directly](#pocketbase-docs-topics-that-do-not-apply-directly)
- [Intentional Omissions](#intentional-omissions)

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

## Hooks Plugin Naming

PocketBase JS extension naming uses `jsvm` package naming.
PocketBun keeps compatibility aliases and adds clearer names:

- compatibility: `RegisterJSVM*`, `MustRegisterJSVM*`
- preferred in PocketBun docs/code: `RegisterHooksPlugin*`, `MustRegisterHooksPlugin*`

Both names map to the same plugin registration behavior.

## Async API Extensions

PocketBun keeps sync-compatible APIs but adds async alternatives for I/O-heavy paths.

| Area | PocketBase-compatible sync API | PocketBun async extension |
| --- | --- | --- |
| Archive helpers | `Create`, `Extract` | `CreateAsync`, `ExtractAsync` |
| App bootstrap/serve | `app.bootstrap()`, `serve(...)` | `app.bootstrapAsync()`, `serveAsync(...)` |
| Migration helper | `migrate(...)` | `migrateAsync(...)` |
| Hooks plugin register | `RegisterHooksPlugin(...)` | `RegisterHooksPluginAsync(...)` |
| Filesystem factories | `NewFilesystem()` | `NewFilesystemAsync()` |
| JSVM helpers | `$http.send(...)`, `$os.readFile(...)` | `$http.sendAsync(...)`, `$os.readFileAsync(...)` |

## Operational Differences

### Activity logs

PocketBun persists activity logs through a background worker to reduce main-thread blocking.

### Thumbnails

PocketBun uses Sharp for image resizing. Output bytes may differ from PocketBase Go image stack.

- BMP thumbnails are emitted as PNG (Sharp limitation).

### Templates

PocketBun `$template` helper supports common PocketBase template patterns.

For closer Go `text/template` parity, install optional `go-text-template`.

### SQL placeholders and dbx rewriting

PocketBun supports dbx-style query marker rewriting for SQLite helpers.
Logged placeholder formats can differ while query behavior remains compatible.

### Windows behavior

- `HooksWatch` restart behavior has no effect on Windows.
- filesystem/process timing can differ from Unix-like systems.

## PocketBase Docs Topics That Do Not Apply Directly

These upstream topics are either intentionally excluded or need reinterpretation for PocketBun:

- all `go-*` extension docs pages (PocketBun is JS/TS extension-first)
- binary self-update workflow for PocketBase executable
- operational assumptions tied to standalone Go binary path semantics
- some upstream docs response examples may use slightly different sample keys than runtime output (for example health sample `status` vs runtime `code`)

These are not bugs in PocketBun docs; they are product-level differences.

## Intentional Omissions

Intentionally not provided in PocketBun:

- PocketBase binary self-update command/plugin workflow
- Go extension workflow as first-class user path

Deferred until demand:

- Dart SDK-specific docs
