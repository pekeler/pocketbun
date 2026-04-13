#!/usr/bin/env bash
# PocketBun-only maintainer helper: run the real CLI under Bun's markdown-friendly heap profiler.
set -euo pipefail

outdir="${POCKETBUN_PROFILE_DIR:-.tmp/profile-heap}"
mkdir -p "$outdir"

for arg in "$@"; do
  if [[ "$arg" == "-h" || "$arg" == "--help" ]]; then
    exec bun src/cli.ts "$@"
  fi
done

exec bun --heap-prof-md --heap-prof-dir "$outdir" src/cli.ts "$@"
