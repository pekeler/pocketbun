# PocketBun Upstream-Port Benchmark Result

- machine: hetzner-8vcpu-pocketbun-8
- timestamp: 2026-08-27T13:45:12.557Z
- tests: create,auth,search,custom,delete
- benchmark source: 05625dc2b2d3f9711c51566010944b10ca9531fa
- server workers: 8
- load generator: http://load-generator:19231
- benchmark target host: application-host
- warmup request target/cap: 1000
## Creating organizations (100)
#### Creating 50 organizations [reqs:50, conc:10, rule:`""`]
```
┌─ Best:      688.512µs
├─ Worst:     6.037701ms
├─ Completed: 9.922587ms
├─ Workers:   0=6 1=8 2=8 4=8 5=4 6=8 7=8
└─ Errors:    0
```
#### Creating 50 organizations [reqs:50, conc:10, rule:`"@request.body.name != ''"`]
```
┌─ Best:      894.595µs
├─ Worst:     6.438775ms
├─ Completed: 14.182232ms
├─ Workers:   0=9 1=13 4=6 5=6 6=9 7=7
└─ Errors:    0
```

## Creating permissions (50)
#### Creating 25 permissions [reqs:25, conc:5, rule:`""`]
```
┌─ Best:      629.109µs
├─ Worst:     4.314069ms
├─ Completed: 7.487403ms
├─ Workers:   0=2 1=9 5=9 6=5
└─ Errors:    0
```
#### Creating 25 permissions [reqs:25, conc:5, rule:`"@request.body.name != ''"`]
```
┌─ Best:      930.755µs
├─ Worst:     2.757068ms
├─ Completed: 8.555118ms
├─ Workers:   1=13 5=12
└─ Errors:    0
```

## Creating users (500 - expected to be slow due to passwordHash generation)
#### Creating 250 users [reqs:250, conc:50, rule:`""`]
```
┌─ Best:      96.426876ms
├─ Worst:     830.267973ms
├─ Completed: 2.075300701s
├─ Workers:   0=23 1=43 2=28 3=26 4=27 5=53 6=25 7=25
└─ Errors:    0
```
#### Creating 250 users [reqs:250, conc:50, rule:`"@request.body.email != '' && @request.body.permissions:length > 0"`]
```
┌─ Best:      130.55384ms
├─ Worst:     860.702916ms
├─ Completed: 2.071062507s
├─ Workers:   0=36 1=23 2=40 3=36 4=40 5=10 6=30 7=35
└─ Errors:    0
```

## Creating posts (10k, 25k, 50k, 100k)
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`""`]
```
┌─ Best:      451.023µs
├─ Worst:     339.099772ms
├─ Completed: 395.531116ms
├─ Workers:   0=430 1=674 2=653 3=626 4=652 5=746 6=571 7=648
└─ Errors:    0
```
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      654.234µs
├─ Worst:     386.008401ms
├─ Completed: 464.037333ms
├─ Workers:   0=681 1=527 2=621 3=523 4=593 5=653 6=663 7=739
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`""`]
```
┌─ Best:      932.047µs
├─ Worst:     628.620792ms
├─ Completed: 808.18717ms
├─ Workers:   0=1595 1=1796 2=1554 3=1330 4=1516 5=1679 6=1464 7=1566
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      571.68µs
├─ Worst:     386.025204ms
├─ Completed: 986.424771ms
├─ Workers:   0=1544 1=1893 2=1425 3=1213 4=1525 5=1688 6=1499 7=1713
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`""`]
```
┌─ Best:      4.156031ms
├─ Worst:     432.322271ms
├─ Completed: 1.685772698s
├─ Workers:   0=3056 1=3649 2=3099 3=2652 4=3036 5=3485 6=2851 7=3172
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      568.756µs
├─ Worst:     511.578718ms
├─ Completed: 1.812550743s
├─ Workers:   0=3090 1=3351 2=3001 3=2871 4=2976 5=3409 6=3030 7=3272
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`""`]
```
┌─ Best:      2.235678ms
├─ Worst:     753.768374ms
├─ Completed: 2.840298378s
├─ Workers:   0=6236 1=7382 2=6140 3=5281 4=6015 5=6774 6=5760 7=6412
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      7.771446ms
├─ Worst:     781.82952ms
├─ Completed: 3.440786027s
├─ Workers:   0=6238 1=7122 2=6124 3=5379 4=6113 5=6931 6=5905 7=6188
└─ Errors:    0
```

