#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/release.sh dry <pocketbun|create-pocketbun>
  bash scripts/release.sh publish <pocketbun|create-pocketbun>

Environment:
  POCKETBUN_RELEASE_CI_WAIT_SECONDS  Seconds to wait for GitHub CI before publishing (default: 1800)
  POCKETBUN_RELEASE_CI_POLL_SECONDS  Seconds between GitHub CI checks (default: 30)
USAGE
}

json_field() {
  local file="$1"
  local field="$2"
  bun --eval "const data=JSON.parse(await Bun.file(\"$file\").text()); console.log(data[\"$field\"]);"
}

ensure_clean_tree() {
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "Release blocked: working tree must be clean." >&2
    git status --short
    exit 1
  fi
}

ensure_unpublished() {
  local name="$1"
  local version="$2"
  if [[ "$(npm_package_version_state "$name" "$version")" == "published" ]]; then
    echo "Release blocked: ${name}@${version} already exists on npm." >&2
    echo "Bump package.json version first." >&2
    exit 1
  fi
}

npm_package_version_state() {
  local name="$1"
  local version="$2"
  local output

  if output="$(npm view "${name}@${version}" version 2>&1)"; then
    echo "published"
    return 0
  fi

  if grep -Eq '(^|[[:space:]])(E404|404)([[:space:]]|$)' <<< "$output"; then
    echo "missing"
    return 0
  fi

  echo "Release blocked: unable to check npm for ${name}@${version}." >&2
  echo "$output" >&2
  exit 1
}

ensure_tag_missing() {
  local tag="$1"
  if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
    echo "Release blocked: tag already exists: $tag" >&2
    exit 1
  fi
}

ensure_npm_auth() {
  local whoami_output
  local whoami_failed=0
  if ! whoami_output="$(npm whoami 2>&1)"; then
    whoami_failed=1
  fi

  if [[ "$whoami_failed" -eq 0 && -n "$whoami_output" ]]; then
    return 0
  fi

  if [[ -t 0 && -t 1 ]]; then
    echo "npm authentication is missing or expired; running 'npm login'..." >&2
    if npm login; then
      if whoami_output="$(npm whoami 2>/dev/null)" && [[ -n "$whoami_output" ]]; then
        echo "npm authenticated as '$whoami_output'." >&2
        return 0
      fi
    fi
  fi

  echo "Release blocked: npm authentication check failed." >&2
  if [[ -n "$whoami_output" ]]; then
    echo "$whoami_output" >&2
  fi
  echo "Run 'npm login' (or set/refresh NPM_TOKEN) and retry." >&2
  exit 1
}

ensure_gh_cli() {
  if ! command -v gh >/dev/null 2>&1; then
    echo "Release blocked: GitHub CLI ('gh') is required to verify CI before publishing." >&2
    exit 1
  fi
}

ci_state_for_sha() {
  local sha="$1"
  local runs_json

  if ! runs_json="$(gh run list --workflow ci.yml --commit "$sha" --limit 20 --json databaseId,status,conclusion,url 2>&1)"; then
    echo "Release blocked: unable to query GitHub CI runs for ${sha}." >&2
    echo "$runs_json" >&2
    exit 1
  fi

  bun --eval '
const runs = JSON.parse(await Bun.stdin.text());
const fields = (state, run) =>
  [state, run?.databaseId ?? "", run?.status ?? "", run?.conclusion ?? "", run?.url ?? ""].join("\t");
const success = runs.find((run) => run.status === "completed" && run.conclusion === "success");
const active = runs.find((run) => run.status !== "completed");
const latest = runs[0];

if (success) {
  console.log(fields("success", success));
} else if (active) {
  console.log(fields("active", active));
} else if (latest) {
  console.log(fields("failed", latest));
} else {
  console.log(fields("missing"));
}
' <<< "$runs_json"
}

ensure_successful_ci_for_head() {
  ensure_gh_cli

  local sha
  local wait_seconds
  local poll_seconds
  local deadline
  sha="$(git rev-parse HEAD)"
  wait_seconds="${POCKETBUN_RELEASE_CI_WAIT_SECONDS:-1800}"
  poll_seconds="${POCKETBUN_RELEASE_CI_POLL_SECONDS:-30}"
  deadline=$((SECONDS + wait_seconds))

  echo "==> Verify GitHub CI passed for ${sha}"

  while true; do
    local state
    local run_id
    local status
    local conclusion
    local url
    IFS=$'\t' read -r state run_id status conclusion url <<< "$(ci_state_for_sha "$sha")"

    case "$state" in
      success)
        echo "CI passed: ${url}"
        return 0
        ;;
      active)
        if ((SECONDS >= deadline)); then
          echo "Release blocked: CI did not finish within ${wait_seconds}s for ${sha}." >&2
          echo "Latest run ${run_id}: ${status} ${url}" >&2
          exit 1
        fi
        echo "CI ${status} for ${sha}; waiting ${poll_seconds}s..."
        sleep "$poll_seconds"
        ;;
      failed)
        echo "Release blocked: CI did not pass for ${sha}." >&2
        echo "Latest run ${run_id}: ${status}/${conclusion}" >&2
        echo "$url" >&2
        exit 1
        ;;
      missing)
        if ((SECONDS >= deadline)); then
          echo "Release blocked: no CI run appeared within ${wait_seconds}s for ${sha}." >&2
          exit 1
        fi
        echo "No CI run found for ${sha}; waiting ${poll_seconds}s..."
        sleep "$poll_seconds"
        ;;
      *)
        echo "Release blocked: unknown CI state '${state}' for ${sha}." >&2
        exit 1
        ;;
    esac
  done
}

