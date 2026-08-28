# PocketBun Upstream-Port Benchmark Result

- machine: hetzner-4vcpu-pocketbun-3
- timestamp: 2026-08-27T15:46:36.566Z
- tests: create,auth,search,custom,delete
- benchmark source: 05625dc2b2d3f9711c51566010944b10ca9531fa
- server workers: 3
- load generator: http://load-generator:19231
- benchmark target host: application-host
- warmup request target/cap: 1000
## Creating organizations (100)
#### Creating 50 organizations [reqs:50, conc:10, rule:`""`]
```
┌─ Best:      824.89µs
├─ Worst:     6.284942ms
├─ Completed: 14.050801ms
├─ Workers:   0=14 1=14 2=22
└─ Errors:    0
```
#### Creating 50 organizations [reqs:50, conc:10, rule:`"@request.body.name != ''"`]
```
┌─ Best:      909.936µs
├─ Worst:     7.379514ms
├─ Completed: 16.828366ms
├─ Workers:   0=14 1=14 2=22
└─ Errors:    0
```

## Creating permissions (50)
#### Creating 25 permissions [reqs:25, conc:5, rule:`""`]
```
┌─ Best:      731.19µs
├─ Worst:     3.79305ms
├─ Completed: 8.21583ms
├─ Workers:   0=6 1=7 2=12
└─ Errors:    0
```
#### Creating 25 permissions [reqs:25, conc:5, rule:`"@request.body.name != ''"`]
```
┌─ Best:      875.189µs
├─ Worst:     4.918174ms
├─ Completed: 10.987098ms
├─ Workers:   0=14 1=8 2=3
└─ Errors:    0
```

## Creating users (500 - expected to be slow due to passwordHash generation)
#### Creating 250 users [reqs:250, conc:50, rule:`""`]
```
┌─ Best:      140.72575ms
├─ Worst:     2.449783639s
├─ Completed: 4.10960821s
├─ Workers:   0=121 1=71 2=58
└─ Errors:    0
```
#### Creating 250 users [reqs:250, conc:50, rule:`"@request.body.email != '' && @request.body.permissions:length > 0"`]
```
┌─ Best:      164.280529ms
├─ Worst:     3.521192404s
├─ Completed: 4.105879367s
├─ Workers:   0=81 1=79 2=90
└─ Errors:    0
```

## Creating posts (10k, 25k, 50k, 100k)
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`""`]
```
┌─ Best:      11.692693ms
├─ Worst:     268.83464ms
├─ Completed: 555.005782ms
├─ Workers:   0=1662 1=1607 2=1731
└─ Errors:    0
```
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      14.896609ms
├─ Worst:     270.655827ms
├─ Completed: 732.158682ms
├─ Workers:   0=1571 1=1640 2=1789
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`""`]
```
┌─ Best:      3.250731ms
├─ Worst:     753.962442ms
├─ Completed: 1.317338486s
├─ Workers:   0=4152 1=3008 2=5340
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      5.711499ms
├─ Worst:     494.433236ms
├─ Completed: 1.802559845s
├─ Workers:   0=4496 1=4129 2=3875
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`""`]
```
┌─ Best:      1.70086ms
├─ Worst:     972.67952ms
├─ Completed: 2.253759408s
├─ Workers:   0=9994 1=6878 2=8128
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      542.339µs
├─ Worst:     664.131268ms
├─ Completed: 3.250806028s
├─ Workers:   0=8406 1=7650 2=8944
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`""`]
```
┌─ Best:      341.362µs
├─ Worst:     625.590909ms
├─ Completed: 4.434188195s
├─ Workers:   0=18215 1=16098 2=15687
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      1.634438ms
├─ Worst:     654.355665ms
├─ Completed: 6.3373776s
├─ Workers:   0=15354 1=17528 2=17118
└─ Errors:    0
```

