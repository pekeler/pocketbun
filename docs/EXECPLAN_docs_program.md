# Build PocketBun Documentation Program (GitHub-hosted, two-page format)

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries, Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.

PLANS.md exists in this repo at `.agents/PLANS.md`. This ExecPlan must be maintained in accordance with that file.

## Purpose / Big Picture

PocketBun currently points users to PocketBase docs plus a “known differences” section. That works for experts but it is not enough for two important audiences: newcomers who need a PocketBun-first learning path, and existing PocketBase users who want a concise migration/differences guide.

After this plan is implemented, users should be able to open one PocketBun docs entrypoint on GitHub and have complete docs in two long pages:

- one general guide page (new user flow + PocketBase migration sections),
- one API reference page.

The docs should live in this repository, require no custom domain, and be easy to update alongside releases.

## Progress

- [x] (2026-02-12 16:35Z) Confirmed the upstream docs source repo is `https://github.com/pocketbase/site` (not `pocketbase/pocketbase`).
- [x] (2026-02-12 16:37Z) Confirmed the docs source path is `src/routes/(app)/docs` in `pocketbase/site`.
- [x] (2026-02-12 16:38Z) Confirmed upstream docs are SvelteKit pages/components (`+page.svelte` plus helper components) and not plain Markdown.
- [x] (2026-02-12 16:39Z) Captured scope snapshot: 50 docs route pages (`.../+page.svelte`), 109 Svelte files, and 4 JS helper files under the upstream docs tree.
- [x] (2026-02-12 17:05Z) Confirmed docs generation model: handwritten docs are in Svelte source files; only JSVM API reference assets are generated (Typedoc via `npm run jstypes` -> `static/jsvm`).
- [x] (2026-02-12 17:08Z) Confirmed upstream license posture: `pocketbase/site` is MIT-licensed; no separate docs-only license file found; bundled third-party JS assets include their own bundled notices.
- [x] (2026-02-12 16:48Z) Created this dedicated documentation ExecPlan.
- [ ] Align this docs plan with maintainer direction and freeze two-page information architecture.
- [ ] Implement the long general docs page (new users + PocketBase migration/differences in one page).
- [ ] Implement the long API reference page (PocketBun-focused, using upstream references where needed).
- [ ] Add a lightweight upstream docs sync/reference process so future PocketBase docs changes are easy to review.
- [ ] Update README/docs links so PocketBun users start from PocketBun docs, not from an external docs-first workflow.
- [ ] Keep Dart SDK coverage intentionally out of scope for this milestone unless explicitly requested by users.

## Surprises & Discoveries

- Observation: The canonical PocketBase docs source is not in the main PocketBase runtime repo.
  Evidence: `.upstream/pocketbase` has no docs source directory; `README.md` points to pocketbase.io docs; `gh api users/pocketbase/repos` lists a separate `site` repo.

- Observation: Upstream docs content is authored as Svelte pages/components rather than Markdown.
  Evidence: `pocketbase/site` docs live under `src/routes/(app)/docs/**` with many `+page.svelte` files and supporting Svelte components (`DocsSidebar.svelte`, `CodeBlock`, endpoint partial components).

- Observation: Upstream docs are not generally auto-generated from comments/markdown; they are mostly handwritten Svelte pages.
  Evidence: docs content source is `src/routes/(app)/docs/**` with handwritten `.svelte` pages and helper `.js` files; repo build config does not include markdown-doc generation tooling.

- Observation: There is one generated-docs exception in upstream docs.
  Evidence: `package.json` has `jstypes` (`typedoc --options ./jsvm/typedoc.json`) and generated JSVM docs live under `static/jsvm`.

- Observation: Direct “copy and tweak” reuse of upstream docs is possible but would pull in a full SvelteKit docs stack.
  Evidence: `pocketbase/site/package.json` build uses `vite build` plus `pagefind`, and docs pages use site-specific components and JS helpers.

- Observation: PocketBun already has partial docs material in-repo that should be integrated into a proper docs structure.
  Evidence: Existing docs files include `docs/UPGRADING.md` and `docs/experience.md`, while user-facing README sections still carry many guidance details.

- Observation: Upstream site repo has a single top-level MIT license file, with no separate docs subtree license override.
  Evidence: only `LICENSE.md` found as license file in repo tree; no `docs/*` license override file detected.

- Observation: Bundled docs assets may carry third-party notices that still need respectful attribution when content/assets are reused.
  Evidence: bundled license notices appear in assets like `static/pagefind/pagefind-highlight.js` and `static/jsvm/assets/main.js`.

## Decision Log

- Decision: Use a docs program native to this repository (GitHub-hosted) instead of relying on an external domain or telling users to start elsewhere.
  Rationale: The explicit product goal is a PocketBun-first docs experience with low operational overhead and no custom domain investment.
  Date/Author: 2026-02-12 / Codex

