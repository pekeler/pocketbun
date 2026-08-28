# PocketBun Upstream-Port Benchmark Result

- machine: hetzner-8vcpu-pocketbun-6
- timestamp: 2026-08-27T20:28:17.241Z
- tests: create,auth,search,custom,delete
- benchmark source: 05625dc2b2d3f9711c51566010944b10ca9531fa
- server workers: 6
- load generator: http://load-generator:19231
- benchmark target host: application-host
- warmup request target/cap: 1000
## Creating organizations (100)
#### Creating 50 organizations [reqs:50, conc:10, rule:`""`]
```
┌─ Best:      684.295µs
├─ Worst:     5.30484ms
├─ Completed: 12.591033ms
├─ Workers:   0=8 1=8 2=8 3=8 4=9 5=9
└─ Errors:    0
```
#### Creating 50 organizations [reqs:50, conc:10, rule:`"@request.body.name != ''"`]
```
┌─ Best:      720.574µs
├─ Worst:     7.384639ms
├─ Completed: 13.644457ms
├─ Workers:   0=7 1=9 2=11 3=9 4=5 5=9
└─ Errors:    0
```

## Creating permissions (50)
#### Creating 25 permissions [reqs:25, conc:5, rule:`""`]
```
┌─ Best:      590.224µs
├─ Worst:     8.451192ms
├─ Completed: 12.387824ms
├─ Workers:   0=3 1=6 2=4 3=5 5=7
└─ Errors:    0
```
#### Creating 25 permissions [reqs:25, conc:5, rule:`"@request.body.name != ''"`]
```
┌─ Best:      792.815µs
├─ Worst:     3.257616ms
├─ Completed: 8.938563ms
├─ Workers:   1=6 2=7 3=6 5=6
└─ Errors:    0
```

## Creating users (500 - expected to be slow due to passwordHash generation)
#### Creating 250 users [reqs:250, conc:50, rule:`""`]
```
┌─ Best:      81.690082ms
├─ Worst:     800.12117ms
├─ Completed: 2.067403902s
├─ Workers:   0=39 1=72 2=33 3=40 4=29 5=37
└─ Errors:    0
```
#### Creating 250 users [reqs:250, conc:50, rule:`"@request.body.email != '' && @request.body.permissions:length > 0"`]
```
┌─ Best:      191.414466ms
├─ Worst:     983.264775ms
├─ Completed: 2.060745945s
├─ Workers:   0=54 1=2 2=59 3=47 4=44 5=44
└─ Errors:    0
```

## Creating posts (10k, 25k, 50k, 100k)
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`""`]
```
┌─ Best:      1.670446ms
├─ Worst:     328.889865ms
├─ Completed: 364.954339ms
├─ Workers:   0=854 1=792 2=1015 3=699 4=818 5=822
└─ Errors:    0
```
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      531.683µs
├─ Worst:     323.471878ms
├─ Completed: 428.636802ms
├─ Workers:   0=765 1=949 2=614 3=913 4=866 5=893
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`""`]
```
┌─ Best:      435.38µs
├─ Worst:     437.435582ms
├─ Completed: 726.738131ms
├─ Workers:   0=2247 1=2034 2=1692 3=2116 4=2027 5=2384
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      465.973µs
├─ Worst:     421.285468ms
├─ Completed: 985.476316ms
├─ Workers:   0=2155 1=1907 2=2259 3=2025 4=2159 5=1995
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`""`]
```
┌─ Best:      1.292353ms
├─ Worst:     488.102317ms
├─ Completed: 1.438309645s
├─ Workers:   0=3297 1=4134 2=4581 3=4533 4=4092 5=4363
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      453.366µs
├─ Worst:     561.805817ms
├─ Completed: 1.723422864s
├─ Workers:   0=4293 1=4037 2=4759 3=4381 4=3996 5=3534
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`""`]
```
┌─ Best:      580.451µs
├─ Worst:     595.639773ms
├─ Completed: 2.815647068s
├─ Workers:   0=8353 1=7839 2=8481 3=8526 4=7856 5=8945
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      700.066µs
├─ Worst:     568.415067ms
├─ Completed: 3.237358132s
├─ Workers:   0=8624 1=7522 2=7739 3=9940 4=8158 5=8017
└─ Errors:    0
```

