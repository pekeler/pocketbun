# PocketBun Upstream-Port Benchmark Result

- machine: hetzner-8vcpu-pocketbun-8
- timestamp: 2026-08-27T16:43:10.484Z
- tests: create,auth,search,custom,delete
- benchmark source: 05625dc2b2d3f9711c51566010944b10ca9531fa
- server workers: 8
- load generator: http://load-generator:19231
- benchmark target host: application-host
- warmup request target/cap: 1000
## Creating organizations (100)
#### Creating 50 organizations [reqs:50, conc:10, rule:`""`]
```
┌─ Best:      700.037µs
├─ Worst:     5.42239ms
├─ Completed: 12.399216ms
├─ Workers:   0=6 1=6 2=7 3=7 4=6 5=7 6=7 7=4
└─ Errors:    0
```
#### Creating 50 organizations [reqs:50, conc:10, rule:`"@request.body.name != ''"`]
```
┌─ Best:      814.234µs
├─ Worst:     5.996904ms
├─ Completed: 12.823583ms
├─ Workers:   0=7 1=9 2=6 3=8 4=3 5=3 6=9 7=5
└─ Errors:    0
```

## Creating permissions (50)
#### Creating 25 permissions [reqs:25, conc:5, rule:`""`]
```
┌─ Best:      698.035µs
├─ Worst:     3.213158ms
├─ Completed: 7.30566ms
├─ Workers:   0=5 1=4 2=5 3=5 6=2 7=4
└─ Errors:    0
```
#### Creating 25 permissions [reqs:25, conc:5, rule:`"@request.body.name != ''"`]
```
┌─ Best:      729.117µs
├─ Worst:     7.151178ms
├─ Completed: 10.253282ms
├─ Workers:   0=6 1=4 2=4 6=7 7=4
└─ Errors:    0
```

## Creating users (500 - expected to be slow due to passwordHash generation)
#### Creating 250 users [reqs:250, conc:50, rule:`""`]
```
┌─ Best:      140.387681ms
├─ Worst:     928.140979ms
├─ Completed: 2.086577075s
├─ Workers:   0=34 1=44 2=35 3=27 4=27 5=21 6=38 7=24
└─ Errors:    0
```
#### Creating 250 users [reqs:250, conc:50, rule:`"@request.body.email != '' && @request.body.permissions:length > 0"`]
```
┌─ Best:      68.954164ms
├─ Worst:     1.0421326s
├─ Completed: 2.120646943s
├─ Workers:   0=28 1=36 2=22 3=35 4=34 5=32 6=33 7=30
└─ Errors:    0
```

## Creating posts (10k, 25k, 50k, 100k)
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`""`]
```
┌─ Best:      559.313µs
├─ Worst:     399.81113ms
├─ Completed: 428.988251ms
├─ Workers:   0=487 1=729 2=568 3=712 4=665 5=674 6=650 7=515
└─ Errors:    0
```
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      648.596µs
├─ Worst:     293.370439ms
├─ Completed: 469.103851ms
├─ Workers:   0=678 1=595 2=580 3=619 4=633 5=535 6=700 7=660
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`""`]
```
┌─ Best:      682.803µs
├─ Worst:     447.624684ms
├─ Completed: 809.196957ms
├─ Workers:   0=1489 1=1690 2=1610 3=1448 4=1588 5=1418 6=1671 7=1586
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      606.087µs
├─ Worst:     575.699778ms
├─ Completed: 1.082508589s
├─ Workers:   0=1380 1=1732 2=1450 3=1614 4=1601 5=1420 6=1659 7=1644
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`""`]
```
┌─ Best:      973.434µs
├─ Worst:     535.829296ms
├─ Completed: 1.565188313s
├─ Workers:   0=2861 1=3434 2=3143 3=3071 4=3116 5=2974 6=3236 7=3165
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      589.174µs
├─ Worst:     552.911311ms
├─ Completed: 1.787480887s
├─ Workers:   0=2873 1=3481 2=3099 3=3246 4=2689 5=2991 6=3411 7=3210
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`""`]
```
┌─ Best:      745.93µs
├─ Worst:     854.818902ms
├─ Completed: 2.765810127s
├─ Workers:   0=5459 1=6674 2=6468 3=6244 4=6232 5=5949 6=6697 7=6277
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      537.802µs
├─ Worst:     842.593095ms
├─ Completed: 3.251406911s
├─ Workers:   0=6104 1=6785 2=6161 3=6051 4=6565 5=5403 6=6577 7=6354
└─ Errors:    0
```

