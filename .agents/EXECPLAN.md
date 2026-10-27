# Upgrade PocketBase compatibility to v0.41.0

This living plan follows `.agents/PLANS.md`.

## Purpose / Big Picture

Upgrade PocketBun from PocketBase v0.40.6 to v0.41.0 (upstream commit f6baa0c43f379de21cd806de97ad6a2b8ca97b83). Users gain shared event data, customizable startup banners, safer default thumbnail limits, mail fixes and the unchanged upstream Admin UI. The upstream-host migration was committed separately as 41e583c1. Complete the compatibility work and required checks on master; do not publish a release.

## Progress

- [x] (2026-10-27 13:59Z) Committed host migration and compared both upstream tags, filtering import/host-only changes to identify behavior changes.
- [x] (2026-10-27 14:10Z) Synced v0.41.0 source/UI, audited declarations and the dbx, ozzo-validation and fexpr dependency migrations. No additional runtime dependency changes.
- [x] (2026-10-27 14:15Z) Ported shared hook and request event data, error-event map copying, startup banners, thumbnail default and sendmail changes. Focused tests passed.
- [x] (2026-10-27 14:15Z) Updated versions, declarations, benchmark inputs and docs/changelog. Repaired overlay drift so regeneration retains hook bundling guidance. Benchmark compiles with read-only module checksums.
- [x] (2026-10-27 14:18Z) Full rerun passed: 2,034 tests, 7 snapshots, zero failures or warnings. Completed final compatibility/performance review; all required checks passed.

## Surprises & Discoveries

The new Git host advertises shallow cloning. Full-history cloning stalled in the prior task; shallow tag fetches work and support direct old/new tree diffs. Most of the 424 changed files only update Go module paths. Actual Go behavior changes are in apis/serve.go, core/events.go, tools/hook/event.go, tools/filesystem/filesystem.go, tools/mailer/sendmail.go, tools/mailer/smtp.go and plugins/jsvm/binds.go. Upstream nullObject now starts with a nil JSON map. A v0.41.0 executable probe confirmed EXTRA_DEFAULT=null, direct property assignment fails until initialization, and NULL_OBJECT={"value":null}; Bun already matches nullObject. The generated runtime contract caught that router.Event implements its own resolver rather than inheriting hook.Event, so it also needs the new field. Existing tests deliberately exercised deprecated expand syntax; they now assert those warnings rather than leaking them into the test log.

## Decision Log

- Use the verified temporary Git checkout at `/tmp/pocketbun-shallow-upstream-check` to compare v0.40.6 and v0.41.0; use the repository sync script for the pinned source/UI. Rationale: keep source read-only and preserve upstream asset provenance. Date: 2026-10-27.
- Keep Bun runtime semantics and dependencies, port observable behavior rather than Go import renames. Review dependency diffs for semantic changes. Date: 2026-10-27.

## Outcomes & Retrospective

The v0.41.0 compatibility upgrade is complete. The owner reviewed the startup-banner changes and approved committing and pushing the upgrade on master. The host migration is committed as 41e583c1. Full validation passed: 2,034 tests across 255 files (122.33 seconds), 7 snapshots, no failures/warnings, formatting, typecheck, lint, package build/types, version alignment, generated docs, zero-gap upstream mapping and byte-identical Admin UI. Benchmark source f53fd8de571ac32293871100e916cdf6d10ced8e uses the new module and builds with -mod=readonly. No release was published. No full throughput benchmark or manual browser UI exercise was performed.

## Context and Orientation

`pocketbase_tag.txt` pins upstream; `package.json` encodes that version with `-pocketbun.0`. `src/tools/hook/event.ts` is shared by hook events. `src/core/events.ts` defines ServeEvent and its public aliases. `src/apis/serve.ts` starts synchronous/asynchronous Bun servers and prints their banners. Mail is implemented under `src/tools/mailer`; thumbnail protection is in `src/tools/filesystem/filesystem.ts`. `src/plugins/jsvm/internal/types/generated/types.d.ts` exposes editor declarations and includes local adaptations. `vendor/pocketbase-admin-ui/dist` must match upstream byte for byte. Benchmark Go sources are vendored separately; their imports and module pins must follow the new upstream module name. The docs pipeline uses a pinned `pocketbase_site_ref.txt` snapshot, so do not silently replace that snapshot with master.