## User auth with password (expected to be slow due to passwordHash verification)
#### users auth with email/pass - high concurrency [reqs:250, conc:250]
```
┌─ Best:      194.944217ms
├─ Worst:     2.053285921s
├─ Completed: 2.05356746s
├─ Workers:   0=29 1=44 2=47 3=70 4=36 5=24
└─ Errors:    0
```
#### users auth with email/pass - small concurrency [reqs:250, conc:10]
```
┌─ Best:      62.674323ms
├─ Worst:     135.054456ms
├─ Completed: 2.079533981s
├─ Workers:   0=44 1=57 2=30 3=54 4=26 5=39
└─ Errors:    0
```

## User auth refresh
#### users - auth refresh (high concurrency) [reqs:1000, conc:1000]
```
┌─ Best:      21.790408ms
├─ Worst:     68.552003ms
├─ Completed: 70.024856ms
├─ Workers:   0=177 1=133 2=190 3=133 4=186 5=181
└─ Errors:    0
```
#### users - auth refresh (medium concurrency) [reqs:1000, conc:100]
```
┌─ Best:      442.881µs
├─ Worst:     41.93131ms
├─ Completed: 79.155796ms
├─ Workers:   0=142 1=198 2=130 3=224 4=143 5=163
└─ Errors:    0
```

