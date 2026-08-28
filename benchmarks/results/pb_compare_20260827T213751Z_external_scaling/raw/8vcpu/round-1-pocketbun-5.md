# PocketBun Upstream-Port Benchmark Result

- machine: hetzner-8vcpu-pocketbun-5
- timestamp: 2026-08-27T16:04:53.546Z
- tests: create,auth,search,custom,delete
- benchmark source: 05625dc2b2d3f9711c51566010944b10ca9531fa
- server workers: 5
- load generator: http://load-generator:19231
- benchmark target host: application-host
- warmup request target/cap: 1000
## Creating organizations (100)
#### Creating 50 organizations [reqs:50, conc:10, rule:`""`]
```
┌─ Best:      611.755µs
├─ Worst:     5.513547ms
├─ Completed: 12.387323ms
├─ Workers:   0=10 1=10 2=15 4=15
└─ Errors:    0
```
#### Creating 50 organizations [reqs:50, conc:10, rule:`"@request.body.name != ''"`]
```
┌─ Best:      782.109µs
├─ Worst:     7.552002ms
├─ Completed: 14.281239ms
├─ Workers:   0=12 1=14 2=13 4=11
└─ Errors:    0
```

## Creating permissions (50)
#### Creating 25 permissions [reqs:25, conc:5, rule:`""`]
```
┌─ Best:      635.758µs
├─ Worst:     3.820459ms
├─ Completed: 7.344016ms
├─ Workers:   0=8 1=7 2=1 4=9
└─ Errors:    0
```
#### Creating 25 permissions [reqs:25, conc:5, rule:`"@request.body.name != ''"`]
```
┌─ Best:      719.954µs
├─ Worst:     4.468262ms
├─ Completed: 8.480514ms
├─ Workers:   0=8 1=7 3=1 4=9
└─ Errors:    0
```

## Creating users (500 - expected to be slow due to passwordHash generation)
#### Creating 250 users [reqs:250, conc:50, rule:`""`]
```
┌─ Best:      77.030509ms
├─ Worst:     1.005471552s
├─ Completed: 2.061025576s
├─ Workers:   0=58 1=68 2=31 3=32 4=61
└─ Errors:    0
```
#### Creating 250 users [reqs:250, conc:50, rule:`"@request.body.email != '' && @request.body.permissions:length > 0"`]
```
┌─ Best:      90.637146ms
├─ Worst:     893.662838ms
├─ Completed: 2.061137929s
├─ Workers:   0=36 1=42 2=62 3=62 4=48
└─ Errors:    0
```

## Creating posts (10k, 25k, 50k, 100k)
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`""`]
```
┌─ Best:      2.925441ms
├─ Worst:     290.977655ms
├─ Completed: 393.456528ms
├─ Workers:   0=1144 1=854 2=997 3=901 4=1104
└─ Errors:    0
```
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      810.98µs
├─ Worst:     325.806928ms
├─ Completed: 446.715198ms
├─ Workers:   0=949 1=1094 2=846 3=1050 4=1061
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`""`]
```
┌─ Best:      4.161349ms
├─ Worst:     403.004538ms
├─ Completed: 806.225365ms
├─ Workers:   0=2638 1=2456 2=2409 3=2688 4=2309
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      2.586283ms
├─ Worst:     485.273063ms
├─ Completed: 1.06047881s
├─ Workers:   0=2650 1=2610 2=2324 3=2165 4=2751
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`""`]
```
┌─ Best:      431.586µs
├─ Worst:     378.346655ms
├─ Completed: 1.63836744s
├─ Workers:   0=4920 1=5113 2=5096 3=4347 4=5524
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      2.084008ms
├─ Worst:     516.248873ms
├─ Completed: 1.837638492s
├─ Workers:   0=5060 1=4330 2=5823 3=4528 4=5259
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`""`]
```
┌─ Best:      11.732748ms
├─ Worst:     448.802102ms
├─ Completed: 3.313619452s
├─ Workers:   0=9380 1=9772 2=10158 3=9883 4=10807
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      756.015µs
├─ Worst:     485.652378ms
├─ Completed: 3.519890104s
├─ Workers:   0=9225 1=10112 2=10855 3=9700 4=10108
└─ Errors:    0
```

