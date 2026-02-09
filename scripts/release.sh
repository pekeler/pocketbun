#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/release.sh check [--package <target>]
  bash scripts/release.sh dry-run [--package <target>] [--with-checks]
  bash scripts/release.sh publish [--package <target>] [--tag <dist-tag>] [--with-checks] [--push-tags] [--no-tags]

Commands:
  check     Run release checks only.
  dry-run   npm publish dry-run for selected package(s) (checks are optional).
  publish   Publish selected package(s) (+ create git tags by default; checks are optional).

Options:
  --package    Release target: pocketbun, create-pocketbun, both (default: pocketbun).
  --tag        npm dist-tag to publish under (default: latest).
  --with-checks  Run full checks before dry-run/publish.
  --push-tags  Push created release tags to origin (publish only).
  --no-tags    Skip git tag creation (publish only).
EOF
}

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

MODE="$1"
shift

PUSH_TAGS=0
CREATE_TAGS=1
RELEASE_TARGET="pocketbun"
NPM_DIST_TAG="latest"
RUN_CHECKS=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --package)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --package" >&2
        usage
        exit 1
      fi
      RELEASE_TARGET="$2"
      shift 2
      ;;
    --push-tags)
      PUSH_TAGS=1
      shift
      ;;
    --tag)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --tag" >&2
        usage
        exit 1
      fi
      NPM_DIST_TAG="$2"
      shift 2
      ;;
    --with-checks)
      RUN_CHECKS=1
      shift
      ;;
    --no-tags)
      CREATE_TAGS=0
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ "$MODE" != "check" && "$MODE" != "dry-run" && "$MODE" != "publish" ]]; then
  echo "Unknown command: $MODE" >&2
  usage
  exit 1
fi

if [[ "$RELEASE_TARGET" != "pocketbun" && "$RELEASE_TARGET" != "create-pocketbun" && "$RELEASE_TARGET" != "both" ]]; then
  echo "Unknown --package target: $RELEASE_TARGET" >&2
  usage
  exit 1
fi

ensure_clean_tree() {
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "Working tree must be clean for release operations." >&2
    git status --short
    exit 1
  fi
}

run_checks() {
  echo "==> Running release checks"
  bun run format:fix
  bun test --concurrent
  bun run typecheck
  bun run lint
}

next_pocketbun_version() {
  local version="$1"
  if [[ "$version" =~ ^([0-9]+\.[0-9]+\.[0-9]+-pocketbun\.)([0-9]+)$ ]]; then
    local prefix="${BASH_REMATCH[1]}"
    local patch="${BASH_REMATCH[2]}"
    echo "${prefix}$((patch + 1))"
    return 0
  fi

  echo "Cannot derive next pocketbun version from: $version" >&2
  return 1
}