## List records
#### users - getOne for auth refresh comparison (medium concurrency) [reqs:1000, conc:100, rule:`""`, query:`/12olgoq13eqa81i`]
```
┌─ Best:      388.515µs
├─ Worst:     27.709975ms
├─ Completed: 69.065903ms
├─ Workers:   0=193 1=172 2=174 3=120 4=166 5=175
└─ Errors:    0
```
#### users - getOne for auth refresh comparison (high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`/12olgoq13eqa81i`]
```
┌─ Best:      26.354826ms
├─ Worst:     70.428642ms
├─ Completed: 71.893614ms
├─ Workers:   0=192 1=141 2=191 3=154 4=178 5=144
└─ Errors:    0
```
#### posts10k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      898.27µs
├─ Worst:     4.915253ms
├─ Completed: 1.681800378s
├─ Workers:   0=75 1=178 2=137 3=194 4=196 5=220
└─ Errors:    0
```
#### posts10k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      23.518873ms
├─ Worst:     181.210947ms
├─ Completed: 182.994998ms
├─ Workers:   0=186 1=144 2=181 3=170 4=145 5=174
└─ Errors:    0
```
#### posts10k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      23.200033ms
├─ Worst:     115.027423ms
├─ Completed: 116.582928ms
├─ Workers:   0=143 1=162 2=142 3=224 4=212 5=117
└─ Errors:    0
```
#### posts10k - mixed read and write (simpleA list with additional 300 concurrent random posts10k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      29.286051ms
├─ Worst:     187.191219ms
├─ Completed: 188.974199ms
├─ Workers:   0=143 1=162 2=142 3=224 4=212 5=117
└─ Errors:    0
```
#### posts10k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.728645ms
├─ Worst:     15.989585ms
├─ Completed: 61.47033ms
├─ Workers:   0=23 1=28 2=30 4=1 5=18
└─ Errors:    0
```
#### posts10k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      1.734623ms
├─ Worst:     19.046821ms
├─ Completed: 69.314936ms
├─ Workers:   0=25 1=14 2=24 3=4 4=9 5=24
└─ Errors:    0
```
#### posts10k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      2.303098ms
├─ Worst:     18.297749ms
├─ Completed: 76.421282ms
├─ Workers:   0=24 1=12 2=20 3=6 4=7 5=31
└─ Errors:    0
```
#### posts10k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      2.31077ms
├─ Worst:     32.72768ms
├─ Completed: 107.788444ms
├─ Workers:   0=14 1=22 2=15 3=10 4=15 5=24
└─ Errors:    0
```
#### posts10k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.445335ms
├─ Worst:     15.143116ms
├─ Completed: 48.406195ms
├─ Workers:   0=16 1=23 2=14 3=17 4=15 5=15
└─ Errors:    0
```
#### posts10k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.237097ms
├─ Worst:     38.764961ms
├─ Completed: 99.234902ms
├─ Workers:   0=15 1=23 2=15 3=17 4=15 5=15
└─ Errors:    0
```
#### posts10k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      719.602µs
├─ Worst:     5.055165ms
├─ Completed: 21.303316ms
├─ Workers:   0=14 1=21 2=22 3=15 4=14 5=14
└─ Errors:    0
```
#### posts10k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      795.589µs
├─ Worst:     4.048857ms
├─ Completed: 18.739287ms
├─ Workers:   0=15 1=23 2=15 3=18 4=14 5=15
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.932176ms
├─ Worst:     32.893348ms
├─ Completed: 88.547344ms
├─ Workers:   0=16 1=22 2=15 3=16 4=15 5=16
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      799.152µs
├─ Worst:     7.534667ms
├─ Completed: 28.230464ms
├─ Workers:   0=15 1=10 2=14 3=17 4=15 5=29
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      715.367µs
├─ Worst:     7.39891ms
├─ Completed: 23.230846ms
├─ Workers:   0=20 2=20 3=22 4=19 5=19
└─ Errors:    0
```
#### posts10k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      4.307445ms
├─ Worst:     38.339803ms
├─ Completed: 131.995977ms
├─ Workers:   0=24 2=21 3=28 4=27
└─ Errors:    0
```
#### posts10k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      1.689721ms
├─ Worst:     34.432602ms
├─ Completed: 128.07713ms
├─ Workers:   3=54 4=46
└─ Errors:    0
```
#### posts10k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      856.681µs
├─ Worst:     9.369439ms
├─ Completed: 33.636074ms
├─ Workers:   0=23 1=28 2=30 4=1 5=18
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      14.412848ms
├─ Worst:     81.499638ms
├─ Completed: 433.519419ms
├─ Workers:   0=25 1=14 2=24 3=4 4=9 5=24
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.059884ms
├─ Worst:     12.416333ms
├─ Completed: 38.205229ms
├─ Workers:   0=24 1=12 2=20 3=6 4=7 5=31
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      5.875527ms
├─ Worst:     67.586341ms
├─ Completed: 214.865434ms
├─ Workers:   0=14 1=22 2=15 3=10 4=15 5=24
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      969.768µs
├─ Worst:     9.129088ms
├─ Completed: 26.613213ms
├─ Workers:   0=16 1=23 2=14 3=17 4=15 5=15
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      7.78303ms
├─ Worst:     58.381288ms
├─ Completed: 239.275537ms
├─ Workers:   0=15 1=23 2=15 3=17 4=15 5=15
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      992.539µs
├─ Worst:     11.889205ms
├─ Completed: 34.428887ms
├─ Workers:   0=14 1=21 2=22 3=15 4=14 5=14
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      35.89515ms
├─ Worst:     223.206786ms
├─ Completed: 1.021344669s
├─ Workers:   0=15 1=23 2=15 3=18 4=14 5=15
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.907281ms
├─ Worst:     15.225709ms
├─ Completed: 53.634568ms
├─ Workers:   0=16 1=22 2=15 3=16 4=15 5=16
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      96.191781ms
├─ Worst:     915.286453ms
├─ Completed: 3.517384302s
├─ Workers:   0=15 1=10 2=14 3=17 4=15 5=29
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.562897ms
├─ Worst:     8.652749ms
├─ Completed: 44.571774ms
├─ Workers:   0=20 2=20 3=22 4=19 5=19
└─ Errors:    0
```
#### posts25k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      2.25374ms
├─ Worst:     6.232401ms
├─ Completed: 2.676759152s
├─ Workers:   0=170 1=166 2=176 3=169 4=163 5=156
└─ Errors:    0
```
#### posts25k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      21.833769ms
├─ Worst:     276.480557ms
├─ Completed: 278.117265ms
├─ Workers:   0=177 1=131 2=173 3=174 4=169 5=176
└─ Errors:    0
```
#### posts25k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      29.832335ms
├─ Worst:     118.64224ms
├─ Completed: 120.077381ms
├─ Workers:   0=145 1=168 2=145 3=127 4=206 5=209
└─ Errors:    0
```
#### posts25k - mixed read and write (simpleA list with additional 300 concurrent random posts25k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      30.666206ms
├─ Worst:     262.860563ms
├─ Completed: 264.892756ms
├─ Workers:   0=145 1=168 2=145 3=127 4=206 5=209
└─ Errors:    0
```
#### posts25k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.321634ms
├─ Worst:     19.106836ms
├─ Completed: 74.707867ms
├─ Workers:   0=24 1=22 2=21 3=16 4=6 5=11
└─ Errors:    0
```
#### posts25k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      1.703561ms
├─ Worst:     21.969425ms
├─ Completed: 104.887221ms
├─ Workers:   0=35 1=6 2=31 3=18 4=6 5=4
└─ Errors:    0
```
#### posts25k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      1.758256ms
├─ Worst:     32.987929ms
├─ Completed: 131.194812ms
├─ Workers:   0=20 1=9 2=31 3=32 4=5 5=3
└─ Errors:    0
```
#### posts25k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      2.766898ms
├─ Worst:     42.305857ms
├─ Completed: 139.135027ms
├─ Workers:   0=14 1=13 2=13 3=32 4=18 5=10
└─ Errors:    0
```
#### posts25k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.768179ms
├─ Worst:     16.620274ms
├─ Completed: 59.378936ms
├─ Workers:   0=15 1=15 2=16 3=15 4=25 5=14
└─ Errors:    0
```
#### posts25k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      4.747271ms
├─ Worst:     68.185276ms
├─ Completed: 184.978365ms
├─ Workers:   0=15 1=14 2=14 3=14 4=24 5=19
└─ Errors:    0
```
#### posts25k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      906.75µs
├─ Worst:     10.101719ms
├─ Completed: 29.7275ms
├─ Workers:   0=14 1=14 2=15 3=14 4=23 5=20
└─ Errors:    0
```
#### posts25k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      866.626µs
├─ Worst:     4.309958ms
├─ Completed: 21.554503ms
├─ Workers:   0=15 1=14 2=15 3=13 4=24 5=19
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      4.997636ms
├─ Worst:     61.750939ms
├─ Completed: 184.34394ms
├─ Workers:   0=15 1=14 2=14 3=13 4=24 5=20
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      905.49µs
├─ Worst:     9.781988ms
├─ Completed: 25.563234ms
├─ Workers:   0=14 1=14 2=15 3=14 4=24 5=19
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      605.546µs
├─ Worst:     7.928992ms
├─ Completed: 25.193494ms
├─ Workers:   0=15 1=14 2=15 3=15 4=22 5=19
└─ Errors:    0
```
#### posts25k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      8.482454ms
├─ Worst:     65.931557ms
├─ Completed: 249.978376ms
├─ Workers:   0=16 1=16 2=17 3=16 4=11 5=24
└─ Errors:    0
```
#### posts25k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      6.864882ms
├─ Worst:     107.427746ms
├─ Completed: 294.399133ms
├─ Workers:   0=9 1=33 2=8 3=12 5=38
└─ Errors:    0
```
#### posts25k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      927.42µs
├─ Worst:     8.042227ms
├─ Completed: 27.126792ms
├─ Workers:   0=24 1=22 2=21 3=16 4=6 5=11
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      37.225686ms
├─ Worst:     338.265942ms
├─ Completed: 1.489741063s
├─ Workers:   0=35 1=6 2=31 3=18 4=6 5=4
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.069085ms
├─ Worst:     8.803998ms
├─ Completed: 40.871267ms
├─ Workers:   0=20 1=9 2=31 3=32 4=5 5=3
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      15.476576ms
├─ Worst:     148.109352ms
├─ Completed: 625.475303ms
├─ Workers:   0=14 1=13 2=13 3=32 4=18 5=10
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      921.671µs
├─ Worst:     13.075532ms
├─ Completed: 35.023418ms
├─ Workers:   0=15 1=15 2=16 3=15 4=25 5=14
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      19.294935ms
├─ Worst:     158.85529ms
├─ Completed: 695.76202ms
├─ Workers:   0=15 1=14 2=14 3=14 4=24 5=19
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      937.063µs
├─ Worst:     11.410725ms
├─ Completed: 34.660276ms
├─ Workers:   0=14 1=14 2=15 3=14 4=23 5=20
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      98.216045ms
├─ Worst:     640.345691ms
├─ Completed: 2.630502391s
├─ Workers:   0=15 1=14 2=15 3=13 4=24 5=19
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.863773ms
├─ Worst:     12.020147ms
├─ Completed: 60.312054ms
├─ Workers:   0=15 1=14 2=14 3=13 4=24 5=20
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      254.931362ms
├─ Worst:     1.612863436s
├─ Completed: 7.439035455s
├─ Workers:   0=14 1=14 2=15 3=14 4=24 5=19
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.664678ms
├─ Worst:     10.194567ms
├─ Completed: 41.352591ms
├─ Workers:   0=15 1=14 2=15 3=15 4=22 5=19
└─ Errors:    0
```
#### posts50k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      2.006779ms
├─ Worst:     11.111943ms
├─ Completed: 4.901012097s
├─ Workers:   0=177 1=156 2=181 3=182 4=142 5=162
└─ Errors:    0
```
#### posts50k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      21.508568ms
├─ Worst:     482.190338ms
├─ Completed: 484.007526ms
├─ Workers:   0=177 1=156 2=181 3=183 4=141 5=162
└─ Errors:    0
```
#### posts50k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      31.77865ms
├─ Worst:     113.505602ms
├─ Completed: 115.11263ms
├─ Workers:   0=176 1=186 2=144 3=152 4=174 5=168
└─ Errors:    0
```
#### posts50k - mixed read and write (simpleA list with additional 300 concurrent random posts50k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      33.731975ms
├─ Worst:     470.431253ms
├─ Completed: 472.659257ms
├─ Workers:   0=176 1=186 2=144 3=152 4=174 5=168
└─ Errors:    0
```
#### posts50k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      2.410105ms
├─ Worst:     30.022316ms
├─ Completed: 96.881104ms
├─ Workers:   0=20 1=12 2=16 3=19 4=19 5=14
└─ Errors:    0
```
#### posts50k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      2.534487ms
├─ Worst:     27.549184ms
├─ Completed: 122.158713ms
├─ Workers:   0=25 1=2 2=22 3=20 4=18 5=13
└─ Errors:    0
```
#### posts50k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      2.458563ms
├─ Worst:     37.934625ms
├─ Completed: 125.893266ms
├─ Workers:   0=6 1=4 2=37 3=30 4=3 5=20
└─ Errors:    0
```
#### posts50k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      3.665809ms
├─ Worst:     56.906854ms
├─ Completed: 128.755707ms
├─ Workers:   0=22 1=13 2=19 3=14 4=19 5=13
└─ Errors:    0
```
#### posts50k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      2.872955ms
├─ Worst:     24.245977ms
├─ Completed: 94.354817ms
├─ Workers:   0=22 1=15 2=13 3=15 4=22 5=13
└─ Errors:    0
```
#### posts50k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      16.498666ms
├─ Worst:     122.815519ms
├─ Completed: 511.067165ms
├─ Workers:   0=22 1=14 2=15 3=14 4=22 5=13
└─ Errors:    0
```
#### posts50k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      867.406µs
├─ Worst:     10.511815ms
├─ Completed: 32.28547ms
├─ Workers:   0=22 1=14 2=14 3=15 4=22 5=13
└─ Errors:    0
```
#### posts50k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.025595ms
├─ Worst:     7.94225ms
├─ Completed: 24.912016ms
├─ Workers:   0=22 1=14 2=14 3=15 4=22 5=13
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      16.527315ms
├─ Worst:     124.15713ms
├─ Completed: 476.462735ms
├─ Workers:   0=25 1=14 2=14 3=14 4=21 5=12
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      852.257µs
├─ Worst:     10.288507ms
├─ Completed: 31.66846ms
├─ Workers:   0=22 1=14 2=14 3=15 4=22 5=13
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      818.57µs
├─ Worst:     8.921151ms
├─ Completed: 27.95983ms
├─ Workers:   0=13 1=17 2=16 3=17 4=22 5=15
└─ Errors:    0
```
#### posts50k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      17.29123ms
├─ Worst:     109.981089ms
├─ Completed: 545.74084ms
├─ Workers:   1=26 2=22 3=24 5=28
└─ Errors:    0
```
#### posts50k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      12.401362ms
├─ Worst:     95.503342ms
├─ Completed: 525.134946ms
├─ Workers:   1=39 2=9 3=12 5=40
└─ Errors:    0
```
#### posts50k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      944.553µs
├─ Worst:     8.66043ms
├─ Completed: 25.092395ms
├─ Workers:   0=20 1=12 2=16 3=19 4=19 5=14
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      80.281046ms
├─ Worst:     736.537966ms
├─ Completed: 2.405638281s
├─ Workers:   0=25 1=2 2=22 3=20 4=18 5=13
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.148826ms
├─ Worst:     6.912979ms
├─ Completed: 36.689487ms
├─ Workers:   0=6 1=4 2=37 3=30 4=3 5=20
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      35.483813ms
├─ Worst:     231.662082ms
├─ Completed: 983.260387ms
├─ Workers:   0=22 1=13 2=19 3=14 4=19 5=13
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      927.44µs
├─ Worst:     8.465391ms
├─ Completed: 28.351822ms
├─ Workers:   0=22 1=15 2=13 3=15 4=22 5=13
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      44.284147ms
├─ Worst:     249.764221ms
├─ Completed: 1.280840519s
├─ Workers:   0=22 1=14 2=15 3=14 4=22 5=13
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.013348ms
├─ Worst:     5.520898ms
├─ Completed: 27.431172ms
├─ Workers:   0=22 1=14 2=14 3=15 4=22 5=13
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      190.17808ms
├─ Worst:     963.653152ms
├─ Completed: 5.444277858s
├─ Workers:   0=22 1=14 2=14 3=15 4=22 5=13
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.257525ms
├─ Worst:     13.546823ms
├─ Completed: 57.518819ms
├─ Workers:   0=25 1=14 2=14 3=14 4=21 5=12
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      478.167136ms
├─ Worst:     3.924400829s
├─ Completed: 14.610688872s
├─ Workers:   0=22 1=14 2=14 3=15 4=22 5=13
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.620756ms
├─ Worst:     19.338304ms
├─ Completed: 50.374591ms
├─ Workers:   0=13 1=17 2=16 3=17 4=22 5=15
└─ Errors:    0
```
#### posts100k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      3.31955ms
├─ Worst:     15.931694ms
├─ Completed: 8.61144651s
├─ Workers:   0=161 1=153 2=181 3=178 4=147 5=180
└─ Errors:    0
```
#### posts100k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      23.99521ms
├─ Worst:     827.831687ms
├─ Completed: 830.560763ms
├─ Workers:   0=155 1=156 2=182 3=180 4=146 5=181
└─ Errors:    0
```
#### posts100k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      22.953404ms
├─ Worst:     126.899476ms
├─ Completed: 128.499383ms
├─ Workers:   0=211 1=141 2=203 3=143 4=164 5=138
└─ Errors:    0
```
#### posts100k - mixed read and write (simpleA list with additional 300 concurrent random posts100k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      33.348717ms
├─ Worst:     910.851694ms
├─ Completed: 912.284321ms
├─ Workers:   0=211 1=141 2=203 3=143 4=164 5=138
└─ Errors:    0
```
#### posts100k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      3.799592ms
├─ Worst:     36.25084ms
├─ Completed: 138.341743ms
├─ Workers:   0=10 1=17 2=18 3=16 4=19 5=20
└─ Errors:    0
```
#### posts100k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      4.300664ms
├─ Worst:     37.456634ms
├─ Completed: 142.271174ms
├─ Workers:   1=23 2=3 3=26 4=23 5=25
└─ Errors:    0
```
#### posts100k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      4.076235ms
├─ Worst:     52.761715ms
├─ Completed: 287.764468ms
├─ Workers:   0=3 1=8 2=3 3=40 4=7 5=39
└─ Errors:    0
```
#### posts100k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      5.77533ms
├─ Worst:     54.207399ms
├─ Completed: 181.273313ms
├─ Workers:   0=13 1=14 2=16 3=20 4=14 5=23
└─ Errors:    0
```
#### posts100k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      3.30454ms
├─ Worst:     32.824253ms
├─ Completed: 131.727717ms
├─ Workers:   0=13 1=14 2=14 3=23 4=13 5=23
└─ Errors:    0
```
#### posts100k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      30.975071ms
├─ Worst:     189.091812ms
├─ Completed: 904.866005ms
├─ Workers:   0=13 1=14 2=13 3=23 4=14 5=23
└─ Errors:    0
```
#### posts100k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.066372ms
├─ Worst:     5.240341ms
├─ Completed: 26.383395ms
├─ Workers:   0=13 1=14 2=14 3=23 4=13 5=23
└─ Errors:    0
```
#### posts100k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      863.893µs
├─ Worst:     8.120836ms
├─ Completed: 27.90169ms
├─ Workers:   0=13 1=15 2=14 3=23 4=13 5=22
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      31.52508ms
├─ Worst:     389.459572ms
├─ Completed: 953.753222ms
├─ Workers:   0=12 1=22 2=13 3=21 4=12 5=20
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.034147ms
├─ Worst:     7.871742ms
├─ Completed: 31.612311ms
├─ Workers:   0=24 1=22 2=20 3=9 4=23 5=2
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      995.674µs
├─ Worst:     9.879331ms
├─ Completed: 35.384696ms
├─ Workers:   0=25 1=26 2=26 4=23
└─ Errors:    0
```
#### posts100k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      67.063037ms
├─ Worst:     185.008997ms
├─ Completed: 1.106957112s
├─ Workers:   0=30 1=9 2=31 4=30
└─ Errors:    0
```
#### posts100k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      79.698273ms
├─ Worst:     294.538754ms
├─ Completed: 1.564295829s
├─ Workers:   0=52 2=40 4=8
└─ Errors:    0
```
#### posts100k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      891.721µs
├─ Worst:     6.460554ms
├─ Completed: 24.840197ms
├─ Workers:   0=10 1=17 2=18 3=16 4=19 5=20
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      182.918112ms
├─ Worst:     753.924645ms
├─ Completed: 4.82681985s
├─ Workers:   1=23 2=3 3=26 4=23 5=25
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.114929ms
├─ Worst:     11.542648ms
├─ Completed: 55.110706ms
├─ Workers:   0=3 1=8 2=3 3=40 4=7 5=39
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      69.83301ms
├─ Worst:     384.346488ms
├─ Completed: 1.961569935s
├─ Workers:   0=13 1=14 2=16 3=20 4=14 5=23
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      953.136µs
├─ Worst:     8.808194ms
├─ Completed: 32.958589ms
├─ Workers:   0=13 1=14 2=14 3=23 4=13 5=23
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      88.124599ms
├─ Worst:     504.857726ms
├─ Completed: 2.344055345s
├─ Workers:   0=13 1=14 2=13 3=23 4=14 5=23
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      926.819µs
├─ Worst:     9.860096ms
├─ Completed: 34.238404ms
├─ Workers:   0=13 1=14 2=14 3=23 4=13 5=23
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      438.424928ms
├─ Worst:     2.509455442s
├─ Completed: 12.050242466s
├─ Workers:   0=13 1=15 2=14 3=23 4=13 5=22
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.862249ms
├─ Worst:     23.268227ms
├─ Completed: 67.452006ms
├─ Workers:   0=12 1=22 2=13 3=21 4=12 5=20
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      971.888407ms
├─ Worst:     5.41070434s
├─ Completed: 30.17239108s
├─ Workers:   0=24 1=22 2=20 3=9 4=23 5=2
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.636148ms
├─ Worst:     13.946564ms
├─ Completed: 60.330368ms
├─ Workers:   0=25 1=26 2=26 4=23
└─ Errors:    0
```