## User auth with password (expected to be slow due to passwordHash verification)
#### users auth with email/pass - high concurrency [reqs:250, conc:250]
```
┌─ Best:      416.54106ms
├─ Worst:     2.030964836s
├─ Completed: 2.031294912s
├─ Workers:   0=30 1=24 2=27 3=37 4=41 5=37 6=26 7=28
└─ Errors:    0
```
#### users auth with email/pass - small concurrency [reqs:250, conc:10]
```
┌─ Best:      63.099137ms
├─ Worst:     140.342463ms
├─ Completed: 2.091099136s
├─ Workers:   0=29 1=35 2=42 3=13 4=44 5=41 6=30 7=16
└─ Errors:    0
```

## User auth refresh
#### users - auth refresh (high concurrency) [reqs:1000, conc:1000]
```
┌─ Best:      25.987099ms
├─ Worst:     75.869368ms
├─ Completed: 77.572239ms
├─ Workers:   0=127 1=158 2=116 3=110 4=97 5=128 6=119 7=145
└─ Errors:    0
```
#### users - auth refresh (medium concurrency) [reqs:1000, conc:100]
```
┌─ Best:      610.123µs
├─ Worst:     20.045212ms
├─ Completed: 58.558925ms
├─ Workers:   0=141 1=141 2=132 3=127 4=156 5=155 6=49 7=99
└─ Errors:    0
```

