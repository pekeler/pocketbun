# PocketBun Upstream-Port Benchmark Result

- machine: hetzner-8vcpu-pocketbun-8
- timestamp: 2026-08-27T18:55:40.568Z
- tests: create,auth,search,custom,delete
- benchmark source: 05625dc2b2d3f9711c51566010944b10ca9531fa
- server workers: 8
- load generator: http://load-generator:19231
- benchmark target host: application-host
- warmup request target/cap: 1000
## Creating organizations (100)
#### Creating 50 organizations [reqs:50, conc:10, rule:`""`]
```
┌─ Best:      764.846µs
├─ Worst:     10.702162ms
├─ Completed: 11.96921ms
├─ Workers:   0=8 1=6 2=5 3=6 4=5 5=7 6=6 7=7
└─ Errors:    0
```
#### Creating 50 organizations [reqs:50, conc:10, rule:`"@request.body.name != ''"`]
```
┌─ Best:      755.683µs
├─ Worst:     10.314186ms
├─ Completed: 14.840302ms
├─ Workers:   0=11 2=10 3=8 4=6 5=6 6=4 7=5
└─ Errors:    0
```

## Creating permissions (50)
#### Creating 25 permissions [reqs:25, conc:5, rule:`""`]
```
┌─ Best:      625.643µs
├─ Worst:     4.080562ms
├─ Completed: 8.290132ms
├─ Workers:   0=6 2=8 3=7 4=4
└─ Errors:    0
```
#### Creating 25 permissions [reqs:25, conc:5, rule:`"@request.body.name != ''"`]
```
┌─ Best:      824.737µs
├─ Worst:     2.969097ms
├─ Completed: 8.365987ms
├─ Workers:   0=8 2=9 3=7 4=1
└─ Errors:    0
```

## Creating users (500 - expected to be slow due to passwordHash generation)
#### Creating 250 users [reqs:250, conc:50, rule:`""`]
```
┌─ Best:      116.195565ms
├─ Worst:     849.393071ms
├─ Completed: 2.07909079s
├─ Workers:   0=30 1=28 2=56 3=30 4=28 5=28 6=24 7=26
└─ Errors:    0
```
#### Creating 250 users [reqs:250, conc:50, rule:`"@request.body.email != '' && @request.body.permissions:length > 0"`]
```
┌─ Best:      157.188715ms
├─ Worst:     799.934568ms
├─ Completed: 2.08780601s
├─ Workers:   0=21 1=38 2=17 3=29 4=41 5=40 6=35 7=29
└─ Errors:    0
```

## Creating posts (10k, 25k, 50k, 100k)
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`""`]
```
┌─ Best:      507.23µs
├─ Worst:     380.283446ms
├─ Completed: 447.639112ms
├─ Workers:   0=626 1=569 2=522 3=662 4=665 5=638 6=656 7=662
└─ Errors:    0
```
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      738.999µs
├─ Worst:     396.989855ms
├─ Completed: 477.188866ms
├─ Workers:   0=645 1=674 2=726 3=586 4=666 5=654 6=470 7=579
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`""`]
```
┌─ Best:      960.316µs
├─ Worst:     662.159888ms
├─ Completed: 755.06648ms
├─ Workers:   0=1704 1=1669 2=1689 3=1679 4=1416 5=1570 6=1432 7=1341
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      524.935µs
├─ Worst:     574.321542ms
├─ Completed: 972.50906ms
├─ Workers:   0=1539 1=1604 2=1449 3=1567 4=1510 5=1789 6=1510 7=1532
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`""`]
```
┌─ Best:      441.741µs
├─ Worst:     641.474498ms
├─ Completed: 1.550354716s
├─ Workers:   0=2974 1=3710 2=3372 3=3083 4=3005 5=3254 6=2920 7=2682
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      503.074µs
├─ Worst:     899.712714ms
├─ Completed: 1.797378204s
├─ Workers:   0=3194 1=2967 2=3288 3=3058 4=3321 5=3460 6=2787 7=2925
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`""`]
```
┌─ Best:      838.307µs
├─ Worst:     801.861168ms
├─ Completed: 2.799383267s
├─ Workers:   0=6514 1=6622 2=6658 3=6155 4=6157 5=6479 6=5771 7=5644
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      519.237µs
├─ Worst:     821.688383ms
├─ Completed: 3.230564603s
├─ Workers:   0=6088 1=6767 2=6849 3=6530 4=6468 5=6202 6=5872 7=5224
└─ Errors:    0
```

