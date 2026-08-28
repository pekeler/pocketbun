# PocketBun Upstream-Port Benchmark Result

- machine: hetzner-4vcpu-pocketbun-3
- timestamp: 2026-08-27T14:40:21.940Z
- tests: create,auth,search,custom,delete
- benchmark source: 05625dc2b2d3f9711c51566010944b10ca9531fa
- server workers: 3
- load generator: http://load-generator:19231
- benchmark target host: application-host
- warmup request target/cap: 1000
## Creating organizations (100)
#### Creating 50 organizations [reqs:50, conc:10, rule:`""`]
```
┌─ Best:      657.899µs
├─ Worst:     7.689293ms
├─ Completed: 16.46692ms
├─ Workers:   0=15 1=21 2=14
└─ Errors:    0
```
#### Creating 50 organizations [reqs:50, conc:10, rule:`"@request.body.name != ''"`]
```
┌─ Best:      1.706668ms
├─ Worst:     8.310862ms
├─ Completed: 20.570139ms
├─ Workers:   0=24 2=26
└─ Errors:    0
```

## Creating permissions (50)
#### Creating 25 permissions [reqs:25, conc:5, rule:`""`]
```
┌─ Best:      1.108221ms
├─ Worst:     3.353833ms
├─ Completed: 10.462486ms
├─ Workers:   0=8 2=17
└─ Errors:    0
```
#### Creating 25 permissions [reqs:25, conc:5, rule:`"@request.body.name != ''"`]
```
┌─ Best:      1.313885ms
├─ Worst:     3.989181ms
├─ Completed: 14.034169ms
├─ Workers:   0=1 1=1 2=23
└─ Errors:    0
```

## Creating users (500 - expected to be slow due to passwordHash generation)
#### Creating 250 users [reqs:250, conc:50, rule:`""`]
```
┌─ Best:      97.469782ms
├─ Worst:     2.599469802s
├─ Completed: 4.118933393s
├─ Workers:   0=55 1=93 2=102
└─ Errors:    0
```
#### Creating 250 users [reqs:250, conc:50, rule:`"@request.body.email != '' && @request.body.permissions:length > 0"`]
```
┌─ Best:      96.871947ms
├─ Worst:     2.576525034s
├─ Completed: 4.131418976s
├─ Workers:   0=89 1=66 2=95
└─ Errors:    0
```

## Creating posts (10k, 25k, 50k, 100k)
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`""`]
```
┌─ Best:      12.63033ms
├─ Worst:     209.318493ms
├─ Completed: 535.335593ms
├─ Workers:   0=1820 1=1588 2=1592
└─ Errors:    0
```
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      16.364869ms
├─ Worst:     252.446547ms
├─ Completed: 743.73897ms
├─ Workers:   0=1644 1=1677 2=1679
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`""`]
```
┌─ Best:      7.595093ms
├─ Worst:     311.915709ms
├─ Completed: 1.317059893s
├─ Workers:   0=4070 1=4073 2=4357
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      2.267843ms
├─ Worst:     678.613364ms
├─ Completed: 1.732323457s
├─ Workers:   0=4787 1=4154 2=3559
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`""`]
```
┌─ Best:      3.298748ms
├─ Worst:     302.269312ms
├─ Completed: 2.15992206s
├─ Workers:   0=8423 1=8535 2=8042
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      4.398667ms
├─ Worst:     549.960648ms
├─ Completed: 3.265914606s
├─ Workers:   0=9266 1=7533 2=8201
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`""`]
```
┌─ Best:      890.521µs
├─ Worst:     579.643759ms
├─ Completed: 4.282126251s
├─ Workers:   0=15202 1=11981 2=22817
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      2.51175ms
├─ Worst:     760.32113ms
├─ Completed: 6.4047567s
├─ Workers:   0=17006 1=17286 2=15708
└─ Errors:    0
```

