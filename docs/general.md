---
layout: default
title: PocketBun General Guide
---

# PocketBun General Guide

This page is the primary guide for both:

- users starting from scratch, and
- users migrating from PocketBase.

If you want endpoint/reference details, also see [API Reference](./api-reference.md).

## New to PocketBun

### Installation

- Add to an existing project:
  - `bun add pocketbun`
- Create a new app from template:
  - `bun create pocketbun my-app`

### First App

Create `server.ts`:

```ts
import { BaseApp, serveAsync } from "pocketbun";

const app = new BaseApp({ dataDir: "pb_data" });
await serveAsync(app, { httpAddr: "127.0.0.1:8090" });
```

Run:

```sh
bun run server.ts
```

Then open:

- Admin UI: `http://127.0.0.1:8090/_/`
- Health API: `http://127.0.0.1:8090/api/health`

### Project Defaults

PocketBun follows PocketBase route conventions:

- API base: `/api/`
- Admin UI: `/_/`
- Public dir (if present): `pb_public/` served at `/`

Default app directories (from current working directory):

- `pb_data/`
- `pb_hooks/`
- `pb_migrations/`

### Auth and API Basics

- PocketBun targets PocketBase-compatible API behavior (status codes, response shape, query semantics).
- Use PocketBase client patterns as baseline, then apply PocketBun-specific differences from this page.

### Deploying

- PocketBun is distributed as an npm/Bun package.
- Update with package manager workflows (`bun update pocketbun`), not an internal self-update command.

## Coming from PocketBase

### Migration Quickstart

- Keep your client/API usage patterns.
- Replace runtime and startup with PocketBun (`BaseApp`, `serveAsync`, Bun-based deployment).
- Review differences below before production rollout.

### Key Differences

- Runtime: Bun/TypeScript instead of Go runtime extensions.
- CLI binary: `pocketbun` (not `pocketbase`).
- No `update` command; use package manager updates.
- CLI defaults resolve from current working directory to avoid writing inside `node_modules`.

### Compatibility Notes

- PocketBun aims for API compatibility first.
- Some implementation details intentionally differ where Bun runtime semantics require it.
- For intentional differences, see README and release notes for the current version.

## Attribution

PocketBun is a separate project and adapts behavior and documentation direction from PocketBase.
PocketBase is by Gani Georgiev: <https://github.com/pocketbase/pocketbase>.
