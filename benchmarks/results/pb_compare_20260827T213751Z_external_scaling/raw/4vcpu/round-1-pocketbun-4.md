# PocketBun Upstream-Port Benchmark Result

- machine: hetzner-4vcpu-pocketbun-4
- timestamp: 2026-08-27T13:22:46.332Z
- tests: create,auth,search,custom,delete
- benchmark source: 05625dc2b2d3f9711c51566010944b10ca9531fa
- server workers: 4
- load generator: http://load-generator:19231
- benchmark target host: application-host
- warmup request target/cap: 1000
## Creating organizations (100)
#### Creating 50 organizations [reqs:50, conc:10, rule:`""`]
```
┌─ Best:      715.639µs
├─ Worst:     5.717547ms
├─ Completed: 13.680136ms
├─ Workers:   0=12 1=12 2=12 3=14
└─ Errors:    0
```
#### Creating 50 organizations [reqs:50, conc:10, rule:`"@request.body.name != ''"`]
```
┌─ Best:      874.538µs
├─ Worst:     11.064053ms
├─ Completed: 20.014817ms
├─ Workers:   0=14 2=12 3=24
└─ Errors:    0
```

## Creating permissions (50)
#### Creating 25 permissions [reqs:25, conc:5, rule:`""`]
```
┌─ Best:      683.583µs
├─ Worst:     3.80074ms
├─ Completed: 9.792827ms
├─ Workers:   0=8 2=6 3=11
└─ Errors:    0
```
#### Creating 25 permissions [reqs:25, conc:5, rule:`"@request.body.name != ''"`]
```
┌─ Best:      945.096µs
├─ Worst:     3.911594ms
├─ Completed: 11.810734ms
├─ Workers:   0=9 2=2 3=14
└─ Errors:    0
```

## Creating users (500 - expected to be slow due to passwordHash generation)
#### Creating 250 users [reqs:250, conc:50, rule:`""`]
```
┌─ Best:      120.986041ms
├─ Worst:     2.136539297s
├─ Completed: 4.102566239s
├─ Workers:   0=97 1=53 2=46 3=54
└─ Errors:    0
```
#### Creating 250 users [reqs:250, conc:50, rule:`"@request.body.email != '' && @request.body.permissions:length > 0"`]
```
┌─ Best:      142.624011ms
├─ Worst:     2.324003495s
├─ Completed: 4.141892651s
├─ Workers:   0=37 1=91 2=86 3=36
└─ Errors:    0
```

## Creating posts (10k, 25k, 50k, 100k)
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`""`]
```
┌─ Best:      3.071313ms
├─ Worst:     295.746372ms
├─ Completed: 574.72481ms
├─ Workers:   0=1355 1=1201 2=1200 3=1244
└─ Errors:    0
```
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      3.000655ms
├─ Worst:     430.820063ms
├─ Completed: 734.342366ms
├─ Workers:   0=1191 1=1372 2=1127 3=1310
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`""`]
```
┌─ Best:      467.536µs
├─ Worst:     465.708526ms
├─ Completed: 1.273426687s
├─ Workers:   0=3588 1=3353 2=2305 3=3254
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      605.106µs
├─ Worst:     659.208211ms
├─ Completed: 1.739634241s
├─ Workers:   0=3356 1=3442 2=2630 3=3072
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`""`]
```
┌─ Best:      554.275µs
├─ Worst:     769.620697ms
├─ Completed: 2.212051373s
├─ Workers:   0=6938 1=4730 2=6872 3=6460
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      555.386µs
├─ Worst:     641.43502ms
├─ Completed: 3.06341225s
├─ Workers:   0=7248 1=5542 2=6322 3=5888
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`""`]
```
┌─ Best:      1.996407ms
├─ Worst:     789.007285ms
├─ Completed: 3.988853746s
├─ Workers:   0=14614 1=12208 2=9559 3=13619
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      2.063771ms
├─ Worst:     661.701916ms
├─ Completed: 5.719507532s
├─ Workers:   0=13987 1=11291 2=13639 3=11083
└─ Errors:    0
```

