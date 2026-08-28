# PocketBun Upstream-Port Benchmark Result

- machine: hetzner-8vcpu-pocketbun-5
- timestamp: 2026-08-27T21:30:10.459Z
- tests: create,auth,search,custom,delete
- benchmark source: 05625dc2b2d3f9711c51566010944b10ca9531fa
- server workers: 5
- load generator: http://load-generator:19231
- benchmark target host: application-host
- warmup request target/cap: 1000
## Creating organizations (100)
#### Creating 50 organizations [reqs:50, conc:10, rule:`""`]
```
┌─ Best:      821.583µs
├─ Worst:     6.649075ms
├─ Completed: 12.964092ms
├─ Workers:   1=6 2=16 3=17 4=11
└─ Errors:    0
```
#### Creating 50 organizations [reqs:50, conc:10, rule:`"@request.body.name != ''"`]
```
┌─ Best:      716.208µs
├─ Worst:     12.665819ms
├─ Completed: 12.926569ms
├─ Workers:   1=12 2=9 3=15 4=14
└─ Errors:    0
```

## Creating permissions (50)
#### Creating 25 permissions [reqs:25, conc:5, rule:`""`]
```
┌─ Best:      699.825µs
├─ Worst:     3.176543ms
├─ Completed: 7.96426ms
├─ Workers:   1=7 2=1 3=8 4=9
└─ Errors:    0
```
#### Creating 25 permissions [reqs:25, conc:5, rule:`"@request.body.name != ''"`]
```
┌─ Best:      714.616µs
├─ Worst:     4.445164ms
├─ Completed: 9.082385ms
├─ Workers:   0=2 1=3 2=6 3=7 4=7
└─ Errors:    0
```

## Creating users (500 - expected to be slow due to passwordHash generation)
#### Creating 250 users [reqs:250, conc:50, rule:`""`]
```
┌─ Best:      106.815891ms
├─ Worst:     1.105603779s
├─ Completed: 2.050341529s
├─ Workers:   0=33 1=57 2=52 3=71 4=37
└─ Errors:    0
```
#### Creating 250 users [reqs:250, conc:50, rule:`"@request.body.email != '' && @request.body.permissions:length > 0"`]
```
┌─ Best:      109.891835ms
├─ Worst:     994.681382ms
├─ Completed: 2.058375664s
├─ Workers:   0=60 1=71 2=42 3=28 4=49
└─ Errors:    0
```

## Creating posts (10k, 25k, 50k, 100k)
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`""`]
```
┌─ Best:      2.873636ms
├─ Worst:     360.641932ms
├─ Completed: 429.296087ms
├─ Workers:   0=908 1=1115 2=709 3=1122 4=1146
└─ Errors:    0
```
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      3.738359ms
├─ Worst:     378.399968ms
├─ Completed: 426.083854ms
├─ Workers:   0=1157 1=1140 2=719 3=1092 4=892
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`""`]
```
┌─ Best:      3.98564ms
├─ Worst:     300.279118ms
├─ Completed: 856.943708ms
├─ Workers:   0=2319 1=2468 2=2578 3=2716 4=2419
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      3.568385ms
├─ Worst:     744.612757ms
├─ Completed: 1.015403571s
├─ Workers:   0=2279 1=2811 2=1659 3=2905 4=2846
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`""`]
```
┌─ Best:      2.18039ms
├─ Worst:     460.165898ms
├─ Completed: 1.513743811s
├─ Workers:   0=5060 1=5351 2=4241 3=5357 4=4991
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      964.701µs
├─ Worst:     350.953792ms
├─ Completed: 1.810460081s
├─ Workers:   0=4788 1=4471 2=5618 3=5076 4=5047
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`""`]
```
┌─ Best:      5.457471ms
├─ Worst:     418.514669ms
├─ Completed: 2.927334255s
├─ Workers:   0=9668 1=10211 2=9599 3=10562 4=9960
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      2.313613ms
├─ Worst:     599.40231ms
├─ Completed: 3.576590726s
├─ Workers:   0=9783 1=10720 2=10246 3=8370 4=10881
└─ Errors:    0
```

