# Upgrade PocketBun Compatibility to PocketBase v0.39.9

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. This document follows `.agents/PLANS.md`.

## Purpose / Big Picture

PocketBun currently targets PocketBase v0.39.8. After this work, its package metadata, vendored Admin UI, and filter-expression behavior will target PocketBase v0.39.9. Users will receive the Firefox `Shift + Click` selection fix and filters will parse escaped quotes, backslashes, and control-character escapes like the new upstream `fexpr` v0.6 parser. A follow-up performance audit will also prove that parsing large string literals is faster than PocketBun v0.39.8 rather than assuming the upstream optimization carries over to Bun. The result is visible in focused filter tests, measured A/B results, exact Admin UI asset parity, and the repository's full validation gate.

## Progress

- [x] (2026-07-23 06:48Z) Read the automation memory, repository instructions, ponytail coding skill, `.agents/PLANS.md`, `.agents/PERFORMANCE.md`, current version metadata, and prior v0.39.8 plan.
- [x] (2026-07-23 06:51Z) Confirmed that PocketBase v0.39.9 is the latest official release at commit `0cbfc046` and inventoried its five commits and fifteen changed paths.
- [x] (2026-07-23 06:54Z) Mapped the Admin UI change, Go-only goja updates, and `fexpr` v0.6 scanner behavior to PocketBun.
- [x] (2026-07-23 06:58Z) Updated the upstream pin, package/docs version, changelog, vendored Admin UI, filter parser, and upstream-derived tests.
- [x] (2026-07-23 06:59Z) Passed all six focused filter tests and verified exact Admin UI parity against the synchronized v0.39.9 checkout.
- [x] (2026-07-23 07:05Z) Passed formatting, 1,896 concurrent tests, application and package typechecks, lint, version/docs checks, Admin UI parity, upstream mapping audit, and final diff review.
- [x] (2026-07-23 07:23Z) Benchmarked PocketBun v0.39.8 and the v0.39.9 working tree twice on 64 KiB escaped/unescaped and 1 MiB unescaped filter literals.
- [x] (2026-07-23 07:24Z) Confirmed the existing v0.39.9 one-pass scanner is consistently faster for large literals, so no additional hot-path code or dependency was needed.

## Surprises & Discoveries

- Observation: The release notes describe “minor filter improvements,” but the dependency bump changes observable literal values rather than only performance.
  Evidence: `github.com/ganigeorgiev/fexpr` v0.6 changes quoted-text scanning so `\\n`, `\\r`, and `\\t` become control characters; escaped quote and backslash sequences are unescaped one character at a time. PocketBase updates `tools/search/filter_test.go` expected SQL accordingly.
- Observation: The goja and regexp2 updates have no dependency equivalent in PocketBun.
  Evidence: PocketBun runs server-side JavaScript in Bun rather than goja and has no goja or regexp2 package dependency.
- Observation: The three source-level UI fixes are all compiled into the vendored `ui/dist` files PocketBun ships unchanged.
  Evidence: Upstream modifies `ui/src/logs/logsList.js`, `ui/src/records/recordsList.js`, and `ui/src/settings/sync/pageExportCollections.js`; the tag diff also renames the compiled index asset and updates the HTML entrypoint.
- Observation: Matching the new fexpr scanner also exposes the existing upstream distinction between escaped and explicit `%` wildcards.
  Evidence: The v0.39.9 test now auto-wraps `ab\\%c` as `%ab\\%c%`, while an even number of preceding backslashes leaves `%` explicit. Porting `containsUnescapedChar` and backslash autoescaping alongside the lexer produces the exact upstream cases.
- Observation: The upstream mapping audit remains unchanged apart from the new release work.
  Evidence: It reports only the four pre-existing missing `plugins/ghupdate` source/test mappings; v0.39.9 introduces no unmapped source file.
- Observation: Removing the v0.39.8 post-scan regular expression produces a measurable Bun speedup, especially when escapes are present.
  Evidence: Two A/B runs measured the v0.39.9 scanner at 1.16–1.17× the throughput of v0.39.8 for 1 MiB plain literals and 1.49–1.56× for 64 KiB escape-heavy literals. The smaller 64 KiB plain case was 1.01–1.07× faster.

## Decision Log

- Decision: Port the `fexpr` v0.6 text-scanning semantics into PocketBun's existing local lexer instead of adding an npm parser dependency.
  Rationale: `src/tools/search/filter.ts` intentionally implements the upstream grammar locally. A small change to `Lexer.readString` preserves the architecture, avoids a new dependency, and matches observable PocketBase behavior at the shared parser boundary.
  Date/Author: 2026-07-23 / Codex
- Decision: Port the changed PocketBase filter cases and relevant upstream fexpr scanner cases adjacent to `src/tools/search/filter.ts`.
  Rationale: The repository requires corresponding upstream tests, and escaped-quote validity plus control characters are easiest to regress at the parser boundary.
  Date/Author: 2026-07-23 / Codex
- Decision: Work directly on clean `master`, leave all changes uncommitted, and create no branch.
  Rationale: The repository uses trunk-based development and the user explicitly requested review before any commit.
  Date/Author: 2026-07-23 / Codex