## User auth with password (expected to be slow due to passwordHash verification)
#### users auth with email/pass - high concurrency [reqs:250, conc:250]
```
┌─ Best:      106.690543ms
├─ Worst:     4.069326072s
├─ Completed: 4.069643221s
├─ Workers:   0=80 1=87 2=83
└─ Errors:    0
```
#### users auth with email/pass - small concurrency [reqs:250, conc:10]
```
┌─ Best:      63.797612ms
├─ Worst:     448.221098ms
├─ Completed: 4.055333081s
├─ Workers:   0=100 1=72 2=78
└─ Errors:    0
```

## User auth refresh
#### users - auth refresh (high concurrency) [reqs:1000, conc:1000]
```
┌─ Best:      28.396327ms
├─ Worst:     99.945275ms
├─ Completed: 101.462431ms
├─ Workers:   0=331 1=320 2=349
└─ Errors:    0
```
#### users - auth refresh (medium concurrency) [reqs:1000, conc:100]
```
┌─ Best:      357.985µs
├─ Worst:     31.730753ms
├─ Completed: 103.616518ms
├─ Workers:   0=309 1=312 2=379
└─ Errors:    0
```

## List records
#### users - getOne for auth refresh comparison (medium concurrency) [reqs:1000, conc:100, rule:`""`, query:`/p7thufs5g4jug1p`]
```
┌─ Best:      320.262µs
├─ Worst:     25.784029ms
├─ Completed: 92.279787ms
├─ Workers:   0=318 1=324 2=358
└─ Errors:    0
```
#### users - getOne for auth refresh comparison (high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`/p7thufs5g4jug1p`]
```
┌─ Best:      23.664921ms
├─ Worst:     96.129855ms
├─ Completed: 97.961274ms
├─ Workers:   0=390 1=261 2=349
└─ Errors:    0
```
#### posts10k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      782.942µs
├─ Worst:     6.589042ms
├─ Completed: 1.667123422s
├─ Workers:   0=392 1=373 2=235
└─ Errors:    0
```
#### posts10k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      25.734581ms
├─ Worst:     295.865352ms
├─ Completed: 298.537373ms
├─ Workers:   0=308 1=316 2=376
└─ Errors:    0
```
#### posts10k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      26.004473ms
├─ Worst:     164.183495ms
├─ Completed: 165.742709ms
├─ Workers:   0=358 1=354 2=288
└─ Errors:    0
```
#### posts10k - mixed read and write (simpleA list with additional 300 concurrent random posts10k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      44.988046ms
├─ Worst:     303.696449ms
├─ Completed: 305.467937ms
├─ Workers:   0=358 1=354 2=288
└─ Errors:    0
```
#### posts10k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.646714ms
├─ Worst:     19.214373ms
├─ Completed: 80.383443ms
├─ Workers:   0=44 1=21 2=35
└─ Errors:    0
```
#### posts10k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      1.583818ms
├─ Worst:     16.023655ms
├─ Completed: 89.985097ms
├─ Workers:   0=25 1=30 2=45
└─ Errors:    0
```
#### posts10k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      1.726545ms
├─ Worst:     23.531096ms
├─ Completed: 103.876917ms
├─ Workers:   0=31 1=16 2=53
└─ Errors:    0
```
#### posts10k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      2.595977ms
├─ Worst:     32.303856ms
├─ Completed: 136.612138ms
├─ Workers:   0=27 1=26 2=47
└─ Errors:    0
```
#### posts10k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.041589ms
├─ Worst:     17.693363ms
├─ Completed: 63.246438ms
├─ Workers:   0=32 1=32 2=36
└─ Errors:    0
```
#### posts10k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.829646ms
├─ Worst:     42.90505ms
├─ Completed: 116.983102ms
├─ Workers:   0=30 1=29 2=41
└─ Errors:    0
```
#### posts10k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      871.624µs
├─ Worst:     10.000525ms
├─ Completed: 40.826639ms
├─ Workers:   0=31 1=32 2=37
└─ Errors:    0
```
#### posts10k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      834.053µs
├─ Worst:     9.802761ms
├─ Completed: 37.375903ms
├─ Workers:   0=32 1=29 2=39
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.04766ms
├─ Worst:     44.59179ms
├─ Completed: 122.362533ms
├─ Workers:   0=32 1=33 2=35
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      874.968µs
├─ Worst:     8.156278ms
├─ Completed: 41.422702ms
├─ Workers:   0=31 1=30 2=39
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      835.795µs
├─ Worst:     11.033212ms
├─ Completed: 42.702209ms
├─ Workers:   0=32 1=33 2=35
└─ Errors:    0
```
#### posts10k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      5.116588ms
├─ Worst:     43.649828ms
├─ Completed: 149.718452ms
├─ Workers:   0=54 1=46
└─ Errors:    0
```
#### posts10k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      4.029726ms
├─ Worst:     36.753021ms
├─ Completed: 134.836256ms
├─ Workers:   0=47 1=53
└─ Errors:    0
```
#### posts10k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.170938ms
├─ Worst:     6.646351ms
├─ Completed: 37.585882ms
├─ Workers:   0=44 1=21 2=35
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      13.341991ms
├─ Worst:     138.459879ms
├─ Completed: 699.062642ms
├─ Workers:   0=25 1=30 2=45
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.176885ms
├─ Worst:     10.140349ms
├─ Completed: 53.121913ms
├─ Workers:   0=31 1=16 2=53
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      5.548845ms
├─ Worst:     81.677341ms
├─ Completed: 341.581635ms
├─ Workers:   0=27 1=26 2=47
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.229609ms
├─ Worst:     6.755582ms
├─ Completed: 40.531972ms
├─ Workers:   0=32 1=32 2=36
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      8.18004ms
├─ Worst:     100.96958ms
├─ Completed: 461.335113ms
├─ Workers:   0=30 1=29 2=41
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      980.525µs
├─ Worst:     12.660929ms
├─ Completed: 46.010791ms
├─ Workers:   0=31 1=32 2=37
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      36.718684ms
├─ Worst:     354.303208ms
├─ Completed: 1.72926943s
├─ Workers:   0=32 1=29 2=39
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.550672ms
├─ Worst:     22.154724ms
├─ Completed: 85.767359ms
├─ Workers:   0=32 1=33 2=35
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      97.688237ms
├─ Worst:     1.162911298s
├─ Completed: 4.966301571s
├─ Workers:   0=31 1=30 2=39
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.38946ms
├─ Worst:     24.748439ms
├─ Completed: 72.021311ms
├─ Workers:   0=32 1=33 2=35
└─ Errors:    0
```
#### posts25k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.951495ms
├─ Worst:     6.401593ms
├─ Completed: 2.680317576s
├─ Workers:   0=353 1=314 2=333
└─ Errors:    0
```
#### posts25k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      22.461629ms
├─ Worst:     464.909492ms
├─ Completed: 466.503414ms
├─ Workers:   0=355 1=320 2=325
└─ Errors:    0
```
#### posts25k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      23.677247ms
├─ Worst:     201.799108ms
├─ Completed: 203.411214ms
├─ Workers:   0=298 1=410 2=292
└─ Errors:    0
```
#### posts25k - mixed read and write (simpleA list with additional 300 concurrent random posts25k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      25.121433ms
├─ Worst:     518.271617ms
├─ Completed: 520.508466ms
├─ Workers:   0=298 1=410 2=292
└─ Errors:    0
```
#### posts25k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.421042ms
├─ Worst:     19.914971ms
├─ Completed: 94.551373ms
├─ Workers:   0=40 1=4 2=56
└─ Errors:    0
```
#### posts25k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      1.943144ms
├─ Worst:     26.707314ms
├─ Completed: 127.810108ms
├─ Workers:   0=29 1=10 2=61
└─ Errors:    0
```
#### posts25k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      1.675475ms
├─ Worst:     26.449548ms
├─ Completed: 119.603312ms
├─ Workers:   0=55 1=10 2=35
└─ Errors:    0
```
#### posts25k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      2.604048ms
├─ Worst:     53.000286ms
├─ Completed: 189.082862ms
├─ Workers:   0=52 1=24 2=24
└─ Errors:    0
```
#### posts25k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.722139ms
├─ Worst:     21.761191ms
├─ Completed: 83.983786ms
├─ Workers:   0=40 1=30 2=30
└─ Errors:    0
```
#### posts25k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      4.089139ms
├─ Worst:     76.329192ms
├─ Completed: 249.804532ms
├─ Workers:   0=43 1=29 2=28
└─ Errors:    0
```
#### posts25k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      885.994µs
├─ Worst:     11.022507ms
├─ Completed: 46.701925ms
├─ Workers:   0=43 1=28 2=29
└─ Errors:    0
```
#### posts25k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.075806ms
├─ Worst:     7.843876ms
├─ Completed: 38.724605ms
├─ Workers:   0=39 1=30 2=31
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      5.79776ms
├─ Worst:     67.598041ms
├─ Completed: 244.327447ms
├─ Workers:   0=42 1=29 2=29
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      893.774µs
├─ Worst:     9.782414ms
├─ Completed: 45.587585ms
├─ Workers:   0=43 1=31 2=26
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      891.711µs
├─ Worst:     9.78659ms
├─ Completed: 44.800668ms
├─ Workers:   0=22 1=36 2=42
└─ Errors:    0
```
#### posts25k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      13.874967ms
├─ Worst:     82.03948ms
├─ Completed: 430.48088ms
├─ Workers:   1=49 2=51
└─ Errors:    0
```
#### posts25k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      40.218598ms
├─ Worst:     96.180064ms
├─ Completed: 577.952819ms
├─ Workers:   1=100
└─ Errors:    0
```
#### posts25k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      866.377µs
├─ Worst:     8.026477ms
├─ Completed: 49.048596ms
├─ Workers:   0=40 1=4 2=56
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      37.320925ms
├─ Worst:     414.371387ms
├─ Completed: 2.40074913s
├─ Workers:   0=29 1=10 2=61
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.055728ms
├─ Worst:     11.255859ms
├─ Completed: 58.164509ms
├─ Workers:   0=55 1=10 2=35
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      15.083837ms
├─ Worst:     209.800381ms
├─ Completed: 974.05547ms
├─ Workers:   0=52 1=24 2=24
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      940.659µs
├─ Worst:     9.885626ms
├─ Completed: 43.743828ms
├─ Workers:   0=40 1=30 2=30
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      19.61121ms
├─ Worst:     170.313093ms
├─ Completed: 1.006915435s
├─ Workers:   0=43 1=29 2=28
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.411569ms
├─ Worst:     9.50525ms
├─ Completed: 44.402208ms
├─ Workers:   0=43 1=28 2=29
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      95.610407ms
├─ Worst:     1.019795377s
├─ Completed: 4.87671698s
├─ Workers:   0=39 1=30 2=31
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.484721ms
├─ Worst:     15.407034ms
├─ Completed: 76.031961ms
├─ Workers:   0=42 1=29 2=29
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      302.92141ms
├─ Worst:     2.530409864s
├─ Completed: 13.570133874s
├─ Workers:   0=43 1=31 2=26
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      959.385µs
├─ Worst:     12.801164ms
├─ Completed: 65.004688ms
├─ Workers:   0=22 1=36 2=42
└─ Errors:    0
```
#### posts50k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.868071ms
├─ Worst:     29.154804ms
├─ Completed: 4.374784879s
├─ Workers:   0=341 1=314 2=345
└─ Errors:    0
```
#### posts50k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      22.930717ms
├─ Worst:     855.313447ms
├─ Completed: 857.147161ms
├─ Workers:   0=323 1=323 2=354
└─ Errors:    0
```
#### posts50k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      32.175788ms
├─ Worst:     163.913993ms
├─ Completed: 165.977773ms
├─ Workers:   0=332 1=391 2=277
└─ Errors:    0
```
#### posts50k - mixed read and write (simpleA list with additional 300 concurrent random posts50k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      26.353354ms
├─ Worst:     929.769414ms
├─ Completed: 931.885487ms
├─ Workers:   0=332 1=391 2=277
└─ Errors:    0
```
#### posts50k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      2.726436ms
├─ Worst:     46.701334ms
├─ Completed: 173.017178ms
├─ Workers:   0=20 1=18 2=62
└─ Errors:    0
```
#### posts50k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      3.868113ms
├─ Worst:     49.577316ms
├─ Completed: 222.691698ms
├─ Workers:   0=22 1=6 2=72
└─ Errors:    0
```
#### posts50k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      2.979916ms
├─ Worst:     52.775665ms
├─ Completed: 223.402861ms
├─ Workers:   0=63 1=8 2=29
└─ Errors:    0
```
#### posts50k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      3.222893ms
├─ Worst:     64.54273ms
├─ Completed: 216.677061ms
├─ Workers:   0=44 1=29 2=27
└─ Errors:    0
```
#### posts50k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.929245ms
├─ Worst:     31.014725ms
├─ Completed: 128.502004ms
├─ Workers:   0=41 1=30 2=29
└─ Errors:    0
```
#### posts50k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      17.669008ms
├─ Worst:     149.970811ms
├─ Completed: 814.574172ms
├─ Workers:   0=40 1=30 2=30
└─ Errors:    0
```
#### posts50k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.103955ms
├─ Worst:     8.15205ms
├─ Completed: 39.996322ms
├─ Workers:   0=42 1=28 2=30
└─ Errors:    0
```
#### posts50k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      846.469µs
├─ Worst:     6.548877ms
├─ Completed: 43.271906ms
├─ Workers:   0=42 1=29 2=29
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      17.316842ms
├─ Worst:     150.892876ms
├─ Completed: 843.909115ms
├─ Workers:   0=41 1=30 2=29
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      981.776µs
├─ Worst:     8.895508ms
├─ Completed: 40.898798ms
├─ Workers:   0=41 1=30 2=29
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.087533ms
├─ Worst:     6.613126ms
├─ Completed: 36.835846ms
├─ Workers:   0=42 1=27 2=31
└─ Errors:    0
```
#### posts50k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      17.985576ms
├─ Worst:     157.551954ms
├─ Completed: 907.06596ms
├─ Workers:   0=10 1=45 2=45
└─ Errors:    0
```
#### posts50k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      60.171191ms
├─ Worst:     166.42508ms
├─ Completed: 1.214711586s
├─ Workers:   1=100
└─ Errors:    0
```
#### posts50k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.05006ms
├─ Worst:     7.994403ms
├─ Completed: 47.830254ms
├─ Workers:   0=20 1=18 2=62
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      80.584042ms
├─ Worst:     868.738224ms
├─ Completed: 6.293311263s
├─ Workers:   0=22 1=6 2=72
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.318612ms
├─ Worst:     11.023859ms
├─ Completed: 69.021297ms
├─ Workers:   0=63 1=8 2=29
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      39.24273ms
├─ Worst:     301.17038ms
├─ Completed: 1.81261147s
├─ Workers:   0=44 1=29 2=27
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      931.337µs
├─ Worst:     13.186145ms
├─ Completed: 52.156149ms
├─ Workers:   0=41 1=30 2=29
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      45.481618ms
├─ Worst:     488.44976ms
├─ Completed: 2.401357021s
├─ Workers:   0=40 1=30 2=30
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      844.086µs
├─ Worst:     10.593153ms
├─ Completed: 47.837334ms
├─ Workers:   0=42 1=28 2=30
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      191.220584ms
├─ Worst:     1.889513284s
├─ Completed: 10.035251186s
├─ Workers:   0=42 1=29 2=29
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.394918ms
├─ Worst:     15.780308ms
├─ Completed: 87.855703ms
├─ Workers:   0=41 1=30 2=29
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      494.992711ms
├─ Worst:     4.446779743s
├─ Completed: 25.83453448s
├─ Workers:   0=41 1=30 2=29
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.225313ms
├─ Worst:     13.856071ms
├─ Completed: 61.144026ms
├─ Workers:   0=42 1=27 2=31
└─ Errors:    0
```
#### posts100k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      3.205128ms
├─ Worst:     15.190843ms
├─ Completed: 5.953326409s
├─ Workers:   0=324 1=323 2=353
└─ Errors:    0
```
#### posts100k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      28.639582ms
├─ Worst:     1.528551872s
├─ Completed: 1.530443835s
├─ Workers:   0=324 1=323 2=353
└─ Errors:    0
```
#### posts100k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      26.7202ms
├─ Worst:     199.198862ms
├─ Completed: 202.303781ms
├─ Workers:   0=324 1=390 2=286
└─ Errors:    0
```
#### posts100k - mixed read and write (simpleA list with additional 300 concurrent random posts100k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      27.563066ms
├─ Worst:     1.666977183s
├─ Completed: 1.668760875s
├─ Workers:   0=324 1=390 2=286
└─ Errors:    0
```
#### posts100k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      4.599334ms
├─ Worst:     67.603106ms
├─ Completed: 315.603913ms
├─ Workers:   0=18 1=21 2=61
└─ Errors:    0
```
#### posts100k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      6.781999ms
├─ Worst:     60.740737ms
├─ Completed: 292.273616ms
├─ Workers:   0=33 1=3 2=64
└─ Errors:    0
```
#### posts100k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      4.96545ms
├─ Worst:     55.970337ms
├─ Completed: 271.643066ms
├─ Workers:   0=66 1=4 2=30
└─ Errors:    0
```
#### posts100k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      4.875817ms
├─ Worst:     58.725684ms
├─ Completed: 292.200443ms
├─ Workers:   0=42 1=29 2=29
└─ Errors:    0
```
#### posts100k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      3.364918ms
├─ Worst:     49.130268ms
├─ Completed: 191.660509ms
├─ Workers:   0=42 1=30 2=28
└─ Errors:    0
```
#### posts100k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      32.123745ms
├─ Worst:     280.891802ms
├─ Completed: 1.557140384s
├─ Workers:   0=45 1=27 2=28
└─ Errors:    0
```
#### posts100k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.028841ms
├─ Worst:     7.119135ms
├─ Completed: 35.321613ms
├─ Workers:   0=44 1=28 2=28
└─ Errors:    0
```
#### posts100k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      882.109µs
├─ Worst:     12.215615ms
├─ Completed: 40.411504ms
├─ Workers:   0=43 1=28 2=29
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      65.944384ms
├─ Worst:     207.643318ms
├─ Completed: 1.464156416s
├─ Workers:   0=45 1=27 2=28
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      958.934µs
├─ Worst:     11.455995ms
├─ Completed: 41.262369ms
├─ Workers:   0=44 1=28 2=28
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      945.005µs
├─ Worst:     11.364298ms
├─ Completed: 47.882665ms
├─ Workers:   0=26 1=36 2=38
└─ Errors:    0
```
#### posts100k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      87.166751ms
├─ Worst:     236.545851ms
├─ Completed: 1.839558044s
├─ Workers:   1=49 2=51
└─ Errors:    0
```
#### posts100k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      76.666376ms
├─ Worst:     335.603541ms
├─ Completed: 2.981187635s
├─ Workers:   1=100
└─ Errors:    0
```
#### posts100k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.101943ms
├─ Worst:     7.09382ms
├─ Completed: 46.025519ms
├─ Workers:   0=18 1=21 2=61
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      176.968834ms
├─ Worst:     1.849202697s
├─ Completed: 11.762974698s
├─ Workers:   0=33 1=3 2=64
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.162416ms
├─ Worst:     10.716423ms
├─ Completed: 58.575606ms
├─ Workers:   0=66 1=4 2=30
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      65.995936ms
├─ Worst:     752.476086ms
├─ Completed: 3.935662439s
├─ Workers:   0=42 1=29 2=29
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      971.132µs
├─ Worst:     9.732043ms
├─ Completed: 42.598185ms
├─ Workers:   0=42 1=30 2=28
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      107.649558ms
├─ Worst:     806.893477ms
├─ Completed: 4.433564818s
├─ Workers:   0=45 1=27 2=28
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.162997ms
├─ Worst:     8.122691ms
├─ Completed: 43.466405ms
├─ Workers:   0=44 1=28 2=28
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      398.996451ms
├─ Worst:     4.092292356s
├─ Completed: 19.979599432s
├─ Workers:   0=43 1=28 2=29
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.727866ms
├─ Worst:     22.691657ms
├─ Completed: 82.924782ms
├─ Workers:   0=45 1=27 2=28
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      982.97824ms
├─ Worst:     9.985378288s
├─ Completed: 49.123954347s
├─ Workers:   0=44 1=28 2=28
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.113589ms
├─ Worst:     11.055723ms
├─ Completed: 63.626093ms
├─ Workers:   1=49 2=51
└─ Errors:    0
```

