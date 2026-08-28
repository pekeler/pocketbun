# PocketBun Upstream-Port Benchmark Result

- machine: hetzner-8vcpu-pocketbun-5
- timestamp: 2026-08-27T18:17:17.697Z
- tests: create,auth,search,custom,delete
- benchmark source: 05625dc2b2d3f9711c51566010944b10ca9531fa
- server workers: 5
- load generator: http://load-generator:19231
- benchmark target host: application-host
- warmup request target/cap: 1000
## Creating organizations (100)
#### Creating 50 organizations [reqs:50, conc:10, rule:`""`]
```
┌─ Best:      661.944µs
├─ Worst:     7.762453ms
├─ Completed: 12.188471ms
├─ Workers:   0=10 1=10 2=10 3=10 4=10
└─ Errors:    0
```
#### Creating 50 organizations [reqs:50, conc:10, rule:`"@request.body.name != ''"`]
```
┌─ Best:      778.865µs
├─ Worst:     4.510605ms
├─ Completed: 12.337437ms
├─ Workers:   0=21 1=8 3=14 4=7
└─ Errors:    0
```

## Creating permissions (50)
#### Creating 25 permissions [reqs:25, conc:5, rule:`""`]
```
┌─ Best:      709.9µs
├─ Worst:     3.952766ms
├─ Completed: 9.072902ms
├─ Workers:   0=10 1=4 3=11
└─ Errors:    0
```
#### Creating 25 permissions [reqs:25, conc:5, rule:`"@request.body.name != ''"`]
```
┌─ Best:      710.24µs
├─ Worst:     3.325058ms
├─ Completed: 8.463442ms
├─ Workers:   0=7 1=9 3=9
└─ Errors:    0
```

## Creating users (500 - expected to be slow due to passwordHash generation)
#### Creating 250 users [reqs:250, conc:50, rule:`""`]
```
┌─ Best:      74.885975ms
├─ Worst:     1.155641188s
├─ Completed: 2.06265726s
├─ Workers:   0=71 1=40 2=31 3=58 4=50
└─ Errors:    0
```
#### Creating 250 users [reqs:250, conc:50, rule:`"@request.body.email != '' && @request.body.permissions:length > 0"`]
```
┌─ Best:      114.262312ms
├─ Worst:     1.217761353s
├─ Completed: 2.05626619s
├─ Workers:   0=62 1=43 2=41 3=42 4=62
└─ Errors:    0
```

## Creating posts (10k, 25k, 50k, 100k)
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`""`]
```
┌─ Best:      713.064µs
├─ Worst:     296.01502ms
├─ Completed: 378.681163ms
├─ Workers:   0=783 1=1145 2=1038 3=1054 4=980
└─ Errors:    0
```
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      3.822325ms
├─ Worst:     343.181077ms
├─ Completed: 436.098148ms
├─ Workers:   0=717 1=1126 2=1133 3=1128 4=896
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`""`]
```
┌─ Best:      524.704µs
├─ Worst:     278.20605ms
├─ Completed: 803.70788ms
├─ Workers:   0=2692 1=2383 2=2581 3=2581 4=2263
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      2.921103ms
├─ Worst:     377.676136ms
├─ Completed: 1.064652998s
├─ Workers:   0=2595 1=2550 2=2237 3=2593 4=2525
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`""`]
```
┌─ Best:      386.243µs
├─ Worst:     621.349736ms
├─ Completed: 1.406154558s
├─ Workers:   0=4399 1=5308 2=5646 3=5590 4=4057
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      1.591097ms
├─ Worst:     395.054551ms
├─ Completed: 1.877332562s
├─ Workers:   0=4801 1=4733 2=5198 3=5115 4=5153
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`""`]
```
┌─ Best:      436.322µs
├─ Worst:     962.950493ms
├─ Completed: 2.678649223s
├─ Workers:   0=10588 1=10712 2=8958 3=10638 4=9104
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      624.221µs
├─ Worst:     419.582113ms
├─ Completed: 3.513628793s
├─ Workers:   0=10636 1=10288 2=9913 3=10438 4=8725
└─ Errors:    0
```

