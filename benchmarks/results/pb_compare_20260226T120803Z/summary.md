# PocketBase vs PocketBun Upstream Benchmark Batch Summary

- generated: 2026-02-26T16:20:49Z
- host: root@pocketbun.pekeler.org
- session: pb_compare_20260226T120803Z
- machine tag: hetzner_ccx13
- runs per system: 5
- remote repo: /opt/pocketbun
- remote results dir: benchmarks/results/batches/pb_compare_20260226T120803Z
- started: 2026-02-26T12:08:05Z
- finished: 2026-02-26T15:38:59Z

## Run Files

| System | Run | Remote File | Local File |
| --- | ---: | --- | --- |
| PocketBase | 1 | `/opt/pocketbun/benchmarks/results/batches/pb_compare_20260226T120803Z/2026-02-26T12-08-05Z-pocketbase-upstream-hetzner_ccx13.md` | `/Users/pekeler/Projects/pocketbun/benchmarks/results/pb_compare_20260226T120803Z/raw/2026-02-26T12-08-05Z-pocketbase-upstream-hetzner_ccx13.md` |
| PocketBun | 1 | `/opt/pocketbun/benchmarks/results/batches/pb_compare_20260226T120803Z/2026-02-26T14-23-07Z-pocketbun-upstream-hetzner_ccx13.md` | `/Users/pekeler/Projects/pocketbun/benchmarks/results/pb_compare_20260226T120803Z/raw/2026-02-26T14-23-07Z-pocketbun-upstream-hetzner_ccx13.md` |
| PocketBase | 2 | `/opt/pocketbun/benchmarks/results/batches/pb_compare_20260226T120803Z/2026-02-26T12-35-11Z-pocketbase-upstream-hetzner_ccx13.md` | `/Users/pekeler/Projects/pocketbun/benchmarks/results/pb_compare_20260226T120803Z/raw/2026-02-26T12-35-11Z-pocketbase-upstream-hetzner_ccx13.md` |
| PocketBun | 2 | `/opt/pocketbun/benchmarks/results/batches/pb_compare_20260226T120803Z/2026-02-26T14-38-17Z-pocketbun-upstream-hetzner_ccx13.md` | `/Users/pekeler/Projects/pocketbun/benchmarks/results/pb_compare_20260226T120803Z/raw/2026-02-26T14-38-17Z-pocketbun-upstream-hetzner_ccx13.md` |
| PocketBase | 3 | `/opt/pocketbun/benchmarks/results/batches/pb_compare_20260226T120803Z/2026-02-26T13-02-31Z-pocketbase-upstream-hetzner_ccx13.md` | `/Users/pekeler/Projects/pocketbun/benchmarks/results/pb_compare_20260226T120803Z/raw/2026-02-26T13-02-31Z-pocketbase-upstream-hetzner_ccx13.md` |
| PocketBun | 3 | `/opt/pocketbun/benchmarks/results/batches/pb_compare_20260226T120803Z/2026-02-26T14-53-29Z-pocketbun-upstream-hetzner_ccx13.md` | `/Users/pekeler/Projects/pocketbun/benchmarks/results/pb_compare_20260226T120803Z/raw/2026-02-26T14-53-29Z-pocketbun-upstream-hetzner_ccx13.md` |
| PocketBase | 4 | `/opt/pocketbun/benchmarks/results/batches/pb_compare_20260226T120803Z/2026-02-26T13-29-23Z-pocketbase-upstream-hetzner_ccx13.md` | `/Users/pekeler/Projects/pocketbun/benchmarks/results/pb_compare_20260226T120803Z/raw/2026-02-26T13-29-23Z-pocketbase-upstream-hetzner_ccx13.md` |
| PocketBun | 4 | `/opt/pocketbun/benchmarks/results/batches/pb_compare_20260226T120803Z/2026-02-26T15-08-42Z-pocketbun-upstream-hetzner_ccx13.md` | `/Users/pekeler/Projects/pocketbun/benchmarks/results/pb_compare_20260226T120803Z/raw/2026-02-26T15-08-42Z-pocketbun-upstream-hetzner_ccx13.md` |
| PocketBase | 5 | `/opt/pocketbun/benchmarks/results/batches/pb_compare_20260226T120803Z/2026-02-26T13-56-09Z-pocketbase-upstream-hetzner_ccx13.md` | `/Users/pekeler/Projects/pocketbun/benchmarks/results/pb_compare_20260226T120803Z/raw/2026-02-26T13-56-09Z-pocketbase-upstream-hetzner_ccx13.md` |
| PocketBun | 5 | `/opt/pocketbun/benchmarks/results/batches/pb_compare_20260226T120803Z/2026-02-26T15-23-54Z-pocketbun-upstream-hetzner_ccx13.md` | `/Users/pekeler/Projects/pocketbun/benchmarks/results/pb_compare_20260226T120803Z/raw/2026-02-26T15-23-54Z-pocketbun-upstream-hetzner_ccx13.md` |

## Factor Summary

```text
results dir: /Users/pekeler/Projects/pocketbun/benchmarks/results/pb_compare_20260226T120803Z/raw
PocketBase files loaded: 5
PocketBun files loaded: 5
comparable scenarios: 150
PocketBase scenarios summed: 150
PocketBun scenarios summed: 150

smallest factor A (PocketBun/PocketBase): 0.16x [List records | posts25k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]]
largest factor B (PocketBun/PocketBase): 3.00x [Creating organizations (100) | Creating 50 organizations [reqs:50, conc:10, rule:`""`]]
geometric mean C (PocketBun/PocketBase): 0.62x
sum mean completed D (all summed scenarios): PocketBase=21.678m, PocketBun=10.025m, PocketBun/PocketBase=0.46x

PocketBun is between 6.14 times faster and 3.00 times slower than PocketBase, with a geometric mean of being 1.62 times faster.
By summed mean Completed time across all summed scenarios, PocketBun is 2.16 times faster than PocketBase.
```