update_changelog_for_release() {
  local version="$1"
  local changelog_file="CHANGELOG.md"
  local release_date
  release_date="$(date -u +%Y-%m-%d)"
  local next_version
  next_version="$(next_pocketbun_version "$version")"

  if [[ ! -f "$changelog_file" ]]; then
    echo "Missing $changelog_file; cannot update changelog automatically." >&2
    exit 1
  fi

  bun --eval '
const [file, version, date, next] = process.argv.slice(2);

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const releaseHeader = `## ${version} - ${date}`;
const unreleasedHeader = `## ${version} (Unreleased)`;
const nextHeader = `## ${next} (Unreleased)`;

let text = (await Bun.file(file).text()).replace(/\r\n/g, "\n");

if (text.includes(unreleasedHeader)) {
  text = text.replace(unreleasedHeader, releaseHeader);
} else if (new RegExp(`^## ${escape(version)} - `, "m").test(text)) {
  // already marked as released
} else if (new RegExp(`^## ${escape(version)}$`, "m").test(text)) {
  text = text.replace(new RegExp(`^## ${escape(version)}$`, "m"), releaseHeader);
} else {
  const firstSection = text.match(/^## /m);
  const releaseSection = `${releaseHeader}\n\n- Release.\n\n`;
  if (firstSection && firstSection.index !== undefined) {
    const idx = firstSection.index;
    text = `${text.slice(0, idx)}${releaseSection}${text.slice(idx)}`;
  } else {
    text = `${text.trimEnd()}\n\n${releaseSection}`;
  }
}

if (!new RegExp(`^${escape(nextHeader)}$`, "m").test(text)) {
  const firstSection = text.match(/^## /m);
  const nextSection = `${nextHeader}\n\n- TBD\n\n`;
  if (firstSection && firstSection.index !== undefined) {
    const idx = firstSection.index;
    text = `${text.slice(0, idx)}${nextSection}${text.slice(idx)}`;
  } else {
    text = `${text.trimEnd()}\n\n${nextSection}`;
  }
}

if (!text.endsWith("\n")) {
  text += "\n";
}

await Bun.write(file, text);
' -- "$changelog_file" "$version" "$release_date" "$next_version"
}

commit_changelog_for_release() {
  local version="$1"
  update_changelog_for_release "$version"

  if ! git diff --quiet -- "CHANGELOG.md"; then
    git add "CHANGELOG.md"
    git commit -m "Update changelog for release $version"
  fi
}

package_version() {
  local package_json_path="$1"
  bun --eval "console.log(JSON.parse(await Bun.file(\"$package_json_path\").text()).version)"
}

publish_package() {
  local package_dir="$1"
  local dry_run="$2"
  pushd "$package_dir" >/dev/null
  if [[ "$dry_run" -eq 1 ]]; then
    npm publish --access public --tag "$NPM_DIST_TAG" --dry-run
  else
    npm publish --access public --tag "$NPM_DIST_TAG"
  fi
  popd >/dev/null
}

should_release_pocketbun() {
  [[ "$RELEASE_TARGET" == "pocketbun" || "$RELEASE_TARGET" == "both" ]]
}

should_release_create() {
  [[ "$RELEASE_TARGET" == "create-pocketbun" || "$RELEASE_TARGET" == "both" ]]
}

create_tags_and_maybe_push() {
  local tags=("$@")
  if [[ ${#tags[@]} -eq 0 ]]; then
    return 0
  fi

  for tag in "${tags[@]}"; do
    if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
      echo "Tag already exists: $tag" >&2
      exit 1
    fi
  done

  for tag in "${tags[@]}"; do
    git tag "$tag"
  done
  echo "Created tags: ${tags[*]}"

  if [[ "$PUSH_TAGS" -eq 1 ]]; then
    git push origin "${tags[@]}"
    echo "Pushed tags to origin."
  fi
}

if [[ "$MODE" == "check" ]]; then
  run_checks
  echo "Checks passed."
  exit 0
fi

ensure_clean_tree

if [[ "$RUN_CHECKS" -eq 1 ]]; then
  run_checks
else
  echo "==> Skipping release checks (use --with-checks or run 'bash scripts/release.sh check')"
fi

MAIN_VERSION=""
CREATE_VERSION=""
MAIN_TAG=""
CREATE_TAG=""

if should_release_pocketbun; then
  MAIN_VERSION="$(package_version "package.json")"
  MAIN_TAG="v${MAIN_VERSION}"
fi

if should_release_create; then
  CREATE_VERSION="$(package_version "create-pocketbun/package.json")"
  CREATE_TAG="create-pocketbun-v${CREATE_VERSION}"
fi

declare -a TAGS_TO_CREATE=()
if [[ "$CREATE_TAGS" -eq 1 ]]; then
  if [[ -n "$MAIN_TAG" ]]; then
    TAGS_TO_CREATE+=("$MAIN_TAG")
  fi
  if [[ -n "$CREATE_TAG" ]]; then
    TAGS_TO_CREATE+=("$CREATE_TAG")
  fi
fi

if [[ "$MODE" == "dry-run" ]]; then
  if should_release_pocketbun; then
    echo "==> Dry-run publishing pocketbun@$MAIN_VERSION"
    publish_package "$ROOT_DIR" 1
  fi
  if should_release_create; then
    echo "==> Dry-run publishing create-pocketbun@$CREATE_VERSION"
    publish_package "$ROOT_DIR/create-pocketbun" 1
  fi
  echo "Dry-run complete."
  if [[ ${#TAGS_TO_CREATE[@]} -gt 0 ]]; then
    echo "Would tag release as: ${TAGS_TO_CREATE[*]}"
  else
    echo "Tag creation is disabled (--no-tags)."
  fi
  exit 0
fi

if should_release_pocketbun; then
  echo "==> Publishing pocketbun@$MAIN_VERSION"
  publish_package "$ROOT_DIR" 0
fi
if should_release_create; then
  echo "==> Publishing create-pocketbun@$CREATE_VERSION"
  publish_package "$ROOT_DIR/create-pocketbun" 0
fi

if should_release_pocketbun; then
  commit_changelog_for_release "$MAIN_VERSION"
fi

create_tags_and_maybe_push "${TAGS_TO_CREATE[@]}"

echo "Release complete."