- Decision: Keep the v0.39.9 scanner implementation unchanged after the A/B measurement.
  Rationale: It already performs one pass and removes v0.39.8's full-literal cleanup regular expression. The measured large-literal cases are faster, so another buffer or scanning abstraction would be speculative and could add allocations.
  Date/Author: 2026-07-23 / Codex

## Outcomes & Retrospective

PocketBun now targets PocketBase v0.39.9 as `0.39.9-pocketbun.0`. Its vendored Admin UI exactly matches the v0.39.9 distribution and carries the Firefox range-selection workaround. The local filter lexer now follows fexpr v0.6 quoted-text behavior: control escapes decode correctly, quote and backslash escapes are consumed once, ordinary escaped characters remain escaped, and LIKE auto-wrapping distinguishes escaped from explicit `%` wildcards.

No dependency or public API was added. PocketBase's goja and regexp2 updates are Go-runtime-specific because PocketBun executes JavaScript in Bun. The parser stays a single-pass state machine and eliminates v0.39.8's post-scan regular expression. Exact-source A/B benchmarks confirmed 16–17% higher throughput for 1 MiB plain literals and 49–56% higher throughput for 64 KiB escape-heavy literals, so no further speculative rewrite was justified.

The complete gate passed 1,896 tests across 242 files with zero failures, 10,083 assertions, and seven snapshots. Formatting, application and package typechecks, lint, version/docs checks, vendored-asset parity, and diff checks all passed. Changes remain uncommitted on `master` for review, as requested.

## Context and Orientation

PocketBun is a Bun-native TypeScript port of PocketBase. Observable compatibility includes filter syntax and matching behavior as well as the static Admin UI. `pocketbase_tag.txt` pins the PocketBase tag, while `package.json` uses the matching version with a `-pocketbun.0` suffix for the first PocketBun release against a new upstream version. `docs/_data/pocketbun.yml` is generated from that package version. `CHANGELOG.md` records user-visible compatibility updates.

The filter parser lives in `src/tools/search/filter.ts`; its adjacent `src/tools/search/filter.test.ts` is ported from PocketBase's `tools/search/filter_test.go`. PocketBase uses the Go module `fexpr` to scan filter strings. PocketBun instead has a local `Lexer` and `Parser` so there is no Go or npm parser dependency. Placeholder values are serialized into quoted filter literals and then parsed back into SQL parameters, making quoted-literal escape behavior observable in API filter parameters.

The unchanged compiled PocketBase Admin UI lives in `vendor/pocketbase-admin-ui/dist`. Running `bun run upstream:sync` checks out the tag from `pocketbase_tag.txt`, replaces this directory with `.upstream/pocketbase/ui/dist`, stages the vendored asset changes, and then removes only the upstream checkout's `.git` metadata. `.upstream/pocketbase` remains a read-only source reference and must never be committed.

## Plan of Work

First, set `pocketbase_tag.txt` to `v0.39.9`, `package.json` and the generated docs version to `0.39.9-pocketbun.0`, and add a dated changelog entry naming upstream commit `0cbfc046`. Run `bun run upstream:sync` so the exact v0.39.9 source and compiled Admin UI are available locally. Confirm that the vendored distribution matches the upstream directory byte-for-byte.

Second, change `Lexer.readString` in `src/tools/search/filter.ts` to maintain a single `escapeNext` state. When escaped, translate `n`, `r`, and `t` to their control characters; remove the escape prefix from backslash and either quote type; preserve the prefix for ordinary characters such as `%`, `_`, and `c`. Only an unescaped quote matching the opening quote ends the literal. This is the direct TypeScript equivalent of fexpr v0.6 without changing the rest of the parser or adding abstractions.

Third, update `src/tools/search/filter.test.ts` mechanically from the new upstream `tools/search/filter_test.go`: add the newline placeholder and newline-like case, and replace the expected backslash wrapping values. Add compact parser cases derived from upstream fexpr v0.6 for newline, carriage return, tab, escaped single/double quotes, trailing escaped backslashes, and invalid even-backslash quote sequences. These tests should fail under the v0.39.8 lexer and pass after the shared fix.

Finally, run the focused filter file and the repository's complete gate. Because this parser is a request-time hot path, review the new loop for avoidable allocations; the intended state-machine change remains one pass and does not introduce regular expressions or extra intermediate strings inside the loop. Review every changed file and leave the tree uncommitted for the user.

For the performance follow-up, load the v0.39.8 `src/tools/search/filter.ts` from `git show HEAD:src/tools/search/filter.ts` and the working-tree version through the same Bun transpiler. Expose only each module's private `Lexer.readString` through a temporary benchmark hook, alternate measurement order, and compare median throughput across nine samples. Use 64 KiB plain and escape-heavy literals plus a 1 MiB plain literal so both escape processing and the removed full-string cleanup pass are represented.

## Concrete Steps

Work from `/Users/pekeler/Projects/pocketbun`.

