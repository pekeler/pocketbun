# PocketBase vs PocketBun External Benchmark Summary

This batch compares PocketBase v0.40.0 and PocketBun at exact revision `de04f6b2` using a separate load-generator host. It is a release-candidate calibration, not yet the final public benchmark: PocketBun will be qualified on Bun 1.4.1 and native HTTP/2 before the README numbers are finalized.

## Method

- Application host: Ubuntu 26.04, AMD EPYC Milan, 4 logical CPUs / 2 physical cores, 15 GiB memory.
- Load host: Ubuntu 26.04, AMD EPYC Milan, 2 logical CPUs / 1 physical core, 7.6 GiB memory.
- Runtime/toolchain: Bun 1.4.0 and Go 1.27.0.
- Workload: the complete 150-scenario upstream `create,auth,search,custom,delete` suite.
- Five accepted runs per configuration. Each table cell is the sum of the 150 per-scenario five-run medians, so one noisy run cannot dominate the total.
- PocketBase parallelism is `GOMAXPROCS=1/2/4`; PocketBun parallelism is one/two/four workers.

Lower times are better. “Parallelism” describes application execution lanes on the same four-logical-CPU host, not hard CPU affinity; runtime helper threads could still execute on other CPUs.

## Complete 150-scenario suite

| Application parallelism | PocketBase | PocketBun | PocketBun advantage |
| ---: | ---: | ---: | ---: |
| 1 | 1,461.6 s | 519.8 s | 2.81× |
| 2 | 788.7 s | 494.6 s | 1.59× |
| 4 | 699.1 s | 468.2 s | 1.49× |

## High-concurrency scaling

This subset sums the same five-run medians for four scenarios: high-concurrency Go route, high-concurrency JavaScript route, `posts25k simpleB`, and `posts100k simpleB`.

| Application parallelism | PocketBase | PocketBun | PocketBun advantage |
| ---: | ---: | ---: | ---: |
| 1 | 52.94 s | 16.42 s | 3.22× |
| 2 | 17.01 s | 8.80 s | 1.93× |
| 4 | 14.19 s | 7.06 s | 2.01× |

## Integrity and caveats

- All 30 accepted raw files contain exactly 150 scenarios and zero errors.
- One initial PocketBase `GOMAXPROCS=2` attempt returned one HTTP 500 among 1,000 concurrent auth-refresh requests. It is excluded from this accepted set; the replacement completed with zero errors.
- The external load generator recorded zero errors. Its p95 CPU use remained below 73% in the full PocketBase/PocketBun matrix.
- PocketBun's four-worker runs were noisier than the other configurations: total run range was 21.9% around the median, and 68/150 scenarios had a greater-than-20% range.
- The upstream report has per-scenario best, worst, and completed durations, but not per-request p50/p95/p99 latency.
- IP addresses were replaced with `application-host` and `load-generator` in the committed artifacts; measurements were not changed.

See [`raw/`](raw/) for the accepted scenario reports, [`telemetry/`](telemetry/) for load-generator and application-resource samples, and [`SHA256SUMS`](SHA256SUMS) for committed-artifact hashes.
