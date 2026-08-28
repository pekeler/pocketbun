# PocketBun Upstream-Port Benchmark Result

- machine: hetzner-8vcpu-pocketbun-6
- timestamp: 2026-08-27T18:01:18.239Z
- tests: create,auth,search,custom,delete
- benchmark source: 05625dc2b2d3f9711c51566010944b10ca9531fa
- server workers: 6
- load generator: http://load-generator:19231
- benchmark target host: application-host
- warmup request target/cap: 1000
## Creating organizations (100)
#### Creating 50 organizations [reqs:50, conc:10, rule:`""`]
```
┌─ Best:      687.769µs
├─ Worst:     10.143377ms
├─ Completed: 12.608439ms
├─ Workers:   0=8 1=9 2=10 3=7 4=7 5=9
└─ Errors:    0
```
#### Creating 50 organizations [reqs:50, conc:10, rule:`"@request.body.name != ''"`]
```
┌─ Best:      804.711µs
├─ Worst:     4.923613ms
├─ Completed: 10.547304ms
├─ Workers:   0=6 1=9 2=15 3=11 5=9
└─ Errors:    0
```

## Creating permissions (50)
#### Creating 25 permissions [reqs:25, conc:5, rule:`""`]
```
┌─ Best:      733.312µs
├─ Worst:     6.279024ms
├─ Completed: 8.651929ms
├─ Workers:   1=2 2=9 3=7 5=7
└─ Errors:    0
```
#### Creating 25 permissions [reqs:25, conc:5, rule:`"@request.body.name != ''"`]
```
┌─ Best:      747.511µs
├─ Worst:     3.318539ms
├─ Completed: 10.60979ms
├─ Workers:   0=1 1=10 2=1 3=11 4=1 5=1
└─ Errors:    0
```

## Creating users (500 - expected to be slow due to passwordHash generation)
#### Creating 250 users [reqs:250, conc:50, rule:`""`]
```
┌─ Best:      80.877395ms
├─ Worst:     907.537783ms
├─ Completed: 2.062589453s
├─ Workers:   0=37 1=26 2=29 3=80 4=32 5=46
└─ Errors:    0
```
#### Creating 250 users [reqs:250, conc:50, rule:`"@request.body.email != '' && @request.body.permissions:length > 0"`]
```
┌─ Best:      185.341145ms
├─ Worst:     1.006289451s
├─ Completed: 2.059649928s
├─ Workers:   0=57 1=39 2=41 3=35 4=43 5=35
└─ Errors:    0
```

## Creating posts (10k, 25k, 50k, 100k)
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`""`]
```
┌─ Best:      1.149205ms
├─ Worst:     251.688578ms
├─ Completed: 420.408527ms
├─ Workers:   0=871 1=825 2=882 3=802 4=765 5=855
└─ Errors:    0
```
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      866.286µs
├─ Worst:     405.465035ms
├─ Completed: 480.204731ms
├─ Workers:   0=958 1=1000 2=895 3=809 4=708 5=630
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`""`]
```
┌─ Best:      623.05µs
├─ Worst:     529.957875ms
├─ Completed: 743.886919ms
├─ Workers:   0=2259 1=2372 2=1853 3=2526 4=1978 5=1512
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      512.117µs
├─ Worst:     392.063844ms
├─ Completed: 985.130043ms
├─ Workers:   0=2259 1=2164 2=1692 3=2104 4=2077 5=2204
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`""`]
```
┌─ Best:      467.485µs
├─ Worst:     477.990054ms
├─ Completed: 1.444688735s
├─ Workers:   0=3944 1=4756 2=4316 3=4413 4=3445 5=4126
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      543.24µs
├─ Worst:     578.189532ms
├─ Completed: 1.766888712s
├─ Workers:   0=4062 1=3764 2=4550 3=4530 4=4289 5=3805
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`""`]
```
┌─ Best:      1.256303ms
├─ Worst:     776.495526ms
├─ Completed: 2.792453402s
├─ Workers:   0=7833 1=9285 2=8545 3=9281 4=6892 5=8164
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      426.178µs
├─ Worst:     731.211879ms
├─ Completed: 3.254731927s
├─ Workers:   0=6954 1=9460 2=9158 3=8804 4=9043 5=6581
└─ Errors:    0
```

