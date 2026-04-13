#!/usr/bin/env bash
# PocketBun-only maintainer helper: run a benchmark-shaped request scenario under Bun's heap profiler.
set -euo pipefail

outdir="${POCKETBUN_PROFILE_DIR:-.tmp/profile-heap-scenario}"
mkdir -p "$outdir"

export POCKETBUN_PROFILE_DIR="$outdir"

for arg in "$@"; do
  if [[ "$arg" == "-h" || "$arg" == "--help" ]]; then
    exec bun scripts/profile_heap_scenario.ts "$@"
  fi
done

exec bun --heap-prof-md --heap-prof-dir "$outdir" scripts/profile_heap_scenario.ts "$@"