## User auth with password (expected to be slow due to passwordHash verification)
#### users auth with email/pass - high concurrency [reqs:250, conc:250]
```
┌─ Best:      222.167911ms
├─ Worst:     2.036425952s
├─ Completed: 2.036875592s
├─ Workers:   0=41 1=60 2=21 3=63 4=65
└─ Errors:    0
```
#### users auth with email/pass - small concurrency [reqs:250, conc:10]
```
┌─ Best:      61.962571ms
├─ Worst:     151.026092ms
├─ Completed: 2.077757984s
├─ Workers:   0=26 1=69 2=46 3=64 4=45
└─ Errors:    0
```

## User auth refresh
#### users - auth refresh (high concurrency) [reqs:1000, conc:1000]
```
┌─ Best:      33.095603ms
├─ Worst:     77.184318ms
├─ Completed: 79.812694ms
├─ Workers:   0=214 1=186 2=220 3=189 4=191
└─ Errors:    0
```
#### users - auth refresh (medium concurrency) [reqs:1000, conc:100]
```
┌─ Best:      367.647µs
├─ Worst:     31.830298ms
├─ Completed: 82.829759ms
├─ Workers:   0=137 1=132 2=224 3=254 4=253
└─ Errors:    0
```

## List records
#### users - getOne for auth refresh comparison (medium concurrency) [reqs:1000, conc:100, rule:`""`, query:`/w1l624z6ugt1cqg`]
```
┌─ Best:      465.892µs
├─ Worst:     16.271275ms
├─ Completed: 70.099041ms
├─ Workers:   0=211 1=239 2=204 3=149 4=197
└─ Errors:    0
```
#### users - getOne for auth refresh comparison (high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`/w1l624z6ugt1cqg`]
```
┌─ Best:      25.581775ms
├─ Worst:     67.522474ms
├─ Completed: 69.23693ms
├─ Workers:   0=191 1=236 2=206 3=184 4=183
└─ Errors:    0
```
#### posts10k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.228104ms
├─ Worst:     4.832549ms
├─ Completed: 1.645831458s
├─ Workers:   0=127 1=200 2=200 3=220 4=253
└─ Errors:    0
```
#### posts10k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      27.416696ms
├─ Worst:     198.570455ms
├─ Completed: 200.33516ms
├─ Workers:   0=209 1=187 2=220 3=220 4=164
└─ Errors:    0
```
#### posts10k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      34.993432ms
├─ Worst:     128.615494ms
├─ Completed: 130.826005ms
├─ Workers:   0=218 1=161 2=216 3=155 4=250
└─ Errors:    0
```
#### posts10k - mixed read and write (simpleA list with additional 300 concurrent random posts10k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      39.339179ms
├─ Worst:     201.613796ms
├─ Completed: 203.542677ms
├─ Workers:   0=215 1=165 2=216 3=154 4=250
└─ Errors:    0
```
#### posts10k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.967084ms
├─ Worst:     12.07952ms
├─ Completed: 56.632594ms
├─ Workers:   0=23 1=32 2=19 3=21 4=5
└─ Errors:    0
```
#### posts10k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      1.312421ms
├─ Worst:     20.714787ms
├─ Completed: 94.789855ms
├─ Workers:   0=8 1=30 2=29 3=22 4=11
└─ Errors:    0
```
#### posts10k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      1.38318ms
├─ Worst:     27.235667ms
├─ Completed: 99.437869ms
├─ Workers:   0=12 1=47 2=10 3=22 4=9
└─ Errors:    0
```
#### posts10k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      3.357423ms
├─ Worst:     31.415104ms
├─ Completed: 128.831222ms
├─ Workers:   0=13 1=21 2=13 3=42 4=11
└─ Errors:    0
```
#### posts10k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      891.241µs
├─ Worst:     10.35497ms
├─ Completed: 41.947658ms
├─ Workers:   0=15 1=25 2=16 3=19 4=25
└─ Errors:    0
```
#### posts10k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.286005ms
├─ Worst:     33.398691ms
├─ Completed: 98.110876ms
├─ Workers:   0=16 1=26 2=15 3=18 4=25
└─ Errors:    0
```
#### posts10k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      846.358µs
├─ Worst:     4.548127ms
├─ Completed: 23.108631ms
├─ Workers:   0=16 1=25 2=16 3=18 4=25
└─ Errors:    0
```
#### posts10k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      875.047µs
├─ Worst:     6.384651ms
├─ Completed: 22.613948ms
├─ Workers:   0=16 1=25 2=16 3=19 4=24
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.802287ms
├─ Worst:     33.25265ms
├─ Completed: 86.785086ms
├─ Workers:   0=16 1=25 2=16 3=19 4=24
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      858.195µs
├─ Worst:     9.154133ms
├─ Completed: 31.091408ms
├─ Workers:   0=21 1=8 2=21 3=17 4=33
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      816.006µs
├─ Worst:     7.400082ms
├─ Completed: 27.226883ms
├─ Workers:   0=20 2=21 3=32 4=27
└─ Errors:    0
```
#### posts10k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      3.319611ms
├─ Worst:     38.230729ms
├─ Completed: 126.575058ms
├─ Workers:   0=31 2=19 3=16 4=34
└─ Errors:    0
```
#### posts10k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      3.808946ms
├─ Worst:     39.743237ms
├─ Completed: 144.726939ms
├─ Workers:   0=36 1=3 2=57 3=4
└─ Errors:    0
```
#### posts10k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      844.525µs
├─ Worst:     7.187519ms
├─ Completed: 31.353119ms
├─ Workers:   0=22 1=31 2=19 3=21 4=7
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      14.461158ms
├─ Worst:     188.24099ms
├─ Completed: 637.977116ms
├─ Workers:   0=7 1=32 2=29 3=21 4=11
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.200476ms
├─ Worst:     8.749755ms
├─ Completed: 44.842515ms
├─ Workers:   0=13 1=46 2=10 3=22 4=9
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      5.553865ms
├─ Worst:     66.750889ms
├─ Completed: 278.735426ms
├─ Workers:   0=12 1=21 2=13 3=41 4=13
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      943.111µs
├─ Worst:     10.104254ms
├─ Completed: 34.070107ms
├─ Workers:   0=17 1=23 2=16 3=20 4=24
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      7.222517ms
├─ Worst:     72.201791ms
├─ Completed: 279.222409ms
├─ Workers:   0=15 1=28 2=16 3=17 4=24
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.000581ms
├─ Worst:     5.18891ms
├─ Completed: 27.128317ms
├─ Workers:   0=16 1=25 2=15 3=18 4=26
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      32.415085ms
├─ Worst:     191.119883ms
├─ Completed: 956.73083ms
├─ Workers:   0=17 1=25 2=15 3=18 4=25
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.171457ms
├─ Worst:     14.078779ms
├─ Completed: 68.53552ms
├─ Workers:   0=15 1=25 2=17 3=19 4=24
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      96.556782ms
├─ Worst:     1.022969681s
├─ Completed: 3.776880686s
├─ Workers:   0=21 1=5 2=22 3=20 4=32
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.542079ms
├─ Worst:     13.686588ms
├─ Completed: 56.901898ms
├─ Workers:   0=20 2=21 3=32 4=27
└─ Errors:    0
```
#### posts25k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.901174ms
├─ Worst:     5.706416ms
├─ Completed: 2.625856823s
├─ Workers:   0=186 1=236 2=209 3=197 4=172
└─ Errors:    0
```
#### posts25k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      24.938776ms
├─ Worst:     282.948371ms
├─ Completed: 285.626797ms
├─ Workers:   0=194 1=190 2=222 3=214 4=180
└─ Errors:    0
```
#### posts25k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      26.494884ms
├─ Worst:     128.095567ms
├─ Completed: 129.86585ms
├─ Workers:   0=160 1=188 2=190 3=209 4=253
└─ Errors:    0
```
#### posts25k - mixed read and write (simpleA list with additional 300 concurrent random posts25k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      39.25293ms
├─ Worst:     322.657141ms
├─ Completed: 324.811684ms
├─ Workers:   0=160 1=188 2=192 3=207 4=253
└─ Errors:    0
```
#### posts25k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.46376ms
├─ Worst:     19.94151ms
├─ Completed: 90.900737ms
├─ Workers:   0=21 1=29 2=29 3=21
└─ Errors:    0
```
#### posts25k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      1.73832ms
├─ Worst:     16.753171ms
├─ Completed: 82.487235ms
├─ Workers:   0=17 1=30 2=26 3=21 4=6
└─ Errors:    0
```
#### posts25k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      1.791283ms
├─ Worst:     27.140865ms
├─ Completed: 109.826596ms
├─ Workers:   0=22 1=24 2=22 3=20 4=12
└─ Errors:    0
```
#### posts25k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      2.593098ms
├─ Worst:     39.861511ms
├─ Completed: 128.992335ms
├─ Workers:   0=20 1=16 2=23 3=25 4=16
└─ Errors:    0
```
#### posts25k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.699284ms
├─ Worst:     19.625223ms
├─ Completed: 75.424709ms
├─ Workers:   0=15 1=16 2=26 3=27 4=16
└─ Errors:    0
```
#### posts25k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      5.113547ms
├─ Worst:     68.660365ms
├─ Completed: 192.409884ms
├─ Workers:   0=20 1=15 2=25 3=25 4=15
└─ Errors:    0
```
#### posts25k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      869.599µs
├─ Worst:     10.077948ms
├─ Completed: 32.417016ms
├─ Workers:   0=23 1=15 2=23 3=24 4=15
└─ Errors:    0
```
#### posts25k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      810.799µs
├─ Worst:     9.251457ms
├─ Completed: 28.162886ms
├─ Workers:   0=17 1=18 2=18 3=29 4=18
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      4.717731ms
├─ Worst:     64.241416ms
├─ Completed: 203.08787ms
├─ Workers:   0=28 1=16 2=12 3=28 4=16
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      837.736µs
├─ Worst:     9.018206ms
├─ Completed: 30.225892ms
├─ Workers:   0=26 1=15 2=19 3=25 4=15
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      865.164µs
├─ Worst:     6.749825ms
├─ Completed: 25.295829ms
├─ Workers:   0=23 1=18 2=22 3=20 4=17
└─ Errors:    0
```
#### posts25k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      8.557159ms
├─ Worst:     71.389671ms
├─ Completed: 372.786823ms
├─ Workers:   0=8 1=36 2=21 4=35
└─ Errors:    0
```
#### posts25k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      9.994212ms
├─ Worst:     83.564373ms
├─ Completed: 358.692111ms
├─ Workers:   0=3 1=21 2=2 3=2 4=72
└─ Errors:    0
```
#### posts25k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      906.1µs
├─ Worst:     10.016262ms
├─ Completed: 33.2102ms
├─ Workers:   0=21 1=26 2=30 3=22 4=1
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      37.725293ms
├─ Worst:     265.70929ms
├─ Completed: 1.292969784s
├─ Workers:   0=14 1=33 2=26 3=21 4=6
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.155834ms
├─ Worst:     9.994222ms
├─ Completed: 38.243107ms
├─ Workers:   0=24 1=21 2=23 3=19 4=13
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      14.696291ms
├─ Worst:     140.993096ms
├─ Completed: 511.246693ms
├─ Workers:   0=20 1=17 2=21 3=25 4=17
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      995.043µs
├─ Worst:     5.265617ms
├─ Completed: 27.597366ms
├─ Workers:   0=16 1=15 2=26 3=28 4=15
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      19.329385ms
├─ Worst:     134.88031ms
├─ Completed: 578.293408ms
├─ Workers:   0=20 1=15 2=24 3=25 4=16
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      921.201µs
├─ Worst:     9.896648ms
├─ Completed: 36.683144ms
├─ Workers:   0=22 1=14 2=25 3=25 4=14
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      86.701903ms
├─ Worst:     675.092226ms
├─ Completed: 2.571381465s
├─ Workers:   0=17 1=19 2=18 3=28 4=18
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.257435ms
├─ Worst:     11.829105ms
├─ Completed: 63.844999ms
├─ Workers:   0=29 1=17 2=11 3=27 4=16
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      278.637972ms
├─ Worst:     1.400907152s
├─ Completed: 8.305773611s
├─ Workers:   0=27 1=14 2=19 3=25 4=15
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.381035ms
├─ Worst:     9.37682ms
├─ Completed: 49.040728ms
├─ Workers:   0=22 1=19 2=22 3=18 4=19
└─ Errors:    0
```
#### posts50k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.867416ms
├─ Worst:     8.549659ms
├─ Completed: 4.726275044s
├─ Workers:   0=164 1=216 2=216 3=199 4=205
└─ Errors:    0
```
#### posts50k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      25.008593ms
├─ Worst:     515.629541ms
├─ Completed: 517.674823ms
├─ Workers:   0=183 1=219 2=201 3=189 4=208
└─ Errors:    0
```
#### posts50k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      25.9992ms
├─ Worst:     114.995789ms
├─ Completed: 116.626129ms
├─ Workers:   0=199 1=157 2=176 3=247 4=221
└─ Errors:    0
```
#### posts50k - mixed read and write (simpleA list with additional 300 concurrent random posts50k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      35.698946ms
├─ Worst:     538.42519ms
├─ Completed: 540.317881ms
├─ Workers:   0=197 1=157 2=178 3=249 4=219
└─ Errors:    0
```
#### posts50k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      2.101039ms
├─ Worst:     22.743416ms
├─ Completed: 110.841437ms
├─ Workers:   0=26 1=32 2=20 3=15 4=7
└─ Errors:    0
```
#### posts50k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      2.474375ms
├─ Worst:     49.993062ms
├─ Completed: 136.449747ms
├─ Workers:   0=17 1=38 2=26 3=5 4=14
└─ Errors:    0
```
#### posts50k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      3.031203ms
├─ Worst:     29.869111ms
├─ Completed: 173.412277ms
├─ Workers:   0=5 1=39 2=42 3=4 4=10
└─ Errors:    0
```
#### posts50k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      3.595602ms
├─ Worst:     34.197204ms
├─ Completed: 142.460952ms
├─ Workers:   0=12 1=28 2=17 3=27 4=16
└─ Errors:    0
```
#### posts50k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.946926ms
├─ Worst:     25.409977ms
├─ Completed: 96.372157ms
├─ Workers:   0=21 1=25 2=15 3=25 4=14
└─ Errors:    0
```
#### posts50k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      16.403848ms
├─ Worst:     133.770088ms
├─ Completed: 568.126579ms
├─ Workers:   0=25 1=24 2=16 3=21 4=14
└─ Errors:    0
```
#### posts50k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      901.735µs
├─ Worst:     8.305783ms
├─ Completed: 26.507171ms
├─ Workers:   0=25 1=26 2=15 3=20 4=14
└─ Errors:    0
```
#### posts50k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      799.443µs
├─ Worst:     6.824217ms
├─ Completed: 27.57232ms
├─ Workers:   0=24 1=24 2=15 3=23 4=14
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      16.527709ms
├─ Worst:     125.301672ms
├─ Completed: 505.77428ms
├─ Workers:   0=25 1=23 2=15 3=24 4=13
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      863.292µs
├─ Worst:     10.810239ms
├─ Completed: 38.856123ms
├─ Workers:   0=28 1=5 2=19 3=29 4=19
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      808.966µs
├─ Worst:     9.836675ms
├─ Completed: 36.687751ms
├─ Workers:   0=27 2=22 3=25 4=26
└─ Errors:    0
```
#### posts50k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      24.366647ms
├─ Worst:     136.792629ms
├─ Completed: 623.49617ms
├─ Workers:   0=5 2=31 3=31 4=33
└─ Errors:    0
```
#### posts50k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      19.322155ms
├─ Worst:     118.800409ms
├─ Completed: 725.384571ms
├─ Workers:   0=3 1=3 2=16 3=19 4=59
└─ Errors:    0
```
#### posts50k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      947.057µs
├─ Worst:     5.020619ms
├─ Completed: 27.813244ms
├─ Workers:   0=26 1=33 2=20 3=13 4=8
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      75.568638ms
├─ Worst:     829.167026ms
├─ Completed: 3.41669185s
├─ Workers:   0=15 1=38 2=26 3=5 4=16
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.038954ms
├─ Worst:     12.085148ms
├─ Completed: 54.530054ms
├─ Workers:   0=6 1=38 2=41 3=5 4=10
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      32.939007ms
├─ Worst:     271.959735ms
├─ Completed: 1.197437905s
├─ Workers:   0=12 1=28 2=17 3=28 4=15
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      924.857µs
├─ Worst:     7.491628ms
├─ Completed: 29.059642ms
├─ Workers:   0=22 1=24 2=16 3=25 4=13
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      44.575116ms
├─ Worst:     256.610803ms
├─ Completed: 1.294059736s
├─ Workers:   0=26 1=25 2=15 3=20 4=14
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      904.238µs
├─ Worst:     11.694759ms
├─ Completed: 36.724983ms
├─ Workers:   0=24 1=26 2=14 3=20 4=16
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      173.658626ms
├─ Worst:     924.85621ms
├─ Completed: 4.881851771s
├─ Workers:   0=24 1=24 2=16 3=23 4=13
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.455739ms
├─ Worst:     16.555017ms
├─ Completed: 66.273059ms
├─ Workers:   0=26 1=23 2=14 3=24 4=13
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      485.979222ms
├─ Worst:     4.096663248s
├─ Completed: 16.167562131s
├─ Workers:   0=26 1=2 2=22 3=31 4=19
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.561946ms
├─ Worst:     9.052484ms
├─ Completed: 50.409557ms
├─ Workers:   0=28 2=20 3=24 4=28
└─ Errors:    0
```
#### posts100k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      3.270204ms
├─ Worst:     17.233873ms
├─ Completed: 8.236877585s
├─ Workers:   0=162 1=241 2=212 3=189 4=196
└─ Errors:    0
```
#### posts100k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      28.224852ms
├─ Worst:     924.621047ms
├─ Completed: 927.642146ms
├─ Workers:   0=168 1=192 2=223 3=205 4=212
└─ Errors:    0
```
#### posts100k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      26.34711ms
├─ Worst:     151.041834ms
├─ Completed: 152.892568ms
├─ Workers:   0=179 1=242 2=212 3=219 4=148
└─ Errors:    0
```
#### posts100k - mixed read and write (simpleA list with additional 300 concurrent random posts100k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      34.974206ms
├─ Worst:     1.054722211s
├─ Completed: 1.056640638s
├─ Workers:   0=177 1=244 2=215 3=218 4=146
└─ Errors:    0
```
#### posts100k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      3.749435ms
├─ Worst:     41.305433ms
├─ Completed: 168.730516ms
├─ Workers:   0=14 1=20 2=25 3=26 4=15
└─ Errors:    0
```
#### posts100k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      4.771224ms
├─ Worst:     44.477921ms
├─ Completed: 190.15375ms
├─ Workers:   0=30 1=2 2=25 3=22 4=21
└─ Errors:    0
```
#### posts100k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      7.180459ms
├─ Worst:     67.972025ms
├─ Completed: 317.423797ms
├─ Workers:   0=19 1=4 2=3 3=6 4=68
└─ Errors:    0
```
#### posts100k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      4.949601ms
├─ Worst:     42.240143ms
├─ Completed: 182.621956ms
├─ Workers:   0=23 1=15 2=25 3=22 4=15
└─ Errors:    0
```
#### posts100k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      3.267169ms
├─ Worst:     32.672779ms
├─ Completed: 126.839403ms
├─ Workers:   0=24 1=15 2=24 3=22 4=15
└─ Errors:    0
```
#### posts100k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      29.946107ms
├─ Worst:     145.225187ms
├─ Completed: 871.211659ms
├─ Workers:   0=23 1=14 2=25 3=23 4=15
└─ Errors:    0
```
#### posts100k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      949.791µs
├─ Worst:     5.29708ms
├─ Completed: 28.058922ms
├─ Workers:   0=22 1=15 2=25 3=24 4=14
└─ Errors:    0
```
#### posts100k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      778.264µs
├─ Worst:     9.959856ms
├─ Completed: 34.248854ms
├─ Workers:   0=23 1=14 2=24 3=24 4=15
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      31.395497ms
├─ Worst:     204.944883ms
├─ Completed: 1.00727977s
├─ Workers:   0=26 1=14 2=23 3=23 4=14
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      886.753µs
├─ Worst:     6.472372ms
├─ Completed: 31.445466ms
├─ Workers:   0=24 1=15 2=26 3=20 4=15
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      812.781µs
├─ Worst:     8.830357ms
├─ Completed: 32.194689ms
├─ Workers:   0=12 1=18 2=27 3=26 4=17
└─ Errors:    0
```
#### posts100k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      33.490509ms
├─ Worst:     311.183238ms
├─ Completed: 1.359088602s
├─ Workers:   1=30 2=14 3=27 4=29
└─ Errors:    0
```
#### posts100k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      33.233243ms
├─ Worst:     369.645596ms
├─ Completed: 2.815842112s
├─ Workers:   0=2 1=91 2=2 3=3 4=2
└─ Errors:    0
```
#### posts100k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      861.479µs
├─ Worst:     6.259217ms
├─ Completed: 28.007201ms
├─ Workers:   0=16 1=17 2=26 3=27 4=14
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      171.755039ms
├─ Worst:     1.05185177s
├─ Completed: 6.191914832s
├─ Workers:   0=32 1=3 2=22 3=18 4=25
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.130801ms
├─ Worst:     8.230449ms
├─ Completed: 52.725973ms
├─ Workers:   0=16 1=6 2=5 3=7 4=66
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      70.762555ms
├─ Worst:     372.469462ms
├─ Completed: 1.98233046s
├─ Workers:   0=23 1=14 2=25 3=24 4=14
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      963.991µs
├─ Worst:     6.782791ms
├─ Completed: 29.856143ms
├─ Workers:   0=23 1=15 2=25 3=22 4=15
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      87.538056ms
├─ Worst:     525.683965ms
├─ Completed: 2.315320068s
├─ Workers:   0=24 1=14 2=25 3=22 4=15
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.068545ms
├─ Worst:     4.967345ms
├─ Completed: 26.035399ms
├─ Workers:   0=23 1=15 2=23 3=24 4=15
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      382.000226ms
├─ Worst:     2.385599269s
├─ Completed: 11.30139624s
├─ Workers:   0=22 1=15 2=26 3=24 4=13
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.424286ms
├─ Worst:     18.037272ms
├─ Completed: 79.993025ms
├─ Workers:   0=26 1=14 2=22 3=24 4=14
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      980.918309ms
├─ Worst:     5.688764558s
├─ Completed: 28.673251919s
├─ Workers:   0=24 1=15 2=26 3=19 4=16
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.57249ms
├─ Worst:     12.241833ms
├─ Completed: 51.488316ms
├─ Workers:   0=9 1=18 2=28 3=27 4=18
└─ Errors:    0
```

