# PocketBun Upstream-Port Benchmark Result

- machine: hetzner-4vcpu-pocketbun-4
- timestamp: 2026-08-27T16:34:48.269Z
- tests: create,auth,search,custom,delete
- benchmark source: 05625dc2b2d3f9711c51566010944b10ca9531fa
- server workers: 4
- load generator: http://load-generator:19231
- benchmark target host: application-host
- warmup request target/cap: 1000
## Creating organizations (100)
#### Creating 50 organizations [reqs:50, conc:10, rule:`""`]
```
┌─ Best:      667.331µs
├─ Worst:     6.302246ms
├─ Completed: 15.143178ms
├─ Workers:   0=13 1=12 2=13 3=12
└─ Errors:    0
```
#### Creating 50 organizations [reqs:50, conc:10, rule:`"@request.body.name != ''"`]
```
┌─ Best:      972.323µs
├─ Worst:     9.414124ms
├─ Completed: 18.353192ms
├─ Workers:   0=19 1=20 2=2 3=9
└─ Errors:    0
```

## Creating permissions (50)
#### Creating 25 permissions [reqs:25, conc:5, rule:`""`]
```
┌─ Best:      966.444µs
├─ Worst:     3.534292ms
├─ Completed: 8.068806ms
├─ Workers:   0=11 1=14
└─ Errors:    0
```
#### Creating 25 permissions [reqs:25, conc:5, rule:`"@request.body.name != ''"`]
```
┌─ Best:      1.71609ms
├─ Worst:     3.210594ms
├─ Completed: 14.274228ms
├─ Workers:   0=21 1=3 3=1
└─ Errors:    0
```

## Creating users (500 - expected to be slow due to passwordHash generation)
#### Creating 250 users [reqs:250, conc:50, rule:`""`]
```
┌─ Best:      97.510516ms
├─ Worst:     2.581066367s
├─ Completed: 4.14282795s
├─ Workers:   0=105 1=44 2=51 3=50
└─ Errors:    0
```
#### Creating 250 users [reqs:250, conc:50, rule:`"@request.body.email != '' && @request.body.permissions:length > 0"`]
```
┌─ Best:      227.779022ms
├─ Worst:     2.057397458s
├─ Completed: 4.162377317s
├─ Workers:   0=49 1=60 2=63 3=78
└─ Errors:    0
```

## Creating posts (10k, 25k, 50k, 100k)
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`""`]
```
┌─ Best:      1.254513ms
├─ Worst:     348.830004ms
├─ Completed: 560.617587ms
├─ Workers:   0=1253 1=1314 2=1122 3=1311
└─ Errors:    0
```
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      9.352289ms
├─ Worst:     467.8845ms
├─ Completed: 726.540162ms
├─ Workers:   0=1396 1=1164 2=1225 3=1215
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`""`]
```
┌─ Best:      642.728µs
├─ Worst:     700.498071ms
├─ Completed: 1.319078504s
├─ Workers:   0=2801 1=2934 2=3205 3=3560
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      694.919µs
├─ Worst:     615.416292ms
├─ Completed: 1.725205456s
├─ Workers:   0=3653 1=3229 2=3048 3=2570
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`""`]
```
┌─ Best:      437.024µs
├─ Worst:     886.061427ms
├─ Completed: 2.211432433s
├─ Workers:   0=4972 1=6541 2=6277 3=7210
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      1.952697ms
├─ Worst:     664.088966ms
├─ Completed: 3.081195977s
├─ Workers:   0=6729 1=6832 2=5317 3=6122
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`""`]
```
┌─ Best:      1.408886ms
├─ Worst:     633.457094ms
├─ Completed: 4.01936912s
├─ Workers:   0=14078 1=14021 2=8555 3=13346
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      507.651µs
├─ Worst:     910.253645ms
├─ Completed: 5.76640428s
├─ Workers:   0=12644 1=12592 2=13330 3=11434
└─ Errors:    0
```

## User auth with password (expected to be slow due to passwordHash verification)
#### users auth with email/pass - high concurrency [reqs:250, conc:250]
```
┌─ Best:      234.772362ms
├─ Worst:     4.06833383s
├─ Completed: 4.068541307s
├─ Workers:   0=69 1=45 2=71 3=65
└─ Errors:    0
```
#### users auth with email/pass - small concurrency [reqs:250, conc:10]
```
┌─ Best:      63.92973ms
├─ Worst:     334.950454ms
├─ Completed: 4.074825399s
├─ Workers:   0=48 1=61 2=65 3=76
└─ Errors:    0
```

