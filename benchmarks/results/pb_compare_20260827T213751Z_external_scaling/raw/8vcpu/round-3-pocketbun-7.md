# PocketBun Upstream-Port Benchmark Result

- machine: hetzner-8vcpu-pocketbun-7
- timestamp: 2026-08-27T19:56:34.274Z
- tests: create,auth,search,custom,delete
- benchmark source: 05625dc2b2d3f9711c51566010944b10ca9531fa
- server workers: 7
- load generator: http://load-generator:19231
- benchmark target host: application-host
- warmup request target/cap: 1000
## Creating organizations (100)
#### Creating 50 organizations [reqs:50, conc:10, rule:`""`]
```
┌─ Best:      688.37µs
├─ Worst:     7.266859ms
├─ Completed: 11.806744ms
├─ Workers:   0=6 1=7 2=6 3=11 4=6 5=7 6=7
└─ Errors:    0
```
#### Creating 50 organizations [reqs:50, conc:10, rule:`"@request.body.name != ''"`]
```
┌─ Best:      793.986µs
├─ Worst:     7.062978ms
├─ Completed: 11.631251ms
├─ Workers:   0=6 1=7 2=7 3=9 4=8 5=7 6=6
└─ Errors:    0
```

## Creating permissions (50)
#### Creating 25 permissions [reqs:25, conc:5, rule:`""`]
```
┌─ Best:      573.151µs
├─ Worst:     4.205033ms
├─ Completed: 7.764806ms
├─ Workers:   1=4 2=6 3=3 4=3 5=6 6=3
└─ Errors:    0
```
#### Creating 25 permissions [reqs:25, conc:5, rule:`"@request.body.name != ''"`]
```
┌─ Best:      804.36µs
├─ Worst:     4.751126ms
├─ Completed: 8.610002ms
├─ Workers:   1=6 2=6 4=6 5=6 6=1
└─ Errors:    0
```

## Creating users (500 - expected to be slow due to passwordHash generation)
#### Creating 250 users [reqs:250, conc:50, rule:`""`]
```
┌─ Best:      70.675214ms
├─ Worst:     787.539836ms
├─ Completed: 2.056925168s
├─ Workers:   0=35 1=30 2=59 3=34 4=38 5=30 6=24
└─ Errors:    0
```
#### Creating 250 users [reqs:250, conc:50, rule:`"@request.body.email != '' && @request.body.permissions:length > 0"`]
```
┌─ Best:      199.019906ms
├─ Worst:     1.006820242s
├─ Completed: 2.073603945s
├─ Workers:   0=34 1=36 2=25 3=41 4=31 5=44 6=39
└─ Errors:    0
```

## Creating posts (10k, 25k, 50k, 100k)
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`""`]
```
┌─ Best:      555.847µs
├─ Worst:     303.970972ms
├─ Completed: 400.955585ms
├─ Workers:   0=630 1=764 2=743 3=756 4=708 5=730 6=669
└─ Errors:    0
```
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      563.447µs
├─ Worst:     260.365565ms
├─ Completed: 416.844172ms
├─ Workers:   0=715 1=758 2=641 3=782 4=742 5=577 6=785
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`""`]
```
┌─ Best:      919.308µs
├─ Worst:     442.66902ms
├─ Completed: 807.825332ms
├─ Workers:   0=1584 1=1823 2=1755 3=1924 4=1663 5=1957 6=1794
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      527.708µs
├─ Worst:     512.306984ms
├─ Completed: 979.358003ms
├─ Workers:   0=1580 1=1909 2=1504 3=1944 4=1827 5=1936 6=1800
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`""`]
```
┌─ Best:      502.884µs
├─ Worst:     760.864944ms
├─ Completed: 1.460060652s
├─ Workers:   0=3194 1=3628 2=3646 3=3564 4=3368 5=4007 6=3593
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      494.923µs
├─ Worst:     535.698475ms
├─ Completed: 1.698367444s
├─ Workers:   0=3709 1=3668 2=3154 3=3692 4=3464 5=3767 6=3546
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`""`]
```
┌─ Best:      441.9µs
├─ Worst:     757.402296ms
├─ Completed: 2.764130369s
├─ Workers:   0=6224 1=7203 2=7218 3=8129 4=6662 5=7376 6=7188
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      482.196µs
├─ Worst:     641.834196ms
├─ Completed: 3.189639187s
├─ Workers:   0=7033 1=6512 2=7063 3=7732 4=6695 5=7457 6=7508
└─ Errors:    0
```