## User auth with password (expected to be slow due to passwordHash verification)
#### users auth with email/pass - high concurrency [reqs:250, conc:250]
```
┌─ Best:      295.506196ms
├─ Worst:     2.041700937s
├─ Completed: 2.041949099s
├─ Workers:   0=35 1=63 2=56 3=66 4=30
└─ Errors:    0
```
#### users auth with email/pass - small concurrency [reqs:250, conc:10]
```
┌─ Best:      62.492671ms
├─ Worst:     141.063321ms
├─ Completed: 2.090425004s
├─ Workers:   0=59 1=49 2=31 3=56 4=55
└─ Errors:    0
```

## User auth refresh
#### users - auth refresh (high concurrency) [reqs:1000, conc:1000]
```
┌─ Best:      22.450185ms
├─ Worst:     77.83818ms
├─ Completed: 79.214289ms
├─ Workers:   0=223 1=186 2=206 3=174 4=211
└─ Errors:    0
```
#### users - auth refresh (medium concurrency) [reqs:1000, conc:100]
```
┌─ Best:      482.015µs
├─ Worst:     26.407426ms
├─ Completed: 67.743768ms
├─ Workers:   0=247 1=178 2=231 3=226 4=118
└─ Errors:    0
```

## List records
#### users - getOne for auth refresh comparison (medium concurrency) [reqs:1000, conc:100, rule:`""`, query:`/8m9phfp9z1u7x7u`]
```
┌─ Best:      400.903µs
├─ Worst:     21.942103ms
├─ Completed: 69.436464ms
├─ Workers:   0=200 1=205 2=177 3=193 4=225
└─ Errors:    0
```
#### users - getOne for auth refresh comparison (high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`/8m9phfp9z1u7x7u`]
```
┌─ Best:      22.867911ms
├─ Worst:     76.724963ms
├─ Completed: 78.276194ms
├─ Workers:   0=168 1=215 2=191 3=191 4=235
└─ Errors:    0
```
#### posts10k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      742.585µs
├─ Worst:     5.960517ms
├─ Completed: 1.616269891s
├─ Workers:   0=282 1=138 2=247 3=109 4=224
└─ Errors:    0
```
#### posts10k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      24.034662ms
├─ Worst:     190.503416ms
├─ Completed: 192.406052ms
├─ Workers:   0=229 1=208 2=163 3=216 4=184
└─ Errors:    0
```
#### posts10k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      33.177129ms
├─ Worst:     123.988296ms
├─ Completed: 125.534148ms
├─ Workers:   0=185 1=159 2=247 3=213 4=196
└─ Errors:    0
```
#### posts10k - mixed read and write (simpleA list with additional 300 concurrent random posts10k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      31.031198ms
├─ Worst:     198.966547ms
├─ Completed: 200.477062ms
├─ Workers:   0=186 1=159 2=246 3=213 4=196
└─ Errors:    0
```
#### posts10k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.545153ms
├─ Worst:     13.554427ms
├─ Completed: 66.1156ms
├─ Workers:   0=26 1=27 2=1 3=17 4=29
└─ Errors:    0
```
#### posts10k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      1.384121ms
├─ Worst:     16.583719ms
├─ Completed: 75.55665ms
├─ Workers:   0=21 1=25 2=7 3=20 4=27
└─ Errors:    0
```
#### posts10k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      1.357933ms
├─ Worst:     26.221089ms
├─ Completed: 83.361153ms
├─ Workers:   0=27 1=30 2=9 3=12 4=22
└─ Errors:    0
```
#### posts10k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      2.172899ms
├─ Worst:     33.159286ms
├─ Completed: 106.591744ms
├─ Workers:   0=28 1=26 2=13 3=14 4=19
└─ Errors:    0
```
#### posts10k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.455819ms
├─ Worst:     9.276553ms
├─ Completed: 44.616008ms
├─ Workers:   0=15 1=25 2=15 3=20 4=25
└─ Errors:    0
```
#### posts10k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.978291ms
├─ Worst:     32.245945ms
├─ Completed: 103.601568ms
├─ Workers:   0=16 1=24 2=16 3=19 4=25
└─ Errors:    0
```
#### posts10k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      944.273µs
├─ Worst:     4.556889ms
├─ Completed: 23.703895ms
├─ Workers:   0=16 1=26 2=15 3=18 4=25
└─ Errors:    0
```
#### posts10k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      839.899µs
├─ Worst:     4.414162ms
├─ Completed: 22.923537ms
├─ Workers:   0=15 1=25 2=16 3=19 4=25
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.689803ms
├─ Worst:     31.936697ms
├─ Completed: 89.270008ms
├─ Workers:   0=16 1=24 2=16 3=18 4=26
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      892.643µs
├─ Worst:     4.716039ms
├─ Completed: 24.77986ms
├─ Workers:   0=17 1=20 2=17 3=20 4=26
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      848.801µs
├─ Worst:     4.156917ms
├─ Completed: 25.359551ms
├─ Workers:   0=27 2=26 3=30 4=17
└─ Errors:    0
```
#### posts10k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      1.801526ms
├─ Worst:     45.39294ms
├─ Completed: 146.116935ms
├─ Workers:   0=32 2=35 3=33
└─ Errors:    0
```
#### posts10k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      1.814844ms
├─ Worst:     32.241749ms
├─ Completed: 120.247122ms
├─ Workers:   0=27 2=61 3=12
└─ Errors:    0
```
#### posts10k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      966.564µs
├─ Worst:     7.087322ms
├─ Completed: 32.632648ms
├─ Workers:   0=25 1=27 2=2 3=16 4=30
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      12.25917ms
├─ Worst:     92.209384ms
├─ Completed: 410.470487ms
├─ Workers:   0=22 1=25 2=7 3=20 4=26
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.08677ms
├─ Worst:     10.265258ms
├─ Completed: 40.077734ms
├─ Workers:   0=26 1=30 2=8 3=13 4=23
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      4.766958ms
├─ Worst:     60.316958ms
├─ Completed: 206.458237ms
├─ Workers:   0=28 1=26 2=13 3=14 4=19
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      936.553µs
├─ Worst:     5.070438ms
├─ Completed: 25.98938ms
├─ Workers:   0=15 1=26 2=15 3=19 4=25
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      7.814525ms
├─ Worst:     70.836986ms
├─ Completed: 276.047752ms
├─ Workers:   0=16 1=23 2=16 3=20 4=25
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      954.157µs
├─ Worst:     10.574355ms
├─ Completed: 38.280844ms
├─ Workers:   0=17 1=27 2=15 3=17 4=24
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      36.751924ms
├─ Worst:     154.355146ms
├─ Completed: 995.391526ms
├─ Workers:   0=14 1=24 2=17 3=20 4=25
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.631852ms
├─ Worst:     17.38158ms
├─ Completed: 66.71654ms
├─ Workers:   0=16 1=25 2=15 3=18 4=26
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      96.689276ms
├─ Worst:     497.537315ms
├─ Completed: 2.787839763s
├─ Workers:   0=17 1=19 2=17 3=20 4=27
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.63036ms
├─ Worst:     11.06361ms
├─ Completed: 60.801637ms
├─ Workers:   0=28 2=27 3=29 4=16
└─ Errors:    0
```
#### posts25k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.054125ms
├─ Worst:     5.576026ms
├─ Completed: 2.517215955s
├─ Workers:   0=221 1=209 2=188 3=184 4=198
└─ Errors:    0
```
#### posts25k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      20.708742ms
├─ Worst:     283.866573ms
├─ Completed: 285.450319ms
├─ Workers:   0=237 1=177 2=199 3=196 4=191
└─ Errors:    0
```
#### posts25k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      21.845841ms
├─ Worst:     108.018283ms
├─ Completed: 109.638418ms
├─ Workers:   0=178 1=252 2=156 3=163 4=251
└─ Errors:    0
```
#### posts25k - mixed read and write (simpleA list with additional 300 concurrent random posts25k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      29.124777ms
├─ Worst:     289.686756ms
├─ Completed: 291.83429ms
├─ Workers:   0=179 1=252 2=157 3=163 4=249
└─ Errors:    0
```
#### posts25k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.423574ms
├─ Worst:     18.867581ms
├─ Completed: 73.677707ms
├─ Workers:   0=28 1=2 2=27 3=26 4=17
└─ Errors:    0
```
#### posts25k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      1.702609ms
├─ Worst:     25.285578ms
├─ Completed: 92.608064ms
├─ Workers:   0=33 1=8 2=29 3=28 4=2
└─ Errors:    0
```
#### posts25k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      1.67346ms
├─ Worst:     24.676727ms
├─ Completed: 112.434407ms
├─ Workers:   0=30 1=9 2=19 3=33 4=9
└─ Errors:    0
```
#### posts25k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      2.593989ms
├─ Worst:     20.844039ms
├─ Completed: 106.880703ms
├─ Workers:   0=18 1=29 2=18 3=23 4=12
└─ Errors:    0
```
#### posts25k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.165769ms
├─ Worst:     18.890722ms
├─ Completed: 76.091677ms
├─ Workers:   0=17 1=29 2=18 3=24 4=12
└─ Errors:    0
```
#### posts25k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      4.753341ms
├─ Worst:     65.26ms
├─ Completed: 181.089023ms
├─ Workers:   0=15 1=26 2=15 3=21 4=23
└─ Errors:    0
```
#### posts25k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      935.521µs
├─ Worst:     8.068397ms
├─ Completed: 29.72102ms
├─ Workers:   0=29 1=21 2=13 3=17 4=20
└─ Errors:    0
```
#### posts25k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      898.069µs
├─ Worst:     5.956531ms
├─ Completed: 26.680575ms
├─ Workers:   0=15 1=24 2=15 3=21 4=25
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      4.443523ms
├─ Worst:     63.881237ms
├─ Completed: 203.089768ms
├─ Workers:   0=13 1=20 2=32 3=16 4=19
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      925.898µs
├─ Worst:     5.952305ms
├─ Completed: 29.455163ms
├─ Workers:   0=15 1=25 2=15 3=20 4=25
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      907.864µs
├─ Worst:     5.472652ms
├─ Completed: 28.084983ms
├─ Workers:   0=15 1=25 2=15 3=22 4=23
└─ Errors:    0
```
#### posts25k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      8.534709ms
├─ Worst:     74.789882ms
├─ Completed: 301.232911ms
├─ Workers:   0=19 1=31 2=20 4=30
└─ Errors:    0
```
#### posts25k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      7.604755ms
├─ Worst:     64.12224ms
├─ Completed: 319.845301ms
├─ Workers:   0=35 1=3 2=11 3=1 4=50
└─ Errors:    0
```
#### posts25k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      878.002µs
├─ Worst:     9.818351ms
├─ Completed: 34.111679ms
├─ Workers:   0=28 1=2 2=28 3=26 4=16
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      37.932454ms
├─ Worst:     223.540572ms
├─ Completed: 1.345203496s
├─ Workers:   0=33 1=8 2=29 3=28 4=2
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.104846ms
├─ Worst:     8.562278ms
├─ Completed: 43.202606ms
├─ Workers:   0=30 1=10 2=19 3=32 4=9
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      14.912953ms
├─ Worst:     98.320098ms
├─ Completed: 499.225653ms
├─ Workers:   0=18 1=28 2=18 3=24 4=12
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      988.565µs
├─ Worst:     8.243607ms
├─ Completed: 32.941044ms
├─ Workers:   0=17 1=30 2=18 3=23 4=12
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      19.302039ms
├─ Worst:     132.868751ms
├─ Completed: 599.036491ms
├─ Workers:   0=15 1=25 2=15 3=21 4=24
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      934.119µs
├─ Worst:     10.249726ms
├─ Completed: 35.898756ms
├─ Workers:   0=30 1=21 2=12 3=17 4=20
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      100.758723ms
├─ Worst:     531.82679ms
├─ Completed: 2.726491062s
├─ Workers:   0=14 1=24 2=17 3=21 4=24
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.553645ms
├─ Worst:     24.609295ms
├─ Completed: 87.2869ms
├─ Workers:   0=13 1=20 2=31 3=17 4=19
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      235.538813ms
├─ Worst:     1.87060749s
├─ Completed: 7.262326569s
├─ Workers:   0=15 1=25 2=15 3=20 4=25
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.627196ms
├─ Worst:     15.38282ms
├─ Completed: 47.269328ms
├─ Workers:   0=15 1=26 2=14 3=21 4=24
└─ Errors:    0
```
#### posts50k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.928352ms
├─ Worst:     9.316678ms
├─ Completed: 4.828635546s
├─ Workers:   0=239 1=181 2=188 3=193 4=199
└─ Errors:    0
```
#### posts50k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      22.145235ms
├─ Worst:     475.734093ms
├─ Completed: 477.636929ms
├─ Workers:   0=224 1=182 2=203 3=193 4=198
└─ Errors:    0
```
#### posts50k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      22.678961ms
├─ Worst:     114.121676ms
├─ Completed: 115.72536ms
├─ Workers:   0=197 1=188 2=211 3=218 4=186
└─ Errors:    0
```
#### posts50k - mixed read and write (simpleA list with additional 300 concurrent random posts50k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      29.956605ms
├─ Worst:     508.56184ms
├─ Completed: 509.917671ms
├─ Workers:   0=198 1=188 2=211 3=217 4=186
└─ Errors:    0
```
#### posts50k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      2.085118ms
├─ Worst:     27.803313ms
├─ Completed: 103.463226ms
├─ Workers:   0=30 1=7 2=18 3=22 4=23
└─ Errors:    0
```
#### posts50k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      2.699936ms
├─ Worst:     29.00342ms
├─ Completed: 127.831137ms
├─ Workers:   0=19 1=24 2=16 3=12 4=29
└─ Errors:    0
```
#### posts50k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      2.335292ms
├─ Worst:     41.737254ms
├─ Completed: 170.508259ms
├─ Workers:   0=26 1=34 2=7 3=9 4=24
└─ Errors:    0
```
#### posts50k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      3.422945ms
├─ Worst:     35.815251ms
├─ Completed: 143.703865ms
├─ Workers:   0=25 1=9 2=17 3=23 4=26
└─ Errors:    0
```
#### posts50k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.955359ms
├─ Worst:     24.586093ms
├─ Completed: 92.404485ms
├─ Workers:   0=25 1=21 2=17 3=22 4=15
└─ Errors:    0
```
#### posts50k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      17.159082ms
├─ Worst:     168.371681ms
├─ Completed: 606.765016ms
├─ Workers:   0=31 1=21 2=14 3=19 4=15
└─ Errors:    0
```
#### posts50k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      914.752µs
├─ Worst:     8.702881ms
├─ Completed: 28.875222ms
├─ Workers:   0=27 1=22 2=15 3=21 4=15
└─ Errors:    0
```
#### posts50k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.113947ms
├─ Worst:     4.483877ms
├─ Completed: 23.755807ms
├─ Workers:   0=24 1=23 2=15 3=22 4=16
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      16.502135ms
├─ Worst:     110.483854ms
├─ Completed: 523.603579ms
├─ Workers:   0=24 1=22 2=17 3=22 4=15
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      888.527µs
├─ Worst:     7.565773ms
├─ Completed: 30.109124ms
├─ Workers:   0=24 1=23 2=15 3=22 4=16
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      531.424µs
├─ Worst:     10.735977ms
├─ Completed: 31.226438ms
├─ Workers:   0=23 1=24 2=16 3=21 4=16
└─ Errors:    0
```
#### posts50k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      17.067146ms
├─ Worst:     106.106395ms
├─ Completed: 542.711451ms
├─ Workers:   0=4 1=22 2=25 3=25 4=24
└─ Errors:    0
```
#### posts50k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      23.849357ms
├─ Worst:     122.210611ms
├─ Completed: 715.552781ms
├─ Workers:   0=1 2=55 3=11 4=33
└─ Errors:    0
```
#### posts50k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      585.628µs
├─ Worst:     9.996266ms
├─ Completed: 29.651054ms
├─ Workers:   0=30 1=7 2=18 3=23 4=22
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      82.59206ms
├─ Worst:     548.726903ms
├─ Completed: 2.767307506s
├─ Workers:   0=19 1=24 2=16 3=11 4=30
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.150108ms
├─ Worst:     10.104046ms
├─ Completed: 43.073738ms
├─ Workers:   0=26 1=34 2=8 3=9 4=23
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      37.422239ms
├─ Worst:     272.038059ms
├─ Completed: 1.248674369s
├─ Workers:   0=24 1=9 2=17 3=24 4=26
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      930.796µs
├─ Worst:     9.450292ms
├─ Completed: 35.188736ms
├─ Workers:   0=26 1=21 2=17 3=21 4=15
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      44.658195ms
├─ Worst:     453.118619ms
├─ Completed: 1.58562062s
├─ Workers:   0=31 1=21 2=13 3=20 4=15
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      949.711µs
├─ Worst:     7.409677ms
├─ Completed: 31.67036ms
├─ Workers:   0=26 1=22 2=16 3=21 4=15
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      212.129746ms
├─ Worst:     1.196496785s
├─ Completed: 5.822717636s
├─ Workers:   0=25 1=23 2=14 3=22 4=16
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.285385ms
├─ Worst:     16.787769ms
├─ Completed: 84.644493ms
├─ Workers:   0=23 1=22 2=18 3=21 4=16
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      554.334323ms
├─ Worst:     2.840207128s
├─ Completed: 15.574275924s
├─ Workers:   0=25 1=23 2=15 3=22 4=15
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.553495ms
├─ Worst:     12.654726ms
├─ Completed: 56.422122ms
├─ Workers:   0=22 1=24 2=16 3=21 4=17
└─ Errors:    0
```
#### posts100k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      3.187028ms
├─ Worst:     15.15052ms
├─ Completed: 8.39892522s
├─ Workers:   0=212 1=183 2=199 3=188 4=218
└─ Errors:    0
```
#### posts100k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      22.949534ms
├─ Worst:     985.762939ms
├─ Completed: 987.608506ms
├─ Workers:   0=201 1=187 2=204 3=187 4=221
└─ Errors:    0
```
#### posts100k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      22.245784ms
├─ Worst:     123.10836ms
├─ Completed: 124.595754ms
├─ Workers:   0=251 1=233 2=212 3=158 4=146
└─ Errors:    0
```
#### posts100k - mixed read and write (simpleA list with additional 300 concurrent random posts100k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      29.611609ms
├─ Worst:     1.039335976s
├─ Completed: 1.041471754s
├─ Workers:   0=251 1=233 2=212 3=158 4=146
└─ Errors:    0
```
#### posts100k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      3.637301ms
├─ Worst:     35.051076ms
├─ Completed: 150.837861ms
├─ Workers:   0=22 1=19 2=24 3=26 4=9
└─ Errors:    0
```
#### posts100k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      3.958743ms
├─ Worst:     55.024203ms
├─ Completed: 278.572066ms
├─ Workers:   0=4 1=2 2=10 3=59 4=25
└─ Errors:    0
```
#### posts100k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      4.547746ms
├─ Worst:     64.881958ms
├─ Completed: 305.005217ms
├─ Workers:   0=6 1=8 2=6 3=15 4=65
└─ Errors:    0
```
#### posts100k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      5.422965ms
├─ Worst:     71.144462ms
├─ Completed: 244.415974ms
├─ Workers:   0=12 1=19 2=12 3=20 4=37
└─ Errors:    0
```
#### posts100k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      3.305822ms
├─ Worst:     43.799791ms
├─ Completed: 130.753301ms
├─ Workers:   0=14 1=23 2=15 3=24 4=24
└─ Errors:    0
```
#### posts100k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      30.890893ms
├─ Worst:     221.536748ms
├─ Completed: 893.046162ms
├─ Workers:   0=22 1=21 2=13 3=21 4=23
└─ Errors:    0
```
#### posts100k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      827.642µs
├─ Worst:     7.865455ms
├─ Completed: 27.847845ms
├─ Workers:   0=15 1=23 2=19 3=21 4=22
└─ Errors:    0
```
#### posts100k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      864.973µs
├─ Worst:     6.692217ms
├─ Completed: 27.130746ms
├─ Workers:   0=15 1=23 2=15 3=23 4=24
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      31.072565ms
├─ Worst:     186.236618ms
├─ Completed: 907.831699ms
├─ Workers:   0=14 1=23 2=15 3=24 4=24
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      878.992µs
├─ Worst:     12.403298ms
├─ Completed: 28.81575ms
├─ Workers:   0=20 1=29 2=20 3=18 4=13
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      791.993µs
├─ Worst:     9.687571ms
├─ Completed: 42.558978ms
├─ Workers:   0=34 1=33 2=33
└─ Errors:    0
```
#### posts100k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      67.193208ms
├─ Worst:     205.164581ms
├─ Completed: 1.311948799s
├─ Workers:   0=37 1=29 2=34
└─ Errors:    0
```
#### posts100k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      57.796979ms
├─ Worst:     300.256784ms
├─ Completed: 2.118707029s
├─ Workers:   0=68 2=32
└─ Errors:    0
```
#### posts100k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.013899ms
├─ Worst:     20.796053ms
├─ Completed: 43.883006ms
├─ Workers:   0=22 1=19 2=24 3=26 4=9
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      160.534954ms
├─ Worst:     1.804841711s
├─ Completed: 10.844673724s
├─ Workers:   0=3 1=2 2=9 3=60 4=26
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.135067ms
├─ Worst:     11.072823ms
├─ Completed: 53.340359ms
├─ Workers:   0=6 1=9 2=6 3=14 4=65
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      73.011337ms
├─ Worst:     688.43214ms
├─ Completed: 2.623670111s
├─ Workers:   0=12 1=19 2=12 3=21 4=36
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      552.182µs
├─ Worst:     8.227245ms
├─ Completed: 29.621212ms
├─ Workers:   0=15 1=23 2=15 3=23 4=24
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      87.853382ms
├─ Worst:     364.452586ms
├─ Completed: 2.345319932s
├─ Workers:   0=21 1=21 2=14 3=21 4=23
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      951.383µs
├─ Worst:     8.474996ms
├─ Completed: 30.032061ms
├─ Workers:   0=15 1=22 2=19 3=21 4=23
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      442.42474ms
├─ Worst:     2.256444348s
├─ Completed: 11.577888593s
├─ Workers:   0=16 1=23 2=14 3=24 4=23
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.374817ms
├─ Worst:     16.761695ms
├─ Completed: 76.536293ms
├─ Workers:   0=13 1=24 2=16 3=23 4=24
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      960.263634ms
├─ Worst:     7.698339862s
├─ Completed: 33.005121224s
├─ Workers:   0=21 1=28 2=20 3=18 4=13
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.51379ms
├─ Worst:     12.332851ms
├─ Completed: 60.334131ms
├─ Workers:   0=34 1=34 2=32
└─ Errors:    0
```