## User auth with password (expected to be slow due to passwordHash verification)
#### users auth with email/pass - high concurrency [reqs:250, conc:250]
```
┌─ Best:      366.507167ms
├─ Worst:     2.063006268s
├─ Completed: 2.06322547s
├─ Workers:   0=42 1=55 2=38 3=46 4=42 5=27
└─ Errors:    0
```
#### users auth with email/pass - small concurrency [reqs:250, conc:10]
```
┌─ Best:      61.698768ms
├─ Worst:     141.681998ms
├─ Completed: 2.104142183s
├─ Workers:   0=38 1=45 2=33 3=64 4=31 5=39
└─ Errors:    0
```

## User auth refresh
#### users - auth refresh (high concurrency) [reqs:1000, conc:1000]
```
┌─ Best:      24.740189ms
├─ Worst:     74.360771ms
├─ Completed: 75.957886ms
├─ Workers:   0=159 1=173 2=180 3=155 4=155 5=178
└─ Errors:    0
```
#### users - auth refresh (medium concurrency) [reqs:1000, conc:100]
```
┌─ Best:      412.509µs
├─ Worst:     26.448146ms
├─ Completed: 68.877484ms
├─ Workers:   0=180 1=173 2=91 3=228 4=172 5=156
└─ Errors:    0
```