## User auth with password (expected to be slow due to passwordHash verification)
#### users auth with email/pass - high concurrency [reqs:250, conc:250]
```
┌─ Best:      304.473084ms
├─ Worst:     2.053968348s
├─ Completed: 2.054079461s
├─ Workers:   0=28 1=40 2=36 3=35 4=43 5=37 6=31
└─ Errors:    0
```
#### users auth with email/pass - small concurrency [reqs:250, conc:10]
```
┌─ Best:      61.705226ms
├─ Worst:     134.210205ms
├─ Completed: 2.105446049s
├─ Workers:   0=44 1=35 2=35 3=35 4=44 5=18 6=39
└─ Errors:    0
```

## User auth refresh
#### users - auth refresh (high concurrency) [reqs:1000, conc:1000]
```
┌─ Best:      28.596053ms
├─ Worst:     68.699929ms
├─ Completed: 70.180222ms
├─ Workers:   0=116 1=144 2=145 3=163 4=117 5=172 6=143
└─ Errors:    0
```
#### users - auth refresh (medium concurrency) [reqs:1000, conc:100]
```
┌─ Best:      446.867µs
├─ Worst:     32.869962ms
├─ Completed: 67.972554ms
├─ Workers:   0=156 1=104 2=137 3=151 4=148 5=138 6=166
└─ Errors:    0
```