## User auth with password (expected to be slow due to passwordHash verification)
#### users auth with email/pass - high concurrency [reqs:250, conc:250]
```
┌─ Best:      220.489298ms
├─ Worst:     4.042857843s
├─ Completed: 4.043127004s
├─ Workers:   0=66 1=53 2=65 3=66
└─ Errors:    0
```
#### users auth with email/pass - small concurrency [reqs:250, conc:10]
```
┌─ Best:      68.222467ms
├─ Worst:     337.159697ms
├─ Completed: 4.054697157s
├─ Workers:   0=67 1=53 2=90 3=40
└─ Errors:    0
```

## User auth refresh
#### users - auth refresh (high concurrency) [reqs:1000, conc:1000]
```
┌─ Best:      23.098116ms
├─ Worst:     96.150826ms
├─ Completed: 97.653051ms
├─ Workers:   0=245 1=260 2=236 3=259
└─ Errors:    0
```
#### users - auth refresh (medium concurrency) [reqs:1000, conc:100]
```
┌─ Best:      465.193µs
├─ Worst:     21.790659ms
├─ Completed: 94.757941ms
├─ Workers:   0=319 1=163 2=277 3=241
└─ Errors:    0
```

## List records
#### users - getOne for auth refresh comparison (medium concurrency) [reqs:1000, conc:100, rule:`""`, query:`/nvlkyn36njk2p9o`]
```
┌─ Best:      324.868µs
├─ Worst:     25.794951ms
├─ Completed: 78.442464ms
├─ Workers:   0=198 1=272 2=284 3=246
└─ Errors:    0
```
#### users - getOne for auth refresh comparison (high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`/nvlkyn36njk2p9o`]
```
┌─ Best:      22.948208ms
├─ Worst:     82.375597ms
├─ Completed: 84.096205ms
├─ Workers:   0=217 1=276 2=252 3=255
└─ Errors:    0
```
#### posts10k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.165791ms
├─ Worst:     4.563553ms
├─ Completed: 1.71700306s
├─ Workers:   0=326 1=247 2=263 3=164
└─ Errors:    0
```
#### posts10k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      25.788863ms
├─ Worst:     261.285879ms
├─ Completed: 263.054562ms
├─ Workers:   0=237 1=227 2=271 3=265
└─ Errors:    0
```
#### posts10k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      32.546987ms
├─ Worst:     185.165313ms
├─ Completed: 187.618972ms
├─ Workers:   0=279 1=293 2=236 3=192
└─ Errors:    0
```
#### posts10k - mixed read and write (simpleA list with additional 300 concurrent random posts10k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      32.201461ms
├─ Worst:     314.985457ms
├─ Completed: 316.394503ms
├─ Workers:   0=279 1=293 2=236 3=192
└─ Errors:    0
```
#### posts10k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.5847ms
├─ Worst:     19.137966ms
├─ Completed: 76.787308ms
├─ Workers:   0=5 1=23 2=34 3=38
└─ Errors:    0
```
#### posts10k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      1.919622ms
├─ Worst:     23.798224ms
├─ Completed: 104.104033ms
├─ Workers:   0=27 1=10 2=39 3=24
└─ Errors:    0
```
#### posts10k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      1.493063ms
├─ Worst:     22.410986ms
├─ Completed: 106.312882ms
├─ Workers:   0=16 1=14 2=28 3=42
└─ Errors:    0
```
#### posts10k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      2.49768ms
├─ Worst:     36.281527ms
├─ Completed: 123.323029ms
├─ Workers:   0=16 1=24 2=25 3=35
└─ Errors:    0
```
#### posts10k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.133296ms
├─ Worst:     10.621682ms
├─ Completed: 54.70885ms
├─ Workers:   0=25 1=28 2=17 3=30
└─ Errors:    0
```
#### posts10k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.76557ms
├─ Worst:     44.675812ms
├─ Completed: 110.091792ms
├─ Workers:   0=24 1=31 2=17 3=28
└─ Errors:    0
```
#### posts10k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.136991ms
├─ Worst:     10.477863ms
├─ Completed: 39.846511ms
├─ Workers:   0=25 1=27 2=15 3=33
└─ Errors:    0
```
#### posts10k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.111266ms
├─ Worst:     7.249595ms
├─ Completed: 33.096836ms
├─ Workers:   0=20 1=27 2=26 3=27
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.723692ms
├─ Worst:     39.489068ms
├─ Completed: 111.005093ms
├─ Workers:   0=19 1=28 2=25 3=28
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      984.501µs
├─ Worst:     10.295522ms
├─ Completed: 42.566008ms
├─ Workers:   0=22 1=29 2=28 3=21
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      876.139µs
├─ Worst:     12.717717ms
├─ Completed: 50.030599ms
├─ Workers:   0=21 1=40 2=29 3=10
└─ Errors:    0
```
#### posts10k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      3.676048ms
├─ Worst:     51.795226ms
├─ Completed: 182.421273ms
├─ Workers:   0=27 1=36 2=37
└─ Errors:    0
```
#### posts10k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      7.316516ms
├─ Worst:     40.2582ms
├─ Completed: 160.380447ms
├─ Workers:   0=80 2=20
└─ Errors:    0
```
#### posts10k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.21633ms
├─ Worst:     5.716136ms
├─ Completed: 37.9206ms
├─ Workers:   0=5 1=23 2=34 3=38
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      14.8843ms
├─ Worst:     130.291324ms
├─ Completed: 674.08472ms
├─ Workers:   0=27 1=10 2=39 3=24
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.098487ms
├─ Worst:     12.327899ms
├─ Completed: 54.542941ms
├─ Workers:   0=16 1=14 2=28 3=42
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      6.804079ms
├─ Worst:     75.487592ms
├─ Completed: 321.078763ms
├─ Workers:   0=16 1=24 2=25 3=35
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      955.5µs
├─ Worst:     11.864068ms
├─ Completed: 44.524713ms
├─ Workers:   0=25 1=28 2=17 3=30
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      8.287007ms
├─ Worst:     73.649785ms
├─ Completed: 393.186727ms
├─ Workers:   0=24 1=31 2=17 3=28
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.02798ms
├─ Worst:     11.557315ms
├─ Completed: 49.487578ms
├─ Workers:   0=25 1=27 2=15 3=33
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      38.878044ms
├─ Worst:     354.550506ms
├─ Completed: 1.69519064s
├─ Workers:   0=20 1=27 2=26 3=27
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.606891ms
├─ Worst:     16.668696ms
├─ Completed: 71.263798ms
├─ Workers:   0=19 1=28 2=25 3=28
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      113.614898ms
├─ Worst:     962.805471ms
├─ Completed: 5.420177041s
├─ Workers:   0=22 1=29 2=28 3=21
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      941.901µs
├─ Worst:     16.740154ms
├─ Completed: 87.033351ms
├─ Workers:   0=21 1=40 2=29 3=10
└─ Errors:    0
```
#### posts25k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.063339ms
├─ Worst:     6.83413ms
├─ Completed: 2.67626107s
├─ Workers:   0=265 1=220 2=258 3=257
└─ Errors:    0
```
#### posts25k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      23.923746ms
├─ Worst:     418.928044ms
├─ Completed: 420.922268ms
├─ Workers:   0=258 1=232 2=282 3=228
└─ Errors:    0
```
#### posts25k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      23.841522ms
├─ Worst:     153.790033ms
├─ Completed: 155.498633ms
├─ Workers:   0=222 1=266 2=240 3=272
└─ Errors:    0
```
#### posts25k - mixed read and write (simpleA list with additional 300 concurrent random posts25k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      33.262436ms
├─ Worst:     425.833382ms
├─ Completed: 427.813747ms
├─ Workers:   0=222 1=266 2=240 3=272
└─ Errors:    0
```
#### posts25k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.491741ms
├─ Worst:     25.153775ms
├─ Completed: 96.570115ms
├─ Workers:   0=32 1=32 2=6 3=30
└─ Errors:    0
```
#### posts25k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      1.945807ms
├─ Worst:     33.58444ms
├─ Completed: 142.02402ms
├─ Workers:   0=48 1=16 2=17 3=19
└─ Errors:    0
```
#### posts25k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      1.976171ms
├─ Worst:     28.198461ms
├─ Completed: 142.299602ms
├─ Workers:   0=31 1=11 2=47 3=11
└─ Errors:    0
```
#### posts25k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      4.205208ms
├─ Worst:     51.171214ms
├─ Completed: 165.87808ms
├─ Workers:   0=20 1=20 2=40 3=20
└─ Errors:    0
```
#### posts25k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.599259ms
├─ Worst:     13.969156ms
├─ Completed: 72.425984ms
├─ Workers:   0=25 1=25 2=23 3=27
└─ Errors:    0
```
#### posts25k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      6.415322ms
├─ Worst:     67.683702ms
├─ Completed: 199.181514ms
├─ Workers:   0=24 1=26 2=23 3=27
└─ Errors:    0
```
#### posts25k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.011277ms
├─ Worst:     10.49687ms
├─ Completed: 36.759866ms
├─ Workers:   0=25 1=28 2=23 3=24
└─ Errors:    0
```
#### posts25k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      964.032µs
├─ Worst:     13.467403ms
├─ Completed: 39.399965ms
├─ Workers:   0=26 1=26 2=20 3=28
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      6.222275ms
├─ Worst:     65.600946ms
├─ Completed: 201.200282ms
├─ Workers:   0=26 1=26 2=22 3=26
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      887.576µs
├─ Worst:     12.491955ms
├─ Completed: 41.681677ms
├─ Workers:   0=26 1=25 2=22 3=27
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      812.412µs
├─ Worst:     11.461602ms
├─ Completed: 39.870954ms
├─ Workers:   0=24 1=25 2=24 3=27
└─ Errors:    0
```
#### posts25k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      9.349214ms
├─ Worst:     76.017424ms
├─ Completed: 328.782683ms
├─ Workers:   0=20 1=25 2=23 3=32
└─ Errors:    0
```
#### posts25k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      5.590792ms
├─ Worst:     73.398166ms
├─ Completed: 338.914962ms
├─ Workers:   1=32 2=50 3=18
└─ Errors:    0
```
#### posts25k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      997.988µs
├─ Worst:     11.904073ms
├─ Completed: 43.746438ms
├─ Workers:   0=32 1=32 2=6 3=30
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      38.234775ms
├─ Worst:     383.01162ms
├─ Completed: 2.092078256s
├─ Workers:   0=48 1=16 2=17 3=19
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.406013ms
├─ Worst:     11.889734ms
├─ Completed: 57.967211ms
├─ Workers:   0=31 1=11 2=47 3=11
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      15.154914ms
├─ Worst:     197.050619ms
├─ Completed: 835.412672ms
├─ Workers:   0=20 1=20 2=40 3=20
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.205526ms
├─ Worst:     9.787168ms
├─ Completed: 39.586701ms
├─ Workers:   0=25 1=25 2=23 3=27
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      29.035688ms
├─ Worst:     177.36557ms
├─ Completed: 817.039642ms
├─ Workers:   0=24 1=26 2=23 3=27
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.003166ms
├─ Worst:     9.017215ms
├─ Completed: 39.640465ms
├─ Workers:   0=25 1=28 2=23 3=24
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      99.892073ms
├─ Worst:     779.261959ms
├─ Completed: 4.284447727s
├─ Workers:   0=26 1=26 2=20 3=28
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.559934ms
├─ Worst:     19.201313ms
├─ Completed: 71.517698ms
├─ Workers:   0=26 1=26 2=22 3=26
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      479.359639ms
├─ Worst:     2.097513825s
├─ Completed: 13.086672662s
├─ Workers:   0=26 1=25 2=22 3=27
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.582076ms
├─ Worst:     13.830234ms
├─ Completed: 60.437774ms
├─ Workers:   0=24 1=25 2=24 3=27
└─ Errors:    0
```
#### posts50k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.89646ms
├─ Worst:     12.978256ms
├─ Completed: 4.762854589s
├─ Workers:   0=251 1=241 2=272 3=236
└─ Errors:    0
```
#### posts50k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      25.380068ms
├─ Worst:     707.858969ms
├─ Completed: 709.478305ms
├─ Workers:   0=252 1=237 2=274 3=237
└─ Errors:    0
```
#### posts50k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      24.106458ms
├─ Worst:     159.328734ms
├─ Completed: 160.923326ms
├─ Workers:   0=255 1=265 2=242 3=238
└─ Errors:    0
```
#### posts50k - mixed read and write (simpleA list with additional 300 concurrent random posts50k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      36.426797ms
├─ Worst:     773.379132ms
├─ Completed: 775.429976ms
├─ Workers:   0=255 1=265 2=242 3=238
└─ Errors:    0
```
#### posts50k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      2.964976ms
├─ Worst:     41.59673ms
├─ Completed: 123.536723ms
├─ Workers:   0=10 1=38 2=29 3=23
└─ Errors:    0
```
#### posts50k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      2.632696ms
├─ Worst:     47.344177ms
├─ Completed: 184.125355ms
├─ Workers:   0=23 1=15 2=16 3=46
└─ Errors:    0
```
#### posts50k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      2.985543ms
├─ Worst:     41.493026ms
├─ Completed: 159.966184ms
├─ Workers:   0=35 1=9 2=47 3=9
└─ Errors:    0
```
#### posts50k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      4.412174ms
├─ Worst:     44.375137ms
├─ Completed: 165.115517ms
├─ Workers:   0=20 1=28 2=25 3=27
└─ Errors:    0
```
#### posts50k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      3.275204ms
├─ Worst:     24.843958ms
├─ Completed: 101.413555ms
├─ Workers:   0=26 1=28 2=20 3=26
└─ Errors:    0
```
#### posts50k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      22.854199ms
├─ Worst:     123.431779ms
├─ Completed: 658.736364ms
├─ Workers:   0=25 1=27 2=24 3=24
└─ Errors:    0
```
#### posts50k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.131915ms
├─ Worst:     11.240166ms
├─ Completed: 36.982584ms
├─ Workers:   0=25 1=28 2=23 3=24
└─ Errors:    0
```
#### posts50k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.028681ms
├─ Worst:     10.878055ms
├─ Completed: 36.902765ms
├─ Workers:   0=25 1=25 2=24 3=26
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      22.982266ms
├─ Worst:     123.212775ms
├─ Completed: 650.773896ms
├─ Workers:   0=25 1=26 2=23 3=26
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      905µs
├─ Worst:     10.155668ms
├─ Completed: 40.499723ms
├─ Workers:   0=25 1=26 2=23 3=26
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.015933ms
├─ Worst:     11.755408ms
├─ Completed: 38.637961ms
├─ Workers:   0=25 1=26 2=24 3=25
└─ Errors:    0
```
#### posts50k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      17.376953ms
├─ Worst:     188.628025ms
├─ Completed: 832.505346ms
├─ Workers:   0=16 1=28 2=22 3=34
└─ Errors:    0
```
#### posts50k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      11.980899ms
├─ Worst:     117.496911ms
├─ Completed: 646.19382ms
├─ Workers:   0=47 1=13 2=40
└─ Errors:    0
```
#### posts50k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      925.918µs
├─ Worst:     12.057165ms
├─ Completed: 44.919028ms
├─ Workers:   0=10 1=38 2=29 3=23
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      83.870914ms
├─ Worst:     917.973944ms
├─ Completed: 4.429608741s
├─ Workers:   0=23 1=15 2=16 3=46
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.12298ms
├─ Worst:     13.552761ms
├─ Completed: 53.399572ms
├─ Workers:   0=35 1=9 2=47 3=9
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      46.993894ms
├─ Worst:     273.220583ms
├─ Completed: 1.668725811s
├─ Workers:   0=20 1=28 2=25 3=27
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      993.723µs
├─ Worst:     11.598471ms
├─ Completed: 42.436598ms
├─ Workers:   0=26 1=28 2=20 3=26
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      121.059522ms
├─ Worst:     254.934346ms
├─ Completed: 1.828663567s
├─ Workers:   0=25 1=27 2=24 3=24
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.275943ms
├─ Worst:     8.031194ms
├─ Completed: 38.00721ms
├─ Workers:   0=25 1=28 2=23 3=24
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      256.780266ms
├─ Worst:     1.514905116s
├─ Completed: 9.024888955s
├─ Workers:   0=25 1=25 2=24 3=26
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.760091ms
├─ Worst:     15.559043ms
├─ Completed: 75.75295ms
├─ Workers:   0=25 1=26 2=23 3=26
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      579.522216ms
├─ Worst:     5.049715875s
├─ Completed: 26.436832936s
├─ Workers:   0=25 1=26 2=23 3=26
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.167644ms
├─ Worst:     13.648682ms
├─ Completed: 64.034101ms
├─ Workers:   0=25 1=26 2=24 3=25
└─ Errors:    0
```
#### posts100k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      3.515156ms
├─ Worst:     33.947863ms
├─ Completed: 8.319578196s
├─ Workers:   0=252 1=239 2=270 3=239
└─ Errors:    0
```
#### posts100k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      28.307571ms
├─ Worst:     1.340903394s
├─ Completed: 1.342633605s
├─ Workers:   0=252 1=237 2=269 3=242
└─ Errors:    0
```
#### posts100k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      24.063099ms
├─ Worst:     168.38994ms
├─ Completed: 170.025068ms
├─ Workers:   0=254 1=256 2=249 3=241
└─ Errors:    0
```
#### posts100k - mixed read and write (simpleA list with additional 300 concurrent random posts100k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      49.436187ms
├─ Worst:     1.365227574s
├─ Completed: 1.367026548s
├─ Workers:   0=254 1=256 2=249 3=241
└─ Errors:    0
```
#### posts100k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      3.86578ms
├─ Worst:     55.727668ms
├─ Completed: 223.987178ms
├─ Workers:   0=6 1=35 2=31 3=28
└─ Errors:    0
```
#### posts100k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      4.498944ms
├─ Worst:     70.011949ms
├─ Completed: 245.335867ms
├─ Workers:   0=12 1=21 2=39 3=28
└─ Errors:    0
```
#### posts100k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      4.778291ms
├─ Worst:     67.943933ms
├─ Completed: 336.537276ms
├─ Workers:   0=62 1=10 2=14 3=14
└─ Errors:    0
```
#### posts100k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      5.054242ms
├─ Worst:     54.929314ms
├─ Completed: 245.517939ms
├─ Workers:   0=22 1=29 2=25 3=24
└─ Errors:    0
```
#### posts100k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      5.134523ms
├─ Worst:     52.200154ms
├─ Completed: 204.066922ms
├─ Workers:   0=20 1=21 2=38 3=21
└─ Errors:    0
```
#### posts100k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      87.626741ms
├─ Worst:     185.490301ms
├─ Completed: 1.193380018s
├─ Workers:   0=24 1=25 2=25 3=26
└─ Errors:    0
```
#### posts100k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      922.926µs
├─ Worst:     12.446432ms
├─ Completed: 40.973047ms
├─ Workers:   0=24 1=26 2=26 3=24
└─ Errors:    0
```
#### posts100k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.081435ms
├─ Worst:     10.112689ms
├─ Completed: 36.86371ms
├─ Workers:   0=24 1=25 2=26 3=25
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      44.118832ms
├─ Worst:     185.109466ms
├─ Completed: 1.191125894s
├─ Workers:   0=24 1=25 2=25 3=26
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      963.301µs
├─ Worst:     32.361922ms
├─ Completed: 42.495679ms
├─ Workers:   0=24 1=25 2=26 3=25
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      947.989µs
├─ Worst:     9.964893ms
├─ Completed: 37.126954ms
├─ Workers:   0=24 1=25 2=26 3=25
└─ Errors:    0
```
#### posts100k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      72.507686ms
├─ Worst:     206.089791ms
├─ Completed: 1.351545461s
├─ Workers:   0=24 1=25 2=25 3=26
└─ Errors:    0
```
#### posts100k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      35.019782ms
├─ Worst:     383.983619ms
├─ Completed: 1.597327665s
├─ Workers:   0=37 1=25 2=14 3=24
└─ Errors:    0
```
#### posts100k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      888.467µs
├─ Worst:     13.230448ms
├─ Completed: 44.628037ms
├─ Workers:   0=6 1=35 2=31 3=28
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      218.280685ms
├─ Worst:     1.62416406s
├─ Completed: 7.732563169s
├─ Workers:   0=12 1=21 2=39 3=28
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      854.991µs
├─ Worst:     11.133221ms
├─ Completed: 63.735205ms
├─ Workers:   0=62 1=10 2=14 3=14
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      109.130065ms
├─ Worst:     532.577295ms
├─ Completed: 2.842889499s
├─ Workers:   0=22 1=29 2=25 3=24
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.198195ms
├─ Worst:     9.875503ms
├─ Completed: 40.679122ms
├─ Workers:   0=20 1=21 2=38 3=21
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      182.899543ms
├─ Worst:     449.810353ms
├─ Completed: 3.487300871s
├─ Workers:   0=24 1=25 2=25 3=26
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      924.016µs
├─ Worst:     12.861018ms
├─ Completed: 42.14055ms
├─ Workers:   0=24 1=26 2=26 3=24
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      679.113225ms
├─ Worst:     2.746024902s
├─ Completed: 17.834938967s
├─ Workers:   0=24 1=25 2=26 3=25
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.596877ms
├─ Worst:     18.283811ms
├─ Completed: 76.3319ms
├─ Workers:   0=24 1=25 2=25 3=26
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      1.674561207s
├─ Worst:     8.278069394s
├─ Completed: 45.594964205s
├─ Workers:   0=24 1=25 2=26 3=25
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.530244ms
├─ Worst:     10.920718ms
├─ Completed: 54.287052ms
├─ Workers:   0=24 1=25 2=26 3=25
└─ Errors:    0
```

