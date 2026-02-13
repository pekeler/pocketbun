# Rebuild PocketBun Documentation Program (5 long pages, upstream-merged)

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries, Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.

PLANS.md exists in this repo at `.agents/PLANS.md`. This ExecPlan must be maintained in accordance with that file.

## Purpose / Big Picture

PocketBun docs are being reset from the previous 2-page shape to a 5-page structure that mirrors how users navigate upstream PocketBase docs, while still being PocketBun-first.

Target outcomes:

- four long pages adapted from upstream PocketBase docs sections:
- Introduction (+ child pages)
- Going to production
- Web APIs reference (`api-*` pages)
- Extend with JavaScript (`js-*` pages)
- one long PocketBun differences page
- one docs index page linking the five pages
- README updated to point to the docs index
- explicit audit outputs:
- missing PocketBun features that should be documented
- documented features that do not exist in PocketBun
- final newcomer-read pass with improvements

## Scope

In scope:

- Docs pages under `docs/`
- README docs links and “Differences” extraction
- Mapping and adaptation of upstream docs content from `pocketbase/site`
- Coverage/mismatch audits against PocketBun public APIs and runtime behavior

Out of scope:

- Go extension docs as a primary user page (we intentionally do not port this section)
- Dart SDK docs (deferred until explicit user demand)

## Progress

- [x] (2026-02-13 11:08Z) Restart docs program from scratch after failed spot-check QA.
- [x] Built deterministic upstream ingestion tool that discovers all required docs routes from `doc_links.js`.
- [x] Built deterministic source resolver that recursively includes route-level local imports (`./` and `../`) from `src/routes/(app)/docs`.
- [x] Built deterministic transformer that emits the 4 merged long pages from upstream source and section ordering.
- [x] Regenerated `docs/introduction.md`, `docs/going-to-production.md`, `docs/web-apis.md`, and `docs/extend-with-javascript.md` from tool output.
- [x] Verified docs index/differences wiring and README link paths remain correct with regenerated pages.
- [x] Ran automated parity checks against upstream key anchors and keywords for every merged section.
- [x] Performed manual QA spot checks (including `ulimit` and `app.rootCmd`) before declaring done.

## Surprises & Discoveries

- Observation: Upstream PocketBase docs source lives in `pocketbase/site`, not in `pocketbase/pocketbase`.
  Evidence: repository structure and upstream docs route files.

- Observation: Docs pages are authored as Svelte source under `src/routes/(app)/docs`.
  Evidence: upstream route tree and `doc_links.js` navigation lists.

- Observation: Top-level docs section structure is explicit in upstream `doc_links.js`.
  Evidence: exported lists: `introductionLinks`, `goingToProductionLinks`, `webApiLinks`, `jsLinks`, `goLinks`.

- Observation: Many docs routes are wrapper pages that delegate actual content to sibling components.
  Evidence: e.g. `/docs/api-health/+page.svelte` imports and renders `Health.svelte`.

- Observation: During this execution, direct GitHub API fetches were intermittent from the local shell environment.
  Evidence: repeated `error connecting to api.github.com`; used upstream route/link inventories and stable source mappings as fallback for deterministic section coverage.

- Observation: Initial merged JS/API docs were too high-level and missed concrete upstream details discovered via maintainer spot checks.
  Evidence: missing `js-database` `join()` coverage and incomplete `api-health` section content.

- Observation: Network-restricted sandbox execution prevented nested `gh api` calls from scripts unless escalated.
  Evidence: direct `gh api` commands worked with approved prefix, while shell/bun scripts failed until elevated network permission was granted for the sync script.

## Decision Log

- Decision: Supersede the previous 2-page docs architecture with a 5-page architecture requested by maintainer.
  Rationale: Better parity with upstream section model and clearer user navigation.
  Date/Author: 2026-02-13 / Codex

