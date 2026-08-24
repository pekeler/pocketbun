#!/usr/bin/env bash
set -euo pipefail

DIR=".upstream/pocketbase-benchmarks"
REPO_URL="https://github.com/pocketbase/benchmarks.git"
VENDOR_DIR="vendor/pocketbase-benchmarks"
POCKETBASE_TAG_FILE="pocketbase_tag.txt"
BENCHMARK_COMMIT_FILE="pocketbase_benchmarks_commit.txt"

mkdir -p .upstream
if [ -d "$DIR" ] && [ ! -d "$DIR/.git" ]; then
  rm -rf "$DIR"
fi

[ -d "$DIR/.git" ] || git clone "$REPO_URL" "$DIR"

git -C "$DIR" fetch origin
git -C "$DIR" checkout -f origin/master

benchmark_commit="$(git -C "$DIR" rev-parse HEAD)"
echo "PocketBase benchmarks checked out: ${benchmark_commit}"

rm -rf "$VENDOR_DIR"
mkdir -p vendor
cp -R "$DIR" "$VENDOR_DIR"
rm -rf "$VENDOR_DIR/.git"

if [ ! -f "$POCKETBASE_TAG_FILE" ]; then
  echo "Missing $POCKETBASE_TAG_FILE; cannot pin benchmark go.mod PocketBase version." >&2
  exit 1
fi

pocketbase_tag="$(tr -d '\r\n[:space:]' <"$POCKETBASE_TAG_FILE")"
if ! printf '%s' "$pocketbase_tag" | grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "Invalid PocketBase tag in $POCKETBASE_TAG_FILE: $pocketbase_tag" >&2
  exit 1
fi

go_mod_file="$VENDOR_DIR/go.mod"
tmp_go_mod="$(mktemp)"
awk -v pocketbase_tag="$pocketbase_tag" '
  /^[[:space:]]*github\.com\/pocketbase\/pocketbase[[:space:]]+v[0-9]+\.[0-9]+\.[0-9]+/ {
    print "\tgithub.com/pocketbase/pocketbase " pocketbase_tag
    next
  }
  { print }
' "$go_mod_file" >"$tmp_go_mod"
mv "$tmp_go_mod" "$go_mod_file"

if ! grep -Fq "github.com/pocketbase/pocketbase $pocketbase_tag" "$go_mod_file"; then
  echo "Failed to pin $go_mod_file to $pocketbase_tag." >&2
  exit 1
fi

printf '%s\n' "$benchmark_commit" >"$BENCHMARK_COMMIT_FILE"

echo "PocketBase benchmarks vendored to: $VENDOR_DIR"
echo "PocketBase benchmark go.mod pinned to: $pocketbase_tag"
echo "PocketBase benchmark source recorded in: $BENCHMARK_COMMIT_FILE"

if command -v go >/dev/null 2>&1; then
  if (cd "$VENDOR_DIR" && go mod download); then
    echo "PocketBase benchmark go.sum refreshed with go mod download."
  else
    echo "Warning: failed to refresh $VENDOR_DIR/go.sum with go mod download." >&2
  fi
else
  echo "Warning: go binary not found; skipped go.sum refresh for $VENDOR_DIR." >&2
fi
