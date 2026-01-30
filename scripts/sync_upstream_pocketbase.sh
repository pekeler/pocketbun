#!/usr/bin/env bash
set -euo pipefail

TAG="$(tr -d '\r\n' < pocketbase_tag.txt)"
DIR=".upstream/pocketbase"

mkdir -p .upstream
[ -d "$DIR/.git" ] || git clone https://github.com/pocketbase/pocketbase.git "$DIR"

git -C "$DIR" fetch --tags origin
git -C "$DIR" checkout -f "$TAG"

echo "PocketBase checked out: $TAG ($(git -C "$DIR" rev-parse --short HEAD))"