## Go vs JS route execution
#### JS route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      54.423711ms
├─ Worst:     2.026259063s
├─ Completed: 2.027178633s
├─ Workers:   0=141 1=116 2=123 3=120
└─ Errors:    0
```
#### Go route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      39.28848ms
├─ Worst:     1.934185115s
├─ Completed: 1.935958064s
├─ Workers:   0=114 1=126 2=140 3=120
└─ Errors:    0
```
#### JS route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      34.135131ms
├─ Worst:     273.595456ms
├─ Completed: 1.964760304s
├─ Workers:   0=121 1=125 2=128 3=126
└─ Errors:    0
```
#### Go route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      33.764117ms
├─ Worst:     458.836374ms
├─ Completed: 1.989811692s
├─ Workers:   0=141 1=116 2=123 3=120
└─ Errors:    0
```
#### JS route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      9.860503ms
├─ Worst:     32.651781ms
├─ Completed: 9.936992543s
├─ Workers:   0=115 1=126 2=138 3=121
└─ Errors:    0
```
#### Go route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      9.833626ms
├─ Worst:     24.451072ms
├─ Completed: 9.329781271s
├─ Workers:   0=120 1=125 2=129 3=126
└─ Errors:    0
```

## Go vs JS hooks execution
#### JS OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      1.025417ms
├─ Worst:     13.937796ms
├─ Completed: 41.051747ms
├─ Workers:   0=25 1=25 2=25 3=25
└─ Errors:    0
```
#### Go OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      886.705µs
├─ Worst:     13.697214ms
├─ Completed: 36.655613ms
├─ Workers:   0=25 1=26 2=25 3=24
└─ Errors:    0
```