## List records
#### users - getOne for auth refresh comparison (medium concurrency) [reqs:1000, conc:100, rule:`""`, query:`/brva1mcv8fsb94i`]
```
┌─ Best:      523.884µs
├─ Worst:     22.217582ms
├─ Completed: 62.685997ms
├─ Workers:   0=123 1=155 2=131 3=91 4=115 5=144 6=139 7=102
└─ Errors:    0
```
#### users - getOne for auth refresh comparison (high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`/brva1mcv8fsb94i`]
```
┌─ Best:      30.210184ms
├─ Worst:     59.654628ms
├─ Completed: 61.532153ms
├─ Workers:   0=133 1=155 2=78 3=91 4=121 5=127 6=141 7=154
└─ Errors:    0
```
#### posts10k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      801.767µs
├─ Worst:     6.367898ms
├─ Completed: 1.779160066s
├─ Workers:   0=119 1=96 2=160 3=133 4=71 5=158 6=124 7=139
└─ Errors:    0
```
#### posts10k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      25.156202ms
├─ Worst:     190.851317ms
├─ Completed: 192.35142ms
├─ Workers:   0=117 1=173 2=141 3=100 4=131 5=136 6=98 7=104
└─ Errors:    0
```
#### posts10k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      35.971923ms
├─ Worst:     121.447852ms
├─ Completed: 123.540694ms
├─ Workers:   0=145 1=82 2=112 3=134 4=111 5=141 6=149 7=126
└─ Errors:    0
```
#### posts10k - mixed read and write (simpleA list with additional 300 concurrent random posts10k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      36.832791ms
├─ Worst:     178.78692ms
├─ Completed: 181.37816ms
├─ Workers:   0=145 1=82 2=112 3=134 4=111 5=141 6=149 7=126
└─ Errors:    0
```
#### posts10k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.956354ms
├─ Worst:     17.806238ms
├─ Completed: 60.491375ms
├─ Workers:   0=16 1=16 2=10 3=2 4=21 5=18 7=17
└─ Errors:    0
```
#### posts10k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      1.910809ms
├─ Worst:     18.006264ms
├─ Completed: 79.376784ms
├─ Workers:   0=9 1=16 2=16 4=24 5=20 7=15
└─ Errors:    0
```
#### posts10k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      1.892634ms
├─ Worst:     20.964291ms
├─ Completed: 77.576255ms
├─ Workers:   0=11 1=28 2=26 3=4 4=11 5=11 6=2 7=7
└─ Errors:    0
```
#### posts10k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      3.339764ms
├─ Worst:     31.650693ms
├─ Completed: 112.692798ms
├─ Workers:   0=13 1=35 2=10 3=4 4=11 5=12 6=4 7=11
└─ Errors:    0
```
#### posts10k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.498249ms
├─ Worst:     16.484322ms
├─ Completed: 51.11364ms
├─ Workers:   0=19 1=24 2=11 3=3 4=13 5=12 6=6 7=12
└─ Errors:    0
```
#### posts10k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.539508ms
├─ Worst:     35.980644ms
├─ Completed: 97.409975ms
├─ Workers:   0=20 1=15 2=14 3=7 4=14 5=15 6=3 7=12
└─ Errors:    0
```
#### posts10k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      945.216µs
├─ Worst:     8.9253ms
├─ Completed: 25.869898ms
├─ Workers:   0=17 1=14 2=14 3=5 4=16 5=12 6=5 7=17
└─ Errors:    0
```
#### posts10k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      891.952µs
├─ Worst:     9.063391ms
├─ Completed: 24.739276ms
├─ Workers:   0=15 1=15 2=14 3=5 4=15 5=16 6=5 7=15
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.407075ms
├─ Worst:     33.293092ms
├─ Completed: 95.259043ms
├─ Workers:   0=18 1=15 2=13 3=4 4=14 5=13 6=8 7=15
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.033367ms
├─ Worst:     7.979724ms
├─ Completed: 24.708943ms
├─ Workers:   0=18 1=14 2=13 3=11 4=12 5=3 6=15 7=14
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      869.391µs
├─ Worst:     8.96942ms
├─ Completed: 29.564922ms
├─ Workers:   0=5 1=1 2=13 3=11 4=5 5=22 6=20 7=23
└─ Errors:    0
```
#### posts10k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      1.938368ms
├─ Worst:     32.679455ms
├─ Completed: 144.707602ms
├─ Workers:   2=6 3=25 5=26 6=36 7=7
└─ Errors:    0
```
#### posts10k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      1.764458ms
├─ Worst:     37.465667ms
├─ Completed: 122.260625ms
├─ Workers:   3=55 6=45
└─ Errors:    0
```
#### posts10k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      944.034µs
├─ Worst:     4.018621ms
├─ Completed: 21.617582ms
├─ Workers:   0=16 1=16 2=10 3=2 4=21 5=18 7=17
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      14.31872ms
├─ Worst:     103.153569ms
├─ Completed: 484.139292ms
├─ Workers:   0=9 1=16 2=16 4=24 5=20 7=15
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.016143ms
├─ Worst:     11.551338ms
├─ Completed: 39.624548ms
├─ Workers:   0=11 1=28 2=26 3=4 4=11 5=11 6=2 7=7
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      6.41348ms
├─ Worst:     65.098538ms
├─ Completed: 293.536127ms
├─ Workers:   0=13 1=35 2=10 3=4 4=11 5=12 6=4 7=11
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.004137ms
├─ Worst:     6.173508ms
├─ Completed: 26.676993ms
├─ Workers:   0=19 1=24 2=11 3=3 4=13 5=12 6=6 7=12
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      8.207348ms
├─ Worst:     59.790737ms
├─ Completed: 222.470926ms
├─ Workers:   0=20 1=15 2=14 3=7 4=14 5=15 6=3 7=12
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.02079ms
├─ Worst:     5.29818ms
├─ Completed: 25.409051ms
├─ Workers:   0=17 1=14 2=14 3=5 4=16 5=12 6=5 7=17
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      36.214838ms
├─ Worst:     195.029127ms
├─ Completed: 993.527083ms
├─ Workers:   0=15 1=15 2=14 3=5 4=15 5=16 6=5 7=15
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.110255ms
├─ Worst:     11.881804ms
├─ Completed: 57.435793ms
├─ Workers:   0=18 1=15 2=13 3=4 4=14 5=13 6=8 7=15
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      96.403715ms
├─ Worst:     556.299835ms
├─ Completed: 2.624541267s
├─ Workers:   0=18 1=14 2=13 3=11 4=12 5=3 6=15 7=14
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.507191ms
├─ Worst:     10.707712ms
├─ Completed: 50.718144ms
├─ Workers:   0=5 1=1 2=13 3=11 4=5 5=22 6=20 7=23
└─ Errors:    0
```
#### posts25k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.139635ms
├─ Worst:     6.809347ms
├─ Completed: 2.629068241s
├─ Workers:   0=120 1=163 2=121 3=110 4=125 5=142 6=106 7=113
└─ Errors:    0
```
#### posts25k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      23.467438ms
├─ Worst:     222.508279ms
├─ Completed: 224.215707ms
├─ Workers:   0=109 1=149 2=118 3=119 4=111 5=137 6=136 7=121
└─ Errors:    0
```
#### posts25k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      41.418977ms
├─ Worst:     139.445192ms
├─ Completed: 141.620758ms
├─ Workers:   0=137 1=130 2=129 3=103 4=127 5=129 6=115 7=130
└─ Errors:    0
```
#### posts25k - mixed read and write (simpleA list with additional 300 concurrent random posts25k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      29.869553ms
├─ Worst:     256.999357ms
├─ Completed: 258.785203ms
├─ Workers:   0=137 1=130 2=129 3=103 4=127 5=129 6=115 7=130
└─ Errors:    0
```
#### posts25k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      2.143001ms
├─ Worst:     16.416608ms
├─ Completed: 69.781107ms
├─ Workers:   0=17 1=11 2=5 3=14 4=13 5=11 6=13 7=16
└─ Errors:    0
```
#### posts25k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      1.81686ms
├─ Worst:     28.531906ms
├─ Completed: 98.870251ms
├─ Workers:   0=11 1=23 2=9 3=19 4=9 5=13 6=10 7=6
└─ Errors:    0
```
#### posts25k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      1.568857ms
├─ Worst:     25.850511ms
├─ Completed: 106.529142ms
├─ Workers:   0=6 1=23 2=18 3=8 4=8 5=27 6=7 7=3
└─ Errors:    0
```
#### posts25k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      2.906004ms
├─ Worst:     20.098945ms
├─ Completed: 93.774623ms
├─ Workers:   0=13 1=13 2=10 3=13 4=13 5=13 6=14 7=11
└─ Errors:    0
```
#### posts25k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.200529ms
├─ Worst:     18.048903ms
├─ Completed: 64.134346ms
├─ Workers:   0=12 1=11 2=9 3=11 4=11 5=10 6=25 7=11
└─ Errors:    0
```
#### posts25k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      6.725882ms
├─ Worst:     67.498003ms
├─ Completed: 167.032233ms
├─ Workers:   0=14 1=7 2=11 3=14 4=14 5=13 6=13 7=14
└─ Errors:    0
```
#### posts25k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      851.757µs
├─ Worst:     6.725741ms
├─ Completed: 24.603017ms
├─ Workers:   0=14 1=15 2=6 3=13 4=13 5=13 6=13 7=13
└─ Errors:    0
```
#### posts25k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      939.057µs
├─ Worst:     6.653982ms
├─ Completed: 24.693052ms
├─ Workers:   0=14 1=13 2=5 3=14 4=14 5=12 6=14 7=14
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      6.90711ms
├─ Worst:     62.516661ms
├─ Completed: 158.54603ms
├─ Workers:   0=14 1=14 2=5 3=14 4=14 5=12 6=14 7=13
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      957.343µs
├─ Worst:     8.583397ms
├─ Completed: 28.432677ms
├─ Workers:   0=13 1=13 2=5 3=16 4=13 5=13 6=14 7=13
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      871.855µs
├─ Worst:     8.974187ms
├─ Completed: 27.352956ms
├─ Workers:   0=16 1=16 2=12 4=16 5=14 6=12 7=14
└─ Errors:    0
```
#### posts25k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      8.887948ms
├─ Worst:     66.25077ms
├─ Completed: 253.765007ms
├─ Workers:   0=15 1=21 2=14 4=18 5=16 7=16
└─ Errors:    0
```
#### posts25k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      6.1454ms
├─ Worst:     55.740342ms
├─ Completed: 303.34571ms
├─ Workers:   0=2 1=13 2=51 5=13 7=21
└─ Errors:    0
```
#### posts25k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.000872ms
├─ Worst:     7.57178ms
├─ Completed: 26.796347ms
├─ Workers:   0=17 1=11 2=5 3=14 4=13 5=11 6=13 7=16
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      36.087391ms
├─ Worst:     280.561284ms
├─ Completed: 1.102074051s
├─ Workers:   0=11 1=23 2=9 3=19 4=9 5=13 6=10 7=6
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.0857ms
├─ Worst:     13.816446ms
├─ Completed: 43.04896ms
├─ Workers:   0=6 1=23 2=18 3=8 4=8 5=27 6=7 7=3
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      13.941339ms
├─ Worst:     97.076884ms
├─ Completed: 394.862033ms
├─ Workers:   0=13 1=13 2=10 3=13 4=13 5=13 6=14 7=11
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.007201ms
├─ Worst:     5.224046ms
├─ Completed: 25.706031ms
├─ Workers:   0=12 1=11 2=9 3=11 4=11 5=10 6=25 7=11
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      19.788627ms
├─ Worst:     104.070086ms
├─ Completed: 482.565658ms
├─ Workers:   0=14 1=7 2=11 3=14 4=14 5=13 6=13 7=14
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.116483ms
├─ Worst:     6.070877ms
├─ Completed: 25.445139ms
├─ Workers:   0=14 1=15 2=6 3=13 4=13 5=13 6=13 7=13
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      97.46564ms
├─ Worst:     448.073531ms
├─ Completed: 2.376735111s
├─ Workers:   0=14 1=13 2=5 3=14 4=14 5=12 6=14 7=14
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.291134ms
├─ Worst:     18.425983ms
├─ Completed: 64.523745ms
├─ Workers:   0=14 1=14 2=5 3=14 4=14 5=12 6=14 7=13
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      240.989159ms
├─ Worst:     1.757297354s
├─ Completed: 7.452170974s
├─ Workers:   0=13 1=13 2=5 3=16 4=13 5=13 6=14 7=13
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.657319ms
├─ Worst:     11.817035ms
├─ Completed: 44.149009ms
├─ Workers:   0=16 1=16 2=12 4=16 5=14 6=12 7=14
└─ Errors:    0
```
#### posts50k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      2.005971ms
├─ Worst:     11.684851ms
├─ Completed: 4.968786744s
├─ Workers:   0=118 1=150 2=138 3=106 4=113 5=141 6=109 7=125
└─ Errors:    0
```
#### posts50k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      24.384407ms
├─ Worst:     409.331601ms
├─ Completed: 411.171513ms
├─ Workers:   0=119 1=158 2=138 3=95 4=115 5=142 6=109 7=124
└─ Errors:    0
```
#### posts50k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      23.58384ms
├─ Worst:     101.13449ms
├─ Completed: 103.547734ms
├─ Workers:   0=131 1=125 2=105 3=124 4=134 5=122 6=129 7=130
└─ Errors:    0
```
#### posts50k - mixed read and write (simpleA list with additional 300 concurrent random posts50k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      29.904411ms
├─ Worst:     420.271895ms
├─ Completed: 421.931176ms
├─ Workers:   0=131 1=125 2=105 3=124 4=134 5=122 6=129 7=130
└─ Errors:    0
```
#### posts50k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      2.417929ms
├─ Worst:     20.929553ms
├─ Completed: 88.629166ms
├─ Workers:   0=16 1=11 2=8 3=11 4=18 5=3 6=16 7=17
└─ Errors:    0
```
#### posts50k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      2.515956ms
├─ Worst:     30.861042ms
├─ Completed: 129.984353ms
├─ Workers:   0=14 1=26 2=14 3=6 4=4 5=15 6=3 7=18
└─ Errors:    0
```
#### posts50k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      2.511029ms
├─ Worst:     28.356983ms
├─ Completed: 132.542608ms
├─ Workers:   0=4 1=26 2=30 3=3 4=3 5=23 6=7 7=4
└─ Errors:    0
```
#### posts50k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      4.318305ms
├─ Worst:     41.823747ms
├─ Completed: 149.767101ms
├─ Workers:   0=11 1=10 2=11 3=11 4=13 5=24 6=11 7=9
└─ Errors:    0
```
#### posts50k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      2.12109ms
├─ Worst:     17.840226ms
├─ Completed: 74.829792ms
├─ Workers:   0=13 1=13 2=13 3=14 4=9 5=12 6=13 7=13
└─ Errors:    0
```
#### posts50k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      19.895144ms
├─ Worst:     99.857296ms
├─ Completed: 383.868465ms
├─ Workers:   0=13 1=12 2=12 3=13 4=14 5=10 6=14 7=12
└─ Errors:    0
```
#### posts50k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.043542ms
├─ Worst:     7.825641ms
├─ Completed: 23.101543ms
├─ Workers:   0=13 1=12 2=13 3=13 4=13 5=11 6=13 7=12
└─ Errors:    0
```
#### posts50k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      965.324µs
├─ Worst:     6.272646ms
├─ Completed: 22.544193ms
├─ Workers:   0=13 1=12 2=12 3=13 4=13 5=11 6=13 7=13
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      18.80746ms
├─ Worst:     100.16579ms
├─ Completed: 381.660727ms
├─ Workers:   0=13 1=13 2=13 3=13 4=13 5=10 6=13 7=12
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.061597ms
├─ Worst:     5.214153ms
├─ Completed: 22.577579ms
├─ Workers:   0=13 1=12 2=12 3=13 4=12 5=11 6=14 7=13
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      883.991µs
├─ Worst:     5.865834ms
├─ Completed: 22.26713ms
├─ Workers:   0=14 1=12 2=12 3=13 4=13 5=11 6=13 7=12
└─ Errors:    0
```
#### posts50k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      19.996353ms
├─ Worst:     105.772886ms
├─ Completed: 431.883515ms
├─ Workers:   0=16 1=12 2=10 3=13 4=13 5=10 6=12 7=14
└─ Errors:    0
```
#### posts50k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      12.192442ms
├─ Worst:     92.421542ms
├─ Completed: 437.211885ms
├─ Workers:   0=8 1=22 4=18 5=29 6=7 7=16
└─ Errors:    0
```
#### posts50k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      931.456µs
├─ Worst:     8.703203ms
├─ Completed: 23.400286ms
├─ Workers:   0=16 1=11 2=8 3=11 4=18 5=3 6=16 7=17
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      81.181136ms
├─ Worst:     574.833669ms
├─ Completed: 2.571978575s
├─ Workers:   0=14 1=26 2=14 3=6 4=4 5=15 6=3 7=18
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.156467ms
├─ Worst:     11.583963ms
├─ Completed: 38.5753ms
├─ Workers:   0=4 1=26 2=30 3=3 4=3 5=23 6=7 7=4
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      33.830375ms
├─ Worst:     361.138729ms
├─ Completed: 1.128325375s
├─ Workers:   0=11 1=10 2=11 3=11 4=13 5=24 6=11 7=9
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.115931ms
├─ Worst:     7.897871ms
├─ Completed: 24.550936ms
├─ Workers:   0=13 1=13 2=13 3=14 4=9 5=12 6=13 7=13
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      46.428009ms
├─ Worst:     192.078339ms
├─ Completed: 971.36321ms
├─ Workers:   0=13 1=12 2=12 3=13 4=14 5=10 6=14 7=12
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.029783ms
├─ Worst:     5.11774ms
├─ Completed: 22.313395ms
├─ Workers:   0=13 1=12 2=13 3=13 4=13 5=11 6=13 7=12
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      204.975985ms
├─ Worst:     736.168097ms
├─ Completed: 4.403900672s
├─ Workers:   0=13 1=12 2=12 3=13 4=13 5=11 6=13 7=13
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.744721ms
├─ Worst:     10.828439ms
├─ Completed: 55.737289ms
├─ Workers:   0=13 1=13 2=13 3=13 4=13 5=10 6=13 7=12
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      532.639139ms
├─ Worst:     2.764402718s
├─ Completed: 12.608133695s
├─ Workers:   0=13 1=12 2=12 3=13 4=12 5=11 6=14 7=13
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.796622ms
├─ Worst:     11.865071ms
├─ Completed: 44.202053ms
├─ Workers:   0=14 1=12 2=12 3=13 4=13 5=11 6=13 7=12
└─ Errors:    0
```
#### posts100k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      4.100884ms
├─ Worst:     16.340103ms
├─ Completed: 8.741018398s
├─ Workers:   0=121 1=156 2=123 3=97 4=118 5=148 6=109 7=128
└─ Errors:    0
```
#### posts100k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      28.952506ms
├─ Worst:     761.049339ms
├─ Completed: 763.272879ms
├─ Workers:   0=122 1=157 2=123 3=97 4=116 5=148 6=109 7=128
└─ Errors:    0
```
#### posts100k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      33.227493ms
├─ Worst:     120.536295ms
├─ Completed: 122.314882ms
├─ Workers:   0=120 1=125 2=123 3=127 4=128 5=122 6=129 7=126
└─ Errors:    0
```
#### posts100k - mixed read and write (simpleA list with additional 300 concurrent random posts100k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      35.594793ms
├─ Worst:     728.195932ms
├─ Completed: 729.842518ms
├─ Workers:   0=120 1=125 2=123 3=127 4=128 5=122 6=129 7=126
└─ Errors:    0
```
#### posts100k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      4.060098ms
├─ Worst:     45.178891ms
├─ Completed: 133.145094ms
├─ Workers:   0=16 1=13 2=16 3=9 4=10 5=16 6=6 7=14
└─ Errors:    0
```
#### posts100k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      3.967862ms
├─ Worst:     51.443187ms
├─ Completed: 159.601513ms
├─ Workers:   0=11 1=14 2=10 4=12 5=22 6=8 7=23
└─ Errors:    0
```
#### posts100k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      4.283808ms
├─ Worst:     48.432848ms
├─ Completed: 234.714478ms
├─ Workers:   0=14 1=43 2=9 3=1 4=3 5=19 6=6 7=5
└─ Errors:    0
```
#### posts100k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      6.880084ms
├─ Worst:     43.988469ms
├─ Completed: 135.647041ms
├─ Workers:   0=12 1=12 2=11 3=11 4=13 5=17 6=12 7=12
└─ Errors:    0
```
#### posts100k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      4.574249ms
├─ Worst:     32.327339ms
├─ Completed: 103.750777ms
├─ Workers:   0=13 1=13 2=13 3=11 4=13 5=12 6=12 7=13
└─ Errors:    0
```
#### posts100k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      36.13562ms
├─ Worst:     145.296081ms
├─ Completed: 666.515794ms
├─ Workers:   0=12 1=13 2=13 3=12 4=12 5=13 6=13 7=12
└─ Errors:    0
```
#### posts100k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      945.806µs
├─ Worst:     6.993801ms
├─ Completed: 22.931128ms
├─ Workers:   0=13 1=12 2=13 3=12 4=13 5=12 6=12 7=13
└─ Errors:    0
```
#### posts100k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      937.496µs
├─ Worst:     7.713496ms
├─ Completed: 22.970893ms
├─ Workers:   0=12 1=13 2=12 3=11 4=13 5=13 6=13 7=13
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      32.435298ms
├─ Worst:     259.422811ms
├─ Completed: 825.785128ms
├─ Workers:   0=12 1=12 2=12 3=11 4=18 5=12 6=11 7=12
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      980.094µs
├─ Worst:     8.196583ms
├─ Completed: 24.774765ms
├─ Workers:   0=13 1=13 2=13 3=12 4=12 5=13 6=12 7=12
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      998.42µs
├─ Worst:     6.845957ms
├─ Completed: 23.424249ms
├─ Workers:   0=12 1=12 2=13 3=12 4=13 5=12 6=13 7=13
└─ Errors:    0
```
#### posts100k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      33.713904ms
├─ Worst:     154.40877ms
├─ Completed: 725.874575ms
├─ Workers:   0=12 1=13 2=12 3=12 4=13 5=13 6=12 7=13
└─ Errors:    0
```
#### posts100k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      29.274301ms
├─ Worst:     224.200415ms
├─ Completed: 885.606039ms
├─ Workers:   0=9 1=10 2=13 3=22 4=11 5=6 6=19 7=10
└─ Errors:    0
```
#### posts100k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      989.167µs
├─ Worst:     7.219483ms
├─ Completed: 20.942412ms
├─ Workers:   0=16 1=13 2=16 3=9 4=10 5=16 6=6 7=14
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      180.565403ms
├─ Worst:     1.056927241s
├─ Completed: 5.107826062s
├─ Workers:   0=11 1=14 2=10 4=12 5=22 6=8 7=23
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.168003ms
├─ Worst:     10.2501ms
├─ Completed: 44.348955ms
├─ Workers:   0=14 1=43 2=9 3=1 4=3 5=19 6=6 7=5
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      69.013971ms
├─ Worst:     498.958111ms
├─ Completed: 1.81817911s
├─ Workers:   0=12 1=12 2=11 3=11 4=13 5=17 6=12 7=12
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      633.306µs
├─ Worst:     8.039086ms
├─ Completed: 25.667299ms
├─ Workers:   0=13 1=13 2=13 3=11 4=13 5=12 6=12 7=13
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      98.795272ms
├─ Worst:     315.563099ms
├─ Completed: 1.758977096s
├─ Workers:   0=12 1=13 2=13 3=12 4=12 5=13 6=13 7=12
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.101491ms
├─ Worst:     4.477025ms
├─ Completed: 23.353582ms
├─ Workers:   0=13 1=12 2=13 3=12 4=13 5=12 6=12 7=13
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      470.653999ms
├─ Worst:     1.476932542s
├─ Completed: 9.606775884s
├─ Workers:   0=12 1=13 2=12 3=11 4=13 5=13 6=13 7=13
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.224243ms
├─ Worst:     13.328903ms
├─ Completed: 67.991827ms
├─ Workers:   0=12 1=12 2=12 3=11 4=18 5=12 6=11 7=12
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      1.124181871s
├─ Worst:     4.286700431s
├─ Completed: 27.005471831s
├─ Workers:   0=13 1=13 2=13 3=12 4=12 5=13 6=12 7=12
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.596025ms
├─ Worst:     11.250863ms
├─ Completed: 42.860769ms
├─ Workers:   0=12 1=12 2=13 3=12 4=13 5=12 6=13 7=13
└─ Errors:    0
```

