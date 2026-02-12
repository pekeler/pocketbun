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

## Mapping Table

| PocketBun doc area | PocketBun file | Upstream source starting point |
| --- | --- | --- |
| Docs landing | `docs/index.md` | `src/routes/(app)/docs/+page.svelte` |
| General guide | `docs/general.md` | `src/routes/(app)/docs/*` topic pages |
| API reference | `docs/api-reference.md` | `src/routes/(app)/docs/api-*` pages |
| Migration/differences | `docs/general.md` + README | upstream docs + PocketBun-specific behavior/tests |

## Release-Time Checklist

1. Sync upstream (`bun run upstream:sync`) and confirm target PocketBase tag.
2. Review changes in `pocketbase/site` docs tree (`src/routes/(app)/docs`).
3. Update PocketBun docs pages for user-relevant changes.
4. Keep attribution clear where upstream handwritten prose is adapted.
5. Keep intentional differences documented in README/docs.
