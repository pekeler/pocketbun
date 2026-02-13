# PocketBun

[![CI](https://github.com/pekeler/pocketbun/actions/workflows/ci.yml/badge.svg)](https://github.com/pekeler/pocketbun/actions/workflows/ci.yml)

PocketBun is a port of [PocketBase](https://pocketbase.io) to Bun.

> PocketBase is an open source Go backend that includes:
> 
> - embedded database (_SQLite_) with **realtime subscriptions**
> - built-in **files and users management**
> - convenient **Admin dashboard UI**
> - and simple **REST-ish API**

PocketBase © 2022–present Gani Georgiev. [Project on GitHub](https://github.com/pocketbase/pocketbase).

## Docs

[PocketBun docs](https://pekeler.github.io/pocketbun/)

## Why?

PocketBase is an excellent, well-designed, self-hosted Backend-as-a-Service. You can extend it with Go and JavaScript, but the embedded JS engine has limited ES6/Node compatibility, making complex customizations difficult. Your project may end up with a second backend.

PocketBun is a semi-automated port to Bun that aims for maximum compatibility with PocketBase’s API and behavior. It's a version of PocketBase that feels more native to JS/TS developers.

Key differences:

- Built on Bun instead of Go
- No Go extensions (only JavaScript/TypeScript)
- Full ES6+ compatibility + native npm package support
- CLI binary is named `pocketbun` (not `pocketbase`)
- No `update` command; update via package manager

## Warning
PocketBase is still under active development and NOT recommended for production.

Naturally, the same applies to PocketBun.

## Installation

`bun add pocketbun` to add to an existing project, or `bun create pocketbun my-app` to create a new project.

## Quick Start

Create a small server script (for example `server.ts`):

```ts
import { BaseApp, serveAsync } from "pocketbun";

const app = new BaseApp({ dataDir: "pb_data" });
await serveAsync(app, { httpAddr: "127.0.0.1:8090" });
```

Run it:

```sh
bun run server.ts
```

Then visit `http://127.0.0.1:8090/_/` for the Admin UI and `http://127.0.0.1:8090/api/health` for a basic API response.

## Examples

- `examples/simple` — minimal server start
- `examples/advanced` — hooks, migrations, auth, CRUD, files, realtime, and custom routes

## Performance

PocketBase is fast for many use cases. PocketBun has been optimized to perform in the same ballpark, but Go (1.25.7) and Bun (1.3.9) are different runtimes, so differences exist.

Depending on the benchmark scenario, **PocketBun is 5.5× faster to 3.1× slower** than PocketBase, with a geometric mean of **1.6× faster**.

Precise comparisons are difficult due to [fluctuating results](https://github.com/pocketbase/benchmarks/issues/8) in the benchmarking suite. PocketBase’s benchmark suite has been run on a Hetzner CCX13 (2 dedicated vCPU, 8 GB RAM) three times for each system and calculated the numbers above from the mean times of those runs.

## Tests

PocketBun keeps upstream test coverage close to PocketBase and adds a small set of PocketBun-specific tests.

Only 2 tests didn't get ported. They are for PocketBase’s self-update command/plugin which doesn't exist in PocketBun.

All tests are passing.

## Differences

The full differences list is documented [here](https://pekeler.github.io/pocketbun/users/differences.html), including:

- runtime/distribution differences
- CLI defaults/path resolution differences
- async API extensions
- operational differences (thumbnails, logs, templates, SQL helpers)
- intentionally unsupported upstream topics

## Development Setup

If you want to contribute after cloning from GitHub:

```sh
bun install
bun run upstream:sync
bun run format:fix
bun test --concurrent
bun run typecheck
bun run lint
```

Optional quick smoke test:

```sh
cd examples/simple
bun install
bun run start
```