## Go vs JS route execution
#### JS route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      51.835159ms
├─ Worst:     1.031188214s
├─ Completed: 1.032685663s
├─ Workers:   0=62 1=93 2=60 3=44 4=49 5=76 6=51 7=65
└─ Errors:    0
```
#### Go route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      32.331664ms
├─ Worst:     827.275269ms
├─ Completed: 828.191295ms
├─ Workers:   0=62 1=63 2=62 3=57 4=64 5=67 6=62 7=63
└─ Errors:    0
```
#### JS route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      22.75937ms
├─ Worst:     157.309096ms
├─ Completed: 862.002842ms
├─ Workers:   0=62 1=63 2=63 3=59 4=68 5=62 6=61 7=62
└─ Errors:    0
```
#### Go route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      11.872991ms
├─ Worst:     347.841689ms
├─ Completed: 971.468923ms
├─ Workers:   0=61 1=92 2=60 3=45 4=49 5=77 6=51 7=65
└─ Errors:    0
```
#### JS route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      8.979644ms
├─ Worst:     23.450325ms
├─ Completed: 9.158457898s
├─ Workers:   0=63 1=63 2=62 3=58 4=64 5=66 6=61 7=63
└─ Errors:    0
```
#### Go route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      7.885984ms
├─ Worst:     55.597275ms
├─ Completed: 9.146709842s
├─ Workers:   0=63 1=64 2=64 3=53 4=67 5=64 6=63 7=62
└─ Errors:    0
```

