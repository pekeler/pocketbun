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
| Introduction (merged) | `docs/introduction.md` | intro links in `src/routes/(app)/docs/doc_links.js` (`/docs`, `/docs/how-to-use`, `/docs/collections`, `/docs/api-rules-and-filters`, `/docs/authentication`, `/docs/files-handling`, `/docs/working-with-relations`, `/docs/use-as-framework`) |
| Going to production | `docs/going-to-production.md` | `/docs/going-to-production` |
| Web APIs reference (merged) | `docs/web-apis.md` | `webApiLinks` in `src/routes/(app)/docs/doc_links.js` and `src/routes/(app)/docs/api-*` |
| Extend with JavaScript (merged) | `docs/extend-with-javascript.md` | `jsLinks` in `src/routes/(app)/docs/doc_links.js` and `src/routes/(app)/docs/js-*` |
| PocketBun differences | `docs/differences.md` | PocketBun-specific behavior + README differences + selective upstream contrast |

## Release-Time Checklist

1. Sync upstream (`bun run upstream:sync`) and confirm target PocketBase tag.
2. Review changes in `pocketbase/site` docs tree (`src/routes/(app)/docs`).
3. Update PocketBun docs pages for user-relevant changes.
4. Keep attribution clear where upstream handwritten prose is adapted.
5. Keep intentional differences documented in `docs/differences.md` (and summarize in README).