## Go vs JS route execution
#### JS route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      43.902799ms
├─ Worst:     1.348688739s
├─ Completed: 1.350406759s
├─ Workers:   0=68 1=146 2=69 3=82 4=135
└─ Errors:    0
```
#### Go route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      25.778006ms
├─ Worst:     1.360508161s
├─ Completed: 1.361488585s
├─ Workers:   0=115 1=73 2=125 3=115 4=72
└─ Errors:    0
```
#### JS route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      8.932617ms
├─ Worst:     372.464127ms
├─ Completed: 1.279481861s
├─ Workers:   0=106 1=94 2=104 3=100 4=96
└─ Errors:    0
```
#### Go route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      14.55006ms
├─ Worst:     288.845479ms
├─ Completed: 1.274588608s
├─ Workers:   0=70 1=129 2=70 3=98 4=133
└─ Errors:    0
```
#### JS route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      7.728765ms
├─ Worst:     24.15118ms
├─ Completed: 9.939895699s
├─ Workers:   0=99 1=81 2=146 3=110 4=64
└─ Errors:    0
```
#### Go route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      7.620376ms
├─ Worst:     30.183495ms
├─ Completed: 9.855099475s
├─ Workers:   0=90 1=106 2=87 3=107 4=110
└─ Errors:    0
```