## User auth with password (expected to be slow due to passwordHash verification)
#### users auth with email/pass - high concurrency [reqs:250, conc:250]
```
┌─ Best:      264.02055ms
├─ Worst:     2.040429935s
├─ Completed: 2.040613988s
├─ Workers:   0=27 1=41 2=40 3=18 4=31 5=43 6=31 7=19
└─ Errors:    0
```
#### users auth with email/pass - small concurrency [reqs:250, conc:10]
```
┌─ Best:      63.426358ms
├─ Worst:     141.169552ms
├─ Completed: 2.08608275s
├─ Workers:   0=30 1=23 2=33 3=25 4=35 5=22 6=42 7=40
└─ Errors:    0
```

## User auth refresh
#### users - auth refresh (high concurrency) [reqs:1000, conc:1000]
```
┌─ Best:      22.646771ms
├─ Worst:     63.277422ms
├─ Completed: 64.656427ms
├─ Workers:   0=116 1=137 2=121 3=136 4=125 5=115 6=130 7=120
└─ Errors:    0
```
#### users - auth refresh (medium concurrency) [reqs:1000, conc:100]
```
┌─ Best:      443.252µs
├─ Worst:     24.164948ms
├─ Completed: 61.533563ms
├─ Workers:   0=131 1=138 2=162 3=80 4=127 5=101 6=144 7=117
└─ Errors:    0
```