## User auth with password (expected to be slow due to passwordHash verification)
#### users auth with email/pass - high concurrency [reqs:250, conc:250]
```
┌─ Best:      420.508927ms
├─ Worst:     2.046071917s
├─ Completed: 2.046376267s
├─ Workers:   0=45 1=21 2=32 3=11 4=49 5=30 6=37 7=25
└─ Errors:    0
```
#### users auth with email/pass - small concurrency [reqs:250, conc:10]
```
┌─ Best:      62.733537ms
├─ Worst:     141.030144ms
├─ Completed: 2.095019786s
├─ Workers:   0=42 1=34 2=39 3=17 4=35 5=43 6=34 7=6
└─ Errors:    0
```

## User auth refresh
#### users - auth refresh (high concurrency) [reqs:1000, conc:1000]
```
┌─ Best:      26.175449ms
├─ Worst:     71.174487ms
├─ Completed: 72.629996ms
├─ Workers:   0=111 1=142 2=137 3=143 4=99 5=124 6=108 7=136
└─ Errors:    0
```
#### users - auth refresh (medium concurrency) [reqs:1000, conc:100]
```
┌─ Best:      594.961µs
├─ Worst:     18.171922ms
├─ Completed: 62.803764ms
├─ Workers:   0=167 1=150 2=68 3=111 4=150 5=156 6=91 7=107
└─ Errors:    0
```