## Go vs JS hooks execution
#### JS OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      530.933µs
├─ Worst:     9.138721ms
├─ Completed: 34.244729ms
├─ Workers:   0=11 1=32 2=10 3=14 4=33
└─ Errors:    0
```
#### Go OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      852.146µs
├─ Worst:     10.690402ms
├─ Completed: 27.272757ms
├─ Workers:   0=15 1=24 2=14 3=23 4=24
└─ Errors:    0
```

## Deleting records
#### deleting 100 posts10k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      692.906µs
├─ Worst:     19.553966ms
├─ Completed: 45.770685ms
├─ Workers:   0=28 1=23 2=11 3=14 4=24
└─ Errors:    0
```
#### deleting 100 posts10k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      693.546µs
├─ Worst:     12.517805ms
├─ Completed: 33.291133ms
├─ Workers:   0=24 1=16 2=15 3=23 4=22
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      684.535µs
├─ Worst:     9.517294ms
├─ Completed: 33.151751ms
├─ Workers:   0=25 1=23 2=27 3=25
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      726.863µs
├─ Worst:     11.372835ms
├─ Completed: 43.598818ms
├─ Workers:   0=16 1=5 2=54 3=19 4=6
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      498.648µs
├─ Worst:     12.821394ms
├─ Completed: 32.364263ms
├─ Workers:   0=17 1=19 2=25 3=19 4=20
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      803.789µs
├─ Worst:     10.214396ms
├─ Completed: 32.98536ms
├─ Workers:   0=16 1=18 2=26 3=24 4=16
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      735.865µs
├─ Worst:     20.991058ms
├─ Completed: 46.882629ms
├─ Workers:   0=15 1=15 2=25 3=23 4=22
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      766.578µs
├─ Worst:     21.302809ms
├─ Completed: 46.828156ms
├─ Workers:   0=16 1=19 2=17 3=24 4=24
└─ Errors:    0
```
#### deleting 100 users - with cascade deleting all associated posts [conc:10, rule:`""`]
```
┌─ Best:      68.235907ms
├─ Worst:     5.207713839s
├─ Completed: 8.650315615s
├─ Workers:   0=42 1=24 2=9 3=11 4=14
└─ Errors:    0
```
#### deleting 100 organizations - with cascade deleting all users and associated posts [conc:10, rule:`""`]
```
┌─ Best:      48.646726ms
├─ Worst:     7.947377757s
├─ Completed: 19.220450199s
├─ Workers:   0=15 1=23 2=15 3=24 4=23
└─ Errors:    0
```

---------------------------------------------------
Completed!
