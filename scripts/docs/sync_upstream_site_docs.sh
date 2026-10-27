#!/usr/bin/env bash
# This script exists to cache upstream PocketBase docs source files locally for deterministic docs generation.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CACHE_DIR="$ROOT_DIR/.cache/upstream-site-docs"
TMP_DIR="$ROOT_DIR/.cache/upstream-site-docs-tmp"
SITE_REF_FILE="$ROOT_DIR/pocketbase_site_ref.txt"

mkdir -p "$TMP_DIR"
rm -rf "$TMP_DIR"/*

if [[ ! -f "$SITE_REF_FILE" ]]; then
  echo "Missing docs ref file $SITE_REF_FILE" >&2
  exit 1
fi

SITE_REF="$(tr -d '\r\n' < "$SITE_REF_FILE")"
if [[ -z "$SITE_REF" ]]; then
  echo "Expected a non-empty docs ref in $SITE_REF_FILE" >&2
  exit 1
fi

TREE_LIST="$TMP_DIR/tree_paths.txt"
REPO_DIR="$TMP_DIR/repo"

git init -q "$REPO_DIR"
git -C "$REPO_DIR" remote add origin https://ganigeorgiev.com/git/pocketbase/site
git -C "$REPO_DIR" fetch --depth=1 origin "$SITE_REF"

# 1) Enumerate all upstream docs source files.
git -C "$REPO_DIR" ls-tree -r --name-only FETCH_HEAD > "$TREE_LIST"

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

  out="$TMP_DIR/$rel_path"
  mkdir -p "$(dirname "$out")"
  git -C "$REPO_DIR" show "FETCH_HEAD:$repo_path" > "$out"
done < "$TMP_DIR/download_files.txt"
rm -rf "$REPO_DIR"

# 3) Atomically replace cache.
rm -rf "$CACHE_DIR"
mkdir -p "$CACHE_DIR"
cp -R "$TMP_DIR"/. "$CACHE_DIR"/

echo "Cached upstream docs sources in $CACHE_DIR (ref $SITE_REF)"
