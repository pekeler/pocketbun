---
layout: default
title: Upstream Docs Map
---

# Upstream Docs Map (Maintainers)

This document maps PocketBun docs topics to upstream PocketBase docs sources.
Use it during release/upgrade review to detect drift and decide what to port or summarize.

## Upstream Source Facts

- Upstream docs repo: <https://github.com/pocketbase/site>
- Main docs source path: `src/routes/(app)/docs`
- Docs format: mostly handwritten `.svelte` pages and helper `.js` files
- Generated exception: JSVM reference docs generated via `typedoc` (`npm run jstypes` -> `static/jsvm`)
- License: upstream site repo includes MIT `LICENSE.md`; no separate docs-only license override found

## Generated Docs Workflow

Use the deterministic docs pipeline:

1. `bash scripts/docs/sync_upstream_site_docs.sh`
2. `bun run docs:rebuild`
3. `bun run docs:patch`
4. `bun run docs:check`

Notes:

- `sync_upstream_site_docs.sh` caches both docs source files and upstream screenshots under:
  - `.cache/upstream-site-docs/*`
  - `.cache/upstream-site-docs/static/images/screenshots/*`
- `rebuild_from_upstream.ts` copies screenshot assets into:
  - `docs/assets/upstream/screenshots/*`
- Generated docs image links are rewritten to local paths:
  - `./assets/upstream/screenshots/<file>`
- `scripts/docs/check_generated_docs.ts` verifies local screenshot links resolve to existing files and fails on upstream screenshot hotlinks.

## Mapping Table

| PocketBun doc area | PocketBun file | Upstream source starting point |
| --- | --- | --- |
| Docs landing | `docs/index.md` | `src/routes/(app)/docs/+page.svelte` |
| Introduction (merged) | `docs/introduction.md` | intro links in `src/routes/(app)/docs/doc_links.js` (`/docs`, `/docs/how-to-use`, `/docs/collections`, `/docs/api-rules-and-filters`, `/docs/authentication`, `/docs/files-handling`, `/docs/working-with-relations`, `/docs/use-as-framework`) |
| Going to production | `docs/going-to-production.md` | `/docs/going-to-production` |
| Web APIs reference (merged) | `docs/web-apis.md` | `webApiLinks` in `src/routes/(app)/docs/doc_links.js` and `src/routes/(app)/docs/api-*` |
| Extend PocketBun (merged) | `docs/extend.md` | `jsLinks` in `src/routes/(app)/docs/doc_links.js` and `src/routes/(app)/docs/js-*` |
| Extend PocketBun reference | `docs/reference.md` | `src/plugins/jsvm/internal/types/generated/types.d.ts` (PocketBun) and upstream JSVM/TypeDoc model (`jsvm/types.d.ts` -> `static/jsvm`) |
| PocketBun differences | `docs/differences.md` | PocketBun-specific behavior + README differences + selective upstream contrast |

## Release-Time Checklist

1. Sync upstream (`bun run upstream:sync`) and confirm target PocketBase tag.
2. Review changes in `pocketbase/site` docs tree (`src/routes/(app)/docs`).
3. Update PocketBun docs pages for user-relevant changes.
4. Keep attribution clear where upstream handwritten prose is adapted.
5. Keep intentional differences documented in `docs/differences.md` (and summarize in README).