## Go vs JS route execution
#### JS route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      43.17582ms
├─ Worst:     1.264946719s
├─ Completed: 1.266344677s
├─ Workers:   0=136 1=58 2=105 3=101 4=100
└─ Errors:    0
```
#### Go route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      24.921247ms
├─ Worst:     1.164336029s
├─ Completed: 1.165083621s
├─ Workers:   0=78 1=109 2=74 3=110 4=129
└─ Errors:    0
```
#### JS route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      9.276464ms
├─ Worst:     297.934219ms
├─ Completed: 1.209999371s
├─ Workers:   0=116 1=116 2=115 3=85 4=68
└─ Errors:    0
```
#### Go route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      9.442753ms
├─ Worst:     253.466376ms
├─ Completed: 1.133248654s
├─ Workers:   0=119 1=71 2=89 3=104 4=117
└─ Errors:    0
```
#### JS route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      7.661274ms
├─ Worst:     26.222941ms
├─ Completed: 10.075593593s
├─ Workers:   0=86 1=104 2=91 3=101 4=118
└─ Errors:    0
```
#### Go route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      9.786136ms
├─ Worst:     28.908318ms
├─ Completed: 10.102511396s
├─ Workers:   0=125 1=104 2=113 3=86 4=72
└─ Errors:    0
```