## List records
#### users - getOne for auth refresh comparison (medium concurrency) [reqs:1000, conc:100, rule:`""`, query:`/fdxdloulcso850j`]
```
┌─ Best:      607.408µs
├─ Worst:     31.68406ms
├─ Completed: 59.879097ms
├─ Workers:   0=118 1=123 2=159 3=123 4=109 5=121 6=144 7=103
└─ Errors:    0
```
#### users - getOne for auth refresh comparison (high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`/fdxdloulcso850j`]
```
┌─ Best:      24.805787ms
├─ Worst:     56.718895ms
├─ Completed: 58.132516ms
├─ Workers:   0=109 1=138 2=167 3=107 4=133 5=128 6=116 7=102
└─ Errors:    0
```
#### posts10k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      989.025µs
├─ Worst:     4.206626ms
├─ Completed: 1.715462292s
├─ Workers:   0=158 1=147 2=96 3=151 4=103 5=144 6=59 7=142
└─ Errors:    0
```
#### posts10k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      22.55442ms
├─ Worst:     161.325115ms
├─ Completed: 162.953792ms
├─ Workers:   0=128 1=135 2=136 3=119 4=130 5=130 6=121 7=101
└─ Errors:    0
```
#### posts10k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      21.755587ms
├─ Worst:     107.872178ms
├─ Completed: 109.347965ms
├─ Workers:   0=101 1=135 2=128 3=133 4=117 5=134 6=120 7=132
└─ Errors:    0
```
#### posts10k - mixed read and write (simpleA list with additional 300 concurrent random posts10k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      30.133552ms
├─ Worst:     166.336142ms
├─ Completed: 168.038941ms
├─ Workers:   0=101 1=135 2=129 3=132 4=117 5=134 6=121 7=131
└─ Errors:    0
```
#### posts10k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.085258ms
├─ Worst:     13.22259ms
├─ Completed: 55.932489ms
├─ Workers:   0=15 1=9 2=13 3=18 4=15 5=4 6=15 7=11
└─ Errors:    0
```
#### posts10k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      2.833731ms
├─ Worst:     23.801522ms
├─ Completed: 79.168261ms
├─ Workers:   0=24 1=19 2=15 3=13 4=17 5=3 6=9
└─ Errors:    0
```
#### posts10k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      1.62996ms
├─ Worst:     21.012542ms
├─ Completed: 93.869071ms
├─ Workers:   0=30 1=12 2=19 3=9 4=9 5=9 6=8 7=4
└─ Errors:    0
```
#### posts10k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      2.393124ms
├─ Worst:     40.755222ms
├─ Completed: 109.676009ms
├─ Workers:   0=11 1=11 2=17 3=7 4=22 5=18 6=11 7=3
└─ Errors:    0
```
#### posts10k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.494783ms
├─ Worst:     14.021203ms
├─ Completed: 40.145361ms
├─ Workers:   0=14 1=15 2=14 3=15 4=16 5=7 6=13 7=6
└─ Errors:    0
```
#### posts10k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      3.537452ms
├─ Worst:     42.091708ms
├─ Completed: 104.633349ms
├─ Workers:   0=13 1=12 2=12 3=12 4=13 5=12 6=17 7=9
└─ Errors:    0
```
#### posts10k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      899.391µs
├─ Worst:     6.673671ms
├─ Completed: 18.290825ms
├─ Workers:   0=13 1=7 2=18 3=13 4=13 5=13 6=13 7=10
└─ Errors:    0
```
#### posts10k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      773.908µs
├─ Worst:     5.453959ms
├─ Completed: 18.785578ms
├─ Workers:   0=15 2=21 3=10 4=15 5=15 6=13 7=11
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.327683ms
├─ Worst:     34.648643ms
├─ Completed: 99.101592ms
├─ Workers:   0=14 1=4 2=18 3=14 4=14 5=14 6=12 7=10
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      844.436µs
├─ Worst:     7.258158ms
├─ Completed: 19.907336ms
├─ Workers:   0=13 1=14 2=13 3=13 4=13 5=13 6=12 7=9
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      845.897µs
├─ Worst:     4.572341ms
├─ Completed: 18.951387ms
├─ Workers:   0=5 1=15 2=14 3=19 4=9 5=16 6=13 7=9
└─ Errors:    0
```
#### posts10k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      4.276333ms
├─ Worst:     39.435921ms
├─ Completed: 130.880364ms
├─ Workers:   1=25 2=4 3=17 5=27 6=12 7=15
└─ Errors:    0
```
#### posts10k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      1.65277ms
├─ Worst:     29.317515ms
├─ Completed: 125.514469ms
├─ Workers:   0=1 1=35 3=1 5=18 7=45
└─ Errors:    0
```
#### posts10k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.011757ms
├─ Worst:     4.94096ms
├─ Completed: 24.203977ms
├─ Workers:   0=15 1=8 2=14 3=17 4=16 5=4 6=15 7=11
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      13.265679ms
├─ Worst:     83.368107ms
├─ Completed: 408.096834ms
├─ Workers:   0=24 1=18 2=15 3=14 4=16 5=4 6=9
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.146032ms
├─ Worst:     9.060916ms
├─ Completed: 36.482434ms
├─ Workers:   0=30 1=13 2=19 3=8 4=9 5=8 6=9 7=4
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      6.575566ms
├─ Worst:     61.324712ms
├─ Completed: 192.24363ms
├─ Workers:   0=11 1=11 2=17 3=7 4=22 5=19 6=10 7=3
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.157236ms
├─ Worst:     7.863924ms
├─ Completed: 26.026513ms
├─ Workers:   0=14 1=15 2=14 3=15 4=16 5=6 6=13 7=7
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      8.158801ms
├─ Worst:     60.557293ms
├─ Completed: 243.821017ms
├─ Workers:   0=13 1=11 2=11 3=13 4=13 5=13 6=18 7=8
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.016743ms
├─ Worst:     5.758448ms
├─ Completed: 23.11973ms
├─ Workers:   0=12 1=7 2=18 3=13 4=14 5=13 6=13 7=10
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      39.018153ms
├─ Worst:     191.213317ms
├─ Completed: 970.111983ms
├─ Workers:   0=15 2=21 3=10 4=15 5=15 6=13 7=11
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.088152ms
├─ Worst:     17.030936ms
├─ Completed: 52.413502ms
├─ Workers:   0=14 1=5 2=18 3=14 4=13 5=14 6=12 7=10
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      102.810091ms
├─ Worst:     570.04543ms
├─ Completed: 2.495505094s
├─ Workers:   0=13 1=13 2=13 3=13 4=13 5=13 6=12 7=10
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.570117ms
├─ Worst:     9.389119ms
├─ Completed: 42.099045ms
├─ Workers:   0=5 1=16 2=14 3=18 4=9 5=16 6=13 7=9
└─ Errors:    0
```
#### posts25k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.402215ms
├─ Worst:     8.686751ms
├─ Completed: 2.695268073s
├─ Workers:   0=135 1=142 2=134 3=116 4=121 5=127 6=112 7=113
└─ Errors:    0
```
#### posts25k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      23.667426ms
├─ Worst:     236.167124ms
├─ Completed: 238.938659ms
├─ Workers:   0=129 1=158 2=128 3=124 4=115 5=128 6=104 7=114
└─ Errors:    0
```
#### posts25k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      23.305488ms
├─ Worst:     98.21554ms
├─ Completed: 99.923507ms
├─ Workers:   0=109 1=111 2=134 3=129 4=130 5=133 6=140 7=114
└─ Errors:    0
```
#### posts25k - mixed read and write (simpleA list with additional 300 concurrent random posts25k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      29.105872ms
├─ Worst:     250.019574ms
├─ Completed: 251.528506ms
├─ Workers:   0=109 1=111 2=134 3=129 4=131 5=133 6=139 7=114
└─ Errors:    0
```
#### posts25k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.719944ms
├─ Worst:     17.642782ms
├─ Completed: 74.327358ms
├─ Workers:   0=18 1=8 2=13 3=16 4=13 5=13 6=8 7=11
└─ Errors:    0
```
#### posts25k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      1.934199ms
├─ Worst:     28.251784ms
├─ Completed: 97.516174ms
├─ Workers:   0=24 1=4 2=17 3=11 4=10 5=20 7=14
└─ Errors:    0
```
#### posts25k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      1.705724ms
├─ Worst:     31.919055ms
├─ Completed: 104.731163ms
├─ Workers:   0=22 1=13 2=20 3=13 4=11 5=11 6=3 7=7
└─ Errors:    0
```
#### posts25k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      2.8838ms
├─ Worst:     31.775338ms
├─ Completed: 115.94539ms
├─ Workers:   0=10 1=31 2=10 3=14 4=11 5=9 6=6 7=9
└─ Errors:    0
```
#### posts25k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.281248ms
├─ Worst:     21.951898ms
├─ Completed: 63.38703ms
├─ Workers:   0=11 1=19 2=13 3=11 4=11 5=12 6=9 7=14
└─ Errors:    0
```
#### posts25k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      6.599279ms
├─ Worst:     64.572344ms
├─ Completed: 154.287872ms
├─ Workers:   0=14 1=13 2=13 3=13 4=9 5=14 6=11 7=13
└─ Errors:    0
```
#### posts25k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      954.707µs
├─ Worst:     9.091409ms
├─ Completed: 24.986998ms
├─ Workers:   0=13 1=14 2=13 3=14 4=9 5=13 6=11 7=13
└─ Errors:    0
```
#### posts25k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      942.572µs
├─ Worst:     8.415475ms
├─ Completed: 23.501076ms
├─ Workers:   0=13 1=12 2=13 3=13 4=13 5=13 6=11 7=12
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      6.787869ms
├─ Worst:     72.365221ms
├─ Completed: 169.671866ms
├─ Workers:   0=13 1=13 2=13 3=13 4=13 5=13 6=10 7=12
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.071989ms
├─ Worst:     7.457723ms
├─ Completed: 24.310254ms
├─ Workers:   0=12 1=13 2=13 3=13 4=13 5=13 6=11 7=12
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      923.554µs
├─ Worst:     10.272127ms
├─ Completed: 25.820959ms
├─ Workers:   0=13 1=13 2=13 3=13 4=13 5=11 6=11 7=13
└─ Errors:    0
```
#### posts25k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      8.782912ms
├─ Worst:     65.09114ms
├─ Completed: 222.652601ms
├─ Workers:   0=4 1=12 2=13 3=16 4=13 5=19 6=11 7=12
└─ Errors:    0
```
#### posts25k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      5.809628ms
├─ Worst:     57.974027ms
├─ Completed: 302.32054ms
├─ Workers:   0=1 1=11 2=15 4=17 5=9 6=46 7=1
└─ Errors:    0
```
#### posts25k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      956.13µs
├─ Worst:     6.874038ms
├─ Completed: 24.303304ms
├─ Workers:   0=18 1=8 2=13 3=17 4=14 5=12 6=8 7=10
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      36.164315ms
├─ Worst:     235.071602ms
├─ Completed: 1.174320595s
├─ Workers:   0=24 1=4 2=16 3=11 4=9 5=21 6=1 7=14
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.227563ms
├─ Worst:     7.598237ms
├─ Completed: 35.941177ms
├─ Workers:   0=22 1=14 2=20 3=13 4=11 5=11 6=2 7=7
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      15.536364ms
├─ Worst:     124.251675ms
├─ Completed: 508.067187ms
├─ Workers:   0=10 1=30 2=11 3=14 4=11 5=9 6=6 7=9
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.069897ms
├─ Worst:     6.814715ms
├─ Completed: 23.207241ms
├─ Workers:   0=11 1=19 2=12 3=10 4=12 5=12 6=9 7=15
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      19.647378ms
├─ Worst:     104.609324ms
├─ Completed: 459.989949ms
├─ Workers:   0=14 1=13 2=13 3=14 4=9 5=14 6=11 7=12
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.150168ms
├─ Worst:     7.066093ms
├─ Completed: 24.773893ms
├─ Workers:   0=13 1=14 2=14 3=14 4=8 5=13 6=11 7=13
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      92.522081ms
├─ Worst:     500.395037ms
├─ Completed: 2.356105974s
├─ Workers:   0=13 1=13 2=12 3=12 4=14 5=12 6=11 7=13
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.455199ms
├─ Worst:     15.107271ms
├─ Completed: 52.858487ms
├─ Workers:   0=13 1=12 2=13 3=14 4=12 5=14 6=11 7=11
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      285.037256ms
├─ Worst:     1.123969379s
├─ Completed: 6.416776496s
├─ Workers:   0=12 1=14 2=14 3=12 4=13 5=12 6=11 7=12
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.653984ms
├─ Worst:     10.315397ms
├─ Completed: 43.429113ms
├─ Workers:   0=12 1=13 2=13 3=13 4=13 5=11 6=11 7=14
└─ Errors:    0
```
#### posts50k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.885722ms
├─ Worst:     8.877343ms
├─ Completed: 4.882792617s
├─ Workers:   0=130 1=138 2=138 3=121 4=118 5=133 6=116 7=106
└─ Errors:    0
```
#### posts50k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      21.845912ms
├─ Worst:     424.15577ms
├─ Completed: 425.962814ms
├─ Workers:   0=128 1=136 2=140 3=122 4=125 5=130 6=115 7=104
└─ Errors:    0
```
#### posts50k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      27.138838ms
├─ Worst:     102.96149ms
├─ Completed: 105.137664ms
├─ Workers:   0=128 1=127 2=114 3=126 4=121 5=129 6=125 7=130
└─ Errors:    0
```
#### posts50k - mixed read and write (simpleA list with additional 300 concurrent random posts50k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      31.119352ms
├─ Worst:     404.913552ms
├─ Completed: 406.577408ms
├─ Workers:   0=128 1=127 2=115 3=125 4=122 5=128 6=125 7=130
└─ Errors:    0
```
#### posts50k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      2.184465ms
├─ Worst:     22.245234ms
├─ Completed: 92.82601ms
├─ Workers:   0=17 1=12 2=15 3=6 4=14 5=9 6=15 7=12
└─ Errors:    0
```
#### posts50k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      2.518986ms
├─ Worst:     32.131519ms
├─ Completed: 135.601871ms
├─ Workers:   0=21 1=13 2=25 3=3 4=16 5=15 6=7
└─ Errors:    0
```
#### posts50k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      2.699866ms
├─ Worst:     32.829533ms
├─ Completed: 159.696628ms
├─ Workers:   0=6 1=17 2=26 3=26 4=5 5=13 6=5 7=2
└─ Errors:    0
```
#### posts50k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      4.436513ms
├─ Worst:     30.353725ms
├─ Completed: 107.012221ms
├─ Workers:   0=13 1=12 2=13 3=10 4=13 5=13 6=13 7=13
└─ Errors:    0
```
#### posts50k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      2.099848ms
├─ Worst:     18.071493ms
├─ Completed: 73.036517ms
├─ Workers:   0=13 1=13 2=12 3=11 4=13 5=13 6=12 7=13
└─ Errors:    0
```
#### posts50k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      18.963044ms
├─ Worst:     101.194081ms
├─ Completed: 378.484514ms
├─ Workers:   0=13 1=12 2=13 3=11 4=13 5=13 6=12 7=13
└─ Errors:    0
```
#### posts50k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      978.181µs
├─ Worst:     13.537685ms
├─ Completed: 29.253336ms
├─ Workers:   0=11 1=20 2=12 3=10 4=11 5=12 6=12 7=12
└─ Errors:    0
```
#### posts50k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      911.788µs
├─ Worst:     9.072502ms
├─ Completed: 25.700212ms
├─ Workers:   0=13 1=12 2=12 3=11 4=16 5=11 6=13 7=12
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      17.599882ms
├─ Worst:     142.094713ms
├─ Completed: 444.924687ms
├─ Workers:   0=12 1=12 2=12 3=11 4=11 5=18 6=12 7=12
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      972.503µs
├─ Worst:     7.704213ms
├─ Completed: 25.164083ms
├─ Workers:   0=13 1=12 2=13 3=11 4=13 5=13 6=13 7=12
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.025666ms
├─ Worst:     7.305083ms
├─ Completed: 23.37218ms
├─ Workers:   0=12 1=13 2=12 3=11 4=13 5=13 6=13 7=13
└─ Errors:    0
```
#### posts50k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      17.815108ms
├─ Worst:     104.26526ms
├─ Completed: 433.602638ms
├─ Workers:   0=15 1=12 2=12 3=11 4=12 5=13 6=12 7=13
└─ Errors:    0
```
#### posts50k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      12.210634ms
├─ Worst:     118.827688ms
├─ Completed: 424.984595ms
├─ Workers:   0=9 1=17 2=1 3=28 4=6 5=14 6=10 7=15
└─ Errors:    0
```
#### posts50k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      980.643µs
├─ Worst:     9.519079ms
├─ Completed: 26.917052ms
├─ Workers:   0=16 1=12 2=16 3=6 4=15 5=9 6=14 7=12
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      83.482265ms
├─ Worst:     762.093196ms
├─ Completed: 2.72502485s
├─ Workers:   0=21 1=13 2=25 3=4 4=15 5=15 6=7
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.038153ms
├─ Worst:     9.814964ms
├─ Completed: 36.770765ms
├─ Workers:   0=7 1=16 2=26 3=25 4=5 5=13 6=6 7=2
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      33.705494ms
├─ Worst:     179.224489ms
├─ Completed: 852.323122ms
├─ Workers:   0=13 1=13 2=12 3=11 4=13 5=13 6=12 7=13
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.080562ms
├─ Worst:     6.148566ms
├─ Completed: 24.067184ms
├─ Workers:   0=13 1=12 2=13 3=11 4=13 5=13 6=12 7=13
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      45.195691ms
├─ Worst:     185.348161ms
├─ Completed: 996.986519ms
├─ Workers:   0=12 1=13 2=13 3=10 4=13 5=12 6=13 7=14
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.076846ms
├─ Worst:     5.481935ms
├─ Completed: 26.656626ms
├─ Workers:   0=11 1=20 2=12 3=10 4=11 5=12 6=12 7=12
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      218.345467ms
├─ Worst:     1.47490115s
├─ Completed: 5.169338961s
├─ Workers:   0=13 1=11 2=12 3=12 4=16 5=12 6=12 7=12
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.418638ms
├─ Worst:     11.127106ms
├─ Completed: 55.02169ms
├─ Workers:   0=13 1=12 2=11 3=10 4=12 5=18 6=12 7=12
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      525.831768ms
├─ Worst:     2.752435031s
├─ Completed: 13.283020693s
├─ Workers:   0=12 1=12 2=14 3=12 4=12 5=13 6=14 7=11
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.718962ms
├─ Worst:     9.393413ms
├─ Completed: 41.152221ms
├─ Workers:   0=13 1=14 2=11 3=11 4=13 5=12 6=13 7=13
└─ Errors:    0
```
#### posts100k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      3.452214ms
├─ Worst:     16.799463ms
├─ Completed: 8.655571357s
├─ Workers:   0=130 1=138 2=142 3=127 4=120 5=126 6=110 7=107
└─ Errors:    0
```
#### posts100k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      28.442661ms
├─ Worst:     734.281737ms
├─ Completed: 736.024983ms
├─ Workers:   0=131 1=133 2=142 3=128 4=117 5=134 6=111 7=104
└─ Errors:    0
```
#### posts100k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      26.871824ms
├─ Worst:     103.538913ms
├─ Completed: 105.214706ms
├─ Workers:   0=117 1=133 2=125 3=121 4=128 5=122 6=127 7=127
└─ Errors:    0
```
#### posts100k - mixed read and write (simpleA list with additional 300 concurrent random posts100k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      31.257967ms
├─ Worst:     734.849259ms
├─ Completed: 736.878029ms
├─ Workers:   0=117 1=132 2=126 3=122 4=128 5=121 6=126 7=128
└─ Errors:    0
```
#### posts100k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      4.010394ms
├─ Worst:     36.329884ms
├─ Completed: 140.034807ms
├─ Workers:   0=15 1=15 2=15 3=16 4=17 6=10 7=12
└─ Errors:    0
```
#### posts100k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      4.215547ms
├─ Worst:     61.120236ms
├─ Completed: 195.634826ms
├─ Workers:   0=29 1=18 2=17 3=13 4=10 5=2 6=10 7=1
└─ Errors:    0
```
#### posts100k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      3.820433ms
├─ Worst:     67.082703ms
├─ Completed: 202.771343ms
├─ Workers:   0=6 1=9 2=23 3=6 4=5 5=43 6=4 7=4
└─ Errors:    0
```
#### posts100k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      5.698254ms
├─ Worst:     53.626344ms
├─ Completed: 156.617733ms
├─ Workers:   0=11 1=11 2=12 3=20 4=11 5=11 6=11 7=13
└─ Errors:    0
```
#### posts100k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      3.730929ms
├─ Worst:     33.751507ms
├─ Completed: 122.409335ms
├─ Workers:   0=12 1=18 2=8 3=13 4=13 5=11 6=13 7=12
└─ Errors:    0
```
#### posts100k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      33.626915ms
├─ Worst:     146.459212ms
├─ Completed: 665.674078ms
├─ Workers:   0=13 1=12 2=13 3=12 4=13 5=12 6=12 7=13
└─ Errors:    0
```
#### posts100k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      943.682µs
├─ Worst:     9.307274ms
├─ Completed: 26.251327ms
├─ Workers:   0=12 1=13 2=13 3=13 4=12 5=11 6=13 7=13
└─ Errors:    0
```
#### posts100k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      900.353µs
├─ Worst:     8.262222ms
├─ Completed: 23.012918ms
├─ Workers:   0=14 1=12 2=13 3=9 4=13 5=13 6=13 7=13
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      46.203512ms
├─ Worst:     149.470299ms
├─ Completed: 681.278102ms
├─ Workers:   0=12 1=13 2=12 3=13 4=13 5=12 6=13 7=12
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.025717ms
├─ Worst:     9.0509ms
├─ Completed: 25.036621ms
├─ Workers:   0=13 1=12 2=12 3=13 4=13 5=11 6=13 7=13
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      962.798µs
├─ Worst:     9.153813ms
├─ Completed: 25.021329ms
├─ Workers:   0=14 1=14 2=9 3=13 4=14 5=12 6=11 7=13
└─ Errors:    0
```
#### posts100k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      37.771945ms
├─ Worst:     231.015821ms
├─ Completed: 815.96582ms
├─ Workers:   0=16 1=12 2=12 3=13 4=12 5=11 6=11 7=13
└─ Errors:    0
```
#### posts100k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      28.893342ms
├─ Worst:     173.846808ms
├─ Completed: 770.403004ms
├─ Workers:   0=1 1=18 2=20 3=6 4=10 5=20 6=15 7=10
└─ Errors:    0
```
#### posts100k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      925.317µs
├─ Worst:     6.201148ms
├─ Completed: 25.452615ms
├─ Workers:   0=15 1=15 2=15 3=16 4=18 6=9 7=12
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      179.436772ms
├─ Worst:     1.245637457s
├─ Completed: 5.282124567s
├─ Workers:   0=28 1=18 2=17 3=14 4=9 5=3 6=10 7=1
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.113246ms
├─ Worst:     11.206204ms
├─ Completed: 42.993401ms
├─ Workers:   0=7 1=9 2=22 3=5 4=6 5=42 6=4 7=5
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      71.131541ms
├─ Worst:     633.003572ms
├─ Completed: 2.080202543s
├─ Workers:   0=10 1=11 2=12 3=21 4=10 5=12 6=12 7=12
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.030373ms
├─ Worst:     8.961176ms
├─ Completed: 24.444563ms
├─ Workers:   0=13 1=18 2=8 3=13 4=13 5=10 6=13 7=12
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      90.864242ms
├─ Worst:     316.625394ms
├─ Completed: 1.826429257s
├─ Workers:   0=12 1=12 2=14 3=12 4=13 5=12 6=11 7=14
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.028499ms
├─ Worst:     7.52946ms
├─ Completed: 25.676574ms
├─ Workers:   0=13 1=12 2=12 3=13 4=12 5=12 6=14 7=12
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      429.625962ms
├─ Worst:     1.985321505s
├─ Completed: 10.485013771s
├─ Workers:   0=13 1=12 2=13 3=9 4=14 5=12 6=13 7=14
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.23249ms
├─ Worst:     10.850925ms
├─ Completed: 50.172358ms
├─ Workers:   0=12 1=13 2=13 3=13 4=12 5=12 6=13 7=12
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      1.061471608s
├─ Worst:     5.167309381s
├─ Completed: 26.90729914s
├─ Workers:   0=13 1=13 2=12 3=12 4=13 5=11 6=13 7=13
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.753951ms
├─ Worst:     9.7685ms
├─ Completed: 44.678867ms
├─ Workers:   0=15 1=13 2=9 3=14 4=15 5=12 6=10 7=12
└─ Errors:    0
```