## User auth with password (expected to be slow due to passwordHash verification)
#### users auth with email/pass - high concurrency [reqs:250, conc:250]
```
┌─ Best:      177.276925ms
├─ Worst:     4.073707222s
├─ Completed: 4.074039762s
├─ Workers:   0=95 1=61 2=94
└─ Errors:    0
```
#### users auth with email/pass - small concurrency [reqs:250, conc:10]
```
┌─ Best:      67.062151ms
├─ Worst:     333.798362ms
├─ Completed: 4.057049137s
├─ Workers:   0=103 1=81 2=66
└─ Errors:    0
```

## User auth refresh
#### users - auth refresh (high concurrency) [reqs:1000, conc:1000]
```
┌─ Best:      25.881278ms
├─ Worst:     91.362324ms
├─ Completed: 93.508721ms
├─ Workers:   0=313 1=333 2=354
└─ Errors:    0
```
#### users - auth refresh (medium concurrency) [reqs:1000, conc:100]
```
┌─ Best:      470.911µs
├─ Worst:     33.482189ms
├─ Completed: 96.513342ms
├─ Workers:   0=339 1=336 2=325
└─ Errors:    0
```

## List records
#### users - getOne for auth refresh comparison (medium concurrency) [reqs:1000, conc:100, rule:`""`, query:`/ctc1lwo3607ut05`]
```
┌─ Best:      314.665µs
├─ Worst:     29.851553ms
├─ Completed: 96.444326ms
├─ Workers:   0=361 1=274 2=365
└─ Errors:    0
```
#### users - getOne for auth refresh comparison (high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`/ctc1lwo3607ut05`]
```
┌─ Best:      23.888343ms
├─ Worst:     91.951608ms
├─ Completed: 93.86992ms
├─ Workers:   0=279 1=348 2=373
└─ Errors:    0
```
#### posts10k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      673.461µs
├─ Worst:     22.339173ms
├─ Completed: 1.253168361s
├─ Workers:   0=310 1=412 2=278
└─ Errors:    0
```
#### posts10k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      27.404321ms
├─ Worst:     285.544015ms
├─ Completed: 287.557496ms
├─ Workers:   0=374 1=265 2=361
└─ Errors:    0
```
#### posts10k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      21.191188ms
├─ Worst:     170.22503ms
├─ Completed: 171.642408ms
├─ Workers:   0=332 1=370 2=298
└─ Errors:    0
```
#### posts10k - mixed read and write (simpleA list with additional 300 concurrent random posts10k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      32.703261ms
├─ Worst:     301.662273ms
├─ Completed: 303.322717ms
├─ Workers:   0=332 1=370 2=298
└─ Errors:    0
```
#### posts10k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.37451ms
├─ Worst:     16.560378ms
├─ Completed: 70.38333ms
├─ Workers:   0=32 1=42 2=26
└─ Errors:    0
```
#### posts10k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      2.08487ms
├─ Worst:     26.819895ms
├─ Completed: 102.996199ms
├─ Workers:   0=31 1=18 2=51
└─ Errors:    0
```
#### posts10k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      1.746473ms
├─ Worst:     26.71546ms
├─ Completed: 114.065461ms
├─ Workers:   0=44 1=16 2=40
└─ Errors:    0
```
#### posts10k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      1.649359ms
├─ Worst:     35.868466ms
├─ Completed: 131.756884ms
├─ Workers:   0=33 1=27 2=40
└─ Errors:    0
```
#### posts10k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.022883ms
├─ Worst:     11.89988ms
├─ Completed: 58.292797ms
├─ Workers:   0=38 1=31 2=31
└─ Errors:    0
```
#### posts10k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.932641ms
├─ Worst:     46.479806ms
├─ Completed: 110.357778ms
├─ Workers:   0=39 1=30 2=31
└─ Errors:    0
```
#### posts10k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      745.881µs
├─ Worst:     10.418825ms
├─ Completed: 40.509486ms
├─ Workers:   0=39 1=31 2=30
└─ Errors:    0
```
#### posts10k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      839.67µs
├─ Worst:     6.290572ms
├─ Completed: 39.60694ms
├─ Workers:   0=39 1=31 2=30
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.163779ms
├─ Worst:     40.516707ms
├─ Completed: 114.883021ms
├─ Workers:   0=39 1=32 2=29
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.066133ms
├─ Worst:     6.876099ms
├─ Completed: 35.727941ms
├─ Workers:   0=40 1=31 2=29
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.038105ms
├─ Worst:     5.832037ms
├─ Completed: 35.021114ms
├─ Workers:   0=39 1=30 2=31
└─ Errors:    0
```
#### posts10k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      3.319516ms
├─ Worst:     45.732433ms
├─ Completed: 157.241311ms
├─ Workers:   0=30 1=35 2=35
└─ Errors:    0
```
#### posts10k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      1.83169ms
├─ Worst:     39.588115ms
├─ Completed: 147.88115ms
├─ Workers:   1=61 2=39
└─ Errors:    0
```
#### posts10k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      904.62µs
├─ Worst:     11.766816ms
├─ Completed: 40.650803ms
├─ Workers:   0=32 1=42 2=26
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      14.401076ms
├─ Worst:     157.00777ms
├─ Completed: 868.042065ms
├─ Workers:   0=31 1=18 2=51
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.087343ms
├─ Worst:     13.323057ms
├─ Completed: 53.672984ms
├─ Workers:   0=44 1=15 2=41
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      4.510012ms
├─ Worst:     71.183766ms
├─ Completed: 349.603928ms
├─ Workers:   0=33 1=27 2=40
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.304092ms
├─ Worst:     6.982567ms
├─ Completed: 40.065243ms
├─ Workers:   0=38 1=31 2=31
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      12.424976ms
├─ Worst:     89.993464ms
├─ Completed: 408.737036ms
├─ Workers:   0=39 1=31 2=30
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.159071ms
├─ Worst:     8.834826ms
├─ Completed: 44.141415ms
├─ Workers:   0=39 1=31 2=30
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      39.861572ms
├─ Worst:     331.995241ms
├─ Completed: 1.807961808s
├─ Workers:   0=39 1=30 2=31
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.109823ms
├─ Worst:     20.843518ms
├─ Completed: 76.046624ms
├─ Workers:   0=39 1=32 2=29
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      97.263419ms
├─ Worst:     1.195749313s
├─ Completed: 5.894065399s
├─ Workers:   0=40 1=31 2=29
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.403019ms
├─ Worst:     19.911289ms
├─ Completed: 69.605897ms
├─ Workers:   0=39 1=31 2=30
└─ Errors:    0
```
#### posts25k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.065553ms
├─ Worst:     6.144099ms
├─ Completed: 2.430833169s
├─ Workers:   0=326 1=320 2=354
└─ Errors:    0
```
#### posts25k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      25.453156ms
├─ Worst:     479.063498ms
├─ Completed: 480.91065ms
├─ Workers:   0=326 1=322 2=352
└─ Errors:    0
```
#### posts25k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      30.658357ms
├─ Worst:     152.937257ms
├─ Completed: 155.048193ms
├─ Workers:   0=320 1=414 2=266
└─ Errors:    0
```
#### posts25k - mixed read and write (simpleA list with additional 300 concurrent random posts25k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      32.836616ms
├─ Worst:     512.630721ms
├─ Completed: 514.605669ms
├─ Workers:   0=320 1=413 2=267
└─ Errors:    0
```
#### posts25k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      2.006502ms
├─ Worst:     23.462474ms
├─ Completed: 94.445782ms
├─ Workers:   0=42 1=5 2=53
└─ Errors:    0
```
#### posts25k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      1.940682ms
├─ Worst:     27.385214ms
├─ Completed: 113.379308ms
├─ Workers:   0=41 1=9 2=50
└─ Errors:    0
```
#### posts25k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      2.727258ms
├─ Worst:     23.69762ms
├─ Completed: 107.370457ms
├─ Workers:   0=40 1=9 2=51
└─ Errors:    0
```
#### posts25k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      2.182345ms
├─ Worst:     51.928161ms
├─ Completed: 171.885766ms
├─ Workers:   0=35 1=25 2=40
└─ Errors:    0
```
#### posts25k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.059694ms
├─ Worst:     15.480858ms
├─ Completed: 74.971697ms
├─ Workers:   0=41 1=29 2=30
└─ Errors:    0
```
#### posts25k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      5.576413ms
├─ Worst:     73.026739ms
├─ Completed: 226.86895ms
├─ Workers:   0=42 1=30 2=28
└─ Errors:    0
```
#### posts25k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      828.214µs
├─ Worst:     11.916133ms
├─ Completed: 51.515061ms
├─ Workers:   0=41 1=29 2=30
└─ Errors:    0
```
#### posts25k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      958.124µs
├─ Worst:     10.945422ms
├─ Completed: 42.1342ms
├─ Workers:   0=39 1=31 2=30
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      6.133754ms
├─ Worst:     65.945506ms
├─ Completed: 231.969456ms
├─ Workers:   0=42 1=29 2=29
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      959.285µs
├─ Worst:     11.619133ms
├─ Completed: 40.930607ms
├─ Workers:   0=43 1=29 2=28
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      880.386µs
├─ Worst:     8.203193ms
├─ Completed: 42.325686ms
├─ Workers:   0=37 1=30 2=33
└─ Errors:    0
```
#### posts25k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      22.919605ms
├─ Worst:     89.599405ms
├─ Completed: 506.589461ms
├─ Workers:   1=60 2=40
└─ Errors:    0
```
#### posts25k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      19.520527ms
├─ Worst:     89.471239ms
├─ Completed: 564.407081ms
├─ Workers:   1=99 2=1
└─ Errors:    0
```
#### posts25k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.152782ms
├─ Worst:     6.957893ms
├─ Completed: 40.520219ms
├─ Workers:   0=43 1=5 2=52
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      59.243917ms
├─ Worst:     287.180821ms
├─ Completed: 1.990037026s
├─ Workers:   0=41 1=9 2=50
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.648828ms
├─ Worst:     8.896611ms
├─ Completed: 51.351034ms
├─ Workers:   0=39 1=10 2=51
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      26.660252ms
├─ Worst:     136.902037ms
├─ Completed: 838.995377ms
├─ Workers:   0=36 1=24 2=40
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.217121ms
├─ Worst:     7.888168ms
├─ Completed: 43.028126ms
├─ Workers:   0=41 1=29 2=30
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      59.181042ms
├─ Worst:     140.019061ms
├─ Completed: 963.596407ms
├─ Workers:   0=41 1=31 2=28
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.006581ms
├─ Worst:     11.575321ms
├─ Completed: 43.294783ms
├─ Workers:   0=42 1=28 2=30
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      99.44065ms
├─ Worst:     904.913463ms
├─ Completed: 4.931959684s
├─ Workers:   0=39 1=31 2=30
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.553687ms
├─ Worst:     16.306519ms
├─ Completed: 79.62168ms
├─ Workers:   0=42 1=29 2=29
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      333.190516ms
├─ Worst:     2.188397918s
├─ Completed: 13.755371073s
├─ Workers:   0=42 1=29 2=29
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.008313ms
├─ Worst:     13.705295ms
├─ Completed: 62.814072ms
├─ Workers:   0=37 1=30 2=33
└─ Errors:    0
```
#### posts50k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.884624ms
├─ Worst:     8.540329ms
├─ Completed: 4.426745921s
├─ Workers:   0=322 1=327 2=351
└─ Errors:    0
```
#### posts50k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      24.973252ms
├─ Worst:     867.724786ms
├─ Completed: 871.052583ms
├─ Workers:   0=322 1=323 2=355
└─ Errors:    0
```
#### posts50k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      31.028617ms
├─ Worst:     151.000753ms
├─ Completed: 152.832814ms
├─ Workers:   0=423 1=299 2=278
└─ Errors:    0
```
#### posts50k - mixed read and write (simpleA list with additional 300 concurrent random posts50k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      28.803012ms
├─ Worst:     937.840063ms
├─ Completed: 939.598322ms
├─ Workers:   0=424 1=298 2=278
└─ Errors:    0
```
#### posts50k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      2.311474ms
├─ Worst:     35.339863ms
├─ Completed: 134.059479ms
├─ Workers:   0=19 1=46 2=35
└─ Errors:    0
```
#### posts50k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      2.452609ms
├─ Worst:     49.496731ms
├─ Completed: 188.925818ms
├─ Workers:   0=3 1=62 2=35
└─ Errors:    0
```
#### posts50k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      5.966042ms
├─ Worst:     42.769428ms
├─ Completed: 240.377512ms
├─ Workers:   0=7 1=12 2=81
└─ Errors:    0
```
#### posts50k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      3.214661ms
├─ Worst:     56.319068ms
├─ Completed: 172.305997ms
├─ Workers:   0=28 1=37 2=35
└─ Errors:    0
```
#### posts50k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      5.287725ms
├─ Worst:     24.72598ms
├─ Completed: 107.277598ms
├─ Workers:   0=30 1=41 2=29
└─ Errors:    0
```
#### posts50k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      46.423816ms
├─ Worst:     124.843696ms
├─ Completed: 781.659053ms
├─ Workers:   0=29 1=42 2=29
└─ Errors:    0
```
#### posts50k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      862.061µs
├─ Worst:     7.038202ms
├─ Completed: 41.826985ms
├─ Workers:   0=29 1=42 2=29
└─ Errors:    0
```
#### posts50k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.12938ms
├─ Worst:     8.354792ms
├─ Completed: 39.883731ms
├─ Workers:   0=29 1=41 2=30
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      45.979473ms
├─ Worst:     125.660355ms
├─ Completed: 754.824389ms
├─ Workers:   0=30 1=41 2=29
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      905.321µs
├─ Worst:     7.236107ms
├─ Completed: 41.305335ms
├─ Workers:   0=30 1=41 2=29
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      806.835µs
├─ Worst:     8.359669ms
├─ Completed: 46.936634ms
├─ Workers:   0=47 1=9 2=44
└─ Errors:    0
```
#### posts50k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      67.96069ms
├─ Worst:     177.478914ms
├─ Completed: 1.161253577s
├─ Workers:   0=63 2=37
└─ Errors:    0
```
#### posts50k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      60.218774ms
├─ Worst:     163.78845ms
├─ Completed: 1.21112032s
├─ Workers:   0=99 1=1
└─ Errors:    0
```
#### posts50k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      942.883µs
├─ Worst:     9.940573ms
├─ Completed: 46.730359ms
├─ Workers:   0=19 1=45 2=36
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      83.221584ms
├─ Worst:     898.829478ms
├─ Completed: 5.444778155s
├─ Workers:   0=4 1=62 2=34
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.12897ms
├─ Worst:     12.870361ms
├─ Completed: 67.362965ms
├─ Workers:   0=6 1=13 2=81
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      33.573843ms
├─ Worst:     384.11539ms
├─ Completed: 1.845173269s
├─ Workers:   0=28 1=37 2=35
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.251139ms
├─ Worst:     7.176955ms
├─ Completed: 40.270276ms
├─ Workers:   0=30 1=41 2=29
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      45.577467ms
├─ Worst:     310.15482ms
├─ Completed: 2.044087046s
├─ Workers:   0=29 1=41 2=30
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      988.937µs
├─ Worst:     10.592165ms
├─ Completed: 43.970537ms
├─ Workers:   0=30 1=42 2=28
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      200.930273ms
├─ Worst:     1.829389583s
├─ Completed: 10.325658191s
├─ Workers:   0=28 1=42 2=30
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.538856ms
├─ Worst:     16.783397ms
├─ Completed: 75.043155ms
├─ Workers:   0=30 1=41 2=29
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      485.259595ms
├─ Worst:     5.065024239s
├─ Completed: 27.126430572s
├─ Workers:   0=30 1=41 2=29
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      761.982µs
├─ Worst:     13.519198ms
├─ Completed: 62.701456ms
├─ Workers:   0=47 1=8 2=45
└─ Errors:    0
```
#### posts100k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      3.206661ms
├─ Worst:     31.427859ms
├─ Completed: 6.678387815s
├─ Workers:   0=337 1=324 2=339
└─ Errors:    0
```
#### posts100k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      29.148851ms
├─ Worst:     1.508431658s
├─ Completed: 1.510161418s
├─ Workers:   0=355 1=290 2=355
└─ Errors:    0
```
#### posts100k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      26.244037ms
├─ Worst:     184.139906ms
├─ Completed: 185.831263ms
├─ Workers:   0=290 1=414 2=296
└─ Errors:    0
```
#### posts100k - mixed read and write (simpleA list with additional 300 concurrent random posts100k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      30.385469ms
├─ Worst:     1.479807221s
├─ Completed: 1.481468055s
├─ Workers:   0=290 1=414 2=296
└─ Errors:    0
```
#### posts100k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      4.106993ms
├─ Worst:     54.322148ms
├─ Completed: 256.410401ms
├─ Workers:   0=34 1=2 2=64
└─ Errors:    0
```
#### posts100k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      4.128473ms
├─ Worst:     57.203959ms
├─ Completed: 240.56538ms
├─ Workers:   0=50 1=3 2=47
└─ Errors:    0
```
#### posts100k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      4.59685ms
├─ Worst:     52.736587ms
├─ Completed: 259.546284ms
├─ Workers:   0=55 1=13 2=32
└─ Errors:    0
```
#### posts100k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      5.033114ms
├─ Worst:     57.679066ms
├─ Completed: 257.459802ms
├─ Workers:   0=28 1=43 2=29
└─ Errors:    0
```
#### posts100k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      3.561821ms
├─ Worst:     52.39032ms
├─ Completed: 226.921772ms
├─ Workers:   0=28 1=43 2=29
└─ Errors:    0
```
#### posts100k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      82.27762ms
├─ Worst:     208.954619ms
├─ Completed: 1.433061421s
├─ Workers:   0=28 1=43 2=29
└─ Errors:    0
```
#### posts100k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      939.708µs
├─ Worst:     12.771244ms
├─ Completed: 43.543367ms
├─ Workers:   0=28 1=44 2=28
└─ Errors:    0
```
#### posts100k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      989.377µs
├─ Worst:     6.626625ms
├─ Completed: 36.342169ms
├─ Workers:   0=28 1=43 2=29
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      31.266165ms
├─ Worst:     304.940799ms
├─ Completed: 1.570572338s
├─ Workers:   0=29 1=42 2=29
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.150509ms
├─ Worst:     6.422754ms
├─ Completed: 39.646623ms
├─ Workers:   0=28 1=44 2=28
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.072942ms
├─ Worst:     5.39987ms
├─ Completed: 36.282747ms
├─ Workers:   0=29 1=42 2=29
└─ Errors:    0
```
#### posts100k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      35.214801ms
├─ Worst:     278.516572ms
├─ Completed: 1.626817713s
├─ Workers:   0=28 1=44 2=28
└─ Errors:    0
```
#### posts100k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      56.124697ms
├─ Worst:     287.73111ms
├─ Completed: 1.683416274s
├─ Workers:   0=51 1=8 2=41
└─ Errors:    0
```
#### posts100k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      977.741µs
├─ Worst:     10.210146ms
├─ Completed: 50.745788ms
├─ Workers:   0=34 1=2 2=64
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      230.98142ms
├─ Worst:     1.389506138s
├─ Completed: 9.248928968s
├─ Workers:   0=49 1=3 2=48
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      905.441µs
├─ Worst:     10.217265ms
├─ Completed: 57.265324ms
├─ Workers:   0=55 1=13 2=32
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      76.669662ms
├─ Worst:     667.107835ms
├─ Completed: 3.61845107s
├─ Workers:   0=29 1=43 2=28
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.012508ms
├─ Worst:     9.307528ms
├─ Completed: 41.764289ms
├─ Workers:   0=27 1=44 2=29
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      88.028014ms
├─ Worst:     986.368145ms
├─ Completed: 4.729998417s
├─ Workers:   0=28 1=43 2=29
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      920.422µs
├─ Worst:     12.99244ms
├─ Completed: 54.607574ms
├─ Workers:   0=29 1=43 2=28
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      442.934833ms
├─ Worst:     3.439752s
├─ Completed: 20.996248275s
├─ Workers:   0=28 1=43 2=29
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.230681ms
├─ Worst:     25.807113ms
├─ Completed: 110.053854ms
├─ Workers:   0=28 1=42 2=30
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      1.196329967s
├─ Worst:     10.629928162s
├─ Completed: 53.475972151s
├─ Workers:   0=29 1=44 2=27
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      30.744365ms
├─ Worst:     41.442094ms
├─ Completed: 353.508356ms
├─ Workers:   0=28 1=42 2=30
└─ Errors:    0
```

