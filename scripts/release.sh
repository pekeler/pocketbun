#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/release.sh dry <pocketbun|create-pocketbun>
  bash scripts/release.sh publish <pocketbun|create-pocketbun>
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
  if npm view "${name}@${version}" version >/dev/null 2>&1; then
    echo "Release blocked: ${name}@${version} already exists on npm." >&2
    echo "Bump package.json version first." >&2
    exit 1
  fi
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

changelog_state() {
  local version="$1"
  local unreleased_header="## ${version} (Unreleased)"
  local released_header_prefix="## ${version} - "

  if [[ ! -f CHANGELOG.md ]]; then
    echo "Release blocked: CHANGELOG.md is missing." >&2
    exit 1
  fi

  if grep -Fqx "$unreleased_header" CHANGELOG.md; then
    echo "unreleased"
    return 0
  fi

  if grep -Fq "$released_header_prefix" CHANGELOG.md; then
    echo "released"
    return 0
  fi

  echo "Release blocked: expected changelog header '$unreleased_header' or released header '${released_header_prefix}YYYY-MM-DD'." >&2
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

today_utc() {
  date -u +"%Y-%m-%d"
}

next_pocketbun_version() {
  local current="$1"
  if [[ "$current" =~ ^([0-9]+\.[0-9]+\.[0-9]+-pocketbun\.)([0-9]+)$ ]]; then
    local prefix="${BASH_REMATCH[1]}"
    local n="${BASH_REMATCH[2]}"
    echo "${prefix}$((n + 1))"
    return 0
  fi

  echo "Cannot derive next pocketbun version from '${current}'." >&2
  exit 1
}

set_package_version() {
  local file="$1"
  local version="$2"
  bun --eval "
const file = \"$file\";
const nextVersion = \"$version\";
const text = await Bun.file(file).text();
const pkg = JSON.parse(text);
pkg.version = nextVersion;
await Bun.write(file, JSON.stringify(pkg, null, 2) + \"\\n\");
"
}

finalize_changelog_release() {
  local version="$1"
  local release_date="$2"
  bun --eval "
const file = \"CHANGELOG.md\";
const version = \"$version\";
const releaseDate = \"$release_date\";
const from = \"## \" + version + \" (Unreleased)\";
const to = \"## \" + version + \" - \" + releaseDate;
let text = (await Bun.file(file).text()).replace(/\\r\\n/g, \"\\n\");
if (!text.includes(from)) {
  throw new Error(\"Missing changelog header: \" + from);
}
text = text.replace(from, to);
await Bun.write(file, text.endsWith(\"\\n\") ? text : text + \"\\n\");
"
}

prepend_next_unreleased_changelog_section() {
  local next_version="$1"
  bun --eval "
const file = \"CHANGELOG.md\";
const nextVersion = \"$next_version\";
const section = \"## \" + nextVersion + \" (Unreleased)\\n\\n- TBD\\n\\n\";
let text = (await Bun.file(file).text()).replace(/\\r\\n/g, \"\\n\");
const marker = \"## \" + nextVersion + \" (Unreleased)\";
if (text.includes(marker)) {
  throw new Error(\"Changelog already contains \" + marker);
}
const title = \"# Changelog\\n\\n\";
if (!text.startsWith(title)) {
  throw new Error(\"Unexpected CHANGELOG.md format: missing '# Changelog' title block.\");
}
text = title + section + text.slice(title.length);
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
  release_tag="v${package_version}"
  changelog_status="$(changelog_state "$package_version")"

  if [[ "$mode" == "publish" ]]; then
    ensure_npm_auth
  fi

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
  local next_version
  next_version="$(next_pocketbun_version "$package_version")"

  if [[ "$changelog_status" == "unreleased" ]]; then
    echo "==> Finalize release notes for ${package_version}"
    finalize_changelog_release "$package_version" "$release_date"
    git add CHANGELOG.md
    git commit -m "chore(release): ${package_version}"
    git push
  else
    echo "==> Release notes for ${package_version} already finalized; continuing."
  fi

  echo "==> Publish ${package_name}@${package_version}"
  publish_package "$ROOT_DIR" 0

  git tag -m "Release ${package_name}@${package_version}" "$release_tag"
  git push origin "$release_tag"

  echo "==> Start next iteration ${next_version}"
  set_package_version "$package_json" "$next_version"
  prepend_next_unreleased_changelog_section "$next_version"
  git add package.json CHANGELOG.md
  git commit -m "chore: start ${next_version}"
  git push
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