## User auth with password (expected to be slow due to passwordHash verification)
#### users auth with email/pass - high concurrency [reqs:250, conc:250]
```
┌─ Best:      144.83212ms
├─ Worst:     2.018672321s
├─ Completed: 2.018909609s
├─ Workers:   0=54 1=62 2=15 3=49 4=70
└─ Errors:    0
```
#### users auth with email/pass - small concurrency [reqs:250, conc:10]
```
┌─ Best:      62.346977ms
├─ Worst:     157.556959ms
├─ Completed: 2.087971771s
├─ Workers:   0=45 1=49 2=47 3=62 4=47
└─ Errors:    0
```

## User auth refresh
#### users - auth refresh (high concurrency) [reqs:1000, conc:1000]
```
┌─ Best:      28.723818ms
├─ Worst:     82.379768ms
├─ Completed: 84.116788ms
├─ Workers:   0=188 1=188 2=217 3=193 4=214
└─ Errors:    0
```
#### users - auth refresh (medium concurrency) [reqs:1000, conc:100]
```
┌─ Best:      443.082µs
├─ Worst:     32.450016ms
├─ Completed: 71.133583ms
├─ Workers:   0=203 1=197 2=237 3=149 4=214
└─ Errors:    0
```

## List records
#### users - getOne for auth refresh comparison (medium concurrency) [reqs:1000, conc:100, rule:`""`, query:`/dndy9iswtd4mqul`]
```
┌─ Best:      467.566µs
├─ Worst:     25.413557ms
├─ Completed: 66.632054ms
├─ Workers:   0=198 1=202 2=199 3=189 4=212
└─ Errors:    0
```
#### users - getOne for auth refresh comparison (high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`/dndy9iswtd4mqul`]
```
┌─ Best:      31.081947ms
├─ Worst:     72.664398ms
├─ Completed: 74.478335ms
├─ Workers:   0=196 1=208 2=206 3=231 4=159
└─ Errors:    0
```
#### posts10k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.213517ms
├─ Worst:     6.685555ms
├─ Completed: 1.679788262s
├─ Workers:   0=236 1=85 2=258 3=211 4=210
└─ Errors:    0
```
#### posts10k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      27.585607ms
├─ Worst:     204.296413ms
├─ Completed: 206.124048ms
├─ Workers:   0=159 1=229 2=186 3=183 4=243
└─ Errors:    0
```
#### posts10k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      25.107644ms
├─ Worst:     145.166912ms
├─ Completed: 146.844821ms
├─ Workers:   0=240 1=144 2=264 3=202 4=150
└─ Errors:    0
```
#### posts10k - mixed read and write (simpleA list with additional 300 concurrent random posts10k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      37.86815ms
├─ Worst:     214.657207ms
├─ Completed: 216.966076ms
├─ Workers:   0=240 1=144 2=264 3=201 4=151
└─ Errors:    0
```
#### posts10k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.966276ms
├─ Worst:     17.351849ms
├─ Completed: 76.316613ms
├─ Workers:   0=7 1=31 2=4 3=15 4=43
└─ Errors:    0
```
#### posts10k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      1.401476ms
├─ Worst:     19.771341ms
├─ Completed: 76.340237ms
├─ Workers:   0=13 1=30 2=9 3=23 4=25
└─ Errors:    0
```
#### posts10k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      1.843906ms
├─ Worst:     21.659239ms
├─ Completed: 76.134081ms
├─ Workers:   0=9 1=33 2=10 3=20 4=28
└─ Errors:    0
```
#### posts10k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      2.014112ms
├─ Worst:     30.969101ms
├─ Completed: 113.867246ms
├─ Workers:   0=19 1=26 2=17 3=10 4=28
└─ Errors:    0
```
#### posts10k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      933.16µs
├─ Worst:     8.791074ms
├─ Completed: 37.742457ms
├─ Workers:   0=18 1=22 2=20 3=21 4=19
└─ Errors:    0
```
#### posts10k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.889561ms
├─ Worst:     33.834911ms
├─ Completed: 99.145189ms
├─ Workers:   0=16 1=18 2=15 3=25 4=26
└─ Errors:    0
```
#### posts10k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      850.194µs
├─ Worst:     4.680196ms
├─ Completed: 23.502147ms
├─ Workers:   0=25 1=19 2=16 3=24 4=16
└─ Errors:    0
```
#### posts10k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      809.558µs
├─ Worst:     4.282717ms
├─ Completed: 23.524546ms
├─ Workers:   0=26 1=18 2=16 3=24 4=16
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.820595ms
├─ Worst:     33.735512ms
├─ Completed: 99.237296ms
├─ Workers:   0=24 1=19 2=16 3=25 4=16
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      903.027µs
├─ Worst:     8.749897ms
├─ Completed: 27.035727ms
├─ Workers:   0=24 1=20 2=16 3=25 4=15
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      831.938µs
├─ Worst:     5.542146ms
├─ Completed: 24.997812ms
├─ Workers:   0=25 1=19 2=16 3=24 4=16
└─ Errors:    0
```
#### posts10k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      2.67105ms
├─ Worst:     32.395371ms
├─ Completed: 121.952604ms
├─ Workers:   0=29 2=24 3=24 4=23
└─ Errors:    0
```
#### posts10k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      7.153802ms
├─ Worst:     42.181349ms
├─ Completed: 168.446601ms
├─ Workers:   0=5 1=1 2=85 3=1 4=8
└─ Errors:    0
```
#### posts10k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      912.14µs
├─ Worst:     6.958973ms
├─ Completed: 32.451979ms
├─ Workers:   0=7 1=31 2=5 3=15 4=42
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      14.334402ms
├─ Worst:     77.548524ms
├─ Completed: 463.456125ms
├─ Workers:   0=14 1=29 2=8 3=23 4=26
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      727.145µs
├─ Worst:     7.890449ms
├─ Completed: 37.689323ms
├─ Workers:   0=8 1=34 2=11 3=19 4=28
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      5.000827ms
├─ Worst:     70.527988ms
├─ Completed: 260.253332ms
├─ Workers:   0=19 1=25 2=17 3=10 4=29
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      950.243µs
├─ Worst:     9.421134ms
├─ Completed: 29.307005ms
├─ Workers:   0=18 1=23 2=19 3=22 4=18
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      7.706385ms
├─ Worst:     66.497168ms
├─ Completed: 283.649743ms
├─ Workers:   0=17 1=17 2=16 3=24 4=26
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      750.516µs
├─ Worst:     6.631961ms
├─ Completed: 24.021093ms
├─ Workers:   0=24 1=20 2=16 3=24 4=16
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      35.090243ms
├─ Worst:     184.976836ms
├─ Completed: 1.082141093s
├─ Workers:   0=26 1=18 2=15 3=25 4=16
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.311602ms
├─ Worst:     22.499161ms
├─ Completed: 81.401237ms
├─ Workers:   0=24 1=19 2=16 3=25 4=16
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      97.997524ms
├─ Worst:     558.497415ms
├─ Completed: 2.953727581s
├─ Workers:   0=25 1=20 2=16 3=25 4=14
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.413052ms
├─ Worst:     11.578815ms
├─ Completed: 50.279736ms
├─ Workers:   0=25 1=18 2=17 3=24 4=16
└─ Errors:    0
```
#### posts25k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.07844ms
├─ Worst:     7.34141ms
├─ Completed: 2.543599745s
├─ Workers:   0=167 1=198 2=216 3=186 4=233
└─ Errors:    0
```
#### posts25k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      25.338232ms
├─ Worst:     282.203244ms
├─ Completed: 284.259085ms
├─ Workers:   0=173 1=201 2=217 3=189 4=220
└─ Errors:    0
```
#### posts25k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      27.6749ms
├─ Worst:     136.589344ms
├─ Completed: 138.26613ms
├─ Workers:   0=240 1=163 2=225 3=205 4=167
└─ Errors:    0
```
#### posts25k - mixed read and write (simpleA list with additional 300 concurrent random posts25k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      29.992171ms
├─ Worst:     310.290983ms
├─ Completed: 312.440432ms
├─ Workers:   0=239 1=162 2=225 3=205 4=169
└─ Errors:    0
```
#### posts25k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.386705ms
├─ Worst:     19.754228ms
├─ Completed: 92.259315ms
├─ Workers:   0=3 1=12 2=21 3=26 4=38
└─ Errors:    0
```
#### posts25k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      1.733655ms
├─ Worst:     35.183482ms
├─ Completed: 103.401628ms
├─ Workers:   0=9 1=18 2=15 3=20 4=38
└─ Errors:    0
```
#### posts25k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      1.548379ms
├─ Worst:     29.560184ms
├─ Completed: 113.6248ms
├─ Workers:   0=13 1=23 2=11 3=11 4=42
└─ Errors:    0
```
#### posts25k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      2.56275ms
├─ Worst:     25.211437ms
├─ Completed: 121.947978ms
├─ Workers:   0=17 1=36 2=12 3=16 4=19
└─ Errors:    0
```
#### posts25k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.140245ms
├─ Worst:     19.401111ms
├─ Completed: 71.058229ms
├─ Workers:   0=24 1=22 2=14 3=17 4=23
└─ Errors:    0
```
#### posts25k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      6.245376ms
├─ Worst:     73.433421ms
├─ Completed: 235.967314ms
├─ Workers:   0=25 1=20 2=15 3=15 4=25
└─ Errors:    0
```
#### posts25k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      832.56µs
├─ Worst:     8.76702ms
├─ Completed: 30.073032ms
├─ Workers:   0=25 1=20 2=15 3=15 4=25
└─ Errors:    0
```
#### posts25k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      850.755µs
├─ Worst:     7.917306ms
├─ Completed: 28.951203ms
├─ Workers:   0=25 1=20 2=15 3=15 4=25
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      3.983043ms
├─ Worst:     72.854951ms
├─ Completed: 231.746102ms
├─ Workers:   0=25 1=20 2=15 3=15 4=25
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      816.178µs
├─ Worst:     10.360662ms
├─ Completed: 35.620537ms
├─ Workers:   0=27 1=23 2=16 3=16 4=18
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      813.003µs
├─ Worst:     9.717344ms
├─ Completed: 36.983078ms
├─ Workers:   0=29 1=24 2=26 3=21
└─ Errors:    0
```
#### posts25k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      8.914824ms
├─ Worst:     66.367079ms
├─ Completed: 319.449866ms
├─ Workers:   0=18 1=17 2=33 3=32
└─ Errors:    0
```
#### posts25k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      6.401853ms
├─ Worst:     64.899923ms
├─ Completed: 342.285262ms
├─ Workers:   2=57 3=42 4=1
└─ Errors:    0
```
#### posts25k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      911.559µs
├─ Worst:     5.996023ms
├─ Completed: 28.470108ms
├─ Workers:   0=4 1=12 2=20 3=26 4=38
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      37.584329ms
├─ Worst:     348.306579ms
├─ Completed: 1.474310154s
├─ Workers:   0=8 1=19 2=15 3=20 4=38
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.038294ms
├─ Worst:     12.737956ms
├─ Completed: 51.341393ms
├─ Workers:   0=14 1=23 2=11 3=11 4=41
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      12.871961ms
├─ Worst:     98.184843ms
├─ Completed: 513.757242ms
├─ Workers:   0=16 1=37 2=12 3=16 4=19
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      945.697µs
├─ Worst:     5.777571ms
├─ Completed: 27.341329ms
├─ Workers:   0=25 1=20 2=15 3=17 4=23
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      19.498444ms
├─ Worst:     116.920312ms
├─ Completed: 624.231159ms
├─ Workers:   0=25 1=20 2=14 3=15 4=26
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      954.819µs
├─ Worst:     8.508904ms
├─ Completed: 35.665668ms
├─ Workers:   0=25 1=20 2=16 3=14 4=25
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      90.07587ms
├─ Worst:     653.444094ms
├─ Completed: 2.820041961s
├─ Workers:   0=24 1=23 2=14 3=15 4=24
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.160814ms
├─ Worst:     21.085597ms
├─ Completed: 73.656189ms
├─ Workers:   0=25 1=18 2=15 3=16 4=26
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      244.893034ms
├─ Worst:     2.113949789s
├─ Completed: 7.993951631s
├─ Workers:   0=27 1=23 2=17 3=16 4=17
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.496948ms
├─ Worst:     9.078741ms
├─ Completed: 47.546991ms
├─ Workers:   0=30 1=24 2=26 3=20
└─ Errors:    0
```
#### posts50k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.956052ms
├─ Worst:     8.591508ms
├─ Completed: 4.829231469s
├─ Workers:   0=159 1=191 2=206 3=209 4=235
└─ Errors:    0
```
#### posts50k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      24.183396ms
├─ Worst:     540.039767ms
├─ Completed: 542.45283ms
├─ Workers:   0=166 1=192 2=221 3=217 4=204
└─ Errors:    0
```
#### posts50k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      24.771869ms
├─ Worst:     104.139368ms
├─ Completed: 105.926597ms
├─ Workers:   0=184 1=216 2=212 3=215 4=173
└─ Errors:    0
```
#### posts50k - mixed read and write (simpleA list with additional 300 concurrent random posts50k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      32.010169ms
├─ Worst:     531.75981ms
├─ Completed: 533.53338ms
├─ Workers:   0=183 1=215 2=213 3=216 4=173
└─ Errors:    0
```
#### posts50k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      2.175275ms
├─ Worst:     31.408518ms
├─ Completed: 128.58018ms
├─ Workers:   0=23 1=23 2=30 3=17 4=7
└─ Errors:    0
```
#### posts50k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      2.874681ms
├─ Worst:     28.729577ms
├─ Completed: 160.867291ms
├─ Workers:   0=24 1=12 2=23 3=13 4=28
└─ Errors:    0
```
#### posts50k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      5.700335ms
├─ Worst:     42.096452ms
├─ Completed: 175.975571ms
├─ Workers:   0=11 1=7 2=10 3=7 4=65
└─ Errors:    0
```
#### posts50k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      3.54761ms
├─ Worst:     48.943821ms
├─ Completed: 187.482147ms
├─ Workers:   0=34 1=19 2=20 3=12 4=15
└─ Errors:    0
```
#### posts50k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.98271ms
├─ Worst:     23.915737ms
├─ Completed: 93.299293ms
├─ Workers:   0=23 1=24 2=24 3=15 4=14
└─ Errors:    0
```
#### posts50k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      16.028572ms
├─ Worst:     166.214027ms
├─ Completed: 626.153806ms
├─ Workers:   0=22 1=30 2=22 3=14 4=12
└─ Errors:    0
```
#### posts50k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      891.302µs
├─ Worst:     8.895218ms
├─ Completed: 30.889931ms
├─ Workers:   0=23 1=23 2=25 3=15 4=14
└─ Errors:    0
```
#### posts50k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      869.422µs
├─ Worst:     10.029955ms
├─ Completed: 34.066109ms
├─ Workers:   0=24 1=24 2=23 3=15 4=14
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      16.752953ms
├─ Worst:     123.25889ms
├─ Completed: 512.077602ms
├─ Workers:   0=23 1=23 2=24 3=16 4=14
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      924.758µs
├─ Worst:     7.096123ms
├─ Completed: 26.440584ms
├─ Workers:   0=21 1=20 2=21 3=26 4=12
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      890.289µs
├─ Worst:     4.302182ms
├─ Completed: 21.724579ms
├─ Workers:   0=12 1=28 2=27 3=17 4=16
└─ Errors:    0
```
#### posts50k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      31.023937ms
├─ Worst:     111.963205ms
├─ Completed: 607.359764ms
├─ Workers:   1=22 2=15 3=31 4=32
└─ Errors:    0
```
#### posts50k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      46.307599ms
├─ Worst:     118.43092ms
├─ Completed: 804.541379ms
├─ Workers:   1=1 2=1 3=63 4=35
└─ Errors:    0
```
#### posts50k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      884.082µs
├─ Worst:     8.087842ms
├─ Completed: 26.308873ms
├─ Workers:   0=24 1=23 2=29 3=17 4=7
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      83.489662ms
├─ Worst:     899.245583ms
├─ Completed: 3.745355693s
├─ Workers:   0=23 1=11 2=24 3=13 4=29
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.077298ms
├─ Worst:     9.706218ms
├─ Completed: 53.927345ms
├─ Workers:   0=12 1=7 2=10 3=6 4=65
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      35.636599ms
├─ Worst:     339.588906ms
├─ Completed: 1.303264985s
├─ Workers:   0=33 1=20 2=19 3=13 4=15
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      924.898µs
├─ Worst:     7.441899ms
├─ Completed: 24.655799ms
├─ Workers:   0=23 1=23 2=25 3=15 4=14
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      44.523346ms
├─ Worst:     398.983163ms
├─ Completed: 1.462111043s
├─ Workers:   0=23 1=30 2=21 3=14 4=12
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.059013ms
├─ Worst:     5.702338ms
├─ Completed: 28.433528ms
├─ Workers:   0=22 1=23 2=26 3=15 4=14
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      200.590975ms
├─ Worst:     1.242572884s
├─ Completed: 5.866070235s
├─ Workers:   0=24 1=24 2=23 3=15 4=14
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.591548ms
├─ Worst:     15.342164ms
├─ Completed: 65.125384ms
├─ Workers:   0=23 1=24 2=24 3=16 4=13
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      486.369898ms
├─ Worst:     4.630468333s
├─ Completed: 15.5844205s
├─ Workers:   0=21 1=19 2=21 3=26 4=13
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.624414ms
├─ Worst:     17.835698ms
├─ Completed: 61.264541ms
├─ Workers:   0=12 1=28 2=27 3=17 4=16
└─ Errors:    0
```
#### posts100k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      3.166845ms
├─ Worst:     15.202651ms
├─ Completed: 7.9948859s
├─ Workers:   0=184 1=186 2=192 3=201 4=237
└─ Errors:    0
```
#### posts100k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      33.512484ms
├─ Worst:     1.024545051s
├─ Completed: 1.026313323s
├─ Workers:   0=172 1=178 2=195 3=217 4=238
└─ Errors:    0
```
#### posts100k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      58.897781ms
├─ Worst:     155.250372ms
├─ Completed: 157.063858ms
├─ Workers:   0=226 1=244 2=240 3=147 4=143
└─ Errors:    0
```
#### posts100k - mixed read and write (simpleA list with additional 300 concurrent random posts100k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      37.250798ms
├─ Worst:     971.422327ms
├─ Completed: 973.120292ms
├─ Workers:   0=227 1=244 2=239 3=147 4=143
└─ Errors:    0
```
#### posts100k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      3.8375ms
├─ Worst:     45.558585ms
├─ Completed: 182.081016ms
├─ Workers:   0=13 1=11 2=9 3=36 4=31
└─ Errors:    0
```
#### posts100k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      6.976377ms
├─ Worst:     57.464552ms
├─ Completed: 214.490066ms
├─ Workers:   0=3 1=2 2=14 3=45 4=36
└─ Errors:    0
```
#### posts100k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      4.615607ms
├─ Worst:     54.911294ms
├─ Completed: 262.141572ms
├─ Workers:   0=3 1=4 2=2 3=33 4=58
└─ Errors:    0
```
#### posts100k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      4.949728ms
├─ Worst:     64.729047ms
├─ Completed: 185.251296ms
├─ Workers:   0=15 1=25 2=18 3=16 4=26
└─ Errors:    0
```
#### posts100k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      3.298266ms
├─ Worst:     45.59187ms
├─ Completed: 143.688349ms
├─ Workers:   0=15 1=25 2=24 3=14 4=22
└─ Errors:    0
```
#### posts100k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      30.958176ms
├─ Worst:     141.669151ms
├─ Completed: 842.443245ms
├─ Workers:   0=16 1=25 2=25 3=16 4=18
└─ Errors:    0
```
#### posts100k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      925.869µs
├─ Worst:     10.857559ms
├─ Completed: 35.874507ms
├─ Workers:   0=13 1=24 2=21 3=14 4=28
└─ Errors:    0
```
#### posts100k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      845.158µs
├─ Worst:     10.132097ms
├─ Completed: 32.176149ms
├─ Workers:   0=15 1=23 2=24 3=15 4=23
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      32.018571ms
├─ Worst:     148.585635ms
├─ Completed: 881.293502ms
├─ Workers:   0=15 1=24 2=24 3=14 4=23
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      925.028µs
├─ Worst:     4.637026ms
├─ Completed: 23.625666ms
├─ Workers:   0=17 1=27 2=26 3=17 4=13
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.142618ms
├─ Worst:     4.457577ms
├─ Completed: 24.999223ms
├─ Workers:   0=26 1=23 2=23 3=28
└─ Errors:    0
```
#### posts100k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      58.734686ms
├─ Worst:     177.643277ms
├─ Completed: 1.125218391s
├─ Workers:   0=28 1=30 2=30 3=12
└─ Errors:    0
```
#### posts100k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      62.51696ms
├─ Worst:     309.36812ms
├─ Completed: 1.912995481s
├─ Workers:   0=61 1=13 2=24 3=1 4=1
└─ Errors:    0
```
#### posts100k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      974.456µs
├─ Worst:     7.722677ms
├─ Completed: 30.473186ms
├─ Workers:   0=13 1=11 2=9 3=36 4=31
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      169.799088ms
├─ Worst:     1.529243678s
├─ Completed: 7.628188207s
├─ Workers:   0=3 1=2 2=14 3=45 4=36
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.187561ms
├─ Worst:     9.710114ms
├─ Completed: 53.672952ms
├─ Workers:   0=3 1=4 2=3 3=33 4=57
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      64.294366ms
├─ Worst:     463.822953ms
├─ Completed: 1.915167893s
├─ Workers:   0=16 1=24 2=18 3=15 4=27
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      961.728µs
├─ Worst:     9.468961ms
├─ Completed: 29.443803ms
├─ Workers:   0=14 1=26 2=24 3=15 4=21
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      88.156959ms
├─ Worst:     409.841264ms
├─ Completed: 2.323487253s
├─ Workers:   0=16 1=25 2=24 3=16 4=19
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      975.056µs
├─ Worst:     10.656911ms
├─ Completed: 29.516863ms
├─ Workers:   0=14 1=24 2=22 3=13 4=27
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      388.667011ms
├─ Worst:     2.284684791s
├─ Completed: 11.472803665s
├─ Workers:   0=14 1=23 2=24 3=15 4=24
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.351358ms
├─ Worst:     10.994068ms
├─ Completed: 66.99054ms
├─ Workers:   0=16 1=24 2=23 3=14 4=23
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      958.243052ms
├─ Worst:     6.863634496s
├─ Completed: 31.860952209s
├─ Workers:   0=17 1=26 2=27 3=18 4=12
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.595635ms
├─ Worst:     10.724444ms
├─ Completed: 51.703924ms
├─ Workers:   0=25 1=24 2=23 3=28
└─ Errors:    0
```