## Go vs JS route execution
#### JS route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      49.076621ms
├─ Worst:     2.653197066s
├─ Completed: 2.653916128s
├─ Workers:   0=217 1=70 2=213
└─ Errors:    0
```
#### Go route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      63.064436ms
├─ Worst:     2.349985135s
├─ Completed: 2.350991014s
├─ Workers:   0=141 1=217 2=142
└─ Errors:    0
```
#### JS route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      10.501637ms
├─ Worst:     429.588454ms
├─ Completed: 2.524977214s
├─ Workers:   0=176 1=145 2=179
└─ Errors:    0
```
#### Go route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      10.678873ms
├─ Worst:     527.17323ms
├─ Completed: 2.725955396s
├─ Workers:   0=181 1=145 2=174
└─ Errors:    0
```
#### JS route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      10.841678ms
├─ Worst:     47.494415ms
├─ Completed: 9.294712682s
├─ Workers:   0=142 1=200 2=158
└─ Errors:    0
```
#### Go route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      10.084322ms
├─ Worst:     54.437758ms
├─ Completed: 8.7571684s
├─ Workers:   0=212 1=76 2=212
└─ Errors:    0
```

## Go vs JS hooks execution
#### JS OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      928.694µs
├─ Worst:     11.307481ms
├─ Completed: 44.238688ms
├─ Workers:   0=44 1=29 2=27
└─ Errors:    0
```
#### Go OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      836.666µs
├─ Worst:     7.356063ms
├─ Completed: 50.556917ms
├─ Workers:   0=15 1=69 2=16
└─ Errors:    0
```