- Decision: Start with Markdown-first docs in this repo and treat “GitHub Pages rendering” as a deployment layer, not as the content source of truth.
  Rationale: Markdown in-repo is low friction for contributors, easy to review in PRs, and does not force immediate adoption of the upstream Svelte docs toolchain.
  Date/Author: 2026-02-12 / Codex

- Decision: Do not fork/clone the entire upstream `pocketbase/site` implementation as the first step.
  Rationale: The upstream docs stack is tightly coupled to Svelte components and site tooling; a full fork increases maintenance cost before we establish PocketBun-specific IA and audience tracks.
  Date/Author: 2026-02-12 / Codex

- Decision: Treat upstream docs as largely handwritten source content (except JSVM Typedoc output), and plan selective copy/adaptation accordingly.
  Rationale: Most docs content is authored directly in Svelte pages, so migration strategy should focus on authored prose structure rather than reverse-generating from code comments.
  Date/Author: 2026-02-12 / Codex

- Decision: Use a two-long-page format for user docs: one general page and one API reference page.
  Rationale: This format favors browser-native find (`Cmd/Ctrl+F`) and avoids discoverability loss behind site search UX, while keeping docs simple on GitHub.
  Date/Author: 2026-02-12 / Codex

- Decision: Explicitly credit PocketBase/Gani Georgiev when adapting large portions of handwritten upstream docs.
  Rationale: Even with MIT licensing, preserving clear author/project attribution is the respectful and maintainable approach.
  Date/Author: 2026-02-12 / Codex

- Decision: Defer Dart SDK docs from this milestone.
  Rationale: Current product scope and user demand prioritize PocketBun runtime + JS ecosystem docs; Dart can be added later on explicit request.
  Date/Author: 2026-02-12 / Codex

## Outcomes & Retrospective

Discovery and planning are complete for the first pass. We now have a concrete upstream source location, generation/licensing findings, and an execution strategy to deliver PocketBun-first docs in a two-page format. No content migration has been implemented yet; implementation starts after maintainer confirmation of this plan’s structure and priorities.

## Context and Orientation

Today, user guidance is split across:

- `README.md` (installation, usage, compatibility notes, differences).
- `docs/UPGRADING.md` (maintainer upgrade workflow).
- `docs/experience.md` (project retrospective article).

There is no dedicated docs information architecture for onboarding vs migration. This plan introduces one with a simplified two-page presentation.

Important upstream references for maintainers:

- Upstream docs repo: `https://github.com/pocketbase/site`
- Upstream docs source tree: `src/routes/(app)/docs`
- Upstream runtime repo (separate): `https://github.com/pocketbase/pocketbase`

Definitions used in this plan:

- “General docs page”: one long page that contains both beginner-first PocketBun guidance and “coming from PocketBase” migration/differences sections.
- “API reference page”: one long page that consolidates API behavior and endpoint/reference material relevant to PocketBun users.
- “Upstream sync map”: a maintainer-facing mapping that links PocketBun docs topics to relevant upstream docs topics for release audits.

## Plan of Work

Milestone 1 establishes docs structure and entrypoints. The outcome is a clear docs landing page with links to the two long pages and stable paths we can link from README and release notes. This milestone is complete when those two pages exist with skeletal content.

Milestone 2 fills the long general docs page with practical guides that use PocketBun commands, paths, and examples. This section should not assume prior PocketBase knowledge for its first half and should cover install/run, first project structure, auth/API basics, and deployment basics in PocketBun terms.

Milestone 3 fills the migration-focused sections in the same long general docs page: what is identical, what intentionally differs, and what changed operationally (for example package-manager updates, directory defaults relative to CWD, Bun-specific notes). The existing README “Known Differences” content should be split into maintainable docs sections.

Milestone 4 fills the long API reference page and defines source strategy for API-reference sections (what to adapt from upstream handwritten docs vs what to summarize from implementation/tests). It should also include explicit attribution notes where text is adapted.

Milestone 5 adds a repeatable upstream-reference process so docs drift can be managed during upgrades. This does not mean mirroring all upstream pages; it means maintaining a compact mapping and checklist so maintainers can review upstream docs changes and decide what to port, summarize, or explicitly defer.

Milestone 6 integrates discoverability: README links and release workflow references should point to the new docs entrypoint first, with upstream docs used as supplemental references when appropriate.

## Concrete Steps

Work in `/Users/pekeler/Projects/pocketbun` for all commands.

Milestone 1 concrete edits:

- Create docs landing and top-level pages:
  - `docs/index.md`
  - `docs/general.md`
  - `docs/api-reference.md`
- Add a maintainer-facing upstream reference page:
  - `docs/maintainers/upstream-docs-map.md`