## List records
#### users - getOne for auth refresh comparison (medium concurrency) [reqs:1000, conc:100, rule:`""`, query:`/ugq5yh68gn1cijq`]
```
┌─ Best:      592.228µs
├─ Worst:     24.120453ms
├─ Completed: 58.815571ms
├─ Workers:   0=165 1=181 2=175 3=153 4=152 5=174
└─ Errors:    0
```
#### users - getOne for auth refresh comparison (high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`/ugq5yh68gn1cijq`]
```
┌─ Best:      25.267376ms
├─ Worst:     71.111577ms
├─ Completed: 72.773821ms
├─ Workers:   0=149 1=197 2=177 3=162 4=136 5=179
└─ Errors:    0
```
#### posts10k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      772.626µs
├─ Worst:     7.678686ms
├─ Completed: 1.66722871s
├─ Workers:   0=205 1=93 2=141 3=201 4=189 5=171
└─ Errors:    0
```
#### posts10k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      21.494001ms
├─ Worst:     175.222291ms
├─ Completed: 176.781112ms
├─ Workers:   0=158 1=202 2=171 3=166 4=150 5=153
└─ Errors:    0
```
#### posts10k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      24.508539ms
├─ Worst:     108.505978ms
├─ Completed: 110.707456ms
├─ Workers:   0=158 1=140 2=158 3=221 4=139 5=184
└─ Errors:    0
```
#### posts10k - mixed read and write (simpleA list with additional 300 concurrent random posts10k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      27.100666ms
├─ Worst:     208.783103ms
├─ Completed: 210.941841ms
├─ Workers:   0=157 1=141 2=157 3=222 4=139 5=184
└─ Errors:    0
```
#### posts10k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.512037ms
├─ Worst:     13.151018ms
├─ Completed: 62.895419ms
├─ Workers:   0=14 1=23 2=23 3=8 4=21 5=11
└─ Errors:    0
```
#### posts10k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      1.830576ms
├─ Worst:     15.424044ms
├─ Completed: 80.902789ms
├─ Workers:   0=29 1=19 2=24 3=2 4=11 5=15
└─ Errors:    0
```
#### posts10k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      1.847048ms
├─ Worst:     18.504786ms
├─ Completed: 69.774362ms
├─ Workers:   0=15 1=28 2=21 3=9 4=16 5=11
└─ Errors:    0
```
#### posts10k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      3.309447ms
├─ Worst:     31.630858ms
├─ Completed: 102.270785ms
├─ Workers:   0=14 1=26 2=20 3=11 4=15 5=14
└─ Errors:    0
```
#### posts10k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.410336ms
├─ Worst:     15.558258ms
├─ Completed: 49.754325ms
├─ Workers:   0=15 1=23 2=24 3=11 4=14 5=13
└─ Errors:    0
```
#### posts10k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      3.041077ms
├─ Worst:     40.349569ms
├─ Completed: 124.953825ms
├─ Workers:   0=11 1=30 2=15 3=8 4=26 5=10
└─ Errors:    0
```
#### posts10k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      923.344µs
├─ Worst:     7.410556ms
├─ Completed: 27.231847ms
├─ Workers:   0=15 1=22 2=20 3=10 4=15 5=18
└─ Errors:    0
```
#### posts10k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      838.367µs
├─ Worst:     8.712342ms
├─ Completed: 33.478928ms
├─ Workers:   0=15 1=25 2=24 3=11 4=15 5=10
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.915123ms
├─ Worst:     33.32809ms
├─ Completed: 92.893253ms
├─ Workers:   0=15 1=24 2=22 3=10 4=15 5=14
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      937.193µs
├─ Worst:     3.720694ms
├─ Completed: 21.315394ms
├─ Workers:   0=16 1=20 2=22 3=12 4=16 5=14
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      865.094µs
├─ Worst:     6.406339ms
├─ Completed: 27.990145ms
├─ Workers:   0=28 2=2 3=21 4=25 5=24
└─ Errors:    0
```
#### posts10k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      2.068124ms
├─ Worst:     42.536477ms
├─ Completed: 137.551809ms
├─ Workers:   0=18 3=40 5=42
└─ Errors:    0
```
#### posts10k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      2.825219ms
├─ Worst:     33.554683ms
├─ Completed: 160.021416ms
├─ Workers:   2=1 3=78 5=21
└─ Errors:    0
```
#### posts10k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      876.349µs
├─ Worst:     9.722277ms
├─ Completed: 32.540683ms
├─ Workers:   0=15 1=23 2=22 3=7 4=21 5=12
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      12.300183ms
├─ Worst:     131.552502ms
├─ Completed: 521.531208ms
├─ Workers:   0=28 1=19 2=25 3=3 4=11 5=14
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.120006ms
├─ Worst:     6.393773ms
├─ Completed: 29.580297ms
├─ Workers:   0=15 1=28 2=20 3=9 4=17 5=11
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      5.336934ms
├─ Worst:     58.064584ms
├─ Completed: 238.628176ms
├─ Workers:   0=15 1=26 2=20 3=10 4=15 5=14
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      853.428µs
├─ Worst:     7.877199ms
├─ Completed: 36.344252ms
├─ Workers:   0=14 1=23 2=25 3=11 4=13 5=14
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      6.989384ms
├─ Worst:     68.132527ms
├─ Completed: 321.971784ms
├─ Workers:   0=11 1=30 2=15 3=8 4=27 5=9
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      981.304µs
├─ Worst:     6.749614ms
├─ Completed: 26.849601ms
├─ Workers:   0=15 1=22 2=19 3=11 4=14 5=19
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      36.807051ms
├─ Worst:     341.288578ms
├─ Completed: 1.221885617s
├─ Workers:   0=15 1=25 2=25 3=11 4=15 5=9
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.1519ms
├─ Worst:     13.989775ms
├─ Completed: 61.763408ms
├─ Workers:   0=16 1=24 2=21 3=9 4=16 5=14
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      97.009484ms
├─ Worst:     523.203195ms
├─ Completed: 2.64481921s
├─ Workers:   0=16 1=20 2=22 3=12 4=15 5=15
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.70379ms
├─ Worst:     12.546232ms
├─ Completed: 57.08443ms
├─ Workers:   0=28 2=2 3=22 4=25 5=23
└─ Errors:    0
```
#### posts25k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.029361ms
├─ Worst:     5.655023ms
├─ Completed: 2.519021474s
├─ Workers:   0=145 1=197 2=172 3=188 4=133 5=165
└─ Errors:    0
```
#### posts25k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      23.386671ms
├─ Worst:     254.576483ms
├─ Completed: 257.355708ms
├─ Workers:   0=164 1=162 2=159 3=200 4=134 5=181
└─ Errors:    0
```
#### posts25k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      29.520165ms
├─ Worst:     111.254712ms
├─ Completed: 112.692256ms
├─ Workers:   0=144 1=162 2=217 3=143 4=189 5=145
└─ Errors:    0
```
#### posts25k - mixed read and write (simpleA list with additional 300 concurrent random posts25k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      26.684682ms
├─ Worst:     293.621031ms
├─ Completed: 295.46807ms
├─ Workers:   0=143 1=162 2=217 3=143 4=189 5=146
└─ Errors:    0
```
#### posts25k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.357274ms
├─ Worst:     22.470156ms
├─ Completed: 84.163989ms
├─ Workers:   0=25 1=31 2=1 3=10 4=2 5=31
└─ Errors:    0
```
#### posts25k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      1.707126ms
├─ Worst:     21.077685ms
├─ Completed: 93.863463ms
├─ Workers:   0=28 1=26 2=4 3=16 4=5 5=21
└─ Errors:    0
```
#### posts25k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      1.749584ms
├─ Worst:     26.772404ms
├─ Completed: 111.729126ms
├─ Workers:   0=10 1=23 2=6 3=36 4=6 5=19
└─ Errors:    0
```
#### posts25k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      3.114727ms
├─ Worst:     36.895171ms
├─ Completed: 137.359052ms
├─ Workers:   0=12 1=20 2=12 3=30 4=14 5=12
└─ Errors:    0
```
#### posts25k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.886854ms
├─ Worst:     15.641004ms
├─ Completed: 66.114602ms
├─ Workers:   0=13 1=24 2=14 3=11 4=24 5=14
└─ Errors:    0
```
#### posts25k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      4.911888ms
├─ Worst:     60.558534ms
├─ Completed: 177.028633ms
├─ Workers:   0=14 1=23 2=15 3=12 4=21 5=15
└─ Errors:    0
```
#### posts25k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      858.424µs
├─ Worst:     7.1817ms
├─ Completed: 23.970416ms
├─ Workers:   0=13 1=23 2=15 3=11 4=24 5=14
└─ Errors:    0
```
#### posts25k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      887.334µs
├─ Worst:     16.161853ms
├─ Completed: 42.16267ms
├─ Workers:   0=16 1=23 2=13 3=11 4=23 5=14
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      6.34813ms
├─ Worst:     61.29992ms
├─ Completed: 191.723962ms
├─ Workers:   0=13 1=22 2=15 3=12 4=23 5=15
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      844.255µs
├─ Worst:     10.714154ms
├─ Completed: 33.211049ms
├─ Workers:   0=14 1=25 2=14 3=11 4=23 5=13
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      835.422µs
├─ Worst:     9.674389ms
├─ Completed: 29.773103ms
├─ Workers:   0=19 2=20 3=17 4=24 5=20
└─ Errors:    0
```
#### posts25k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      8.886443ms
├─ Worst:     66.810872ms
├─ Completed: 273.143995ms
├─ Workers:   0=27 2=24 3=22 5=27
└─ Errors:    0
```
#### posts25k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      5.771645ms
├─ Worst:     71.680032ms
├─ Completed: 382.85ms
├─ Workers:   0=2 2=64 3=31 5=3
└─ Errors:    0
```
#### posts25k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      846.889µs
├─ Worst:     9.423884ms
├─ Completed: 32.76996ms
├─ Workers:   0=25 1=32 2=1 3=10 4=2 5=30
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      34.441687ms
├─ Worst:     242.663736ms
├─ Completed: 1.208095167s
├─ Workers:   0=28 1=25 2=4 3=17 4=5 5=21
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.102592ms
├─ Worst:     10.557028ms
├─ Completed: 40.79203ms
├─ Workers:   0=9 1=23 2=6 3=36 4=7 5=19
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      13.689171ms
├─ Worst:     150.449056ms
├─ Completed: 583.63111ms
├─ Workers:   0=12 1=20 2=12 3=29 4=14 5=13
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      927.22µs
├─ Worst:     9.028939ms
├─ Completed: 30.447463ms
├─ Workers:   0=13 1=25 2=15 3=11 4=23 5=13
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      19.286153ms
├─ Worst:     103.294017ms
├─ Completed: 541.782683ms
├─ Workers:   0=14 1=23 2=14 3=12 4=22 5=15
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      899.452µs
├─ Worst:     10.52977ms
├─ Completed: 34.207963ms
├─ Workers:   0=13 1=23 2=15 3=11 4=24 5=14
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      92.263917ms
├─ Worst:     642.11345ms
├─ Completed: 2.829177767s
├─ Workers:   0=17 1=22 2=13 3=12 4=22 5=14
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.692325ms
├─ Worst:     12.905659ms
├─ Completed: 62.312085ms
├─ Workers:   0=13 1=23 2=15 3=11 4=23 5=15
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      238.902474ms
├─ Worst:     1.809406964s
├─ Completed: 7.51293892s
├─ Workers:   0=13 1=24 2=14 3=12 4=23 5=14
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.512707ms
├─ Worst:     12.924074ms
├─ Completed: 57.082469ms
├─ Workers:   0=20 2=21 3=16 4=24 5=19
└─ Errors:    0
```
#### posts50k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.852696ms
├─ Worst:     8.834692ms
├─ Completed: 4.87905964s
├─ Workers:   0=160 1=193 2=167 3=192 4=119 5=169
└─ Errors:    0
```
#### posts50k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      23.658488ms
├─ Worst:     471.022421ms
├─ Completed: 473.887032ms
├─ Workers:   0=161 1=173 2=175 3=194 4=122 5=175
└─ Errors:    0
```
#### posts50k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      31.263751ms
├─ Worst:     112.138271ms
├─ Completed: 113.686116ms
├─ Workers:   0=143 1=222 2=198 3=138 4=155 5=144
└─ Errors:    0
```
#### posts50k - mixed read and write (simpleA list with additional 300 concurrent random posts50k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      27.949327ms
├─ Worst:     545.290503ms
├─ Completed: 546.894317ms
├─ Workers:   0=145 1=221 2=198 3=138 4=154 5=144
└─ Errors:    0
```
#### posts50k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      2.154343ms
├─ Worst:     19.95015ms
├─ Completed: 92.607749ms
├─ Workers:   0=20 1=4 2=17 3=21 4=15 5=23
└─ Errors:    0
```
#### posts50k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      2.691994ms
├─ Worst:     31.876837ms
├─ Completed: 118.090755ms
├─ Workers:   0=27 1=9 2=2 3=24 4=15 5=23
└─ Errors:    0
```
#### posts50k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      2.395855ms
├─ Worst:     30.432955ms
├─ Completed: 135.06606ms
├─ Workers:   0=14 1=7 2=5 3=40 4=4 5=30
└─ Errors:    0
```
#### posts50k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      3.699415ms
├─ Worst:     39.525282ms
├─ Completed: 138.58161ms
├─ Workers:   0=23 1=12 2=14 3=14 4=14 5=23
└─ Errors:    0
```
#### posts50k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      2.11675ms
├─ Worst:     20.746529ms
├─ Completed: 80.661395ms
├─ Workers:   0=22 1=13 2=15 3=14 4=14 5=22
└─ Errors:    0
```
#### posts50k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      16.074181ms
├─ Worst:     122.699034ms
├─ Completed: 477.585205ms
├─ Workers:   0=21 1=12 2=13 3=21 4=13 5=20
└─ Errors:    0
```
#### posts50k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      852.156µs
├─ Worst:     10.035138ms
├─ Completed: 26.642384ms
├─ Workers:   0=21 1=13 2=16 3=14 4=14 5=22
└─ Errors:    0
```
#### posts50k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      913.37µs
├─ Worst:     3.803799ms
├─ Completed: 19.387153ms
├─ Workers:   0=22 1=13 2=14 3=15 4=14 5=22
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      16.636588ms
├─ Worst:     99.768702ms
├─ Completed: 478.295515ms
├─ Workers:   0=22 1=13 2=15 3=14 4=14 5=22
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      840.039µs
├─ Worst:     7.605014ms
├─ Completed: 27.744514ms
├─ Workers:   0=13 1=18 2=20 3=20 4=19 5=10
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.285143ms
├─ Worst:     4.749284ms
├─ Completed: 25.372751ms
├─ Workers:   1=24 2=24 3=25 4=27
└─ Errors:    0
```
#### posts50k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      16.651007ms
├─ Worst:     138.616218ms
├─ Completed: 665.134989ms
├─ Workers:   1=30 2=36 3=8 4=26
└─ Errors:    0
```
#### posts50k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      20.302366ms
├─ Worst:     122.88358ms
├─ Completed: 896.62126ms
├─ Workers:   1=72 2=27 4=1
└─ Errors:    0
```
#### posts50k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      931.726µs
├─ Worst:     4.718922ms
├─ Completed: 23.577775ms
├─ Workers:   0=20 1=4 2=16 3=22 4=15 5=23
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      76.12058ms
├─ Worst:     600.076823ms
├─ Completed: 2.346157432s
├─ Workers:   0=27 1=9 2=2 3=24 4=14 5=24
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.108019ms
├─ Worst:     10.549006ms
├─ Completed: 46.754987ms
├─ Workers:   0=14 1=8 2=5 3=39 4=4 5=30
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      32.951981ms
├─ Worst:     376.447214ms
├─ Completed: 1.133652653s
├─ Workers:   0=24 1=12 2=14 3=14 4=14 5=22
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      677.946µs
├─ Worst:     6.951672ms
├─ Completed: 26.986248ms
├─ Workers:   0=22 1=12 2=15 3=15 4=14 5=22
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      44.056304ms
├─ Worst:     226.978389ms
├─ Completed: 1.20678649s
├─ Workers:   0=20 1=12 2=13 3=21 4=13 5=21
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      961.187µs
├─ Worst:     7.96396ms
├─ Completed: 24.895324ms
├─ Workers:   0=21 1=13 2=16 3=13 4=15 5=22
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      203.07068ms
├─ Worst:     1.332560047s
├─ Completed: 5.909896342s
├─ Workers:   0=23 1=14 2=14 3=15 4=13 5=21
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.063428ms
├─ Worst:     11.316967ms
├─ Completed: 52.907078ms
├─ Workers:   0=21 1=13 2=16 3=14 4=14 5=22
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      556.50593ms
├─ Worst:     3.352782408s
├─ Completed: 15.836820182s
├─ Workers:   0=13 1=17 2=20 3=21 4=19 5=10
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.566491ms
├─ Worst:     14.677873ms
├─ Completed: 55.326866ms
├─ Workers:   1=25 2=24 3=24 4=27
└─ Errors:    0
```
#### posts100k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      3.193397ms
├─ Worst:     29.362828ms
├─ Completed: 8.410931345s
├─ Workers:   0=172 1=185 2=157 3=171 4=129 5=186
└─ Errors:    0
```
#### posts100k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      26.076343ms
├─ Worst:     846.969034ms
├─ Completed: 848.657744ms
├─ Workers:   0=141 1=202 2=175 3=182 4=148 5=152
└─ Errors:    0
```
#### posts100k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      22.221904ms
├─ Worst:     111.235104ms
├─ Completed: 113.043028ms
├─ Workers:   0=162 1=198 2=192 3=146 4=139 5=163
└─ Errors:    0
```
#### posts100k - mixed read and write (simpleA list with additional 300 concurrent random posts100k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      30.869557ms
├─ Worst:     892.912571ms
├─ Completed: 894.820243ms
├─ Workers:   0=162 1=198 2=192 3=146 4=139 5=163
└─ Errors:    0
```
#### posts100k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      3.503053ms
├─ Worst:     58.087836ms
├─ Completed: 170.651535ms
├─ Workers:   0=32 1=7 2=10 3=33 4=10 5=8
└─ Errors:    0
```
#### posts100k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      4.52254ms
├─ Worst:     39.234241ms
├─ Completed: 195.469551ms
├─ Workers:   0=12 1=12 2=12 3=35 4=13 5=16
└─ Errors:    0
```
#### posts100k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      4.02181ms
├─ Worst:     55.33009ms
├─ Completed: 223.467995ms
├─ Workers:   0=7 1=17 2=4 3=18 4=27 5=27
└─ Errors:    0
```
#### posts100k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      5.443171ms
├─ Worst:     43.678401ms
├─ Completed: 166.376474ms
├─ Workers:   0=13 1=20 2=14 3=13 4=21 5=19
└─ Errors:    0
```
#### posts100k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      3.758116ms
├─ Worst:     43.216374ms
├─ Completed: 132.476526ms
├─ Workers:   0=14 1=21 2=14 3=13 4=24 5=14
└─ Errors:    0
```
#### posts100k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      30.883598ms
├─ Worst:     218.711212ms
├─ Completed: 931.317098ms
├─ Workers:   0=14 1=21 2=14 3=14 4=23 5=14
└─ Errors:    0
```
#### posts100k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      892.802µs
├─ Worst:     7.991368ms
├─ Completed: 31.174198ms
├─ Workers:   0=12 1=30 2=12 3=12 4=21 5=13
└─ Errors:    0
```
#### posts100k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      820.402µs
├─ Worst:     7.884821ms
├─ Completed: 27.556365ms
├─ Workers:   0=14 1=21 2=17 3=14 4=21 5=13
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      30.596431ms
├─ Worst:     178.926653ms
├─ Completed: 896.262205ms
├─ Workers:   0=14 1=21 2=14 3=14 4=23 5=14
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      885.912µs
├─ Worst:     9.144479ms
├─ Completed: 32.38562ms
├─ Workers:   0=20 1=23 2=15 3=20 4=6 5=16
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      746.5µs
├─ Worst:     9.643417ms
├─ Completed: 29.336451ms
├─ Workers:   0=23 1=24 2=15 3=24 5=14
└─ Errors:    0
```
#### posts100k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      33.72747ms
├─ Worst:     252.443699ms
├─ Completed: 1.007448711s
├─ Workers:   0=24 1=23 2=16 3=20 5=17
└─ Errors:    0
```
#### posts100k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      56.200282ms
├─ Worst:     301.900586ms
├─ Completed: 1.83210741s
├─ Workers:   0=7 2=60 5=33
└─ Errors:    0
```
#### posts100k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      889.788µs
├─ Worst:     8.799813ms
├─ Completed: 36.323073ms
├─ Workers:   0=32 1=8 2=10 3=33 4=10 5=7
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      175.122163ms
├─ Worst:     1.756918964s
├─ Completed: 6.63574434s
├─ Workers:   0=11 1=11 2=12 3=36 4=13 5=17
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.078889ms
├─ Worst:     10.7765ms
├─ Completed: 37.940274ms
├─ Workers:   0=7 1=18 2=4 3=18 4=27 5=26
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      74.639016ms
├─ Worst:     372.055544ms
├─ Completed: 1.97441545s
├─ Workers:   0=14 1=19 2=15 3=12 4=21 5=19
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.04337ms
├─ Worst:     4.091486ms
├─ Completed: 23.828491ms
├─ Workers:   0=13 1=21 2=13 3=14 4=24 5=15
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      86.35354ms
├─ Worst:     568.650728ms
├─ Completed: 2.427528387s
├─ Workers:   0=15 1=21 2=14 3=13 4=23 5=14
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      938.945µs
├─ Worst:     8.713935ms
├─ Completed: 34.648772ms
├─ Workers:   0=12 1=30 2=12 3=13 4=21 5=12
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      414.675846ms
├─ Worst:     2.80417692s
├─ Completed: 12.193498906s
├─ Workers:   0=14 1=21 2=17 3=13 4=21 5=14
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.387916ms
├─ Worst:     18.426717ms
├─ Completed: 69.282902ms
├─ Workers:   0=13 1=22 2=14 3=14 4=23 5=14
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      975.236831ms
├─ Worst:     5.776767544s
├─ Completed: 30.479879074s
├─ Workers:   0=20 1=23 2=15 3=21 4=6 5=15
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.512478ms
├─ Worst:     10.124624ms
├─ Completed: 42.688317ms
├─ Workers:   0=23 1=24 2=15 3=23 5=15
└─ Errors:    0
```