## List records
#### users - getOne for auth refresh comparison (medium concurrency) [reqs:1000, conc:100, rule:`""`, query:`/j137klho6c7veyd`]
```
┌─ Best:      485.35µs
├─ Worst:     20.97754ms
├─ Completed: 58.401686ms
├─ Workers:   0=124 1=159 2=154 3=96 4=150 5=168 6=149
└─ Errors:    0
```
#### users - getOne for auth refresh comparison (high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`/j137klho6c7veyd`]
```
┌─ Best:      22.41211ms
├─ Worst:     62.265509ms
├─ Completed: 63.83818ms
├─ Workers:   0=119 1=167 2=145 3=187 4=136 5=127 6=119
└─ Errors:    0
```
#### posts10k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.355731ms
├─ Worst:     7.199025ms
├─ Completed: 1.698976936s
├─ Workers:   0=147 1=180 2=77 3=123 4=128 5=173 6=172
└─ Errors:    0
```
#### posts10k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      24.432558ms
├─ Worst:     169.53161ms
├─ Completed: 171.758554ms
├─ Workers:   0=117 1=127 2=163 3=161 4=138 5=152 6=142
└─ Errors:    0
```
#### posts10k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      34.186259ms
├─ Worst:     111.937958ms
├─ Completed: 113.581347ms
├─ Workers:   0=155 1=132 2=130 3=162 4=136 5=146 6=139
└─ Errors:    0
```
#### posts10k - mixed read and write (simpleA list with additional 300 concurrent random posts10k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      29.523343ms
├─ Worst:     178.783158ms
├─ Completed: 180.548825ms
├─ Workers:   0=155 1=131 2=131 3=162 4=136 5=146 6=139
└─ Errors:    0
```
#### posts10k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      2.02137ms
├─ Worst:     21.697684ms
├─ Completed: 64.922656ms
├─ Workers:   0=4 1=20 2=15 3=11 4=19 5=14 6=17
└─ Errors:    0
```
#### posts10k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      2.122269ms
├─ Worst:     18.069777ms
├─ Completed: 73.53381ms
├─ Workers:   0=7 1=20 2=17 3=20 4=8 5=3 6=25
└─ Errors:    0
```
#### posts10k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      2.107879ms
├─ Worst:     26.694999ms
├─ Completed: 83.293899ms
├─ Workers:   0=8 1=23 2=16 3=11 4=9 5=19 6=14
└─ Errors:    0
```
#### posts10k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      2.959955ms
├─ Worst:     30.269283ms
├─ Completed: 89.25893ms
├─ Workers:   0=13 1=13 2=15 3=13 4=13 5=17 6=16
└─ Errors:    0
```
#### posts10k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.483467ms
├─ Worst:     11.096815ms
├─ Completed: 40.964401ms
├─ Workers:   0=5 1=21 2=14 3=15 4=21 5=11 6=13
└─ Errors:    0
```
#### posts10k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.676685ms
├─ Worst:     46.234956ms
├─ Completed: 115.741859ms
├─ Workers:   0=11 1=17 2=24 3=12 4=15 5=9 6=12
└─ Errors:    0
```
#### posts10k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      907.463µs
├─ Worst:     6.725371ms
├─ Completed: 23.169935ms
├─ Workers:   0=13 1=20 2=14 3=14 4=14 5=10 6=15
└─ Errors:    0
```
#### posts10k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      881.436µs
├─ Worst:     6.699686ms
├─ Completed: 21.919509ms
├─ Workers:   0=13 1=20 2=15 3=14 4=14 5=11 6=13
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      3.365615ms
├─ Worst:     36.459024ms
├─ Completed: 104.629633ms
├─ Workers:   0=14 1=22 2=14 3=12 4=13 5=10 6=15
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      890.409µs
├─ Worst:     6.293675ms
├─ Completed: 22.110242ms
├─ Workers:   0=14 1=15 2=16 3=15 4=15 5=11 6=14
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      948.87µs
├─ Worst:     3.544903ms
├─ Completed: 17.448459ms
├─ Workers:   0=16 2=18 3=17 4=18 5=13 6=18
└─ Errors:    0
```
#### posts10k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      3.542228ms
├─ Worst:     39.583266ms
├─ Completed: 125.93242ms
├─ Workers:   0=20 2=9 3=26 4=15 5=16 6=14
└─ Errors:    0
```
#### posts10k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      2.432337ms
├─ Worst:     30.018126ms
├─ Completed: 147.308691ms
├─ Workers:   0=23 3=25 5=51 6=1
└─ Errors:    0
```
#### posts10k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      904.729µs
├─ Worst:     9.537322ms
├─ Completed: 29.547998ms
├─ Workers:   0=4 1=20 2=16 3=11 4=19 5=14 6=16
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      14.475267ms
├─ Worst:     89.119448ms
├─ Completed: 420.39353ms
├─ Workers:   0=7 1=20 2=16 3=21 4=8 5=3 6=25
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.206905ms
├─ Worst:     6.101531ms
├─ Completed: 28.740943ms
├─ Workers:   0=8 1=23 2=16 3=10 4=9 5=20 6=14
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      5.503234ms
├─ Worst:     57.735417ms
├─ Completed: 190.717717ms
├─ Workers:   0=13 1=13 2=15 3=13 4=13 5=17 6=16
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.003325ms
├─ Worst:     9.250055ms
├─ Completed: 25.657938ms
├─ Workers:   0=5 1=21 2=14 3=15 4=21 5=11 6=13
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      7.821184ms
├─ Worst:     75.629522ms
├─ Completed: 291.633576ms
├─ Workers:   0=11 1=17 2=25 3=12 4=15 5=8 6=12
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.052452ms
├─ Worst:     7.332809ms
├─ Completed: 24.298662ms
├─ Workers:   0=13 1=20 2=13 3=15 4=14 5=10 6=15
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      35.953917ms
├─ Worst:     185.207564ms
├─ Completed: 951.577936ms
├─ Workers:   0=13 1=20 2=15 3=13 4=14 5=11 6=14
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.199785ms
├─ Worst:     12.99206ms
├─ Completed: 56.559233ms
├─ Workers:   0=14 1=23 2=14 3=12 4=13 5=10 6=14
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      97.401157ms
├─ Worst:     645.403793ms
├─ Completed: 2.65289525s
├─ Workers:   0=14 1=14 2=17 3=15 4=15 5=11 6=14
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.491329ms
├─ Worst:     14.023924ms
├─ Completed: 44.776492ms
├─ Workers:   0=16 2=17 3=17 4=18 5=14 6=18
└─ Errors:    0
```
#### posts25k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.122769ms
├─ Worst:     5.339789ms
├─ Completed: 2.649219381s
├─ Workers:   0=117 1=154 2=140 3=161 4=128 5=160 6=140
└─ Errors:    0
```
#### posts25k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      23.081383ms
├─ Worst:     270.866567ms
├─ Completed: 272.742875ms
├─ Workers:   0=125 1=134 2=133 3=165 4=132 5=166 6=145
└─ Errors:    0
```
#### posts25k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      22.382909ms
├─ Worst:     105.550965ms
├─ Completed: 107.101143ms
├─ Workers:   0=135 1=149 2=151 3=190 4=136 5=104 6=135
└─ Errors:    0
```
#### posts25k - mixed read and write (simpleA list with additional 300 concurrent random posts25k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      26.116251ms
├─ Worst:     265.966063ms
├─ Completed: 267.126324ms
├─ Workers:   0=135 1=149 2=150 3=191 4=136 5=104 6=135
└─ Errors:    0
```
#### posts25k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.391901ms
├─ Worst:     13.63714ms
├─ Completed: 76.36695ms
├─ Workers:   0=14 1=16 2=7 3=13 4=19 5=14 6=17
└─ Errors:    0
```
#### posts25k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      1.583465ms
├─ Worst:     31.817068ms
├─ Completed: 89.190416ms
├─ Workers:   0=13 1=22 2=4 3=5 4=15 5=18 6=23
└─ Errors:    0
```
#### posts25k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      3.488063ms
├─ Worst:     31.392332ms
├─ Completed: 78.62785ms
├─ Workers:   0=9 1=10 2=25 3=7 4=6 5=30 6=13
└─ Errors:    0
```
#### posts25k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      2.520148ms
├─ Worst:     49.50522ms
├─ Completed: 136.939291ms
├─ Workers:   0=13 1=12 2=9 3=19 4=11 5=25 6=11
└─ Errors:    0
```
#### posts25k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.221666ms
├─ Worst:     15.669934ms
├─ Completed: 58.065382ms
├─ Workers:   0=12 1=12 2=12 3=17 4=13 5=22 6=12
└─ Errors:    0
```
#### posts25k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      5.440939ms
├─ Worst:     62.739082ms
├─ Completed: 168.507987ms
├─ Workers:   0=13 1=14 2=15 3=14 4=13 5=14 6=17
└─ Errors:    0
```
#### posts25k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      990.958µs
├─ Worst:     6.102241ms
├─ Completed: 24.33304ms
├─ Workers:   0=17 1=14 2=11 3=7 4=13 5=16 6=22
└─ Errors:    0
```
#### posts25k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      907.382µs
├─ Worst:     7.014819ms
├─ Completed: 23.631022ms
├─ Workers:   0=14 1=14 2=11 3=14 4=13 5=13 6=21
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      5.632733ms
├─ Worst:     62.722359ms
├─ Completed: 191.143065ms
├─ Workers:   0=13 1=13 2=12 3=13 4=13 5=14 6=22
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      920.02µs
├─ Worst:     6.347019ms
├─ Completed: 23.562177ms
├─ Workers:   0=14 1=14 2=11 3=14 4=12 5=13 6=22
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      970.719µs
├─ Worst:     3.929152ms
├─ Completed: 19.959935ms
├─ Workers:   0=16 1=16 2=14 3=17 4=15 5=16 6=6
└─ Errors:    0
```
#### posts25k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      8.708808ms
├─ Worst:     75.157771ms
├─ Completed: 312.755385ms
├─ Workers:   0=13 1=23 2=15 3=31 4=18
└─ Errors:    0
```
#### posts25k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      6.052482ms
├─ Worst:     54.490999ms
├─ Completed: 271.732852ms
├─ Workers:   1=11 2=41 3=34 4=13 5=1
└─ Errors:    0
```
#### posts25k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      936.392µs
├─ Worst:     9.551762ms
├─ Completed: 26.280088ms
├─ Workers:   0=15 1=16 2=7 3=13 4=19 5=13 6=17
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      37.458855ms
├─ Worst:     279.57166ms
├─ Completed: 1.089690577s
├─ Workers:   0=12 1=22 2=5 3=5 4=15 5=18 6=23
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.124231ms
├─ Worst:     6.438085ms
├─ Completed: 31.282912ms
├─ Workers:   0=10 1=10 2=24 3=7 4=6 5=30 6=13
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      15.682272ms
├─ Worst:     139.139318ms
├─ Completed: 533.545215ms
├─ Workers:   0=12 1=12 2=9 3=19 4=11 5=25 6=12
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      961.376µs
├─ Worst:     7.45637ms
├─ Completed: 26.815437ms
├─ Workers:   0=12 1=12 2=12 3=18 4=13 5=22 6=11
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      19.552032ms
├─ Worst:     105.16384ms
├─ Completed: 486.867396ms
├─ Workers:   0=13 1=14 2=16 3=13 4=13 5=14 6=17
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      538.403µs
├─ Worst:     5.62254ms
├─ Completed: 22.55744ms
├─ Workers:   0=17 1=15 2=10 3=7 4=13 5=16 6=22
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      98.737422ms
├─ Worst:     788.502234ms
├─ Completed: 2.764037429s
├─ Workers:   0=14 1=13 2=12 3=14 4=13 5=13 6=21
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.940168ms
├─ Worst:     13.728456ms
├─ Completed: 64.634278ms
├─ Workers:   0=13 1=13 2=11 3=13 4=14 5=14 6=22
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      277.793756ms
├─ Worst:     1.863369723s
├─ Completed: 7.681789241s
├─ Workers:   0=14 1=14 2=11 3=14 4=11 5=14 6=22
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.71031ms
├─ Worst:     12.965122ms
├─ Completed: 46.57951ms
├─ Workers:   0=16 1=16 2=14 3=17 4=16 5=15 6=6
└─ Errors:    0
```
#### posts50k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      2.057209ms
├─ Worst:     11.344105ms
├─ Completed: 4.95038049s
├─ Workers:   0=118 1=149 2=151 3=161 4=133 5=152 6=136
└─ Errors:    0
```
#### posts50k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      22.149638ms
├─ Worst:     444.618019ms
├─ Completed: 446.248971ms
├─ Workers:   0=117 1=149 2=149 3=171 4=135 5=152 6=127
└─ Errors:    0
```
#### posts50k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      22.947558ms
├─ Worst:     104.528865ms
├─ Completed: 106.072685ms
├─ Workers:   0=161 1=137 2=130 3=133 4=136 5=143 6=160
└─ Errors:    0
```
#### posts50k - mixed read and write (simpleA list with additional 300 concurrent random posts50k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      32.000122ms
├─ Worst:     461.242724ms
├─ Completed: 462.714625ms
├─ Workers:   0=160 1=137 2=130 3=133 4=136 5=144 6=160
└─ Errors:    0
```
#### posts50k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      2.265417ms
├─ Worst:     27.898021ms
├─ Completed: 118.534132ms
├─ Workers:   0=1 1=13 2=22 3=4 4=20 5=22 6=18
└─ Errors:    0
```
#### posts50k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      2.629619ms
├─ Worst:     35.476308ms
├─ Completed: 112.874752ms
├─ Workers:   0=1 1=22 2=21 3=17 4=15 5=15 6=9
└─ Errors:    0
```
#### posts50k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      2.948378ms
├─ Worst:     36.377031ms
├─ Completed: 192.191843ms
├─ Workers:   0=5 1=8 2=6 3=51 4=6 5=18 6=6
└─ Errors:    0
```
#### posts50k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      3.981144ms
├─ Worst:     29.029211ms
├─ Completed: 113.607022ms
├─ Workers:   0=12 1=14 2=14 3=13 4=13 5=21 6=13
└─ Errors:    0
```
#### posts50k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      2.407422ms
├─ Worst:     23.97032ms
├─ Completed: 81.597027ms
├─ Workers:   0=12 1=14 2=13 3=14 4=13 5=21 6=13
└─ Errors:    0
```
#### posts50k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      18.156868ms
├─ Worst:     99.736241ms
├─ Completed: 426.466662ms
├─ Workers:   0=12 1=14 2=13 3=14 4=13 5=21 6=13
└─ Errors:    0
```
#### posts50k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      909.545µs
├─ Worst:     9.714466ms
├─ Completed: 31.097446ms
├─ Workers:   0=11 1=13 2=13 3=13 4=14 5=22 6=14
└─ Errors:    0
```
#### posts50k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      886.244µs
├─ Worst:     6.791663ms
├─ Completed: 23.725212ms
├─ Workers:   0=11 1=12 2=22 3=12 4=12 5=19 6=12
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      16.964021ms
├─ Worst:     101.000685ms
├─ Completed: 452.071275ms
├─ Workers:   0=12 1=14 2=13 3=14 4=13 5=21 6=13
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      944.063µs
├─ Worst:     10.540426ms
├─ Completed: 27.435902ms
├─ Workers:   0=14 1=15 2=14 3=14 4=14 5=15 6=14
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      856.032µs
├─ Worst:     6.720394ms
├─ Completed: 35.246292ms
├─ Workers:   0=12 1=28 2=16 3=16 4=14 6=14
└─ Errors:    0
```
#### posts50k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      17.165839ms
├─ Worst:     132.476043ms
├─ Completed: 522.678696ms
├─ Workers:   0=14 1=15 2=20 3=23 4=14 6=14
└─ Errors:    0
```
#### posts50k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      21.566123ms
├─ Worst:     134.704178ms
├─ Completed: 608.599642ms
├─ Workers:   0=44 1=9 4=13 5=1 6=33
└─ Errors:    0
```
#### posts50k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      857.944µs
├─ Worst:     11.157597ms
├─ Completed: 30.512768ms
├─ Workers:   0=1 1=13 2=23 3=4 4=20 5=21 6=18
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      79.16376ms
├─ Worst:     577.514423ms
├─ Completed: 2.381813576s
├─ Workers:   0=1 1=23 2=20 3=17 4=15 5=15 6=9
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.139271ms
├─ Worst:     12.913411ms
├─ Completed: 49.406593ms
├─ Workers:   0=5 1=7 2=7 3=51 4=6 5=18 6=6
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      38.358986ms
├─ Worst:     171.935047ms
├─ Completed: 955.45808ms
├─ Workers:   0=12 1=14 2=13 3=14 4=13 5=21 6=13
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      997.096µs
├─ Worst:     10.767891ms
├─ Completed: 30.748654ms
├─ Workers:   0=13 1=14 2=13 3=13 4=13 5=21 6=13
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      44.653614ms
├─ Worst:     329.318613ms
├─ Completed: 1.273627165s
├─ Workers:   0=11 1=14 2=13 3=14 4=13 5=21 6=14
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      961.677µs
├─ Worst:     7.01384ms
├─ Completed: 24.794827ms
├─ Workers:   0=11 1=13 2=13 3=13 4=14 5=22 6=14
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      196.13173ms
├─ Worst:     1.485628998s
├─ Completed: 5.454670391s
├─ Workers:   0=11 1=13 2=22 3=12 4=12 5=19 6=11
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.884432ms
├─ Worst:     16.176704ms
├─ Completed: 62.447911ms
├─ Workers:   0=12 1=13 2=13 3=14 4=13 5=21 6=14
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      485.74702ms
├─ Worst:     3.243314593s
├─ Completed: 14.969707338s
├─ Workers:   0=15 1=15 2=14 3=14 4=14 5=15 6=13
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.600038ms
├─ Worst:     16.96335ms
├─ Completed: 57.442863ms
├─ Workers:   0=11 1=28 2=16 3=17 4=14 6=14
└─ Errors:    0
```
#### posts100k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      3.276662ms
├─ Worst:     17.009044ms
├─ Completed: 8.56563017s
├─ Workers:   0=123 1=135 2=144 3=160 4=134 5=159 6=145
└─ Errors:    0
```
#### posts100k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      22.863372ms
├─ Worst:     777.723389ms
├─ Completed: 779.284522ms
├─ Workers:   0=128 1=151 2=140 3=166 4=135 5=133 6=147
└─ Errors:    0
```
#### posts100k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      22.692286ms
├─ Worst:     101.721761ms
├─ Completed: 103.270968ms
├─ Workers:   0=119 1=133 2=140 3=189 4=133 5=154 6=132
└─ Errors:    0
```
#### posts100k - mixed read and write (simpleA list with additional 300 concurrent random posts100k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      28.001943ms
├─ Worst:     881.087636ms
├─ Completed: 883.18435ms
├─ Workers:   0=119 1=134 2=140 3=189 4=132 5=154 6=132
└─ Errors:    0
```
#### posts100k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      3.928792ms
├─ Worst:     34.664066ms
├─ Completed: 137.204848ms
├─ Workers:   0=7 1=17 2=20 3=14 4=11 5=18 6=13
└─ Errors:    0
```
#### posts100k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      4.340209ms
├─ Worst:     44.442593ms
├─ Completed: 159.727581ms
├─ Workers:   0=21 1=14 2=14 3=1 4=16 5=17 6=17
└─ Errors:    0
```
#### posts100k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      4.663596ms
├─ Worst:     54.984892ms
├─ Completed: 206.922191ms
├─ Workers:   0=18 1=34 2=7 3=8 4=8 5=8 6=17
└─ Errors:    0
```
#### posts100k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      5.324229ms
├─ Worst:     41.300156ms
├─ Completed: 160.760126ms
├─ Workers:   0=12 1=21 2=14 3=14 4=13 5=13 6=13
└─ Errors:    0
```
#### posts100k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      3.843004ms
├─ Worst:     34.386554ms
├─ Completed: 126.065795ms
├─ Workers:   0=12 1=22 2=13 3=13 4=14 5=13 6=13
└─ Errors:    0
```
#### posts100k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      31.696702ms
├─ Worst:     322.176696ms
├─ Completed: 1.035703751s
├─ Workers:   0=11 1=19 2=24 3=11 4=11 5=12 6=12
└─ Errors:    0
```
#### posts100k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      997.537µs
├─ Worst:     6.375168ms
├─ Completed: 26.695971ms
├─ Workers:   0=12 1=22 2=13 3=13 4=14 5=13 6=13
└─ Errors:    0
```
#### posts100k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      837.356µs
├─ Worst:     7.827483ms
├─ Completed: 27.083125ms
├─ Workers:   0=11 1=18 2=12 3=12 4=12 5=12 6=23
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      37.67249ms
├─ Worst:     141.637516ms
├─ Completed: 776.823157ms
├─ Workers:   0=12 1=22 2=13 3=13 4=13 5=13 6=14
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      951.582µs
├─ Worst:     10.616962ms
├─ Completed: 33.323847ms
├─ Workers:   0=13 1=2 2=17 3=13 4=26 5=16 6=13
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      855.641µs
├─ Worst:     8.710561ms
├─ Completed: 23.320583ms
├─ Workers:   0=13 2=22 3=13 4=15 5=23 6=14
└─ Errors:    0
```
#### posts100k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      34.588705ms
├─ Worst:     247.258918ms
├─ Completed: 1.065380088s
├─ Workers:   0=14 2=18 3=15 4=14 5=24 6=15
└─ Errors:    0
```
#### posts100k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      29.530844ms
├─ Worst:     301.823879ms
├─ Completed: 2.07630332s
├─ Workers:   0=5 3=65 4=7 5=14 6=9
└─ Errors:    0
```
#### posts100k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.000982ms
├─ Worst:     5.308966ms
├─ Completed: 24.634607ms
├─ Workers:   0=7 1=17 2=20 3=14 4=12 5=17 6=13
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      180.736493ms
├─ Worst:     1.2496745s
├─ Completed: 5.19303192s
├─ Workers:   0=21 1=14 2=14 3=1 4=15 5=17 6=18
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.215747ms
├─ Worst:     8.47105ms
├─ Completed: 38.517014ms
├─ Workers:   0=18 1=34 2=8 3=8 4=8 5=8 6=16
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      74.727287ms
├─ Worst:     358.390673ms
├─ Completed: 1.887830981s
├─ Workers:   0=12 1=21 2=13 3=14 4=13 5=13 6=14
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.063006ms
├─ Worst:     5.61518ms
├─ Completed: 23.089795ms
├─ Workers:   0=12 1=22 2=14 3=13 4=14 5=13 6=12
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      88.768264ms
├─ Worst:     635.20695ms
├─ Completed: 2.616779512s
├─ Workers:   0=12 1=19 2=23 3=11 4=11 5=12 6=12
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      993.931µs
├─ Worst:     7.329915ms
├─ Completed: 26.202249ms
├─ Workers:   0=12 1=22 2=13 3=13 4=14 5=13 6=13
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      433.714554ms
├─ Worst:     3.219200132s
├─ Completed: 12.925220904s
├─ Workers:   0=10 1=19 2=12 3=12 4=12 5=12 6=23
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.856572ms
├─ Worst:     17.885953ms
├─ Completed: 60.624704ms
├─ Workers:   0=12 1=21 2=13 3=14 4=13 5=13 6=14
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      992.932506ms
├─ Worst:     9.132998887s
├─ Completed: 34.687352409s
├─ Workers:   0=13 1=2 2=17 3=12 4=26 5=17 6=13
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.596664ms
├─ Worst:     8.107668ms
├─ Completed: 45.762634ms
├─ Workers:   0=13 2=23 3=13 4=15 5=22 6=14
└─ Errors:    0
```