## Go vs JS route execution
#### JS route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      45.830597ms
├─ Worst:     898.741501ms
├─ Completed: 900.255069ms
├─ Workers:   0=66 1=73 2=85 3=54 4=54 5=77 6=50 7=41
└─ Errors:    0
```
#### Go route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      30.809307ms
├─ Worst:     800.581939ms
├─ Completed: 801.444841ms
├─ Workers:   0=63 1=65 2=59 3=67 4=62 5=58 6=62 7=64
└─ Errors:    0
```
#### JS route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      12.478089ms
├─ Worst:     124.034908ms
├─ Completed: 815.875025ms
├─ Workers:   0=64 1=63 2=60 3=63 4=66 5=59 6=62 7=63
└─ Errors:    0
```
#### Go route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      11.603191ms
├─ Worst:     225.339619ms
├─ Completed: 889.395571ms
├─ Workers:   0=66 1=74 2=85 3=55 4=54 5=77 6=49 7=40
└─ Errors:    0
```
#### JS route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      8.74621ms
├─ Worst:     22.34755ms
├─ Completed: 8.895680833s
├─ Workers:   0=61 1=65 2=57 3=68 4=62 5=58 6=64 7=65
└─ Errors:    0
```
#### Go route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      8.261681ms
├─ Worst:     25.746541ms
├─ Completed: 8.691712336s
├─ Workers:   0=66 1=65 2=64 3=65 4=68 5=61 6=59 7=52
└─ Errors:    0
```

