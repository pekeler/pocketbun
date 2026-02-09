#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/release.sh check
  bash scripts/release.sh dry-run
  bash scripts/release.sh publish [--push-tags] [--no-tags]

Commands:
  check     Run release checks only.
  dry-run   Run checks + npm publish dry-run for pocketbun and create-pocketbun.
  publish   Run checks + publish both packages (+ create git tags by default).

Options:
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

while [[ $# -gt 0 ]]; do
  case "$1" in
    --push-tags)
      PUSH_TAGS=1
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

package_version() {
  local package_json_path="$1"
  bun --eval "console.log(JSON.parse(await Bun.file(\"$package_json_path\").text()).version)"
}

publish_package() {
  local package_dir="$1"
  local dry_run="$2"
  pushd "$package_dir" >/dev/null
  if [[ "$dry_run" -eq 1 ]]; then
    npm publish --access public --dry-run
  else
    npm publish --access public
  fi
  popd >/dev/null
}

create_tags() {
  local main_tag="$1"
  local create_tag="$2"

  if git rev-parse -q --verify "refs/tags/$main_tag" >/dev/null; then
    echo "Tag already exists: $main_tag" >&2
    exit 1
  fi
  if git rev-parse -q --verify "refs/tags/$create_tag" >/dev/null; then
    echo "Tag already exists: $create_tag" >&2
    exit 1
  fi

  git tag "$main_tag"
  git tag "$create_tag"
  echo "Created tags: $main_tag, $create_tag"

  if [[ "$PUSH_TAGS" -eq 1 ]]; then
    git push origin "$main_tag" "$create_tag"
    echo "Pushed tags to origin."
  fi
}

if [[ "$MODE" == "check" ]]; then
  run_checks
  echo "Checks passed."
  exit 0
fi

ensure_clean_tree
run_checks

MAIN_VERSION="$(package_version "package.json")"
CREATE_VERSION="$(package_version "create-pocketbun/package.json")"
MAIN_TAG="v${MAIN_VERSION}"
CREATE_TAG="create-pocketbun-v${CREATE_VERSION}"

if [[ "$MODE" == "dry-run" ]]; then
  echo "==> Dry-run publishing pocketbun@$MAIN_VERSION"
  publish_package "$ROOT_DIR" 1
  echo "==> Dry-run publishing create-pocketbun@$CREATE_VERSION"
  publish_package "$ROOT_DIR/create-pocketbun" 1
  echo "Dry-run complete."
  echo "Would tag release as: $MAIN_TAG and $CREATE_TAG"
  exit 0
fi

echo "==> Publishing pocketbun@$MAIN_VERSION"
publish_package "$ROOT_DIR" 0
echo "==> Publishing create-pocketbun@$CREATE_VERSION"
publish_package "$ROOT_DIR/create-pocketbun" 0

if [[ "$CREATE_TAGS" -eq 1 ]]; then
  create_tags "$MAIN_TAG" "$CREATE_TAG"
fi

echo "Release complete."