## Deleting records
#### deleting 100 posts10k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      669.896µs
├─ Worst:     16.332835ms
├─ Completed: 39.018837ms
├─ Workers:   0=42 1=15 2=23 3=20
└─ Errors:    0
```
#### deleting 100 posts10k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      766.428µs
├─ Worst:     9.328999ms
├─ Completed: 40.6127ms
├─ Workers:   0=25 1=25 2=25 3=25
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      741.654µs
├─ Worst:     13.034868ms
├─ Completed: 36.772774ms
├─ Workers:   0=24 1=25 2=26 3=25
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      821.154µs
├─ Worst:     22.490922ms
├─ Completed: 47.494366ms
├─ Workers:   0=16 1=26 2=38 3=20
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      754.053µs
├─ Worst:     14.0267ms
├─ Completed: 41.853635ms
├─ Workers:   0=25 1=25 2=24 3=26
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      792.916µs
├─ Worst:     20.298334ms
├─ Completed: 48.616018ms
├─ Workers:   0=25 1=25 2=25 3=25
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      760.55µs
├─ Worst:     13.244189ms
├─ Completed: 40.979847ms
├─ Workers:   0=25 1=25 2=24 3=26
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      807.855µs
├─ Worst:     9.774494ms
├─ Completed: 39.191787ms
├─ Workers:   0=26 1=25 2=24 3=25
└─ Errors:    0
```
#### deleting 100 users - with cascade deleting all associated posts [conc:10, rule:`""`]
```
┌─ Best:      68.73274ms
├─ Worst:     2.348963334s
├─ Completed: 8.193802107s
├─ Workers:   0=20 1=25 2=31 3=24
└─ Errors:    0
```
#### deleting 100 organizations - with cascade deleting all users and associated posts [conc:10, rule:`""`]
```
┌─ Best:      48.884359ms
├─ Worst:     9.634578395s
├─ Completed: 18.761439812s
├─ Workers:   0=25 1=25 2=25 3=25
└─ Errors:    0
```

---------------------------------------------------
Completed!