## User auth refresh
#### users - auth refresh (high concurrency) [reqs:1000, conc:1000]
```
┌─ Best:      27.6537ms
├─ Worst:     90.301266ms
├─ Completed: 91.982469ms
├─ Workers:   0=275 1=266 2=224 3=235
└─ Errors:    0
```
#### users - auth refresh (medium concurrency) [reqs:1000, conc:100]
```
┌─ Best:      391.221µs
├─ Worst:     32.177008ms
├─ Completed: 90.003286ms
├─ Workers:   0=245 1=198 2=272 3=285
└─ Errors:    0
```

## List records
#### users - getOne for auth refresh comparison (medium concurrency) [reqs:1000, conc:100, rule:`""`, query:`/9ddoq9cjj7hca2w`]
```
┌─ Best:      334.162µs
├─ Worst:     37.704262ms
├─ Completed: 81.41306ms
├─ Workers:   0=213 1=279 2=246 3=262
└─ Errors:    0
```
#### users - getOne for auth refresh comparison (high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`/9ddoq9cjj7hca2w`]
```
┌─ Best:      22.454417ms
├─ Worst:     80.28469ms
├─ Completed: 81.955669ms
├─ Workers:   0=262 1=262 2=225 3=251
└─ Errors:    0
```
#### posts10k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      841.351µs
├─ Worst:     8.53429ms
├─ Completed: 1.69227726s
├─ Workers:   0=286 1=166 2=297 3=251
└─ Errors:    0
```
#### posts10k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      26.045508ms
├─ Worst:     277.894979ms
├─ Completed: 279.718808ms
├─ Workers:   0=254 1=280 2=218 3=248
└─ Errors:    0
```
#### posts10k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      32.266752ms
├─ Worst:     168.875716ms
├─ Completed: 170.561905ms
├─ Workers:   0=219 1=231 2=282 3=268
└─ Errors:    0
```
#### posts10k - mixed read and write (simpleA list with additional 300 concurrent random posts10k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      31.68733ms
├─ Worst:     293.154447ms
├─ Completed: 294.989172ms
├─ Workers:   0=219 1=231 2=282 3=268
└─ Errors:    0
```
#### posts10k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.508995ms
├─ Worst:     24.113489ms
├─ Completed: 92.753094ms
├─ Workers:   0=37 1=5 2=24 3=34
└─ Errors:    0
```
#### posts10k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      1.958034ms
├─ Worst:     21.457952ms
├─ Completed: 97.060593ms
├─ Workers:   0=44 1=18 2=16 3=22
└─ Errors:    0
```
#### posts10k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      1.966627ms
├─ Worst:     21.882016ms
├─ Completed: 99.042302ms
├─ Workers:   0=37 1=34 2=15 3=14
└─ Errors:    0
```
#### posts10k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      2.590669ms
├─ Worst:     38.818552ms
├─ Completed: 135.320205ms
├─ Workers:   0=19 1=39 2=22 3=20
└─ Errors:    0
```
#### posts10k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.723591ms
├─ Worst:     12.690731ms
├─ Completed: 53.56401ms
├─ Workers:   0=27 1=20 2=28 3=25
└─ Errors:    0
```
#### posts10k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      3.19246ms
├─ Worst:     40.757ms
├─ Completed: 114.212497ms
├─ Workers:   0=25 1=23 2=26 3=26
└─ Errors:    0
```
#### posts10k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.152552ms
├─ Worst:     6.277401ms
├─ Completed: 33.095195ms
├─ Workers:   0=25 1=24 2=31 3=20
└─ Errors:    0
```
#### posts10k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.177846ms
├─ Worst:     7.762623ms
├─ Completed: 31.642649ms
├─ Workers:   0=29 1=15 2=31 3=25
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.59145ms
├─ Worst:     42.834489ms
├─ Completed: 118.709028ms
├─ Workers:   0=27 1=20 2=28 3=25
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.003506ms
├─ Worst:     8.434652ms
├─ Completed: 35.731128ms
├─ Workers:   0=27 1=21 2=26 3=26
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      905.721µs
├─ Worst:     9.809691ms
├─ Completed: 35.237215ms
├─ Workers:   0=27 1=17 2=30 3=26
└─ Errors:    0
```
#### posts10k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      3.398034ms
├─ Worst:     41.490091ms
├─ Completed: 144.202213ms
├─ Workers:   0=18 1=23 2=30 3=29
└─ Errors:    0
```
#### posts10k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      3.350719ms
├─ Worst:     35.486448ms
├─ Completed: 149.408205ms
├─ Workers:   1=68 3=32
└─ Errors:    0
```
#### posts10k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.204784ms
├─ Worst:     6.50043ms
├─ Completed: 37.618003ms
├─ Workers:   0=37 1=5 2=24 3=34
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      13.556496ms
├─ Worst:     153.533934ms
├─ Completed: 790.819715ms
├─ Workers:   0=44 1=18 2=16 3=22
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.200568ms
├─ Worst:     14.171636ms
├─ Completed: 51.631521ms
├─ Workers:   0=37 1=34 2=15 3=14
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      5.660138ms
├─ Worst:     83.15829ms
├─ Completed: 357.049238ms
├─ Workers:   0=19 1=39 2=22 3=20
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.154244ms
├─ Worst:     9.250278ms
├─ Completed: 40.141329ms
├─ Workers:   0=27 1=20 2=28 3=25
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      12.408831ms
├─ Worst:     72.742212ms
├─ Completed: 348.815074ms
├─ Workers:   0=25 1=23 2=26 3=26
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      977.48µs
├─ Worst:     12.431292ms
├─ Completed: 48.073755ms
├─ Workers:   0=25 1=24 2=31 3=20
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      60.065461ms
├─ Worst:     353.203707ms
├─ Completed: 1.71771585s
├─ Workers:   0=29 1=15 2=31 3=25
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.317961ms
├─ Worst:     13.837625ms
├─ Completed: 66.024783ms
├─ Workers:   0=27 1=20 2=28 3=25
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      165.340021ms
├─ Worst:     683.099919ms
├─ Completed: 4.734225775s
├─ Workers:   0=27 1=21 2=26 3=26
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.091027ms
├─ Worst:     17.148467ms
├─ Completed: 63.805297ms
├─ Workers:   0=27 1=17 2=30 3=26
└─ Errors:    0
```
#### posts25k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.070409ms
├─ Worst:     5.989895ms
├─ Completed: 2.489284054s
├─ Workers:   0=261 1=269 2=223 3=247
└─ Errors:    0
```
#### posts25k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      26.035764ms
├─ Worst:     429.270731ms
├─ Completed: 432.305824ms
├─ Workers:   0=263 1=265 2=219 3=253
└─ Errors:    0
```
#### posts25k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      26.261435ms
├─ Worst:     156.279956ms
├─ Completed: 158.205015ms
├─ Workers:   0=231 1=240 2=274 3=255
└─ Errors:    0
```
#### posts25k - mixed read and write (simpleA list with additional 300 concurrent random posts25k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      29.430253ms
├─ Worst:     434.167124ms
├─ Completed: 436.224406ms
├─ Workers:   0=231 1=240 2=274 3=255
└─ Errors:    0
```
#### posts25k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.509436ms
├─ Worst:     25.712549ms
├─ Completed: 96.733102ms
├─ Workers:   0=8 1=22 2=32 3=38
└─ Errors:    0
```
#### posts25k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      1.787469ms
├─ Worst:     37.945957ms
├─ Completed: 115.562502ms
├─ Workers:   0=28 1=41 2=7 3=24
└─ Errors:    0
```
#### posts25k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      2.134358ms
├─ Worst:     27.188478ms
├─ Completed: 120.258177ms
├─ Workers:   0=50 1=26 2=12 3=12
└─ Errors:    0
```
#### posts25k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      2.509447ms
├─ Worst:     41.077242ms
├─ Completed: 151.205697ms
├─ Workers:   0=37 1=20 2=22 3=21
└─ Errors:    0
```
#### posts25k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.62143ms
├─ Worst:     13.636286ms
├─ Completed: 65.705783ms
├─ Workers:   0=23 1=26 2=26 3=25
└─ Errors:    0
```
#### posts25k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      7.079048ms
├─ Worst:     73.653942ms
├─ Completed: 246.082395ms
├─ Workers:   0=23 1=26 2=25 3=26
└─ Errors:    0
```
#### posts25k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      888.206µs
├─ Worst:     7.511036ms
├─ Completed: 38.48424ms
├─ Workers:   0=20 1=27 2=26 3=27
└─ Errors:    0
```
#### posts25k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      933.208µs
├─ Worst:     13.706453ms
├─ Completed: 38.650079ms
├─ Workers:   0=22 1=26 2=26 3=26
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      6.911728ms
├─ Worst:     73.837414ms
├─ Completed: 259.778243ms
├─ Workers:   0=23 1=25 2=27 3=25
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      987.955µs
├─ Worst:     12.360474ms
├─ Completed: 37.23229ms
├─ Workers:   0=22 1=26 2=26 3=26
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      995.796µs
├─ Worst:     8.886546ms
├─ Completed: 36.930905ms
├─ Workers:   0=23 1=24 2=25 3=28
└─ Errors:    0
```
#### posts25k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      9.865549ms
├─ Worst:     76.808028ms
├─ Completed: 303.903465ms
├─ Workers:   0=22 1=27 2=25 3=26
└─ Errors:    0
```
#### posts25k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      5.834861ms
├─ Worst:     65.489103ms
├─ Completed: 313.755575ms
├─ Workers:   0=41 1=11 2=28 3=20
└─ Errors:    0
```
#### posts25k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.02098ms
├─ Worst:     8.200257ms
├─ Completed: 38.741836ms
├─ Workers:   0=8 1=22 2=32 3=38
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      39.776895ms
├─ Worst:     379.903159ms
├─ Completed: 1.9344396s
├─ Workers:   0=28 1=41 2=7 3=24
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.15764ms
├─ Worst:     9.821056ms
├─ Completed: 51.851854ms
├─ Workers:   0=50 1=26 2=12 3=12
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      15.243056ms
├─ Worst:     209.427022ms
├─ Completed: 790.066425ms
├─ Workers:   0=37 1=20 2=22 3=21
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.087332ms
├─ Worst:     10.410971ms
├─ Completed: 40.448964ms
├─ Workers:   0=23 1=26 2=26 3=25
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      29.690222ms
├─ Worst:     137.263098ms
├─ Completed: 815.947736ms
├─ Workers:   0=23 1=26 2=25 3=26
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.044693ms
├─ Worst:     10.438249ms
├─ Completed: 42.969926ms
├─ Workers:   0=20 1=27 2=26 3=27
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      108.148351ms
├─ Worst:     788.624053ms
├─ Completed: 4.58078349s
├─ Workers:   0=22 1=26 2=26 3=26
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.348944ms
├─ Worst:     12.658716ms
├─ Completed: 64.908091ms
├─ Workers:   0=23 1=25 2=27 3=25
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      464.88694ms
├─ Worst:     2.414588971s
├─ Completed: 12.94940893s
├─ Workers:   0=22 1=26 2=26 3=26
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      883.83µs
├─ Worst:     17.383613ms
├─ Completed: 68.012539ms
├─ Workers:   0=23 1=24 2=25 3=28
└─ Errors:    0
```
#### posts50k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.898632ms
├─ Worst:     8.820735ms
├─ Completed: 4.456489555s
├─ Workers:   0=274 1=252 2=229 3=245
└─ Errors:    0
```
#### posts50k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      24.220287ms
├─ Worst:     719.365263ms
├─ Completed: 721.152342ms
├─ Workers:   0=277 1=248 2=230 3=245
└─ Errors:    0
```
#### posts50k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      32.599371ms
├─ Worst:     170.303386ms
├─ Completed: 172.186658ms
├─ Workers:   0=250 1=256 2=238 3=256
└─ Errors:    0
```
#### posts50k - mixed read and write (simpleA list with additional 300 concurrent random posts50k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      45.033156ms
├─ Worst:     800.451762ms
├─ Completed: 802.230659ms
├─ Workers:   0=250 1=256 2=238 3=256
└─ Errors:    0
```
#### posts50k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      2.25812ms
├─ Worst:     39.442784ms
├─ Completed: 140.051169ms
├─ Workers:   0=39 1=24 2=33 3=4
└─ Errors:    0
```
#### posts50k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      2.784245ms
├─ Worst:     34.465469ms
├─ Completed: 156.061105ms
├─ Workers:   0=37 1=24 2=23 3=16
└─ Errors:    0
```
#### posts50k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      2.692659ms
├─ Worst:     37.701988ms
├─ Completed: 156.283109ms
├─ Workers:   0=18 1=24 2=12 3=46
└─ Errors:    0
```
#### posts50k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      7.913742ms
├─ Worst:     38.246893ms
├─ Completed: 163.992672ms
├─ Workers:   0=26 1=25 2=26 3=23
└─ Errors:    0
```
#### posts50k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      2.935214ms
├─ Worst:     25.443445ms
├─ Completed: 105.576887ms
├─ Workers:   0=26 1=25 2=26 3=23
└─ Errors:    0
```
#### posts50k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      23.569948ms
├─ Worst:     124.876457ms
├─ Completed: 677.436614ms
├─ Workers:   0=25 1=26 2=26 3=23
└─ Errors:    0
```
#### posts50k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.168293ms
├─ Worst:     9.125977ms
├─ Completed: 41.833476ms
├─ Workers:   0=24 1=22 2=34 3=20
└─ Errors:    0
```
#### posts50k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.220536ms
├─ Worst:     8.262163ms
├─ Completed: 34.693274ms
├─ Workers:   0=33 1=24 2=26 3=17
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      23.185037ms
├─ Worst:     122.506244ms
├─ Completed: 678.070149ms
├─ Workers:   0=27 1=25 2=26 3=22
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.197495ms
├─ Worst:     10.95342ms
├─ Completed: 41.929559ms
├─ Workers:   0=28 1=27 2=25 3=20
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      571.97µs
├─ Worst:     5.339625ms
├─ Completed: 28.513978ms
├─ Workers:   0=31 1=29 2=17 3=23
└─ Errors:    0
```
#### posts50k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      25.814029ms
├─ Worst:     139.629667ms
├─ Completed: 765.988655ms
├─ Workers:   0=24 1=25 2=29 3=22
└─ Errors:    0
```
#### posts50k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      16.15822ms
├─ Worst:     115.940163ms
├─ Completed: 831.129187ms
├─ Workers:   0=4 1=27 2=4 3=65
└─ Errors:    0
```
#### posts50k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      992.892µs
├─ Worst:     10.505522ms
├─ Completed: 43.071486ms
├─ Workers:   0=39 1=24 2=33 3=4
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      115.632588ms
├─ Worst:     768.519482ms
├─ Completed: 4.002390257s
├─ Workers:   0=37 1=24 2=23 3=16
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.212644ms
├─ Worst:     11.672704ms
├─ Completed: 52.420742ms
├─ Workers:   0=18 1=24 2=12 3=46
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      50.51577ms
├─ Worst:     285.633569ms
├─ Completed: 1.572190739s
├─ Workers:   0=26 1=25 2=26 3=23
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.206446ms
├─ Worst:     11.824253ms
├─ Completed: 39.065551ms
├─ Workers:   0=26 1=25 2=26 3=23
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      85.937721ms
├─ Worst:     251.958282ms
├─ Completed: 1.789446746s
├─ Workers:   0=25 1=26 2=26 3=23
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.124513ms
├─ Worst:     11.179613ms
├─ Completed: 46.392063ms
├─ Workers:   0=24 1=22 2=34 3=20
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      195.333052ms
├─ Worst:     2.549041399s
├─ Completed: 9.652477024s
├─ Workers:   0=33 1=24 2=26 3=17
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.803421ms
├─ Worst:     40.682627ms
├─ Completed: 122.840886ms
├─ Workers:   0=27 1=25 2=26 3=22
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      854.87744ms
├─ Worst:     4.736558005s
├─ Completed: 24.588609405s
├─ Workers:   0=28 1=27 2=25 3=20
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.275322ms
├─ Worst:     13.274307ms
├─ Completed: 62.524038ms
├─ Workers:   0=31 1=29 2=17 3=23
└─ Errors:    0
```
#### posts100k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      3.20728ms
├─ Worst:     15.604454ms
├─ Completed: 8.207900067s
├─ Workers:   0=256 1=246 2=239 3=259
└─ Errors:    0
```
#### posts100k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      29.991927ms
├─ Worst:     1.38672434s
├─ Completed: 1.38882314s
├─ Workers:   0=260 1=255 2=221 3=264
└─ Errors:    0
```
#### posts100k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      23.739153ms
├─ Worst:     170.19595ms
├─ Completed: 172.218433ms
├─ Workers:   0=247 1=249 2=266 3=238
└─ Errors:    0
```
#### posts100k - mixed read and write (simpleA list with additional 300 concurrent random posts100k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      45.10039ms
├─ Worst:     1.392300868s
├─ Completed: 1.39364951s
├─ Workers:   0=247 1=249 2=266 3=238
└─ Errors:    0
```
#### posts100k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      3.680985ms
├─ Worst:     61.492212ms
├─ Completed: 251.309625ms
├─ Workers:   0=38 1=18 2=2 3=42
└─ Errors:    0
```
#### posts100k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      4.188226ms
├─ Worst:     58.597515ms
├─ Completed: 244.133633ms
├─ Workers:   0=29 1=26 2=4 3=41
└─ Errors:    0
```
#### posts100k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      4.050054ms
├─ Worst:     54.190756ms
├─ Completed: 241.60458ms
├─ Workers:   0=32 1=26 2=37 3=5
└─ Errors:    0
```
#### posts100k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      11.920826ms
├─ Worst:     52.266527ms
├─ Completed: 222.691204ms
├─ Workers:   0=26 1=26 2=23 3=25
└─ Errors:    0
```
#### posts100k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      8.687851ms
├─ Worst:     46.020721ms
├─ Completed: 165.340082ms
├─ Workers:   0=25 1=25 2=24 3=26
└─ Errors:    0
```
#### posts100k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      77.426272ms
├─ Worst:     185.045221ms
├─ Completed: 1.201139038s
├─ Workers:   0=26 1=25 2=24 3=25
└─ Errors:    0
```
#### posts100k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.053456ms
├─ Worst:     12.990414ms
├─ Completed: 41.108694ms
├─ Workers:   0=25 1=25 2=24 3=26
└─ Errors:    0
```
#### posts100k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      891.011µs
├─ Worst:     12.076031ms
├─ Completed: 43.176702ms
├─ Workers:   0=24 1=32 2=22 3=22
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      43.825779ms
├─ Worst:     189.29405ms
├─ Completed: 1.225105545s
├─ Workers:   0=26 1=25 2=23 3=26
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.064881ms
├─ Worst:     10.772131ms
├─ Completed: 37.285264ms
├─ Workers:   0=25 1=25 2=24 3=26
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      999.881µs
├─ Worst:     10.190446ms
├─ Completed: 37.036429ms
├─ Workers:   0=25 1=25 2=24 3=26
└─ Errors:    0
```
#### posts100k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      50.26228ms
├─ Worst:     208.618003ms
├─ Completed: 1.392282494s
├─ Workers:   0=26 1=25 2=23 3=26
└─ Errors:    0
```
#### posts100k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      81.675323ms
├─ Worst:     298.801249ms
├─ Completed: 1.798598308s
├─ Workers:   0=15 1=24 2=53 3=8
└─ Errors:    0
```
#### posts100k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      974.066µs
├─ Worst:     28.905198ms
├─ Completed: 73.965642ms
├─ Workers:   0=38 1=18 2=2 3=42
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      238.733423ms
├─ Worst:     1.750790309s
├─ Completed: 8.627548934s
├─ Workers:   0=29 1=26 2=4 3=41
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.304993ms
├─ Worst:     12.55359ms
├─ Completed: 51.102799ms
├─ Workers:   0=32 1=26 2=37 3=5
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      118.37036ms
├─ Worst:     493.546187ms
├─ Completed: 3.138281222s
├─ Workers:   0=26 1=26 2=23 3=25
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.088684ms
├─ Worst:     10.311804ms
├─ Completed: 39.857858ms
├─ Workers:   0=25 1=25 2=24 3=26
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      183.642914ms
├─ Worst:     447.731893ms
├─ Completed: 3.456081294s
├─ Workers:   0=26 1=25 2=24 3=25
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.312844ms
├─ Worst:     14.834962ms
├─ Completed: 48.667016ms
├─ Workers:   0=25 1=25 2=24 3=26
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      700.986615ms
├─ Worst:     3.629670063s
├─ Completed: 20.219979812s
├─ Workers:   0=24 1=32 2=22 3=22
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.480255ms
├─ Worst:     16.20915ms
├─ Completed: 67.822826ms
├─ Workers:   0=26 1=25 2=23 3=26
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      1.73336714s
├─ Worst:     8.595259509s
├─ Completed: 50.986566591s
├─ Workers:   0=25 1=25 2=24 3=26
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.449282ms
├─ Worst:     16.596625ms
├─ Completed: 66.853489ms
├─ Workers:   0=25 1=25 2=24 3=26
└─ Errors:    0
```