## Go vs JS route execution
#### JS route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      40.754296ms
├─ Worst:     1.114037001s
├─ Completed: 1.114854209s
├─ Workers:   0=95 1=57 2=95 3=82 4=87 5=84
└─ Errors:    0
```
#### Go route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      24.533854ms
├─ Worst:     1.182994043s
├─ Completed: 1.18447043s
├─ Workers:   0=65 1=71 2=71 3=112 4=67 5=114
└─ Errors:    0
```
#### JS route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      9.016832ms
├─ Worst:     275.272539ms
├─ Completed: 1.171348925s
├─ Workers:   0=90 1=98 2=103 3=58 4=101 5=50
└─ Errors:    0
```
#### Go route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      8.597904ms
├─ Worst:     240.981181ms
├─ Completed: 1.025449072s
├─ Workers:   0=95 1=71 2=95 3=83 4=72 5=84
└─ Errors:    0
```
#### JS route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      9.360707ms
├─ Worst:     22.110701ms
├─ Completed: 9.521960343s
├─ Workers:   0=66 1=74 2=57 3=113 4=82 5=108
└─ Errors:    0
```
#### Go route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      8.133042ms
├─ Worst:     29.658214ms
├─ Completed: 9.326927856s
├─ Workers:   0=95 1=82 2=105 3=58 4=102 5=58
└─ Errors:    0
```