## Go vs JS route execution
#### JS route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      40.778981ms
├─ Worst:     1.194661229s
├─ Completed: 1.196072748s
├─ Workers:   0=81 1=60 2=102 3=107 4=50 5=100
└─ Errors:    0
```
#### Go route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      22.667886ms
├─ Worst:     1.133138591s
├─ Completed: 1.1339851s
├─ Workers:   0=69 1=111 2=71 3=66 4=110 5=73
└─ Errors:    0
```
#### JS route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      8.837378ms
├─ Worst:     288.348799ms
├─ Completed: 1.110588529s
├─ Workers:   0=99 1=97 2=73 3=86 4=73 5=72
└─ Errors:    0
```
#### Go route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      8.404028ms
├─ Worst:     351.289328ms
├─ Completed: 1.235178673s
├─ Workers:   0=81 1=61 2=100 3=122 4=35 5=101
└─ Errors:    0
```
#### JS route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      8.648056ms
├─ Worst:     27.106381ms
├─ Completed: 9.083322641s
├─ Workers:   0=61 1=117 2=80 3=57 4=110 5=75
└─ Errors:    0
```
#### Go route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      6.936885ms
├─ Worst:     24.380319ms
├─ Completed: 9.456322226s
├─ Workers:   0=98 1=94 2=83 3=85 4=50 5=90
└─ Errors:    0
```