## Go vs JS route execution
#### JS route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      56.560669ms
├─ Worst:     2.110852685s
├─ Completed: 2.112319741s
├─ Workers:   0=140 1=119 2=119 3=122
└─ Errors:    0
```
#### Go route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      38.560386ms
├─ Worst:     1.956166971s
├─ Completed: 1.95702804s
├─ Workers:   0=126 1=133 2=117 3=124
└─ Errors:    0
```
#### JS route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      35.448486ms
├─ Worst:     266.239118ms
├─ Completed: 1.961577036s
├─ Workers:   0=124 1=126 2=122 3=128
└─ Errors:    0
```
#### Go route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      34.979097ms
├─ Worst:     447.237118ms
├─ Completed: 2.041467692s
├─ Workers:   0=142 1=118 2=117 3=123
└─ Errors:    0
```
#### JS route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      9.864376ms
├─ Worst:     31.214084ms
├─ Completed: 9.231755415s
├─ Workers:   0=126 1=133 2=117 3=124
└─ Errors:    0
```
#### Go route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      10.214619ms
├─ Worst:     26.030115ms
├─ Completed: 8.992754865s
├─ Workers:   0=124 1=127 2=122 3=127
└─ Errors:    0
```

## Go vs JS hooks execution
#### JS OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      1.182853ms
├─ Worst:     11.452289ms
├─ Completed: 42.470613ms
├─ Workers:   0=25 1=24 2=25 3=26
└─ Errors:    0
```
#### Go OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      932.879µs
├─ Worst:     11.534853ms
├─ Completed: 31.892201ms
├─ Workers:   0=26 1=25 2=24 3=25
└─ Errors:    0
```