## Deleting records
#### deleting 100 posts10k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      693.619µs
├─ Worst:     13.79585ms
├─ Completed: 45.278846ms
├─ Workers:   0=28 1=44 2=28
└─ Errors:    0
```
#### deleting 100 posts10k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      686.178µs
├─ Worst:     9.620302ms
├─ Completed: 38.896548ms
├─ Workers:   0=28 1=32 2=40
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      699.406µs
├─ Worst:     12.595601ms
├─ Completed: 46.049049ms
├─ Workers:   0=29 1=39 2=32
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      752.32µs
├─ Worst:     9.259421ms
├─ Completed: 42.825395ms
├─ Workers:   0=29 1=41 2=30
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      762.854µs
├─ Worst:     10.210896ms
├─ Completed: 40.7868ms
├─ Workers:   0=29 1=44 2=27
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      888.226µs
├─ Worst:     9.305716ms
├─ Completed: 41.027501ms
├─ Workers:   0=47 1=5 2=48
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      680.639µs
├─ Worst:     10.983554ms
├─ Completed: 46.336156ms
├─ Workers:   0=54 2=46
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      1.040117ms
├─ Worst:     11.589141ms
├─ Completed: 42.793391ms
├─ Workers:   0=42 1=9 2=49
└─ Errors:    0
```
#### deleting 100 users - with cascade deleting all associated posts [conc:10, rule:`""`]
```
┌─ Best:      65.837737ms
├─ Worst:     2.268143209s
├─ Completed: 8.018310745s
├─ Workers:   0=28 1=29 2=43
└─ Errors:    0
```
#### deleting 100 organizations - with cascade deleting all users and associated posts [conc:10, rule:`""`]
```
┌─ Best:      68.63447ms
├─ Worst:     6.442711067s
├─ Completed: 18.500093202s
├─ Workers:   0=41 1=30 2=29
└─ Errors:    0
```

---------------------------------------------------
Completed!