## Go vs JS hooks execution
#### JS OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      779.386µs
├─ Worst:     9.742876ms
├─ Completed: 29.632477ms
├─ Workers:   0=8 1=6 2=27 3=24 4=7 5=28
└─ Errors:    0
```
#### Go OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      469.108µs
├─ Worst:     10.365546ms
├─ Completed: 25.504169ms
├─ Workers:   0=20 1=15 2=20 3=15 4=14 5=16
└─ Errors:    0
```

## Deleting records
#### deleting 100 posts10k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      648.816µs
├─ Worst:     21.708592ms
├─ Completed: 48.386431ms
├─ Workers:   0=19 1=8 2=8 3=49 4=8 5=8
└─ Errors:    0
```
#### deleting 100 posts10k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      702.149µs
├─ Worst:     37.711088ms
├─ Completed: 53.085797ms
├─ Workers:   0=22 1=15 2=14 3=20 4=15 5=14
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      702.079µs
├─ Worst:     11.807417ms
├─ Completed: 33.414597ms
├─ Workers:   0=2 1=24 2=24 3=2 4=24 5=24
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      743.427µs
├─ Worst:     9.608512ms
├─ Completed: 41.824594ms
├─ Workers:   0=1 1=44 2=6 4=43 5=6
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      732.331µs
├─ Worst:     20.831039ms
├─ Completed: 40.221552ms
├─ Workers:   0=14 1=14 2=21 3=15 4=22 5=14
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      737.769µs
├─ Worst:     35.550405ms
├─ Completed: 53.708897ms
├─ Workers:   0=22 1=21 2=14 3=20 4=6 5=17
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      686.337µs
├─ Worst:     15.314036ms
├─ Completed: 32.040531ms
├─ Workers:   0=23 1=18 2=15 3=22 4=7 5=15
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      785.204µs
├─ Worst:     10.967568ms
├─ Completed: 31.493697ms
├─ Workers:   0=21 1=15 2=14 3=21 4=15 5=14
└─ Errors:    0
```
#### deleting 100 users - with cascade deleting all associated posts [conc:10, rule:`""`]
```
┌─ Best:      66.143529ms
├─ Worst:     4.026058011s
├─ Completed: 8.78390199s
├─ Workers:   0=18 1=29 2=9 3=8 4=23 5=13
└─ Errors:    0
```
#### deleting 100 organizations - with cascade deleting all users and associated posts [conc:10, rule:`""`]
```
┌─ Best:      52.526905ms
├─ Worst:     8.085437139s
├─ Completed: 19.017410841s
├─ Workers:   0=15 1=20 2=22 3=15 4=5 5=23
└─ Errors:    0
```

---------------------------------------------------
Completed!
