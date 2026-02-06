# Benchmark Results

This directory stores raw benchmark output snapshots committed to the repository.

Naming convention:

- `<timestamp>-pocketbase-upstream-<machine-tag>.md`
- `<timestamp>-pocketbun-upstream-<machine-tag>.md`

Example machine tags:

- `m2-max`
- `linux-amd64-cx53`

Commands used for upstream-suite comparisons:

```sh
bun run bench:upstream
bun run bench:upstream:pocketbun
```

By default, both scripts write:

- a timestamped file in this directory
- a latest raw copy in `/tmp` (`/tmp/pocketbase-benchmarks-latest.txt` or `/tmp/pocketbun-benchmarks-latest.txt`)

You can override the machine tag with `POCKETBUN_BENCH_MACHINE_TAG`.
