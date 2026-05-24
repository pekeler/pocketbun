# Upgrading PocketBun to a new PocketBase release

This document describes the upgrade process we follow when PocketBase publishes a new tag. The goal is to keep PocketBun API-compatible with the upstream release and to make the changes repeatable.

## Steps

1) Update the pinned upstream tag.

   Edit `pocketbase_tag.txt` and set it to the new PocketBase tag (for example `v0.36.2`).

2) Update the PocketBun version.

   Set `package.json` to the matching version using the PocketBun scheme:

   - If the tag is `vX.Y.Z`, set `version` to `X.Y.Z-pocketbun.0`.
   - If this is a PocketBun-only follow-up without changing the upstream tag, increment the `pocketbun.N` suffix.

   Do this during release preparation, not immediately after the previous release. Between releases, keep `package.json` on the latest published version and collect pending notes under `## Unreleased` in `CHANGELOG.md`.

   Then verify the unavoidable version sources agree:

       bun run check:versions

3) Review release notes and prepare a diff.

   PocketBase keeps release notes in `CHANGELOG.md` and older changelog files in the upstream repo. Before changing code, read the entries for the target tag so you know which areas to double‑check.

   When adding the PocketBun upgrade entry in `CHANGELOG.md`, always include a direct link to the upstream PocketBase changelog anchor for that release (for example `https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md#v0364` for `v0.36.4`).

   Then generate a diff between the old and new tags using a temporary clone (with `.git`) so we don’t miss silent changes. Keep the previous tag in a variable before editing `pocketbase_tag.txt`:

       OLD_TAG="v0.36.1"
       NEW_TAG="v0.36.2"
       tmpdir="$(mktemp -d)"
       git clone https://github.com/pocketbase/pocketbase.git "$tmpdir/pocketbase"
       git -C "$tmpdir/pocketbase" fetch --tags origin
       git -C "$tmpdir/pocketbase" diff --name-status "$OLD_TAG..$NEW_TAG"
       git -C "$tmpdir/pocketbase" diff "$OLD_TAG..$NEW_TAG"

   The `--name-status` output tells you exactly which files changed. The full diff highlights the API, behavior, and test changes we need to port.

   If you want a side-by-side directory diff, keep a snapshot of the old upstream checkout before syncing:

       cp -R .upstream/pocketbase ".upstream/pocketbase_prev_${OLD_TAG}"
       diff -ru ".upstream/pocketbase_prev_${OLD_TAG}" .upstream/pocketbase

4) Sync the upstream checkout and Admin UI assets.

   Run:

       bun run upstream:sync

   This refreshes `.upstream/pocketbase` to the pinned tag, updates `vendor/pocketbase-admin-ui/dist`, and removes `.upstream/pocketbase/.git` to avoid IDE confusion.

5) Run the file mapping audit.

   Use the audit script (see `scripts/audit_upstream_mapping.ts`) to identify missing source and test files after the upgrade:

       bun run upstream:audit

   Capture any gaps in `.agents/EXECPLAN.md` (Progress and TODOs) or in a dedicated audit report.

6) Update user docs using the deterministic pipeline (instead of raw upstream docs diffs).

   The upstream docs repo (`pocketbase/site`) has many generated/structural changes that can make raw git diffs noisy and low-signal. For release upgrades, treat the **generated PocketBun docs output** as the review surface.

   Run:

       bun run docs:rebuild:full

   This performs:
   - upstream docs source snapshot sync (`scripts/docs/sync_upstream_site_docs.sh`)
   - deterministic docs generation (`scripts/docs/rebuild_from_upstream.ts`)
   - deterministic PocketBun patches (`scripts/docs/apply_pocketbun_patches.ts`)
   - parity checks (`scripts/docs/check_generated_docs.ts`)

   Then review only the local generated outputs and mapping metadata:

       git diff -- docs/users docs/assets/upstream/screenshots docs/maintainers/upstream-docs-manifest.json

   Rules:
   - Do not hand-edit generated user docs pages as part of routine upgrades.
   - If output is wrong/noisy, adjust generator/patch logic in `scripts/docs/rebuild_from_upstream.ts` and/or `scripts/docs/apply_pocketbun_patches.ts`, then rerun.
   - Keep PocketBun-only behavior notes in `docs/users/differences.md` (and summarize in README when relevant).
   - Keep `docs/maintainers/upstream-docs-map.md` current when upstream docs structure changes (new routes/sections).
   - The upstream docs snapshot is pinned by `pocketbase_site_ref.txt`; do not treat `pocketbase/site@master` as an implicit input anymore.

   When you intentionally refresh the upstream docs snapshot:

       SITE_SHA="$(gh api repos/pocketbase/site/commits/master --jq .sha)"
       printf '%s\n' "$SITE_SHA" > pocketbase_site_ref.txt

   Then rerun `bun run docs:rebuild:full` and review the generated diff.

7) Fix any breakages.

   Reconcile upstream changes in code and tests. Prefer mechanical ports, keep 1:1 file mapping where feasible, and document unavoidable deviations.

8) Validate and document.

   Run the full validation suite:

       bun run format:fix
       bun run check:versions
       bun run lint
       bun run typecheck
       bun test --only-failures --concurrent

   Update README compatibility notes and any known differences if behavior changed.

9) Commit.

   Commit the version bump, upstream sync changes, and any fixes/tests. Keep commits focused and note the new upstream tag in commit messages or release notes.

## Notes

- The `examples/` directory is PocketBun-specific and does not exist upstream. Keep the example projects runnable after upgrades, but exclude them from upstream mapping audits and avoid treating missing upstream examples as porting gaps.
- `bash scripts/release.sh publish pocketbun` finalizes either `## Unreleased` or `## X.Y.Z-pocketbun.N (Unreleased)`, validates that the final changelog has exactly one non-empty section for the package version, publishes the package, and pushes the release tag. It does not prepare the next `pocketbun.N` version after publishing.
- Hosted docs are deployed by `.github/workflows/docs-pages.yml` after the GitHub Release workflow succeeds for a PocketBun release tag. Manual reruns must pass the release tag to avoid publishing docs from unreleased `master` changes.