1. Edit `pocketbase_tag.txt`, `package.json`, `CHANGELOG.md`, and `.agents/EXECPLAN.md` with `apply_patch`; regenerate `docs/_data/pocketbun.yml` using `bun run docs:version`.
2. Run `bun run upstream:sync` and inspect `.upstream/pocketbase` plus the staged Admin UI asset diff.
3. Edit `src/tools/search/filter.ts` and `src/tools/search/filter.test.ts` with `apply_patch`.
4. Run `bun test src/tools/search/filter.test.ts` and expect every case to pass.
5. Run:

       bun run format:fix
       bun test --concurrent
       bun run typecheck
       bun run typecheck:package
       bun run lint
       bun run check:versions
       bun run docs:check
       git diff --check

6. Compare `vendor/pocketbase-admin-ui/dist` with `.upstream/pocketbase/ui/dist`, inspect `git status --short`, and review the complete uncommitted diff.
7. Run the temporary exact-source benchmark twice with `bun .tmp/filter_literal_bench.ts`, record the medians below, and remove the temporary harness before handoff.

## Validation and Acceptance

The upgrade is accepted when `pocketbase_tag.txt` contains `v0.39.9`; package and docs metadata contain `0.39.9-pocketbun.0`; the changelog names v0.39.9 and commit `0cbfc046`; and the vendored Admin UI exactly matches upstream v0.39.9. Filter tests must prove that placeholders containing newline characters survive parsing, escaped quotes are decoded once, ordinary escaped characters retain their backslash, and like-pattern escaping matches the v0.39.9 upstream expected values.

All required format, test, typecheck, and lint commands must exit zero without warnings. Repository-specific package, docs, and version checks must pass. `git diff --check` must report no whitespace errors. No commit or branch should be created.

For the performance acceptance criterion, the v0.39.9 working-tree scanner must exceed v0.39.8 median throughput in both repeated 1 MiB plain-literal runs and both repeated 64 KiB escape-heavy runs. The benchmark must time the actual old and new `Lexer.readString` implementations, excluding transpilation and input construction.

## Idempotence and Recovery

`bun run upstream:sync` is safe to rerun after setting the tag and deterministically replaces only the ignored upstream checkout plus the vendored Admin UI distribution. Version generation is deterministic. Preserve user changes and never use reset or checkout to discard work. If a test fails, repair only the scoped parser or test expectation and rerun the same stable command.

## Artifacts and Notes

Initial state:

    Branch: master, clean and aligned with origin/master
    PocketBase pin: v0.39.8
    PocketBun version: 0.39.8-pocketbun.0
    Current commit: 6bc7c0e7 Upgrade PocketBase compatibility to v0.39.8

Release evidence:

    PocketBase release: v0.39.9, marked Latest
    Release commit: 0cbfc046
    Release time shown by GitHub: 22 Jul 17:22
    Tag range: 5 commits, 15 changed paths

Focused validation evidence:

    6 pass, 0 fail, 55 assertions — bun test src/tools/search/filter.test.ts
    no differences — diff -qr .upstream/pocketbase/ui/dist vendor/pocketbase-admin-ui/dist

Final validation evidence:

    1896 pass, 0 fail, 10083 assertions, 7 snapshots — bun test --concurrent
    pass — bun run format:fix
    pass — bun run typecheck
    pass — bun run typecheck:package
    pass — bun run lint (0 warnings, 0 errors across 587 files)
    pass — bun run check:versions
    pass — bun run docs:check
    pass — git diff --check and staged diff check
    pass — vendored Admin UI parity

Large-literal A/B evidence (`bun .tmp/filter_literal_bench.ts`, nine samples per version/case, median throughput):

    Run 1 — 64 KiB plain:   134.8 -> 144.3 MiB/s (1.07x)
    Run 1 — 64 KiB escaped: 107.3 -> 167.2 MiB/s (1.56x)
    Run 1 — 1 MiB plain:    100.2 -> 115.9 MiB/s (1.16x)
    Run 2 — 64 KiB plain:   136.6 -> 138.3 MiB/s (1.01x)
    Run 2 — 64 KiB escaped: 106.8 -> 159.3 MiB/s (1.49x)
    Run 2 — 1 MiB plain:    101.3 -> 118.7 MiB/s (1.17x)

## Interfaces and Dependencies

No new package is allowed or needed. Keep the public `buildFilterExpr(filter, resolver, maxExpressions, replacements)` interface unchanged. Modify only the private `Lexer.readString` behavior and its adjacent tests. Continue using Bun, TypeScript, and the existing local parser, store, resolver, and SQL expression helpers. The goja, regexp2, and Go fexpr modules remain upstream reference dependencies only.

Revision note, 2026-07-23 / Codex: Replaced the completed v0.39.8 plan with a self-contained v0.39.9 compatibility plan after confirming the new release and mapping its filter parser and Admin UI changes.

Revision note, 2026-07-23 / Codex: Closed the plan with implemented parser/UI/version changes, exact validation evidence, runtime-specific dependency classification, and the requested uncommitted review state.

Revision note, 2026-07-23 / Codex: Added the requested large-literal performance audit, recorded two exact-source A/B runs, and confirmed the existing one-pass v0.39.9 scanner is faster without further code changes.
