# Benchmark Results

This directory stores raw benchmark output snapshots committed to the repository.

Committed comparison batches:

- [`pb_compare_20260824T220243Z_external`](pb_compare_20260824T220243Z_external/summary.md) — PocketBase v0.40.0 versus PocketBun with external load generation and one/two/four application execution lanes.
- [`pb_compare_20260226T120803Z`](pb_compare_20260226T120803Z/summary.md) — earlier co-located PocketBase/PocketBun comparison.

Naming convention:

- `<timestamp>-pocketbase-upstream-<machine-tag>.md`
- `<timestamp>-pocketbun-upstream-<machine-tag>.md`

Example machine tags:

- `m2-max`
- `linux-amd64-cx53`
- `hetzner_ccx13`

Commands used for upstream-suite comparisons:

```sh
bun run bench:upstream
bun run bench:upstream:pocketbun
```

The default full-suite run first executes the same selected scenarios without
recording their timings, using a 150-request target for the short organization
and permission create scenarios and a 150-request cap for longer scenarios.
The measured `create` phase then clears that disposable data without restarting
the server, so both runtimes are warm while measured fixtures remain unchanged.
Set `POCKETBUN_BENCHMARK_WARMUP_REQUESTS=0` to disable the warmup or another
non-negative integer to change the target/cap.

Remote paired-run helper (local-only script):

```sh
bash scripts/bench_upstream_compare_ssh.sh start
bash scripts/bench_upstream_compare_ssh.sh status
bash scripts/bench_upstream_compare_ssh.sh report
```

By default, the helper runs both systems 5 times each on the remote host,
stores remote raw files under `benchmarks/results/batches/<session>/`, and
writes a local markdown summary with the mean-factor output.

Current retention policy:

- keep every accepted run used to calculate a committed comparison summary
- keep the latest 3 full zero-error PocketBase upstream runs per machine tag
- keep the latest 3 full zero-error PocketBun upstream runs per machine tag
- remove older/partial/error-only snapshots after issues are investigated

By default, both scripts write:

- a timestamped file in this directory
- a latest raw copy in `/tmp` (`/tmp/pocketbase-benchmarks-latest.txt` or `/tmp/pocketbun-benchmarks-latest.txt`)

You can override the machine tag with `POCKETBUN_BENCH_MACHINE_TAG`.

You can summarize factor ranges from all files in this directory with:

```sh
bun scripts/bench_upstream_factor_summary.js --dir benchmarks/results
```