## List records
#### users - getOne for auth refresh comparison (medium concurrency) [reqs:1000, conc:100, rule:`""`, query:`/m4hio2qbg5055si`]
```
┌─ Best:      392.061µs
├─ Worst:     16.79572ms
├─ Completed: 48.026347ms
├─ Workers:   0=116 1=84 2=127 3=118 4=134 5=135 6=140 7=146
└─ Errors:    0
```
#### users - getOne for auth refresh comparison (high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`/m4hio2qbg5055si`]
```
┌─ Best:      23.691124ms
├─ Worst:     41.987325ms
├─ Completed: 44.574218ms
├─ Workers:   0=98 1=152 2=108 3=140 4=133 5=118 6=132 7=119
└─ Errors:    0
```
#### posts10k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.022613ms
├─ Worst:     37.896395ms
├─ Completed: 1.870317997s
├─ Workers:   0=146 1=102 2=119 3=161 4=165 5=101 6=107 7=99
└─ Errors:    0
```
#### posts10k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      31.61565ms
├─ Worst:     180.174327ms
├─ Completed: 185.385155ms
├─ Workers:   0=116 1=132 2=138 3=92 4=118 5=127 6=145 7=132
└─ Errors:    0
```
#### posts10k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      35.241888ms
├─ Worst:     117.13953ms
├─ Completed: 120.53512ms
├─ Workers:   0=120 1=136 2=112 3=161 4=138 5=123 6=87 7=123
└─ Errors:    0
```
#### posts10k - mixed read and write (simpleA list with additional 300 concurrent random posts10k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      28.696438ms
├─ Worst:     163.104549ms
├─ Completed: 164.43048ms
├─ Workers:   0=120 1=136 2=112 3=161 4=138 5=123 6=87 7=123
└─ Errors:    0
```
#### posts10k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      2.111516ms
├─ Worst:     12.965529ms
├─ Completed: 59.079594ms
├─ Workers:   0=13 1=14 2=6 4=22 5=14 6=17 7=14
└─ Errors:    0
```
#### posts10k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      1.555298ms
├─ Worst:     28.435738ms
├─ Completed: 87.178195ms
├─ Workers:   0=15 1=14 2=1 4=9 5=19 6=21 7=21
└─ Errors:    0
```
#### posts10k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      2.777517ms
├─ Worst:     20.779212ms
├─ Completed: 74.433433ms
├─ Workers:   0=16 1=12 2=8 3=3 4=8 5=7 6=37 7=9
└─ Errors:    0
```
#### posts10k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      2.421144ms
├─ Worst:     44.964057ms
├─ Completed: 133.535895ms
├─ Workers:   0=10 1=9 2=27 3=6 4=14 5=7 6=18 7=9
└─ Errors:    0
```
#### posts10k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.507934ms
├─ Worst:     12.154468ms
├─ Completed: 42.377875ms
├─ Workers:   0=12 1=13 2=13 3=16 4=5 5=14 6=13 7=14
└─ Errors:    0
```
#### posts10k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.396821ms
├─ Worst:     35.950627ms
├─ Completed: 106.438889ms
├─ Workers:   0=14 1=15 2=9 3=15 4=14 5=13 6=8 7=12
└─ Errors:    0
```
#### posts10k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      985.131µs
├─ Worst:     7.865043ms
├─ Completed: 23.775038ms
├─ Workers:   0=14 1=13 2=9 3=14 4=13 5=12 6=13 7=12
└─ Errors:    0
```
#### posts10k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      930.765µs
├─ Worst:     8.461077ms
├─ Completed: 24.423796ms
├─ Workers:   0=13 1=13 2=9 3=13 4=14 5=13 6=13 7=12
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      3.21461ms
├─ Worst:     35.563792ms
├─ Completed: 102.471079ms
├─ Workers:   0=13 1=13 2=9 3=13 4=13 5=13 6=14 7=12
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.010135ms
├─ Worst:     6.87095ms
├─ Completed: 23.737958ms
├─ Workers:   0=13 1=13 2=9 3=14 4=14 5=13 6=12 7=12
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      961.367µs
├─ Worst:     7.767469ms
├─ Completed: 22.693816ms
├─ Workers:   0=13 1=14 2=10 3=14 4=14 5=14 6=8 7=13
└─ Errors:    0
```
#### posts10k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      4.009509ms
├─ Worst:     34.428946ms
├─ Completed: 112.131352ms
├─ Workers:   1=19 2=13 3=18 4=18 5=16 7=16
└─ Errors:    0
```
#### posts10k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      2.607391ms
├─ Worst:     33.61464ms
├─ Completed: 128.349944ms
├─ Workers:   1=12 2=41 3=35 4=7 7=5
└─ Errors:    0
```
#### posts10k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.031355ms
├─ Worst:     9.181452ms
├─ Completed: 24.474255ms
├─ Workers:   0=13 1=15 2=6 4=22 5=14 6=17 7=13
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      14.15358ms
├─ Worst:     102.37784ms
├─ Completed: 443.029887ms
├─ Workers:   0=15 1=13 2=1 4=9 5=19 6=21 7=22
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.185978ms
├─ Worst:     8.069226ms
├─ Completed: 35.043995ms
├─ Workers:   0=16 1=12 2=9 3=3 4=8 5=7 6=37 7=8
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      5.847046ms
├─ Worst:     59.54712ms
├─ Completed: 241.505831ms
├─ Workers:   0=10 1=9 2=26 3=6 4=14 5=7 6=19 7=9
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.091898ms
├─ Worst:     7.337045ms
├─ Completed: 24.825951ms
├─ Workers:   0=12 1=13 2=14 3=16 4=5 5=14 6=12 7=14
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      8.537732ms
├─ Worst:     72.745841ms
├─ Completed: 248.159021ms
├─ Workers:   0=14 1=15 2=8 3=15 4=14 5=14 6=8 7=12
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.043051ms
├─ Worst:     7.353757ms
├─ Completed: 26.090318ms
├─ Workers:   0=14 1=13 2=10 3=14 4=13 5=11 6=13 7=12
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      41.709781ms
├─ Worst:     186.086552ms
├─ Completed: 993.480528ms
├─ Workers:   0=14 1=13 2=8 3=13 4=14 5=13 6=13 7=12
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.831651ms
├─ Worst:     24.962159ms
├─ Completed: 61.056845ms
├─ Workers:   0=12 1=13 2=9 3=14 4=13 5=13 6=14 7=12
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      96.349654ms
├─ Worst:     467.74164ms
├─ Completed: 2.660014837s
├─ Workers:   0=13 1=13 2=9 3=13 4=14 5=13 6=12 7=13
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.818501ms
├─ Worst:     11.675357ms
├─ Completed: 39.916735ms
├─ Workers:   0=13 1=14 2=10 3=14 4=14 5=14 6=8 7=13
└─ Errors:    0
```
#### posts25k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.600841ms
├─ Worst:     8.653833ms
├─ Completed: 2.843206773s
├─ Workers:   0=108 1=134 2=136 3=121 4=124 5=115 6=140 7=122
└─ Errors:    0
```
#### posts25k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      22.942889ms
├─ Worst:     261.929511ms
├─ Completed: 263.67323ms
├─ Workers:   0=104 1=133 2=139 3=118 4=125 5=117 6=140 7=124
└─ Errors:    0
```
#### posts25k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      23.5581ms
├─ Worst:     114.957215ms
├─ Completed: 116.691631ms
├─ Workers:   0=134 1=106 2=112 3=134 4=130 5=128 6=128 7=128
└─ Errors:    0
```
#### posts25k - mixed read and write (simpleA list with additional 300 concurrent random posts25k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      28.613322ms
├─ Worst:     265.762155ms
├─ Completed: 267.703437ms
├─ Workers:   0=134 1=106 2=112 3=134 4=130 5=128 6=128 7=128
└─ Errors:    0
```
#### posts25k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.729199ms
├─ Worst:     18.571902ms
├─ Completed: 78.94262ms
├─ Workers:   0=12 1=14 2=17 3=3 4=14 5=17 6=11 7=12
└─ Errors:    0
```
#### posts25k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      2.220557ms
├─ Worst:     24.854651ms
├─ Completed: 96.178968ms
├─ Workers:   0=1 1=15 2=19 3=5 4=18 5=11 6=13 7=18
└─ Errors:    0
```
#### posts25k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      2.315709ms
├─ Worst:     23.917837ms
├─ Completed: 97.67923ms
├─ Workers:   0=6 1=32 2=10 3=16 4=6 5=6 6=17 7=7
└─ Errors:    0
```
#### posts25k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      2.955152ms
├─ Worst:     31.991678ms
├─ Completed: 117.595648ms
├─ Workers:   0=11 1=18 2=12 3=12 4=12 5=12 6=11 7=12
└─ Errors:    0
```
#### posts25k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      2.551704ms
├─ Worst:     15.156154ms
├─ Completed: 56.584678ms
├─ Workers:   0=14 1=13 2=13 3=10 4=13 5=12 6=12 7=13
└─ Errors:    0
```
#### posts25k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      7.119644ms
├─ Worst:     63.048486ms
├─ Completed: 186.850509ms
├─ Workers:   0=11 1=12 2=20 3=9 4=12 5=12 6=12 7=12
└─ Errors:    0
```
#### posts25k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.017316ms
├─ Worst:     5.849059ms
├─ Completed: 22.799472ms
├─ Workers:   0=13 1=13 2=12 3=9 4=14 5=14 6=12 7=13
└─ Errors:    0
```
#### posts25k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      888.618µs
├─ Worst:     6.438774ms
├─ Completed: 23.004974ms
├─ Workers:   0=12 1=14 2=13 3=11 4=12 5=13 6=12 7=13
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      7.004845ms
├─ Worst:     72.383911ms
├─ Completed: 177.918471ms
├─ Workers:   0=11 1=12 2=13 3=9 4=12 5=13 6=17 7=13
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.057551ms
├─ Worst:     5.986469ms
├─ Completed: 23.158987ms
├─ Workers:   0=13 1=13 2=12 3=10 4=14 5=13 6=13 7=12
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      989.356µs
├─ Worst:     7.099425ms
├─ Completed: 24.971672ms
├─ Workers:   0=14 1=14 2=14 3=11 4=14 5=14 6=13 7=6
└─ Errors:    0
```
#### posts25k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      9.502756ms
├─ Worst:     67.19257ms
├─ Completed: 249.538466ms
├─ Workers:   0=15 1=4 2=9 3=10 4=14 5=15 6=13 7=20
└─ Errors:    0
```
#### posts25k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      6.271353ms
├─ Worst:     61.548364ms
├─ Completed: 338.553128ms
├─ Workers:   0=13 2=1 3=46 4=10 5=3 6=18 7=9
└─ Errors:    0
```
#### posts25k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      493.251µs
├─ Worst:     4.992206ms
├─ Completed: 18.462622ms
├─ Workers:   0=12 1=14 2=17 3=3 4=14 5=17 6=11 7=12
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      35.570592ms
├─ Worst:     242.14265ms
├─ Completed: 1.040327367s
├─ Workers:   0=1 1=15 2=19 3=5 4=18 5=11 6=13 7=18
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.086851ms
├─ Worst:     7.445123ms
├─ Completed: 37.28477ms
├─ Workers:   0=6 1=32 2=9 3=16 4=6 5=6 6=17 7=8
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      16.048707ms
├─ Worst:     107.577382ms
├─ Completed: 441.128201ms
├─ Workers:   0=11 1=18 2=12 3=12 4=12 5=12 6=12 7=11
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.107671ms
├─ Worst:     9.838569ms
├─ Completed: 27.335517ms
├─ Workers:   0=14 1=13 2=13 3=10 4=13 5=13 6=11 7=13
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      20.224325ms
├─ Worst:     150.895414ms
├─ Completed: 588.348499ms
├─ Workers:   0=11 1=12 2=21 3=9 4=12 5=11 6=12 7=12
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.171209ms
├─ Worst:     4.713201ms
├─ Completed: 25.345308ms
├─ Workers:   0=13 1=13 2=12 3=9 4=14 5=14 6=12 7=13
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      99.284337ms
├─ Worst:     419.093114ms
├─ Completed: 2.360865966s
├─ Workers:   0=12 1=14 2=12 3=11 4=12 5=14 6=12 7=13
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.500303ms
├─ Worst:     13.90766ms
├─ Completed: 59.86625ms
├─ Workers:   0=12 1=12 2=13 3=9 4=12 5=12 6=17 7=13
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      249.725634ms
├─ Worst:     1.264730955s
├─ Completed: 6.415868016s
├─ Workers:   0=12 1=13 2=12 3=10 4=14 5=13 6=14 7=12
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.798053ms
├─ Worst:     8.155124ms
├─ Completed: 39.638511ms
├─ Workers:   0=14 1=14 2=14 3=11 4=15 5=14 6=12 7=6
└─ Errors:    0
```
#### posts50k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.946988ms
├─ Worst:     9.283263ms
├─ Completed: 5.033742449s
├─ Workers:   0=108 1=135 2=125 3=131 4=124 5=116 6=131 7=130
└─ Errors:    0
```
#### posts50k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      23.977368ms
├─ Worst:     415.60133ms
├─ Completed: 418.390804ms
├─ Workers:   0=111 1=135 2=119 3=133 4=127 5=116 6=138 7=121
└─ Errors:    0
```
#### posts50k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      33.244589ms
├─ Worst:     111.953256ms
├─ Completed: 113.655437ms
├─ Workers:   0=126 1=131 2=121 3=118 4=128 5=130 6=125 7=121
└─ Errors:    0
```
#### posts50k - mixed read and write (simpleA list with additional 300 concurrent random posts50k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      26.870945ms
├─ Worst:     448.861191ms
├─ Completed: 449.85906ms
├─ Workers:   0=126 1=131 2=121 3=118 4=128 5=130 6=125 7=121
└─ Errors:    0
```
#### posts50k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      2.578741ms
├─ Worst:     29.527516ms
├─ Completed: 99.94511ms
├─ Workers:   0=10 1=16 2=12 3=17 4=5 5=13 6=11 7=16
└─ Errors:    0
```
#### posts50k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      3.032518ms
├─ Worst:     26.230692ms
├─ Completed: 129.88165ms
├─ Workers:   0=6 1=25 2=5 3=19 4=10 5=6 6=16 7=13
└─ Errors:    0
```
#### posts50k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      3.009898ms
├─ Worst:     32.069626ms
├─ Completed: 152.227585ms
├─ Workers:   0=7 1=2 2=18 3=15 4=24 5=6 6=16 7=12
└─ Errors:    0
```
#### posts50k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      4.142031ms
├─ Worst:     26.582347ms
├─ Completed: 119.162034ms
├─ Workers:   0=12 1=11 2=15 3=12 4=11 5=14 6=13 7=12
└─ Errors:    0
```
#### posts50k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      2.35941ms
├─ Worst:     25.403759ms
├─ Completed: 84.488479ms
├─ Workers:   0=10 1=12 2=12 3=13 4=11 5=17 6=12 7=13
└─ Errors:    0
```
#### posts50k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      22.605695ms
├─ Worst:     103.991108ms
├─ Completed: 378.716844ms
├─ Workers:   0=13 1=12 2=13 3=12 4=12 5=11 6=14 7=13
└─ Errors:    0
```
#### posts50k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      964.562µs
├─ Worst:     6.685064ms
├─ Completed: 22.936592ms
├─ Workers:   0=13 1=13 2=13 3=13 4=10 5=13 6=12 7=13
└─ Errors:    0
```
#### posts50k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.037714ms
├─ Worst:     5.876276ms
├─ Completed: 23.338345ms
├─ Workers:   0=13 1=12 2=13 3=13 4=11 5=12 6=13 7=13
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      17.642139ms
├─ Worst:     199.060484ms
├─ Completed: 455.421324ms
├─ Workers:   0=13 1=12 2=14 3=12 4=10 5=11 6=16 7=12
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.063909ms
├─ Worst:     8.14494ms
├─ Completed: 25.207569ms
├─ Workers:   0=17 1=12 2=12 3=12 4=11 5=12 6=12 7=12
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.004696ms
├─ Worst:     7.156205ms
├─ Completed: 25.735498ms
├─ Workers:   0=12 1=13 2=13 3=13 4=11 5=12 6=13 7=13
└─ Errors:    0
```
#### posts50k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      18.72183ms
├─ Worst:     105.858638ms
├─ Completed: 435.001486ms
├─ Workers:   0=12 1=15 2=13 3=10 4=11 5=12 6=13 7=14
└─ Errors:    0
```
#### posts50k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      12.599534ms
├─ Worst:     127.36232ms
├─ Completed: 466.659286ms
├─ Workers:   0=8 1=19 2=11 4=28 5=16 6=14 7=4
└─ Errors:    0
```
#### posts50k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.046606ms
├─ Worst:     5.022497ms
├─ Completed: 21.958581ms
├─ Workers:   0=10 1=16 2=12 3=17 4=5 5=13 6=10 7=17
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      87.613357ms
├─ Worst:     878.433271ms
├─ Completed: 2.928212086s
├─ Workers:   0=6 1=25 2=5 3=20 4=10 5=6 6=16 7=12
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.111705ms
├─ Worst:     8.501913ms
├─ Completed: 31.313852ms
├─ Workers:   0=7 1=2 2=18 3=15 4=24 5=6 6=16 7=12
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      38.480833ms
├─ Worst:     273.807888ms
├─ Completed: 1.095004999s
├─ Workers:   0=12 1=11 2=16 3=11 4=11 5=14 6=13 7=12
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.105237ms
├─ Worst:     7.497896ms
├─ Completed: 23.856881ms
├─ Workers:   0=10 1=12 2=11 3=14 4=11 5=17 6=12 7=13
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      47.070276ms
├─ Worst:     185.855023ms
├─ Completed: 971.129837ms
├─ Workers:   0=13 1=12 2=13 3=11 4=12 5=11 6=14 7=14
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.131222ms
├─ Worst:     7.844976ms
├─ Completed: 25.377002ms
├─ Workers:   0=13 1=13 2=13 3=13 4=11 5=13 6=12 7=12
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      228.788817ms
├─ Worst:     790.140656ms
├─ Completed: 5.009378697s
├─ Workers:   0=13 1=12 2=14 3=13 4=10 5=12 6=13 7=13
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.726445ms
├─ Worst:     15.98591ms
├─ Completed: 56.216029ms
├─ Workers:   0=13 1=12 2=13 3=12 4=10 5=11 6=16 7=13
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      549.047896ms
├─ Worst:     3.27104886s
├─ Completed: 13.994285098s
├─ Workers:   0=17 1=13 2=12 3=12 4=11 5=12 6=12 7=11
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.804312ms
├─ Worst:     9.781841ms
├─ Completed: 44.962885ms
├─ Workers:   0=13 1=12 2=13 3=13 4=11 5=12 6=13 7=13
└─ Errors:    0
```
#### posts100k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      3.758711ms
├─ Worst:     15.887164ms
├─ Completed: 8.78550642s
├─ Workers:   0=103 1=137 2=126 3=124 4=133 5=120 6=134 7=123
└─ Errors:    0
```
#### posts100k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      30.677684ms
├─ Worst:     820.299563ms
├─ Completed: 822.105628ms
├─ Workers:   0=107 1=138 2=124 3=124 4=133 5=119 6=134 7=121
└─ Errors:    0
```
#### posts100k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      26.269074ms
├─ Worst:     99.987558ms
├─ Completed: 102.661302ms
├─ Workers:   0=128 1=117 2=128 3=126 4=122 5=124 6=130 7=125
└─ Errors:    0
```
#### posts100k - mixed read and write (simpleA list with additional 300 concurrent random posts100k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      28.282676ms
├─ Worst:     763.87693ms
├─ Completed: 765.469018ms
├─ Workers:   0=127 1=117 2=128 3=127 4=122 5=124 6=130 7=125
└─ Errors:    0
```
#### posts100k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      4.175699ms
├─ Worst:     35.160125ms
├─ Completed: 150.138249ms
├─ Workers:   0=18 1=14 2=7 3=12 4=7 5=18 6=17 7=7
└─ Errors:    0
```
#### posts100k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      5.855237ms
├─ Worst:     48.938266ms
├─ Completed: 209.104917ms
├─ Workers:   0=2 1=14 2=8 3=21 4=9 5=12 6=25 7=9
└─ Errors:    0
```
#### posts100k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      4.521145ms
├─ Worst:     49.204703ms
├─ Completed: 178.564473ms
├─ Workers:   0=5 1=26 2=19 3=3 4=28 5=4 6=3 7=12
└─ Errors:    0
```
#### posts100k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      7.458642ms
├─ Worst:     41.449573ms
├─ Completed: 140.187304ms
├─ Workers:   0=12 1=13 2=13 3=12 4=12 5=13 6=13 7=12
└─ Errors:    0
```
#### posts100k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      4.53973ms
├─ Worst:     32.598335ms
├─ Completed: 110.597193ms
├─ Workers:   0=13 1=12 2=13 3=13 4=11 5=12 6=13 7=13
└─ Errors:    0
```
#### posts100k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      39.337596ms
├─ Worst:     146.16375ms
├─ Completed: 665.094155ms
├─ Workers:   0=13 1=13 2=12 3=13 4=12 5=13 6=12 7=12
└─ Errors:    0
```
#### posts100k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.045203ms
├─ Worst:     7.226622ms
├─ Completed: 24.900715ms
├─ Workers:   0=13 1=13 2=13 3=12 4=11 5=13 6=13 7=12
└─ Errors:    0
```
#### posts100k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      986.773µs
├─ Worst:     6.215795ms
├─ Completed: 22.098103ms
├─ Workers:   0=13 1=12 2=13 3=12 4=12 5=12 6=13 7=13
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      34.533369ms
├─ Worst:     177.307046ms
├─ Completed: 691.815403ms
├─ Workers:   0=12 1=13 2=13 3=13 4=12 5=13 6=12 7=12
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      991.239µs
├─ Worst:     6.923352ms
├─ Completed: 26.54087ms
├─ Workers:   0=13 1=10 2=12 3=12 4=11 5=12 6=12 7=18
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.065122ms
├─ Worst:     6.858483ms
├─ Completed: 22.528027ms
├─ Workers:   0=12 1=13 2=12 3=13 4=12 5=13 6=13 7=12
└─ Errors:    0
```
#### posts100k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      50.053958ms
├─ Worst:     152.870613ms
├─ Completed: 756.366335ms
├─ Workers:   0=13 1=12 2=13 3=12 4=11 5=13 6=13 7=13
└─ Errors:    0
```
#### posts100k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      32.605417ms
├─ Worst:     207.114769ms
├─ Completed: 772.778364ms
├─ Workers:   0=7 1=9 2=16 3=13 4=17 5=7 6=16 7=15
└─ Errors:    0
```
#### posts100k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.051272ms
├─ Worst:     7.112564ms
├─ Completed: 25.037053ms
├─ Workers:   0=18 1=14 2=7 3=12 4=7 5=18 6=16 7=8
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      180.042694ms
├─ Worst:     1.842693688s
├─ Completed: 5.794996634s
├─ Workers:   0=2 1=14 2=8 3=21 4=10 5=12 6=25 7=8
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.157208ms
├─ Worst:     7.504796ms
├─ Completed: 33.042339ms
├─ Workers:   0=5 1=26 2=19 3=3 4=27 5=4 6=4 7=12
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      94.58067ms
├─ Worst:     296.549321ms
├─ Completed: 1.670131696s
├─ Workers:   0=12 1=13 2=13 3=12 4=12 5=13 6=12 7=13
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.177817ms
├─ Worst:     6.333017ms
├─ Completed: 24.930245ms
├─ Workers:   0=14 1=12 2=13 3=13 4=11 5=12 6=13 7=12
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      92.841436ms
├─ Worst:     316.062343ms
├─ Completed: 1.823517532s
├─ Workers:   0=13 1=13 2=12 3=13 4=12 5=13 6=12 7=12
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.138162ms
├─ Worst:     8.455469ms
├─ Completed: 25.758449ms
├─ Workers:   0=12 1=13 2=13 3=12 4=12 5=13 6=13 7=12
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      473.316942ms
├─ Worst:     2.387011823s
├─ Completed: 10.35612235s
├─ Workers:   0=14 1=12 2=13 3=12 4=11 5=12 6=13 7=13
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.639676ms
├─ Worst:     15.330645ms
├─ Completed: 58.228297ms
├─ Workers:   0=11 1=13 2=13 3=13 4=12 5=13 6=12 7=13
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      1.024586035s
├─ Worst:     7.11782788s
├─ Completed: 27.318709655s
├─ Workers:   0=13 1=10 2=12 3=12 4=11 5=12 6=13 7=17
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.648887ms
├─ Worst:     12.891766ms
├─ Completed: 41.41912ms
├─ Workers:   0=12 1=13 2=13 3=13 4=12 5=13 6=12 7=12
└─ Errors:    0
```

