#!/usr/bin/env bash
# This script syncs the pinned upstream source and unchanged Admin UI assets.
set -euo pipefail

TAG="$(tr -d '\r\n' < pocketbase_tag.txt)"
DIR=".upstream/pocketbase"
REPO_URL="https://ganigeorgiev.com/git/pocketbase/pocketbase"

mkdir -p .upstream
if [ -d "$DIR" ] && [ ! -d "$DIR/.git" ]; then
  rm -rf "$DIR"
fi

[ -d "$DIR/.git" ] || git clone --depth=1 --branch "$TAG" "$REPO_URL" "$DIR"
git -C "$DIR" remote set-url origin "$REPO_URL"

git -C "$DIR" fetch --depth=1 origin tag "$TAG"
git -C "$DIR" checkout -f "$TAG"

echo "PocketBase checked out: $TAG ($(git -C "$DIR" rev-parse --short HEAD))"

rm -rf vendor/pocketbase-admin-ui/dist
mkdir -p vendor/pocketbase-admin-ui
cp -R .upstream/pocketbase/ui/dist vendor/pocketbase-admin-ui/dist
git add -A -- vendor/pocketbase-admin-ui

rm -rf "$DIR/.git"