## Go vs JS route execution
#### JS route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      47.563264ms
├─ Worst:     2.541592669s
├─ Completed: 2.542529774s
├─ Workers:   0=159 1=157 2=184
└─ Errors:    0
```
#### Go route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      28.640063ms
├─ Worst:     2.698902676s
├─ Completed: 2.699891953s
├─ Workers:   0=219 1=140 2=141
└─ Errors:    0
```
#### JS route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      11.420696ms
├─ Worst:     560.414732ms
├─ Completed: 2.570753181s
├─ Workers:   0=176 1=162 2=162
└─ Errors:    0
```
#### Go route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      10.40262ms
├─ Worst:     778.870797ms
├─ Completed: 2.577545563s
├─ Workers:   0=112 1=205 2=183
└─ Errors:    0
```
#### JS route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      8.880649ms
├─ Worst:     27.455618ms
├─ Completed: 7.88333417s
├─ Workers:   0=222 1=125 2=153
└─ Errors:    0
```
#### Go route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      9.791377ms
├─ Worst:     25.93828ms
├─ Completed: 8.786798939s
├─ Workers:   0=156 1=181 2=163
└─ Errors:    0
```

## Go vs JS hooks execution
#### JS OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      943.344µs
├─ Worst:     15.895598ms
├─ Completed: 50.957513ms
├─ Workers:   0=28 1=44 2=28
└─ Errors:    0
```
#### Go OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      780.609µs
├─ Worst:     8.38943ms
├─ Completed: 49.603562ms
├─ Workers:   0=16 1=24 2=60
└─ Errors:    0
```