## Go vs JS route execution
#### JS route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      43.1808ms
├─ Worst:     1.378621369s
├─ Completed: 1.380157913s
├─ Workers:   0=109 1=59 2=80 3=127 4=125
└─ Errors:    0
```
#### Go route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      25.037506ms
├─ Worst:     1.327213774s
├─ Completed: 1.328082885s
├─ Workers:   0=73 1=122 2=112 3=74 4=119
└─ Errors:    0
```
#### JS route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      9.266741ms
├─ Worst:     264.235684ms
├─ Completed: 1.204951563s
├─ Workers:   0=106 1=119 2=103 3=91 4=81
└─ Errors:    0
```
#### Go route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      8.383871ms
├─ Worst:     479.578898ms
├─ Completed: 1.492578137s
├─ Workers:   0=108 1=45 2=80 3=142 4=125
└─ Errors:    0
```
#### JS route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      7.704542ms
├─ Worst:     45.759111ms
├─ Completed: 10.195517248s
├─ Workers:   0=68 1=130 2=129 3=67 4=106
└─ Errors:    0
```
#### Go route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      11.853654ms
├─ Worst:     29.327803ms
├─ Completed: 10.107336747s
├─ Workers:   0=113 1=94 2=103 3=93 4=97
└─ Errors:    0
```