## Deleting records
#### deleting 100 posts10k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      774.259µs
├─ Worst:     11.353051ms
├─ Completed: 36.023728ms
├─ Workers:   0=41 1=18 2=19 3=22
└─ Errors:    0
```
#### deleting 100 posts10k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      776.132µs
├─ Worst:     9.050351ms
├─ Completed: 35.687164ms
├─ Workers:   0=25 1=25 2=25 3=25
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      749.906µs
├─ Worst:     16.815327ms
├─ Completed: 41.445826ms
├─ Workers:   0=25 1=26 2=24 3=25
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      748.854µs
├─ Worst:     14.946165ms
├─ Completed: 49.038816ms
├─ Workers:   0=26 1=32 2=19 3=23
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      777.154µs
├─ Worst:     11.450546ms
├─ Completed: 41.851637ms
├─ Workers:   0=25 1=25 2=24 3=26
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      833.641µs
├─ Worst:     12.063673ms
├─ Completed: 38.128635ms
├─ Workers:   0=25 1=25 2=25 3=25
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      774.47µs
├─ Worst:     21.975424ms
├─ Completed: 48.710371ms
├─ Workers:   0=25 1=26 2=24 3=25
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      772.837µs
├─ Worst:     21.506156ms
├─ Completed: 51.374931ms
├─ Workers:   0=25 1=24 2=25 3=26
└─ Errors:    0
```
#### deleting 100 users - with cascade deleting all associated posts [conc:10, rule:`""`]
```
┌─ Best:      66.901817ms
├─ Worst:     2.548260135s
├─ Completed: 8.797053316s
├─ Workers:   0=24 1=26 2=24 3=26
└─ Errors:    0
```
#### deleting 100 organizations - with cascade deleting all users and associated posts [conc:10, rule:`""`]
```
┌─ Best:      16.801248ms
├─ Worst:     5.403736796s
├─ Completed: 18.577766234s
├─ Workers:   0=25 1=25 2=25 3=25
└─ Errors:    0
```

---------------------------------------------------
Completed!