## Go vs JS route execution
#### JS route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      44.076837ms
├─ Worst:     1.106706547s
├─ Completed: 1.10752027s
├─ Workers:   0=65 1=66 2=59 3=103 4=56 5=80 6=71
└─ Errors:    0
```
#### Go route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      22.91231ms
├─ Worst:     985.983716ms
├─ Completed: 986.955648ms
├─ Workers:   0=58 1=103 2=75 3=63 4=64 5=63 6=74
└─ Errors:    0
```
#### JS route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      8.244628ms
├─ Worst:     212.067381ms
├─ Completed: 953.214535ms
├─ Workers:   0=65 1=49 2=80 3=66 4=80 5=91 6=69
└─ Errors:    0
```
#### Go route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      8.321154ms
├─ Worst:     312.559636ms
├─ Completed: 1.104849406s
├─ Workers:   0=64 1=66 2=59 3=117 4=57 5=68 6=69
└─ Errors:    0
```
#### JS route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      6.611363ms
├─ Worst:     24.708259ms
├─ Completed: 9.143449464s
├─ Workers:   0=61 1=98 2=76 3=56 4=67 5=67 6=75
└─ Errors:    0
```
#### Go route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      8.380817ms
├─ Worst:     22.272987ms
├─ Completed: 8.932466807s
├─ Workers:   0=64 1=55 2=81 3=61 4=80 5=89 6=70
└─ Errors:    0
```