## Go vs JS hooks execution
#### JS OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      1.055718ms
├─ Worst:     7.593319ms
├─ Completed: 31.115813ms
├─ Workers:   0=23 1=8 2=9 3=27 4=33
└─ Errors:    0
```
#### Go OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      812.472µs
├─ Worst:     6.249994ms
├─ Completed: 23.395869ms
├─ Workers:   0=23 1=16 2=15 3=19 4=27
└─ Errors:    0
```

## Deleting records
#### deleting 100 posts10k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      757.546µs
├─ Worst:     11.44507ms
├─ Completed: 38.961632ms
├─ Workers:   0=13 1=8 2=8 3=55 4=16
└─ Errors:    0
```
#### deleting 100 posts10k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      691.175µs
├─ Worst:     21.13726ms
├─ Completed: 34.386591ms
├─ Workers:   0=24 1=15 2=15 3=23 4=23
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      669.355µs
├─ Worst:     10.177529ms
├─ Completed: 32.910433ms
├─ Workers:   0=2 1=31 2=31 3=3 4=33
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      747.412µs
├─ Worst:     9.040348ms
├─ Completed: 36.21747ms
├─ Workers:   0=2 1=45 2=36 3=1 4=16
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      427.401µs
├─ Worst:     11.192811ms
├─ Completed: 28.95574ms
├─ Workers:   0=23 1=15 2=25 3=22 4=15
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      743.327µs
├─ Worst:     20.945654ms
├─ Completed: 38.981489ms
├─ Workers:   0=18 1=23 2=23 3=18 4=18
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      747.003µs
├─ Worst:     19.721093ms
├─ Completed: 42.549939ms
├─ Workers:   0=24 1=24 2=20 3=24 4=8
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      784.844µs
├─ Worst:     12.636746ms
├─ Completed: 35.916905ms
├─ Workers:   0=24 1=25 2=16 3=18 4=17
└─ Errors:    0
```
#### deleting 100 users - with cascade deleting all associated posts [conc:10, rule:`""`]
```
┌─ Best:      66.947851ms
├─ Worst:     3.150635722s
├─ Completed: 8.883564999s
├─ Workers:   0=16 1=32 2=19 3=9 4=24
└─ Errors:    0
```
#### deleting 100 organizations - with cascade deleting all users and associated posts [conc:10, rule:`""`]
```
┌─ Best:      57.625064ms
├─ Worst:     6.679564336s
├─ Completed: 19.290652255s
├─ Workers:   0=24 1=13 2=22 3=17 4=24
└─ Errors:    0
```

---------------------------------------------------
Completed!