## Go vs JS route execution
#### JS route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      52.93666ms
├─ Worst:     973.652902ms
├─ Completed: 974.524115ms
├─ Workers:   0=45 1=75 2=62 3=61 4=73 5=54 6=74 7=56
└─ Errors:    0
```
#### Go route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      33.053445ms
├─ Worst:     851.309015ms
├─ Completed: 852.182271ms
├─ Workers:   0=65 1=63 2=64 3=62 4=57 5=63 6=64 7=62
└─ Errors:    0
```
#### JS route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      13.124748ms
├─ Worst:     163.157111ms
├─ Completed: 885.799094ms
├─ Workers:   0=61 1=62 2=63 3=63 4=59 5=64 6=60 7=68
└─ Errors:    0
```
#### Go route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      9.705725ms
├─ Worst:     210.842277ms
├─ Completed: 934.408596ms
├─ Workers:   0=45 1=73 2=62 3=62 4=74 5=53 6=75 7=56
└─ Errors:    0
```
#### JS route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      9.453958ms
├─ Worst:     23.14537ms
├─ Completed: 9.417342078s
├─ Workers:   0=64 1=63 2=65 3=62 4=57 5=64 6=63 7=62
└─ Errors:    0
```
#### Go route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      9.048157ms
├─ Worst:     24.049379ms
├─ Completed: 9.113532508s
├─ Workers:   0=57 1=65 2=64 3=63 4=59 5=63 6=61 7=68
└─ Errors:    0
```