## Go vs JS hooks execution
#### JS OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      965.082µs
├─ Worst:     11.622319ms
├─ Completed: 27.984099ms
├─ Workers:   0=15 1=17 2=9 3=21 4=6 5=16 6=16
└─ Errors:    0
```
#### Go OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      942.651µs
├─ Worst:     6.924906ms
├─ Completed: 22.380716ms
├─ Workers:   0=14 1=13 2=13 3=20 4=13 5=14 6=13
└─ Errors:    0
```

## Deleting records
#### deleting 100 posts10k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      671.527µs
├─ Worst:     36.389107ms
├─ Completed: 50.34738ms
├─ Workers:   0=7 1=8 2=8 3=47 4=8 5=9 6=13
└─ Errors:    0
```
#### deleting 100 posts10k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      735.936µs
├─ Worst:     14.136078ms
├─ Completed: 35.225041ms
├─ Workers:   0=13 1=14 2=14 3=20 4=13 5=13 6=13
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      645.061µs
├─ Worst:     20.1804ms
├─ Completed: 36.132053ms
├─ Workers:   0=14 1=20 2=14 3=2 4=15 5=21 6=14
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      761.702µs
├─ Worst:     20.149427ms
├─ Completed: 44.97711ms
├─ Workers:   0=6 1=42 2=21 4=9 5=2 6=20
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      747.922µs
├─ Worst:     19.442591ms
├─ Completed: 46.732242ms
├─ Workers:   0=19 1=14 2=13 3=13 4=14 5=14 6=13
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      767.71µs
├─ Worst:     55.668314ms
├─ Completed: 71.723921ms
├─ Workers:   0=9 1=8 2=14 3=21 4=16 5=17 6=15
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      423.075µs
├─ Worst:     11.733423ms
├─ Completed: 28.35403ms
├─ Workers:   0=13 1=5 2=16 3=11 4=16 5=24 6=15
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      767.098µs
├─ Worst:     20.331338ms
├─ Completed: 34.731572ms
├─ Workers:   0=12 1=13 2=13 3=13 4=13 5=23 6=13
└─ Errors:    0
```
#### deleting 100 users - with cascade deleting all associated posts [conc:10, rule:`""`]
```
┌─ Best:      65.991512ms
├─ Worst:     3.049900624s
├─ Completed: 8.99445163s
├─ Workers:   0=11 1=9 2=23 3=8 4=22 5=14 6=13
└─ Errors:    0
```
#### deleting 100 organizations - with cascade deleting all users and associated posts [conc:10, rule:`""`]
```
┌─ Best:      47.955119ms
├─ Worst:     8.502250863s
├─ Completed: 19.595134317s
├─ Workers:   0=14 1=13 2=13 3=14 4=19 5=13 6=14
└─ Errors:    0
```

---------------------------------------------------
Completed!