## Go vs JS hooks execution
#### JS OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      906.913µs
├─ Worst:     11.447874ms
├─ Completed: 26.385679ms
├─ Workers:   0=16 1=19 2=13 3=5 4=5 5=20 6=5 7=17
└─ Errors:    0
```
#### Go OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      850.365µs
├─ Worst:     10.886679ms
├─ Completed: 27.498779ms
├─ Workers:   0=12 1=13 2=13 3=12 4=12 5=13 6=12 7=13
└─ Errors:    0
```

## Deleting records
#### deleting 100 posts10k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      643.44µs
├─ Worst:     57.198308ms
├─ Completed: 67.852235ms
├─ Workers:   0=7 1=34 2=8 3=8 4=8 5=17 6=8 7=10
└─ Errors:    0
```
#### deleting 100 posts10k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      526.027µs
├─ Worst:     80.922823ms
├─ Completed: 95.409906ms
├─ Workers:   0=12 1=13 2=13 3=13 4=12 5=12 6=12 7=13
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      727.676µs
├─ Worst:     55.540126ms
├─ Completed: 67.553373ms
├─ Workers:   0=12 1=13 2=12 3=12 4=13 5=13 6=13 7=12
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      751.728µs
├─ Worst:     35.364394ms
├─ Completed: 46.514217ms
├─ Workers:   0=14 1=12 2=12 3=7 4=14 5=16 6=12 7=13
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      733.394µs
├─ Worst:     10.062631ms
├─ Completed: 32.40749ms
├─ Workers:   0=13 1=13 2=12 3=13 4=12 5=12 6=12 7=13
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      790.092µs
├─ Worst:     81.663535ms
├─ Completed: 95.963969ms
├─ Workers:   0=12 1=12 2=13 3=13 4=13 5=13 6=12 7=12
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      765.848µs
├─ Worst:     81.415502ms
├─ Completed: 90.51988ms
├─ Workers:   0=13 1=12 2=13 3=12 4=12 5=13 6=12 7=13
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      831.078µs
├─ Worst:     80.715534ms
├─ Completed: 95.700286ms
├─ Workers:   0=12 1=13 2=13 3=13 4=13 5=12 6=12 7=12
└─ Errors:    0
```
#### deleting 100 users - with cascade deleting all associated posts [conc:10, rule:`""`]
```
┌─ Best:      68.347099ms
├─ Worst:     5.464583152s
├─ Completed: 9.922060963s
├─ Workers:   0=12 1=13 2=12 3=8 4=18 5=12 6=13 7=12
└─ Errors:    0
```
#### deleting 100 organizations - with cascade deleting all users and associated posts [conc:10, rule:`""`]
```
┌─ Best:      61.214676ms
├─ Worst:     6.76120148s
├─ Completed: 19.825778586s
├─ Workers:   0=13 1=13 2=13 3=12 4=12 5=13 6=12 7=12
└─ Errors:    0
```

---------------------------------------------------
Completed!
