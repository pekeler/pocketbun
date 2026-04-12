#!/usr/bin/env bash
# PocketBun-only maintainer helper: run the real CLI under Bun's markdown-friendly CPU profiler.
set -euo pipefail

outdir="${POCKETBUN_PROFILE_DIR:-.tmp/profile-cpu}"
mkdir -p "$outdir"

exec bun --cpu-prof --cpu-prof-md --cpu-prof-dir "$outdir" src/cli.ts "$@"