## Plan of Work

First sync v0.41.0 and audit its file mapping. Trace callers of changed behavior and compare upstream tests. Implement additions in the existing shared classes and mail helpers, preserving upstream comments. Add focused tests for event extra sharing/isolation, banner override/suppression including async serving, thumbnail default boundaries and mail MIME/header behavior. Verify nullObject and preserve local declaration adaptations when adding new public properties. Inspect upstream dependency changes and benchmark repository migration before updating benchmark inputs. Update compatibility/version docs and add concise upstream release sub-points under Unreleased.

## Concrete Steps

Work in `/Users/pekeler/Projects/pocketbun`. Use `git -C /tmp/pocketbun-shallow-upstream-check diff v0.40.6..v0.41.0 -- PATH` for upstream evidence. The behavior-only review is saved at `/tmp/pocketbase-0.41.0-behavior.diff`. Set the tag and package version, then run `bun run upstream:sync` and `bun run upstream:audit`. Run focused tests during implementation, then `bun run format:fix`, `bun test --concurrent`, `bun run typecheck`, `bun run lint`, `bun run check:versions`, `bun run typecheck:package`, and `bun run docs:rebuild:full`. Inspect and resolve generated docs drift without removing PocketBun-specific documentation. Run `diff -qr vendor/pocketbase-admin-ui/dist .upstream/pocketbase/ui/dist` and `git diff --check`.

## Validation and Acceptance

All required checks pass without compiler/runtime warnings. A non-record hook can assign extra data and the next handler reads it; separate events do not share data. onServe can replace or suppress the banner and receives the actual bound URL. Default output uses greater-than markers. Text-only mail excludes an empty HTML part; sendmail honors custom headers and supplies a message ID. Thumbnails use the upstream 100 << 20 pixel default with environment overrides preserved. Version sources agree on v0.41.0 and the Admin UI matches upstream exactly.

## Idempotence and Recovery

No production data is modified. Tests use temporary databases and mail fixtures. Sync can be rerun at the pinned tag and stages UI files automatically. Never edit `.upstream` sources. Preserve the initial committed baseline and only revert artifacts generated by this task when unrelated drift is observed.

## Artifacts and Notes

Release notes: https://ganigeorgiev.com/pocketbase/pocketbase/releases?expr=tag%3D%22v0.41.0%22 . Upstream tag resolves to f6baa0c43f379de21cd806de97ad6a2b8ca97b83. The prior host-migration checks verified both tag access and byte-identical v0.40.6 UI assets on the new host.

## Interfaces and Dependencies

Expose JSVM-style `extra` and `startBannerFunc`; retain Go-style aliases where the surrounding API does so. Prefer native object/map representation already used by hook APIs. Do not add runtime dependencies. Generated declarations must match the runtime APIs.

Created 2026-10-27 after committing the host migration and examining the complete upstream diff.

Updated 2026-10-27 14:15Z with implementation and verification evidence. Event data defaults to null, avoiding per-request map allocations; initialization is explicit. Banner functions are reused and run once per startup. Mail header processing only affects outbound sendmail messages. No performance workload was changed and no throughput claims are made.

Updated 2026-10-27 14:18Z after successful full validation. The upgrade preserves the existing docs pin and all prior PocketBun-specific guidance. Hook bundling guidance now has its own managed overlay so repeated patching cannot duplicate it. The docs patcher has pre-existing blank-line normalization on a second pass; substantive content is checked for stability. Source changes are additive except for the upstream thumbnail-limit and mail fixes, with no data migration required.

Updated 2026-10-27 after owner approval to commit and push. The validated source is unchanged; formatting, version alignment and docs checks were rechecked before committing.