release_changelog_section_count() {
  local version="$1"
  awk -v prefix="## ${version} - " '
    index($0, prefix) == 1 { count++ }
    END { print count + 0 }
  ' CHANGELOG.md
}

validate_release_changelog_section() {
  local version="$1"
  local count
  count="$(release_changelog_section_count "$version")"
  if [[ "$count" -ne 1 ]]; then
    echo "Release blocked: expected exactly one CHANGELOG.md release section for ${version}, found ${count}." >&2
    exit 1
  fi

  if ! awk -v prefix="## ${version} - " '
    index($0, prefix) == 1 { in_section = 1; next }
    in_section && /^## / { exit }
    in_section && /[^[:space:]]/ { found = 1 }
    END { exit found ? 0 : 1 }
  ' CHANGELOG.md; then
    echo "Release blocked: CHANGELOG.md release section for ${version} is empty." >&2
    exit 1
  fi
}

changelog_state() {
  local version="$1"
  local generic_unreleased_header="## Unreleased"
  local unreleased_header="## ${version} (Unreleased)"
  local released_header_prefix="## ${version} - "

  if [[ ! -f CHANGELOG.md ]]; then
    echo "Release blocked: CHANGELOG.md is missing." >&2
    exit 1
  fi

  if grep -Fq "$released_header_prefix" CHANGELOG.md; then
    echo "released"
    return 0
  fi

  if grep -Fqx "$generic_unreleased_header" CHANGELOG.md || grep -Fqx "$unreleased_header" CHANGELOG.md; then
    echo "unreleased"
    return 0
  fi

  echo "Release blocked: expected changelog header '$generic_unreleased_header', '$unreleased_header', or released header '${released_header_prefix}YYYY-MM-DD'." >&2
  exit 1
}

publish_package() {
  local dir="$1"
  local dry="$2"
  pushd "$dir" >/dev/null
  if [[ "$dry" -eq 1 ]]; then
    npm publish --access public --tag latest --dry-run
  else
    npm publish --access public --tag latest
  fi
  popd >/dev/null
}