- Update README docs links to point first to `docs/index.md`.

Milestone 2 concrete edits (general page beginner sections):

- Add the newcomer-first sections to `docs/general.md`:
  - installation
  - first app
  - auth and API basics
  - deployment basics
- Ensure commands and paths use PocketBun defaults and scripts.

Milestone 3 concrete edits (general page migration sections):

- Add migration/differences sections to `docs/general.md`:
  - migration quickstart
  - differences
  - compatibility notes
- Move/normalize relevant “Known Differences” material from `README.md` into `docs/general.md` and keep README concise.

Milestone 4 concrete edits (API reference + attribution):

- Add API reference sections to `docs/api-reference.md`:
  - REST endpoints summary and conventions
  - auth/realtime/file API reference notes
  - linkouts to deeper upstream references where appropriate
- Add explicit attribution block(s) in copied/adapted sections:
  - credit PocketBase docs and Gani Georgiev
  - reference source paths/URLs for substantial adapted text

Milestone 5 concrete edits (upstream review process):

- Add `docs/maintainers/upstream-docs-map.md` entries mapping PocketBun doc topics to upstream paths/URLs.
- Add a small release-time checklist section to `docs/UPGRADING.md` to review upstream docs changes in `pocketbase/site`.

Milestone 6 concrete edits (discoverability and optional Pages):

- Ensure README and release notes reference `docs/index.md` as the primary docs entrypoint.
- Optional: enable GitHub Pages for `/docs` branch/folder rendering if maintainers want a site URL without custom domain.

## Validation and Acceptance

This plan is accepted when:

- A user can start from one PocketBun docs entrypoint (`docs/index.md`) and reach complete docs through two pages (`docs/general.md` and `docs/api-reference.md`).
- The general page contains practical PocketBun-first guidance for newcomers and clearly marked migration/differences sections for experienced PocketBase users.
- The API reference page provides consolidated, searchable-on-page reference coverage without requiring custom search tooling.
- README no longer frames PocketBase docs as the required first step for PocketBun users.
- Maintainers have a documented process to review upstream docs changes at release time.
- Dart SDK docs are explicitly deferred until user demand exists.

Validation commands (content and link sanity):

    cd /Users/pekeler/Projects/pocketbun
    rg -n "docs/index.md|docs/general.md|docs/api-reference.md" README.md docs
    bun run format
    bun run typecheck
    bun run lint
    bun test --concurrent

The code-related validation commands stay required because docs link updates may accompany code examples and README edits.

## Idempotence and Recovery

All planned changes are additive documentation files and link edits. Re-running the steps is safe. If content direction changes mid-way, keep stale drafts in separate files until replacement pages are ready, then remove them in a focused cleanup commit.

If an upstream mapping entry becomes outdated, update only the mapping document and related links; do not block docs publishing on complete upstream parity.

## Artifacts and Notes

Upstream docs source evidence:

    Repository: https://github.com/pocketbase/site
    Source tree: src/routes/(app)/docs
    Build stack: SvelteKit + Vite + Pagefind
    Generation finding: docs pages are handwritten Svelte; JSVM reference is generated via Typedoc (`npm run jstypes` -> static/jsvm)
    License finding: top-level MIT license (`LICENSE.md`) with no separate docs-only license override found
    Scope snapshot: 50 docs route pages (+page.svelte), 109 Svelte files, 4 JS helper files under docs tree.

Attribution policy for PocketBun docs:

    When adapting upstream handwritten prose, include clear credit to PocketBase docs and Gani Georgiev.
    Keep source links/paths in maintainer docs (`docs/maintainers/upstream-docs-map.md`) for traceability.

Out-of-scope for this milestone:

    Dart SDK documentation (defer until a user explicitly requests it).

Current PocketBun docs starting point:

    docs/UPGRADING.md
    docs/experience.md
    README.md (contains large “Known Differences” and operational guidance sections)

## Interfaces and Dependencies

No runtime interfaces are changed by this plan. This is documentation architecture and content work.

Tooling expectations:

- Source-of-truth docs stay in Markdown within this repository.
- Optional GitHub Pages deployment should use GitHub-native hosting (no custom domain required).
- Upstream docs references should point to stable paths in `pocketbase/site` and `pocketbase.io/docs`.

Plan change note: 2026-02-12, created this dedicated docs ExecPlan after confirming upstream docs live in `pocketbase/site` and after scoping the upstream docs source format/size. The goal is to deliver PocketBun-first docs for both newcomers and PocketBase migrants.
Plan change note: 2026-02-12, updated the plan with findings that upstream docs are mostly handwritten (except generated JSVM API docs), recorded license findings (MIT with no docs-only override found), adopted a two-long-page user-doc format, and deferred Dart SDK docs until explicitly requested.
