# PocketBun

[![CI](https://github.com/pekeler/pocketbun/actions/workflows/ci.yml/badge.svg)](https://github.com/pekeler/pocketbun/actions/workflows/ci.yml)

An attempt to port **PocketBase** to JavaScript/TypeScript using Bun. **_Work in progress._**

> [PocketBase](https://pocketbase.io) is an open source Go backend that includes:
> 
> - embedded database (_SQLite_) with **realtime subscriptions**
> - built-in **files and users management**
> - convenient **Admin dashboard UI**
> - and simple **REST-ish API**
> 
> **For documentation and examples, please visit https://pocketbase.io/docs.**

PocketBase © 2022–present Gani Georgiev. [Project on GitHub](https://github.com/pocketbase/pocketbase).

## Why?

PocketBase is an excellent, well-designed, self-hosted Backend-as-a-Service. You can extend it with Go and JavaScript, but the embedded JS engine has limited ES6/Node compatibility, making complex customizations difficult. Your project may end up with a second backend.

PocketBun is a semi-automated port to Bun that aims for maximum compatibility with PocketBase’s API and behavior. It's a version of PocketBase that feels more native to JS/TS developers.

Key differences:

- No Go extensions (only JavaScript/TypeScript)
- Library-first API (CLI is optional and wraps the same APIs)
- Full ES6+ compatibility + native npm package support
- Built on Bun instead of Go + embedded JS VM
- CLI binary is named `pocketbun` (not `pocketbase`)
- No `update` command; update via your package manager (bun/npm/pnpm)

## Installation

todo

## Quick Start

Create a small server script (for example `server.ts`):

```ts
import { BaseApp, serve } from "pocketbun";

const app = new BaseApp({ dataDir: "pb_data" });
app.bootstrap();

serve(app, { httpAddr: "127.0.0.1:8090" });
```

Run it:

```sh
bun run server.ts
```

Then visit `http://127.0.0.1:8090/_/` for the Admin UI and `http://127.0.0.1:8090/api/health` for a basic API response. See `examples/simple` for a minimal runnable project.

## Examples

- `examples/simple` — minimal server start
- `examples/advanced` — hooks, migrations, auth, CRUD, files, realtime, and custom routes

## Performance Snapshot (Upstream Benchmarks)

This snapshot is from the full vendored upstream benchmark suite on **February 7, 2026** (MacBook Pro `m2-max`):

- PocketBase run (best-of baseline): `benchmarks/results/best-of-pocketbase-upstream-m2-max.md`
- PocketBun run: `benchmarks/results/2026-02-07T14-21-25Z-pocketbun-upstream-m2-max.md`

Commands:

```sh
bun run bench:upstream
bun run bench:upstream:pocketbun
```

`bench:upstream` follows upstream run instructions by executing `go build` first, then running the built executable with `serve` (with a host-compatible fallback binary only for local execution when the upstream target cannot run on the current OS/arch).

Metric used:

- Reported as plain language: `X% faster` or `X% slower` based on `Completed` time
- Example: PocketBase `100ms` vs PocketBun `80ms` => PocketBun is `20% faster`
- Example: PocketBase `100ms` vs PocketBun `120ms` => PocketBun is `20% slower`
- `best-of-pocketbase-upstream-m2-max.md` is a synthetic baseline built from local `*-pocketbase-upstream-m2-max.md` snapshots by taking the lowest zero-error `Completed` value per scenario.
- Scenarios are comparable only when both sides report `Errors: 0`
- Parsed from the two raw result files above (`148` overlapping scenario names)

Overall summary:

- All benchmark scenarios ran with `Errors: 0` in both PocketBase and PocketBun results.
- Overall result (geometric mean): PocketBun is `43.9% slower`
- Equivalent time ratio (geometric mean): PocketBun takes `1.44x` PocketBase time

Category summary (geometric mean over comparable scenarios):

| Category | PocketBun vs PocketBase |
| --- | ---: |
| `Creating organizations (100)` | `257.6% slower` |
| `Creating permissions (50)` | `151.2% slower` |
| `Creating users (500 - expected to be slow due to passwordHash generation)` | `49.0% faster` |
| `Creating posts (10k, 25k, 50k, 100k)` | `83.8% slower` |
| `User auth with password (expected to be slow due to passwordHash verification)` | `0.5% faster` |
| `User auth refresh` | `52.1% slower` |
| `List records` | `40.6% slower` |
| `route execution (PocketBase Go)` | `64.5% slower` |
| `route execution (PocketBase JS)` | `77.5% slower` |
| `hooks execution (PocketBase Go)` | `21.5% faster` |
| `hooks execution (PocketBase JS)` | `68.1% faster` |
| `Deleting records` | `68.1% slower` |

## Known Differences

### Library Usage (API-first)

PocketBun ships as a library and also provides a CLI wrapper. Use the library exports to run migrations, start the server, and manage superusers:

```ts
import { BaseApp, migrate, serve, superuser } from "pocketbun";

const app = new BaseApp({ dataDir: "pb_data" });

migrate(app);
serve(app, { httpAddr: "127.0.0.1:8090" });

superuser.upsert(app, "admin@example.com", "change-me");
```

CLI usage (PocketBase-style):

```sh
pocketbun serve
pocketbun superuser upsert admin@example.com change-me
```

### CLI Updates

PocketBun does not ship the PocketBase `update` command. Because PocketBun is distributed as a package, update it via your package manager instead (for example `bun add -g pocketbun@latest`, `npm i -g pocketbun@latest`, or `pnpm add -g pocketbun@latest`).

### Activity Logs

PocketBun persists activity logs via a background worker to avoid blocking Bun’s main thread. We also skip wrapping each log batch in an explicit transaction because it didn’t improve throughput in Bun; logs are still inserted one-by-one like PocketBase.

### Thumbnails

PocketBun uses Sharp for image resizing. Output bytes may differ from PocketBase’s Go imaging stack, and BMP thumbnails are emitted as PNG because Sharp doesn’t write BMP.

### Templates ($template)

PocketBun exposes the same `$template` helper for JS/TS hooks/migrations. By default it handles a small, common subset of Go-style templates. If you want closer Go `text/template` compatibility, install the optional `go-text-template` package and `$template` will use it automatically. HTML escaping is basic; use the `raw` helper when you need unescaped output. If you want full control or a different syntax, use any JS templating library.

Example using a JS/TS-native templating engine in hooks:

```ts
import Handlebars from "handlebars";

const source = await Bun.file("email.html").text();
const tpl = Handlebars.compile(source);
const html = tpl({ name: "Ada" });
```

Example enabling Go-style template syntax:

```sh
bun add go-text-template
```

```ts
const tpl = $template.load("templates/welcome.html");
const html = tpl.render({ Name: "Ada" });
```

### DBX Helpers

PocketBun exposes dbx-style SQL placeholder helpers from the package entrypoint so external callers can keep using `[[column]]` and `{{table}}` syntax.

```ts
import { DbxDatabase, attachDbxRewrite, rewriteDbxIdentifiers } from "pocketbun";
import { Database } from "bun:sqlite";

const db = new DbxDatabase("pb_data/data.db");
db.query("select [[id]] from {{users}}").all();

const externalDb = new Database(":memory:");
attachDbxRewrite(externalDb);
externalDb.query("select [[id]] from {{users}}").all();

const sql = rewriteDbxIdentifiers("select [[name]] from {{users}}");
```

### SQL Placeholder Indices

When a filter expression collapses to a literal (for example, comparing to an empty string), PocketBun drops any now-unused params. This can make `{:p0}`, `{:p1}`, … numbering differ from PocketBase if you log SQL and params. The behavior is the same; only the placeholder indices change.

Example:

PocketBun will inline the empty string:

```
[[title]] = '' OR [[title]] IS NULL
```

PocketBase may still keep an unused placeholder param:

```
[[title]] = {:p0} OR [[title]] IS NULL
```
