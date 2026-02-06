#!/usr/bin/env bash
set -euo pipefail

DIR=".upstream/pocketbase-benchmarks"
REPO_URL="https://github.com/pocketbase/benchmarks.git"
VENDOR_DIR="vendor/pocketbase-benchmarks"

mkdir -p .upstream
if [ -d "$DIR" ] && [ ! -d "$DIR/.git" ]; then
  rm -rf "$DIR"
fi

[ -d "$DIR/.git" ] || git clone "$REPO_URL" "$DIR"

git -C "$DIR" fetch origin
git -C "$DIR" checkout -f origin/master

echo "PocketBase benchmarks checked out: $(git -C "$DIR" rev-parse --short HEAD)"

rm -rf "$VENDOR_DIR"
mkdir -p vendor
cp -R "$DIR" "$VENDOR_DIR"
rm -rf "$VENDOR_DIR/.git"

echo "PocketBase benchmarks vendored to: $VENDOR_DIR"
