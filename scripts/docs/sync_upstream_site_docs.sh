#!/usr/bin/env bash
# This script exists to cache upstream PocketBase docs source files locally for deterministic docs generation.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CACHE_DIR="$ROOT_DIR/.cache/upstream-site-docs"
TMP_DIR="$ROOT_DIR/.cache/upstream-site-docs-tmp"

mkdir -p "$TMP_DIR"
rm -rf "$TMP_DIR"/*

TREE_LIST="$TMP_DIR/tree_paths.txt"

# Retry helper for flaky API connectivity.
run_with_retry() {
  local max_attempts="$1"
  shift

  local attempt=1
  while true; do
    if "$@"; then
      return 0
    fi

    if [[ "$attempt" -ge "$max_attempts" ]]; then
      return 1
    fi

    attempt=$((attempt + 1))
    sleep 1
  done
}

fetch_content_to_file() {
  local endpoint="$1"
  local output_file="$2"
  mkdir -p "$(dirname "$output_file")"

  run_with_retry 25 gh api "$endpoint" --jq .content | tr -d '\n' | base64 --decode > "$output_file"
}

# 1) Enumerate all upstream docs source files.
run_with_retry 25 gh api "repos/pocketbase/site/git/trees/master?recursive=1" --jq '.tree[].path' > "$TREE_LIST"

# Keep docs source files (Svelte/JS) under src/routes/(app)/docs.
rg '^src/routes/\(app\)/docs/.*\.(svelte|js)$' "$TREE_LIST" > "$TMP_DIR/docs_files.txt"

# Keep screenshot assets referenced in docs pages.
rg '^static/images/screenshots/.*\.(png|jpg|jpeg|webp|gif|svg)$' "$TREE_LIST" > "$TMP_DIR/screenshot_files.txt"

cat "$TMP_DIR/docs_files.txt" "$TMP_DIR/screenshot_files.txt" > "$TMP_DIR/download_files.txt"

# 2) Download each file into local cache preserving relative path from docs root.
while IFS= read -r repo_path; do
  if [[ "$repo_path" == src/routes/\(app\)/docs/* ]]; then
    rel_path="${repo_path#src/routes/(app)/docs/}"
  else
    rel_path="$repo_path"
  fi

  endpoint="repos/pocketbase/site/contents/${repo_path}?ref=master"
  out="$TMP_DIR/$rel_path"
  fetch_content_to_file "$endpoint" "$out"
done < "$TMP_DIR/download_files.txt"

# 3) Atomically replace cache.
rm -rf "$CACHE_DIR"
mkdir -p "$CACHE_DIR"
cp -R "$TMP_DIR"/. "$CACHE_DIR"/

echo "Cached upstream docs sources in $CACHE_DIR"
