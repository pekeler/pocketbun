# PocketBase v0.40.0 vs PocketBun Scaling Benchmark

Three external-load runs were accepted for every PocketBase/PocketBun and worker/GOMAXPROCS combination. Each value below is the aggregate of the 150 per-scenario medians, not one wall-clock suite run; lower is better. The raw reports are retained under [`raw/`](raw/).

## Method

- Bun `1.4.0`, Go `1.27.0`, PocketBase `v0.40.0`, PocketBun `319fc7da`.
- Complete PocketBase project `create,auth,search,custom,delete` suite; the same discarded 1,000-request warmup is applied to both systems. PocketBun needs it to reach JIT-optimized performance, while it does not materially affect PocketBase.
- PocketBase uses `GOMAXPROCS=N`; PocketBun uses `--workers=N`.
- A dedicated external Bun load generator drove every application host. It recorded zero request errors and remained below host CPU capacity; the final 5–8 lane round was compared with the preceding rounds and showed no systematic generator-limited improvement.
- The 1/2, 3/4, and 5–8 lane values come from Hetzner CCX13, CCX23, and CCX33 hosts respectively. They are the practical host configurations users would normally select at those worker counts, not one hard-affinity scaling curve.
- One PocketBun 1-worker round overlapped an Ubuntu release check and was replaced with a clean repeat before calculating medians.

## Complete-suite aggregate

| Workers / GOMAXPROCS | PocketBase | PocketBun | PocketBun advantage |
| ---: | ---: | ---: | ---: |
| 1 | 1,204.2 s | 528.6 s | 2.28× |
| 2 | 953.4 s | 455.5 s | 2.09× |
| 3 | 651.0 s | 304.4 s | 2.14× |
| 4 | 624.1 s | 283.5 s | 2.20× |
| 5 | 483.7 s | 210.9 s | 2.29× |
| 6 | 488.0 s | 201.1 s | 2.43× |
| 7 | 487.2 s | 197.9 s | 2.46× |
| 8 | 484.7 s | 189.0 s | 2.56× |

## High-concurrency subset

This subset sums the per-scenario medians for high-concurrency Go and JS routes plus `posts25k` and `posts100k` `simpleB`.

| Workers / GOMAXPROCS | PocketBase | PocketBun | PocketBun advantage |
| ---: | ---: | ---: | ---: |
| 1 | 51.87 s | 14.56 s | 3.56× |
| 2 | 23.01 s | 11.48 s | 2.00× |
| 3 | 15.15 s | 7.34 s | 2.06× |
| 4 | 14.19 s | 5.85 s | 2.43× |
| 5 | 11.88 s | 3.95 s | 3.01× |
| 6 | 14.33 s | 3.47 s | 4.12× |
| 7 | 15.10 s | 3.31 s | 4.56× |
| 8 | 15.46 s | 2.80 s | 5.51× |

## Phase detail

Each value is PocketBase / PocketBun seconds.

| Lanes | Create | Authentication | Read | Custom routes/hooks | Delete |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 129.8 / 61.5 | 29.6 / 16.4 | 897.7 / 394.8 | 120.0 / 32.1 | 27.2 / 23.8 |
| 2 | 80.2 / 51.2 | 16.5 / 16.4 | 792.1 / 335.4 | 36.0 / 28.0 | 28.5 / 24.6 |
| 3 | 52.9 / 28.8 | 10.6 / 8.3 | 514.2 / 212.5 | 42.7 / 28.1 | 30.5 / 26.7 |
| 4 | 48.1 / 27.7 | 8.4 / 8.3 | 495.4 / 192.9 | 41.0 / 27.1 | 31.2 / 27.5 |
| 5 | 37.3 / 16.7 | 6.3 / 4.3 | 368.9 / 136.2 | 38.8 / 25.4 | 32.3 / 28.4 |
| 6 | 36.6 / 16.1 | 5.5 / 4.3 | 372.3 / 128.8 | 41.5 / 23.7 | 32.1 / 28.2 |
| 7 | 35.7 / 16.2 | 4.8 / 4.3 | 372.2 / 125.5 | 41.6 / 22.6 | 32.8 / 29.3 |
| 8 | 35.8 / 16.3 | 4.3 / 4.3 | 370.2 / 116.0 | 41.8 / 21.9 | 32.6 / 30.5 |

## Integrity

- 48 accepted raw reports × 150 scenarios, all with zero errors.
- `round-2-pocketbun-1.md` is the clean repeat described above.
- See [`SHA256SUMS`](SHA256SUMS) for the committed artifacts.
