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

This snapshot is from the full vendored upstream benchmark suite on **February 6, 2026** (MacBook Pro `m2-max`):

- PocketBase run: `benchmarks/results/2026-02-06T21-08-38Z-pocketbase-upstream-m2-max.md`
- PocketBun run: `benchmarks/results/2026-02-06T21-19-34Z-pocketbun-upstream-m2-max.md`

Commands:

```sh
bun run bench:upstream
bun run bench:upstream:pocketbun
```

`bench:upstream` follows upstream run instructions by executing `go build` first, then running the built executable with `serve` (with a host-compatible fallback binary only for local execution when the upstream target cannot run on the current OS/arch).

Relative metric:

- Completion index (higher is better): `100 * (PocketBase completed_ms / PocketBun completed_ms)`
- Scenarios are comparable only when both sides report `Errors: 0`
- Parsed from the two raw result files above (`150` scenarios each, `148` overlapping names)

Overall summary:

- Comparable scenarios: `138`
- Overall completion index (geometric mean): `58.9`

Category summary (geometric mean over comparable scenarios):

| Category | Comparable scenarios | Scenarios with errors | Completion index |
| --- | ---: | ---: | ---: |
| `Creating organizations (100)` | `2 / 2` | `0` | `24.6` |
| `Creating permissions (50)` | `2 / 2` | `0` | `33.4` |
| `Creating users (500 - expected to be slow due to passwordHash generation)` | `2 / 2` | `0` | `12.2` |
| `Creating posts (10k, 25k, 50k, 100k)` | `2 / 8` | `6` | `24.6` |
| `User auth with password (expected to be slow due to passwordHash verification)` | `2 / 2` | `0` | `12.5` |
| `User auth refresh` | `2 / 2` | `0` | `70.4` |
| `List records` | `112 / 112` | `0` | `66.5` |
| `Go vs JS route execution` | `3 / 6` | `3` | `63.4` |
| `Go vs JS hooks execution` | `1 / 2` | `1` | `34.6` |
| `Deleting records` | `10 / 10` | `0` | `44.0` |

Error-mismatch notes from this run pair:

- Upstream PocketBase reported errors in 6 high-concurrency post-create scenarios (`posts25k`, `posts50k`, `posts100k`), while PocketBun reported `0` there.
- Upstream PocketBase reported `500/500` errors in all three `JS route` scenarios, while PocketBun reported `0`.
- PocketBun reported `100/100` errors in `JS OnRecordBeforeUpdateRequest hook handler`, while PocketBase reported `0`.

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
