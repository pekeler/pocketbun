#!/usr/bin/env bash
set -euo pipefail

TAG="$(tr -d '\r\n' < pocketbase_tag.txt)"
DIR=".upstream/pocketbase"

mkdir -p .upstream
if [ -d "$DIR" ] && [ ! -d "$DIR/.git" ]; then
  rm -rf "$DIR"
fi

[ -d "$DIR/.git" ] || git clone https://github.com/pocketbase/pocketbase.git "$DIR"

git -C "$DIR" fetch --tags origin
git -C "$DIR" checkout -f "$TAG"

echo "PocketBase checked out: $TAG ($(git -C "$DIR" rev-parse --short HEAD))"

rm -rf vendor/pocketbase-admin-ui/dist
mkdir -p vendor/pocketbase-admin-ui
cp -R .upstream/pocketbase/ui/dist vendor/pocketbase-admin-ui/dist
git add -A -- vendor/pocketbase-admin-ui

rm -rf "$DIR/.git"