set_package_version() {
  local version="$1"
  bun --eval "
const file = \"package.json\";
const version = \"$version\";
const data = JSON.parse(await Bun.file(file).text());
data.version = version;
await Bun.write(file, JSON.stringify(data, null, 2) + \"\\n\");
"
}

retarget_versioned_unreleased_changelog() {
  local from_version="$1"
  local to_version="$2"
  bun --eval "
const file = \"CHANGELOG.md\";
const from = \"## ${from_version} (Unreleased)\";
const to = \"## ${to_version} (Unreleased)\";
let text = (await Bun.file(file).text()).replace(/\\r\\n/g, \"\\n\");
if (text.includes(from)) {
  text = text.replace(from, to);
  await Bun.write(file, text.endsWith(\"\\n\") ? text : text + \"\\n\");
}
"
}

prepare_next_pocketbun_version() {
  local package_name="$1"
  local package_version="$2"
  local changelog_status="$3"
  local package_base
  local package_suffix
  local candidate_version
  local candidate_suffix

  if [[ "$changelog_status" != "unreleased" ]]; then
    return 0
  fi

  if [[ "$(npm_package_version_state "$package_name" "$package_version")" == "missing" ]]; then
    return 0
  fi

  if [[ ! "$package_version" =~ ^([0-9]+\.[0-9]+\.[0-9]+)-pocketbun\.([0-9]+)$ ]]; then
    echo "Release blocked: cannot auto-bump non-PocketBun version '${package_version}'." >&2
    exit 1
  fi

  package_base="${BASH_REMATCH[1]}"
  package_suffix="${BASH_REMATCH[2]}"
  candidate_suffix=$((package_suffix + 1))

  while true; do
    candidate_version="${package_base}-pocketbun.${candidate_suffix}"
    if [[ "$(npm_package_version_state "$package_name" "$candidate_version")" == "missing" ]]; then
      break
    fi
    candidate_suffix=$((candidate_suffix + 1))
  done

  echo "==> Prepare ${package_name}@${candidate_version}"
  echo "${package_name}@${package_version} already exists on npm; using next unpublished PocketBun patch."
  set_package_version "$candidate_version"
  retarget_versioned_unreleased_changelog "$package_version" "$candidate_version"
  bun run docs:version
  git add package.json docs/_data/pocketbun.yml CHANGELOG.md
  git commit -m "chore: prepare ${candidate_version}"
}

push_release_head() {
  echo "==> Push current release commit"
  git push
}

today_utc() {
  date -u +"%Y-%m-%d"
}

finalize_changelog_release() {
  local version="$1"
  local release_date="$2"
  bun --eval "
const file = \"CHANGELOG.md\";
const version = \"$version\";
const releaseDate = \"$release_date\";
const genericFrom = \"## Unreleased\";
const versionedFrom = \"## \" + version + \" (Unreleased)\";
const to = \"## \" + version + \" - \" + releaseDate;
let text = (await Bun.file(file).text()).replace(/\\r\\n/g, \"\\n\");
const from = text.includes(genericFrom) ? genericFrom : versionedFrom;
if (!text.includes(from)) {
  throw new Error(\"Missing changelog header: \" + genericFrom + \" or \" + versionedFrom);
}
text = text.replace(from, to);
await Bun.write(file, text.endsWith(\"\\n\") ? text : text + \"\\n\");
"
}

release_pocketbun() {
  local mode="$1"
  local package_json="package.json"
  local package_name
  local package_version
  local release_tag
  local changelog_status

  package_name="$(json_field "$package_json" "name")"
  package_version="$(json_field "$package_json" "version")"
  changelog_status="$(changelog_state "$package_version")"

  if [[ "$mode" == "publish" ]]; then
    ensure_npm_auth
    prepare_next_pocketbun_version "$package_name" "$package_version" "$changelog_status"
  fi

  package_version="$(json_field "$package_json" "version")"
  release_tag="v${package_version}"
  changelog_status="$(changelog_state "$package_version")"

  ensure_unpublished "$package_name" "$package_version"
  ensure_tag_missing "$release_tag"

  if [[ "$mode" == "dry" ]]; then
    echo "==> Dry-run ${package_name}@${package_version}"
    publish_package "$ROOT_DIR" 1
    echo "Dry-run complete."
    return 0
  fi

  local release_date
  release_date="$(today_utc)"

  if [[ "$changelog_status" == "unreleased" ]]; then
    echo "==> Finalize release notes for ${package_version}"
    finalize_changelog_release "$package_version" "$release_date"
    git add CHANGELOG.md
    git commit -m "chore(release): ${package_version}"
  else
    echo "==> Release notes for ${package_version} already finalized; continuing."
  fi

  validate_release_changelog_section "$package_version"
  push_release_head
  ensure_successful_ci_for_head

  echo "==> Publish ${package_name}@${package_version}"
  publish_package "$ROOT_DIR" 0

  git tag -m "Release ${package_name}@${package_version}" "$release_tag"
  git push origin "$release_tag"
}

release_create_pocketbun() {
  local mode="$1"
  local package_json="create-pocketbun/package.json"
  local package_dir="$ROOT_DIR/create-pocketbun"
  local package_name
  local package_version
  local release_tag

  package_name="$(json_field "$package_json" "name")"
  package_version="$(json_field "$package_json" "version")"
  release_tag="create-pocketbun-v${package_version}"

  if [[ "$mode" == "publish" ]]; then
    ensure_npm_auth
  fi

  ensure_unpublished "$package_name" "$package_version"
  ensure_tag_missing "$release_tag"

  if [[ "$mode" == "dry" ]]; then
    echo "==> Dry-run ${package_name}@${package_version}"
    publish_package "$package_dir" 1
    echo "Dry-run complete."
    return 0
  fi

  push_release_head
  ensure_successful_ci_for_head

  echo "==> Publish ${package_name}@${package_version}"
  publish_package "$package_dir" 0

  git tag -m "Release ${package_name}@${package_version}" "$release_tag"
  git push origin "$release_tag"
}

MODE="${1:-}"
if [[ -z "$MODE" ]]; then
  usage
  exit 1
fi
shift || true

TARGET="${1:-}"
if [[ -z "$TARGET" ]]; then
  usage
  exit 1
fi
shift || true

if [[ $# -gt 0 ]]; then
  echo "Unknown option: $1" >&2
  usage
  exit 1
fi

if [[ "$MODE" != "dry" && "$MODE" != "publish" ]]; then
  echo "Unknown command: $MODE" >&2
  usage
  exit 1
fi

ensure_clean_tree

case "$TARGET" in
  pocketbun)
    release_pocketbun "$MODE"
    ;;
  create-pocketbun)
    release_create_pocketbun "$MODE"
    ;;
  *)
    echo "Unknown package target: $TARGET" >&2
    usage
    exit 1
    ;;
esac

echo "Release flow complete."