## Go vs JS hooks execution
#### JS OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      1.002295ms
├─ Worst:     7.552691ms
├─ Completed: 26.831289ms
├─ Workers:   0=5 1=14 2=15 3=15 4=17 5=9 6=16 7=9
└─ Errors:    0
```
#### Go OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      953.888µs
├─ Worst:     9.834174ms
├─ Completed: 26.666664ms
├─ Workers:   0=13 1=13 2=12 3=13 4=12 5=12 6=12 7=13
└─ Errors:    0
```

## Deleting records
#### deleting 100 posts10k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      782.752µs
├─ Worst:     58.673994ms
├─ Completed: 79.053112ms
├─ Workers:   0=7 1=19 2=8 3=8 4=20 5=7 6=23 7=8
└─ Errors:    0
```
#### deleting 100 posts10k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      779.608µs
├─ Worst:     12.694294ms
├─ Completed: 33.480917ms
├─ Workers:   0=13 1=12 2=13 3=12 4=13 5=13 6=12 7=12
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      801.657µs
├─ Worst:     80.828805ms
├─ Completed: 96.837446ms
├─ Workers:   0=12 1=13 2=12 3=13 4=12 5=13 6=12 7=13
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      833.592µs
├─ Worst:     80.726935ms
├─ Completed: 93.013836ms
├─ Workers:   0=15 1=14 2=14 3=11 4=7 5=13 6=15 7=11
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      816.869µs
├─ Worst:     36.086454ms
├─ Completed: 50.006071ms
├─ Workers:   0=12 1=13 2=13 3=13 4=13 5=12 6=11 7=13
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      824.85µs
├─ Worst:     20.454733ms
├─ Completed: 39.389607ms
├─ Workers:   0=12 1=11 2=13 3=13 4=13 5=13 6=12 7=13
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      631.712µs
├─ Worst:     36.143514ms
├─ Completed: 48.791743ms
├─ Workers:   0=13 1=13 2=12 3=13 4=12 5=12 6=13 7=12
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      872.716µs
├─ Worst:     36.289296ms
├─ Completed: 50.22967ms
├─ Workers:   0=12 1=12 2=13 3=12 4=13 5=13 6=12 7=13
└─ Errors:    0
```
#### deleting 100 users - with cascade deleting all associated posts [conc:10, rule:`""`]
```
┌─ Best:      69.686685ms
├─ Worst:     7.538641139s
├─ Completed: 10.249381782s
├─ Workers:   0=12 1=14 2=13 3=12 4=8 5=13 6=11 7=17
└─ Errors:    0
```
#### deleting 100 organizations - with cascade deleting all users and associated posts [conc:10, rule:`""`]
```
┌─ Best:      52.170671ms
├─ Worst:     11.023426765s
├─ Completed: 20.834697466s
├─ Workers:   0=13 1=13 2=13 3=11 4=13 5=12 6=13 7=12
└─ Errors:    0
```

---------------------------------------------------
Completed!