- Decision: Use upstream docs section/page inventory from `pocketbase/site` as source of truth before writing merged pages.
  Rationale: Prevent missing/duplicated sections and keep deterministic merge scope.
  Date/Author: 2026-02-13 / Codex

- Decision: Keep explicit attribution on each long page and cite upstream source sections.
  Rationale: Respectful reuse, traceability, and easier future updates.
  Date/Author: 2026-02-13 / Codex

- Decision: Exclude Go extension docs from user-facing merged docs pages, but track any references as mismatch/deviation notes.
  Rationale: PocketBun is Bun/TypeScript-first and does not expose Go extension path.
  Date/Author: 2026-02-13 / Codex

## Target Information Architecture

Planned docs pages:

- `docs/index.md` (docs index)
- `docs/introduction.md` (merged Introduction section)
- `docs/going-to-production.md` (merged production section)
- `docs/web-apis.md` (merged Web APIs section)
- `docs/extend-with-javascript.md` (merged JavaScript section)
- `docs/differences.md` (PocketBase vs PocketBun differences)

Each long page must include:

- top quick-links section using in-page anchor links
- clear PocketBun adaptation notes where behavior/operations differ
- attribution block at bottom

## Concrete Work Plan

1) Upstream inventory and mapping

- Parse upstream docs links and route files from `pocketbase/site`.
- Resolve which component files actually contain page content (not only wrappers).
- Build a maintainer-visible mapping table from upstream source -> target `docs/*.md` section anchors.

2) Page creation and migration

- Create/replace the 5 page targets.
- Merge upstream prose in section order.
- Adapt commands/examples to PocketBun package/CLI/runtime defaults.
- Remove or rewrite unsupported features.

3) README and discoverability

- Link README docs section to `docs/index.md`.
- Move detailed differences out of README to `docs/differences.md`.

4) Coverage and mismatch audits

- Public surface audit:
- check exported APIs and important user-visible commands/options
- verify each has docs coverage where user-relevant
- Mismatch audit:
- list docs claims that are not true in PocketBun
- keep explicit list in final report

5) Newcomer-read pass

- Read all five docs pages as a new PocketBun user.
- Improve sequence, terminology consistency, and first-run clarity.

## Validation and Acceptance

This plan is done when:

- the five target docs pages exist and are linked from `docs/index.md`
- each of the four upstream-derived pages has a top anchor quick-links block and bottom attribution
- README points users to docs index first
- differences are centralized in `docs/differences.md`
- missing-feature docs audit has been performed and gaps fixed
- docs-mismatch list is produced and shared
- newcomer-read improvements are applied

Validation checks:

    cd /Users/pekeler/Projects/pocketbun
    rg -n "docs/index.md|docs/introduction.md|docs/going-to-production.md|docs/web-apis.md|docs/extend-with-javascript.md|docs/differences.md" README.md docs
    bun run format

(Only docs/README changes are expected for this plan.)

## Idempotence and Recovery

- Docs edits are additive and safe to rerun.
- If a merge section is wrong, replace only that section and keep stable anchors.
- If upstream mapping changes, update mapping notes and the affected sections without blocking unrelated docs completion.

## Outcomes & Retrospective

This plan is currently in restart mode after QA failures. The previous attempt is treated as invalid, and completion claims are intentionally reset until the tool-driven ingestion/transformation flow is implemented and verified.

Plan change note: 2026-02-13, replaced prior two-page docs architecture plan with this 5-page upstream-merged docs plan, including required parity/mismatch audits and newcomer-read pass.
Plan change note: 2026-02-13, maintainer requested full reset after repeated spot-check failures; all completion tasks were unset and a deterministic tooling approach was mandated before further docs claims.
Plan change note: 2026-02-13, implemented a deterministic docs pipeline (`scripts/docs/sync_upstream_site_docs.sh`, `scripts/docs/rebuild_from_upstream.ts`, `scripts/docs/check_generated_docs.ts`) and regenerated the merged docs pages from cached upstream source.