## Go vs JS hooks execution
#### JS OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      966.414µs
├─ Worst:     9.973061ms
├─ Completed: 28.733758ms
├─ Workers:   0=20 1=6 2=23 3=25 4=6 5=20
└─ Errors:    0
```
#### Go OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      830.175µs
├─ Worst:     7.275179ms
├─ Completed: 22.732879ms
├─ Workers:   0=15 1=15 2=22 3=20 4=14 5=14
└─ Errors:    0
```

## Deleting records
#### deleting 100 posts10k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      658.919µs
├─ Worst:     36.237642ms
├─ Completed: 56.494566ms
├─ Workers:   0=25 1=21 2=18 3=8 4=8 5=20
└─ Errors:    0
```
#### deleting 100 posts10k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      740.02µs
├─ Worst:     36.572265ms
├─ Completed: 52.920824ms
├─ Workers:   0=15 1=21 2=22 3=14 4=14 5=14
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      706.825µs
├─ Worst:     36.105872ms
├─ Completed: 54.26576ms
├─ Workers:   0=21 1=8 2=5 3=21 4=22 5=23
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      718.362µs
├─ Worst:     7.509252ms
├─ Completed: 42.75778ms
├─ Workers:   3=48 4=3 5=49
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      727.785µs
├─ Worst:     35.45268ms
├─ Completed: 48.720788ms
├─ Workers:   0=15 1=22 2=14 3=14 4=21 5=14
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      768.38µs
├─ Worst:     36.498914ms
├─ Completed: 56.301158ms
├─ Workers:   0=15 1=23 2=16 3=16 4=22 5=8
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      736.656µs
├─ Worst:     21.601617ms
├─ Completed: 42.704225ms
├─ Workers:   0=22 1=23 2=20 3=6 4=23 5=6
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      789.86µs
├─ Worst:     22.736294ms
├─ Completed: 43.755957ms
├─ Workers:   0=14 1=22 2=14 3=14 4=22 5=14
└─ Errors:    0
```
#### deleting 100 users - with cascade deleting all associated posts [conc:10, rule:`""`]
```
┌─ Best:      68.341893ms
├─ Worst:     3.582385336s
├─ Completed: 8.490788902s
├─ Workers:   0=24 1=8 2=39 3=8 4=13 5=8
└─ Errors:    0
```
#### deleting 100 organizations - with cascade deleting all users and associated posts [conc:10, rule:`""`]
```
┌─ Best:      2.850083ms
├─ Worst:     10.211340328s
├─ Completed: 19.281631017s
├─ Workers:   0=20 1=15 2=15 3=14 4=22 5=14
└─ Errors:    0
```

---------------------------------------------------
Completed!
