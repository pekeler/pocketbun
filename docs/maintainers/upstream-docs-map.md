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
- Pinned site ref: `pocketbase_site_ref.txt`
- License: upstream site repo includes MIT `LICENSE.md`; no separate docs-only license override found

## Generated Docs Workflow

Use the deterministic docs pipeline:

1. `bash scripts/docs/sync_upstream_site_docs.sh`
2. `bun run docs:rebuild`
3. `bun run docs:patch`
4. `bun run docs:check`

PocketBun-specific guidance is layered on top of the generated docs via heading-based overlay fragments under `scripts/docs/overlays/`. These overlays intentionally own the higher-divergence sections instead of relying on exact upstream sentence matches.

Notes:

- `sync_upstream_site_docs.sh` caches both docs source files and upstream screenshots under:
  - `.cache/upstream-site-docs/*`
  - `.cache/upstream-site-docs/static/images/screenshots/*`
- `sync_upstream_site_docs.sh` reads the upstream site ref from `pocketbase_site_ref.txt`; bump that file intentionally when you want a newer docs snapshot.
- `rebuild_from_upstream.ts` copies screenshot assets into:
  - `docs/assets/upstream/screenshots/*`
- Generated docs image links are rewritten to local paths:
  - `./assets/upstream/screenshots/<file>` (published from root via per-page permalinks)
- `scripts/docs/check_generated_docs.ts` verifies local screenshot links resolve to existing files and fails on upstream screenshot hotlinks.
- `scripts/docs/check_generated_docs.ts` also verifies required PocketBun-only guidance is still present (for example `.pb.ts` hooks, async helpers, JSVM naming aliases, and the package-manager update model).
- If an upstream prose change invalidates an overlay anchor, fix the overlay operation or the generator so the rebuild stays deterministic; do not hand-edit the generated user docs as the primary fix.

## Mapping Table

| PocketBun doc area | PocketBun file | Upstream source starting point |
| --- | --- | --- |
| Docs landing | `docs/users/index.md` | `src/routes/(app)/docs/+page.svelte` |
| Introduction (merged) | `docs/users/introduction.md` | intro links in `src/routes/(app)/docs/doc_links.js` (`/docs`, `/docs/how-to-use`, `/docs/collections`, `/docs/api-rules-and-filters`, `/docs/authentication`, `/docs/files-handling`, `/docs/working-with-relations`, `/docs/use-as-framework`) |
| Going to production | `docs/users/going-to-production.md` | `/docs/going-to-production` |
| Web APIs reference (merged) | `docs/users/web-apis.md` | `webApiLinks` in `src/routes/(app)/docs/doc_links.js` and `src/routes/(app)/docs/api-*` |
| Extend PocketBun (merged) | `docs/users/extend.md` | `jsLinks` in `src/routes/(app)/docs/doc_links.js` and `src/routes/(app)/docs/js-*` |
| Extend PocketBun reference | `docs/users/reference.md` | `src/plugins/jsvm/internal/types/generated/types.d.ts` (PocketBun) and upstream JSVM/TypeDoc model (`jsvm/types.d.ts` -> `static/jsvm`) |
| PocketBun differences | `docs/users/differences.md` | PocketBun-specific behavior + README differences + selective upstream contrast |

## Release-Time Checklist

1. Sync upstream (`bun run upstream:sync`) and confirm target PocketBase tag.
2. Review changes in `pocketbase/site` docs tree (`src/routes/(app)/docs`) for the ref pinned in `pocketbase_site_ref.txt`.
3. Bump `pocketbase_site_ref.txt` only when you intentionally want a newer upstream site snapshot.
4. Run `bun run docs:rebuild:full` and inspect the generated diff.
5. If PocketBun-only guidance moved or disappeared, update the heading-based overlays in `scripts/docs/overlays/` and/or the overlay operations in `scripts/docs/apply_pocketbun_patches.ts`.
6. Keep the required-content checks in `scripts/docs/check_generated_docs.ts` aligned with the overlay-owned guidance so regressions fail fast.
7. Keep attribution clear where upstream handwritten prose is adapted.
8. Keep intentional differences documented in `docs/users/differences.md` (and summarize in README).