## Deleting records
#### deleting 100 posts10k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      895.677µs
├─ Worst:     8.760011ms
├─ Completed: 45.379777ms
├─ Workers:   0=46 1=7 2=47
└─ Errors:    0
```
#### deleting 100 posts10k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      736.027µs
├─ Worst:     8.797974ms
├─ Completed: 47.880031ms
├─ Workers:   0=88 2=12
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      743.106µs
├─ Worst:     21.968748ms
├─ Completed: 48.172705ms
├─ Workers:   0=29 1=43 2=28
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      777.364µs
├─ Worst:     14.310749ms
├─ Completed: 51.686619ms
├─ Workers:   0=29 1=42 2=29
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      721.257µs
├─ Worst:     11.95163ms
├─ Completed: 40.339626ms
├─ Workers:   0=30 1=33 2=37
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      841.513µs
├─ Worst:     12.480049ms
├─ Completed: 47.313649ms
├─ Workers:   0=29 1=29 2=42
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      816.358µs
├─ Worst:     10.367823ms
├─ Completed: 50.866207ms
├─ Workers:   0=59 1=15 2=26
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      774.921µs
├─ Worst:     9.617716ms
├─ Completed: 43.839369ms
├─ Workers:   0=27 1=46 2=27
└─ Errors:    0
```
#### deleting 100 users - with cascade deleting all associated posts [conc:10, rule:`""`]
```
┌─ Best:      69.066608ms
├─ Worst:     1.750388816s
├─ Completed: 7.826787565s
├─ Workers:   0=13 1=47 2=40
└─ Errors:    0
```
#### deleting 100 organizations - with cascade deleting all users and associated posts [conc:10, rule:`""`]
```
┌─ Best:      1.263916ms
├─ Worst:     6.198236054s
├─ Completed: 18.65971218s
├─ Workers:   0=28 1=44 2=28
└─ Errors:    0
```

---------------------------------------------------
Completed!