## Go vs JS hooks execution
#### JS OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      899.832µs
├─ Worst:     7.069777ms
├─ Completed: 27.342308ms
├─ Workers:   0=24 1=7 2=19 3=25 4=25
└─ Errors:    0
```
#### Go OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      783.301µs
├─ Worst:     7.346239ms
├─ Completed: 24.809009ms
├─ Workers:   0=24 1=15 2=15 3=22 4=24
└─ Errors:    0
```

## Deleting records
#### deleting 100 posts10k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      665.248µs
├─ Worst:     12.551693ms
├─ Completed: 38.159016ms
├─ Workers:   0=24 1=23 2=9 3=17 4=27
└─ Errors:    0
```
#### deleting 100 posts10k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      644.62µs
├─ Worst:     20.248766ms
├─ Completed: 37.815672ms
├─ Workers:   0=15 1=22 2=16 3=23 4=24
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      719.022µs
├─ Worst:     22.638375ms
├─ Completed: 41.136354ms
├─ Workers:   0=15 1=23 2=15 3=24 4=23
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      727.484µs
├─ Worst:     9.497057ms
├─ Completed: 35.773143ms
├─ Workers:   0=17 1=19 2=13 3=16 4=35
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      685.286µs
├─ Worst:     10.42672ms
├─ Completed: 30.536776ms
├─ Workers:   0=22 1=16 2=24 3=22 4=16
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      757.244µs
├─ Worst:     13.151812ms
├─ Completed: 35.123886ms
├─ Workers:   0=17 1=23 2=23 3=17 4=20
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      711.593µs
├─ Worst:     12.136651ms
├─ Completed: 37.905376ms
├─ Workers:   0=29 1=28 2=30 3=6 4=7
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      789.78µs
├─ Worst:     6.202531ms
├─ Completed: 32.243953ms
├─ Workers:   0=24 1=22 2=23 3=15 4=16
└─ Errors:    0
```
#### deleting 100 users - with cascade deleting all associated posts [conc:10, rule:`""`]
```
┌─ Best:      68.674992ms
├─ Worst:     4.350037064s
├─ Completed: 8.983547147s
├─ Workers:   0=24 1=28 2=15 3=25 4=8
└─ Errors:    0
```
#### deleting 100 organizations - with cascade deleting all users and associated posts [conc:10, rule:`""`]
```
┌─ Best:      2.127186ms
├─ Worst:     8.864479225s
├─ Completed: 19.055848115s
├─ Workers:   0=23 1=22 2=23 3=15 4=17
└─ Errors:    0
```

---------------------------------------------------
Completed!
