# PocketBun

[![CI](https://github.com/pekeler/pocketbun/actions/workflows/ci.yml/badge.svg)](https://github.com/pekeler/pocketbun/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/pekeler/pocketbun?display_name=tag&sort=semver&color=brightgreen)](https://github.com/pekeler/pocketbun/releases/latest)

PocketBun is a port of [PocketBase](https://pocketbase.io) to Bun.

> PocketBase is an open source Go backend that includes:
> 
> - embedded database (_SQLite_) with **realtime subscriptions**
> - built-in **files and users management**
> - convenient **Admin dashboard UI**
> - and simple **REST-ish API**

PocketBase © 2022–present Gani Georgiev. [Project on GitHub](https://github.com/pocketbase/pocketbase).

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

## Docs

[PocketBun docs](https://pekeler.github.io/pocketbun/)

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

PocketBun aims to stay in the same performance range as PocketBase. Exact comparisons are noisy because Go (`1.26.0`) and Bun (`1.3.10`) are different runtimes.

Benchmark setup:

- host: Hetzner CCX13 (2 dedicated vCPU, 8 GB RAM)
- versions: PocketBase `v0.36.5`, PocketBun `0.36.5-pocketbun.2`
- method: 5 full runs per system, then mean values per scenario

Results (PocketBun relative to PocketBase):

- scenario range: **6.1x faster to 3.0x slower**
- geometric mean: **1.6x faster**
- aggregate mean benchmark time (sum of mean `Completed` across scenarios): **10m 2s** vs **21m 41s**

In this benchmark batch, PocketBun was generally faster on read-heavy/filter-heavy workloads, slower on create-heavy write workloads, and mostly in the same range elsewhere.

The benchmark suite itself has [known fluctuations](https://github.com/pocketbase/benchmarks/issues/8), so treat these numbers as directional rather than absolute.

Local memory spot-check on 2026-03-17 (M2 Max macOS) via `bun scripts/compare_memory_local.ts`:

- full-server idle RSS after warmup: PocketBase `53.3 MiB`, PocketBun `172.5 MiB`
- 10s authenticated list load peak: PocketBase `481.9 MiB`, PocketBun `283.3 MiB`
- upload peak delta above idle: PocketBase `85-86 MiB`, PocketBun `23-27 MiB` for `64/256/512 MiB` files on this host

Treat the memory numbers as local spot-checks, not universal results.

## Tests

PocketBun keeps upstream test coverage close to PocketBase and adds around 20% additional PocketBun-specific tests.

Only 2 tests didn't get ported. They are for PocketBase’s self-update command/plugin which doesn't exist in PocketBun.

All tests are passing.

## Differences

The full differences list is documented [here](https://pekeler.github.io/pocketbun/differences.html), including:

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

---
![Jeans with logos.](docs/jeans.webp)