## Go vs JS hooks execution
#### JS OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      940.087µs
├─ Worst:     7.596483ms
├─ Completed: 28.419258ms
├─ Workers:   0=18 1=20 2=20 3=7 4=7 5=16 6=6 7=6
└─ Errors:    0
```
#### Go OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      876.179µs
├─ Worst:     11.321765ms
├─ Completed: 24.137219ms
├─ Workers:   0=12 1=13 2=13 3=13 4=12 5=13 6=12 7=12
└─ Errors:    0
```

## Deleting records
#### deleting 100 posts10k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      652.842µs
├─ Worst:     58.004137ms
├─ Completed: 64.907884ms
├─ Workers:   0=10 1=13 2=25 3=7 4=8 5=22 6=8 7=7
└─ Errors:    0
```
#### deleting 100 posts10k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      766.278µs
├─ Worst:     34.979752ms
├─ Completed: 47.632424ms
├─ Workers:   0=13 1=13 2=12 3=12 4=12 5=12 6=13 7=13
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      763.764µs
├─ Worst:     81.60851ms
├─ Completed: 95.863221ms
├─ Workers:   0=12 1=13 2=12 3=13 4=13 5=12 6=12 7=13
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      719.393µs
├─ Worst:     35.504026ms
├─ Completed: 47.27523ms
├─ Workers:   0=13 1=14 2=9 3=18 4=11 5=9 6=12 7=14
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      766.557µs
├─ Worst:     81.440388ms
├─ Completed: 95.584146ms
├─ Workers:   0=11 1=13 2=12 3=13 4=13 5=12 6=13 7=13
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      827.962µs
├─ Worst:     57.187088ms
├─ Completed: 68.386814ms
├─ Workers:   0=12 1=12 2=12 3=13 4=13 5=12 6=13 7=13
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      739.782µs
├─ Worst:     80.697643ms
├─ Completed: 92.257735ms
├─ Workers:   0=12 1=13 2=12 3=13 4=12 5=13 6=13 7=12
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      816.057µs
├─ Worst:     36.494072ms
├─ Completed: 46.31846ms
├─ Workers:   0=12 1=13 2=12 3=12 4=13 5=12 6=13 7=13
└─ Errors:    0
```
#### deleting 100 users - with cascade deleting all associated posts [conc:10, rule:`""`]
```
┌─ Best:      68.077777ms
├─ Worst:     5.586024946s
├─ Completed: 9.709439097s
├─ Workers:   0=17 1=12 2=12 3=12 4=15 5=10 6=10 7=12
└─ Errors:    0
```
#### deleting 100 organizations - with cascade deleting all users and associated posts [conc:10, rule:`""`]
```
┌─ Best:      2.175011ms
├─ Worst:     8.123517984s
├─ Completed: 20.024052791s
├─ Workers:   0=12 1=13 2=13 3=13 4=13 5=12 6=12 7=12
└─ Errors:    0
```

---------------------------------------------------
Completed!
