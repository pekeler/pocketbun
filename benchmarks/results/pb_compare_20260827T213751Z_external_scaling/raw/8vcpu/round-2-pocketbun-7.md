# PocketBun Upstream-Port Benchmark Result

- machine: hetzner-8vcpu-pocketbun-7
- timestamp: 2026-08-27T16:58:51.593Z
- tests: create,auth,search,custom,delete
- benchmark source: 05625dc2b2d3f9711c51566010944b10ca9531fa
- server workers: 7
- load generator: http://load-generator:19231
- benchmark target host: application-host
- warmup request target/cap: 1000
## Creating organizations (100)
#### Creating 50 organizations [reqs:50, conc:10, rule:`""`]
```
┌─ Best:      743.157µs
├─ Worst:     5.69767ms
├─ Completed: 13.173065ms
├─ Workers:   0=7 1=10 2=7 3=5 4=7 5=9 6=5
└─ Errors:    0
```
#### Creating 50 organizations [reqs:50, conc:10, rule:`"@request.body.name != ''"`]
```
┌─ Best:      848.372µs
├─ Worst:     4.307491ms
├─ Completed: 12.406386ms
├─ Workers:   0=2 1=10 2=9 4=9 5=12 6=8
└─ Errors:    0
```

## Creating permissions (50)
#### Creating 25 permissions [reqs:25, conc:5, rule:`""`]
```
┌─ Best:      696.723µs
├─ Worst:     4.889905ms
├─ Completed: 9.10093ms
├─ Workers:   1=8 2=8 5=8 6=1
└─ Errors:    0
```
#### Creating 25 permissions [reqs:25, conc:5, rule:`"@request.body.name != ''"`]
```
┌─ Best:      783.351µs
├─ Worst:     2.936987ms
├─ Completed: 8.689092ms
├─ Workers:   0=1 1=7 2=3 3=3 4=1 5=8 6=2
└─ Errors:    0
```

## Creating users (500 - expected to be slow due to passwordHash generation)
#### Creating 250 users [reqs:250, conc:50, rule:`""`]
```
┌─ Best:      90.938459ms
├─ Worst:     822.603614ms
├─ Completed: 2.091437808s
├─ Workers:   0=23 1=73 2=35 3=27 4=31 5=33 6=28
└─ Errors:    0
```
#### Creating 250 users [reqs:250, conc:50, rule:`"@request.body.email != '' && @request.body.permissions:length > 0"`]
```
┌─ Best:      141.062854ms
├─ Worst:     1.293413362s
├─ Completed: 2.082404821s
├─ Workers:   0=54 2=41 3=47 4=27 5=42 6=39
└─ Errors:    0
```

## Creating posts (10k, 25k, 50k, 100k)
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`""`]
```
┌─ Best:      443.233µs
├─ Worst:     359.777996ms
├─ Completed: 450.573586ms
├─ Workers:   0=751 1=733 2=772 3=732 4=744 5=571 6=697
└─ Errors:    0
```
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      1.69472ms
├─ Worst:     268.725669ms
├─ Completed: 455.341713ms
├─ Workers:   0=772 1=648 2=800 3=674 4=783 5=727 6=596
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`""`]
```
┌─ Best:      540.547µs
├─ Worst:     660.922371ms
├─ Completed: 759.721449ms
├─ Workers:   0=1907 1=1836 2=1511 3=1760 4=1878 5=2057 6=1551
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      760.57µs
├─ Worst:     397.948899ms
├─ Completed: 1.017383936s
├─ Workers:   0=1800 1=1911 2=1967 3=1670 4=1894 5=1989 6=1269
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`""`]
```
┌─ Best:      477.71µs
├─ Worst:     1.162502809s
├─ Completed: 1.493861028s
├─ Workers:   0=3818 1=3545 2=4010 3=3531 4=3094 5=3886 6=3116
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      486.502µs
├─ Worst:     796.605392ms
├─ Completed: 1.841935937s
├─ Workers:   0=3019 1=3659 2=4070 3=3435 4=3606 5=3983 6=3228
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`""`]
```
┌─ Best:      373.146µs
├─ Worst:     1.017080866s
├─ Completed: 2.686639541s
├─ Workers:   0=7077 1=7031 2=7486 3=6709 4=7434 5=7675 6=6588
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      485.852µs
├─ Worst:     908.92136ms
├─ Completed: 3.270397147s
├─ Workers:   0=7212 1=6296 2=7654 3=7430 4=6953 5=7419 6=7036
└─ Errors:    0
```

## User auth with password (expected to be slow due to passwordHash verification)
#### users auth with email/pass - high concurrency [reqs:250, conc:250]
```
┌─ Best:      418.538231ms
├─ Worst:     2.033435547s
├─ Completed: 2.033576231s
├─ Workers:   0=25 1=36 2=33 3=36 4=14 5=50 6=56
└─ Errors:    0
```
#### users auth with email/pass - small concurrency [reqs:250, conc:10]
```
┌─ Best:      62.111125ms
├─ Worst:     163.46312ms
├─ Completed: 2.102571937s
├─ Workers:   0=31 1=35 2=33 3=39 4=22 5=52 6=38
└─ Errors:    0
```

## User auth refresh
#### users - auth refresh (high concurrency) [reqs:1000, conc:1000]
```
┌─ Best:      27.379236ms
├─ Worst:     77.546285ms
├─ Completed: 80.34398ms
├─ Workers:   0=152 1=146 2=167 3=127 4=168 5=136 6=104
└─ Errors:    0
```
#### users - auth refresh (medium concurrency) [reqs:1000, conc:100]
```
┌─ Best:      398.33µs
├─ Worst:     16.652691ms
├─ Completed: 69.257506ms
├─ Workers:   0=149 1=166 2=83 3=169 4=135 5=135 6=163
└─ Errors:    0
```

## List records
#### users - getOne for auth refresh comparison (medium concurrency) [reqs:1000, conc:100, rule:`""`, query:`/0cc9c4w8gjtev7j`]
```
┌─ Best:      336.375µs
├─ Worst:     44.532487ms
├─ Completed: 67.672277ms
├─ Workers:   0=148 1=105 2=166 3=112 4=145 5=190 6=134
└─ Errors:    0
```
#### users - getOne for auth refresh comparison (high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`/0cc9c4w8gjtev7j`]
```
┌─ Best:      23.616899ms
├─ Worst:     64.141351ms
├─ Completed: 65.885609ms
├─ Workers:   0=147 1=159 2=127 3=133 4=153 5=163 6=118
└─ Errors:    0
```
#### posts10k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.439708ms
├─ Worst:     5.475373ms
├─ Completed: 1.904350543s
├─ Workers:   0=137 1=149 2=175 3=149 4=83 5=150 6=157
└─ Errors:    0
```
#### posts10k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      24.630889ms
├─ Worst:     190.529643ms
├─ Completed: 192.231905ms
├─ Workers:   0=144 1=137 2=164 3=122 4=162 5=156 6=115
└─ Errors:    0
```
#### posts10k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      27.091998ms
├─ Worst:     112.555748ms
├─ Completed: 114.297514ms
├─ Workers:   0=113 1=156 2=135 3=152 4=132 5=149 6=163
└─ Errors:    0
```
#### posts10k - mixed read and write (simpleA list with additional 300 concurrent random posts10k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      24.548575ms
├─ Worst:     188.650247ms
├─ Completed: 190.738932ms
├─ Workers:   0=114 1=155 2=135 3=153 4=132 5=150 6=161
└─ Errors:    0
```
#### posts10k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      2.481798ms
├─ Worst:     17.785184ms
├─ Completed: 67.254031ms
├─ Workers:   0=16 1=18 2=20 3=17 4=6 5=18 6=5
└─ Errors:    0
```
#### posts10k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      1.617784ms
├─ Worst:     18.008693ms
├─ Completed: 78.616352ms
├─ Workers:   0=17 1=9 2=23 3=10 4=11 5=21 6=9
└─ Errors:    0
```
#### posts10k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      2.510368ms
├─ Worst:     21.319095ms
├─ Completed: 77.521ms
├─ Workers:   0=28 1=9 2=19 3=11 4=16 5=7 6=10
└─ Errors:    0
```
#### posts10k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      3.473659ms
├─ Worst:     40.480851ms
├─ Completed: 121.08575ms
├─ Workers:   0=17 1=11 2=8 3=12 4=27 5=13 6=12
└─ Errors:    0
```
#### posts10k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.53572ms
├─ Worst:     16.194677ms
├─ Completed: 48.668539ms
├─ Workers:   0=15 1=12 2=23 3=15 4=10 5=14 6=11
└─ Errors:    0
```
#### posts10k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      3.956615ms
├─ Worst:     37.382051ms
├─ Completed: 118.459282ms
├─ Workers:   0=14 1=7 2=24 3=15 4=10 5=15 6=15
└─ Errors:    0
```
#### posts10k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      902.987µs
├─ Worst:     9.037412ms
├─ Completed: 29.78587ms
├─ Workers:   0=16 1=6 2=23 3=14 4=11 5=15 6=15
└─ Errors:    0
```
#### posts10k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      932.639µs
├─ Worst:     4.578763ms
├─ Completed: 19.981148ms
├─ Workers:   0=14 1=11 2=22 3=15 4=9 5=14 6=15
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      4.066927ms
├─ Worst:     34.86232ms
├─ Completed: 109.163933ms
├─ Workers:   0=14 1=12 2=22 3=14 4=9 5=15 6=14
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      876.38µs
├─ Worst:     5.630096ms
├─ Completed: 23.226309ms
├─ Workers:   0=16 1=13 2=16 3=15 4=9 5=16 6=15
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      926.571µs
├─ Worst:     10.906503ms
├─ Completed: 30.60461ms
├─ Workers:   0=16 1=14 3=17 4=11 5=26 6=16
└─ Errors:    0
```
#### posts10k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      4.013033ms
├─ Worst:     41.760228ms
├─ Completed: 147.890642ms
├─ Workers:   1=23 3=14 4=14 5=28 6=21
└─ Errors:    0
```
#### posts10k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      2.74462ms
├─ Worst:     34.442341ms
├─ Completed: 176.807519ms
├─ Workers:   1=42 2=2 3=1 4=47 5=3 6=5
└─ Errors:    0
```
#### posts10k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.033868ms
├─ Worst:     5.300631ms
├─ Completed: 25.657267ms
├─ Workers:   0=18 1=17 2=19 3=17 4=7 5=16 6=6
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      14.623377ms
├─ Worst:     103.35458ms
├─ Completed: 449.419582ms
├─ Workers:   0=15 1=9 2=23 3=11 4=12 5=21 6=9
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.228827ms
├─ Worst:     7.741662ms
├─ Completed: 34.989136ms
├─ Workers:   0=30 1=9 2=19 3=10 4=15 5=7 6=10
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      6.259566ms
├─ Worst:     74.278891ms
├─ Completed: 264.158747ms
├─ Workers:   0=16 1=11 2=8 3=12 4=28 5=13 6=12
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.027799ms
├─ Worst:     8.31899ms
├─ Completed: 26.291253ms
├─ Workers:   0=15 1=11 2=24 3=15 4=9 5=15 6=11
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      8.650037ms
├─ Worst:     60.983449ms
├─ Completed: 268.029732ms
├─ Workers:   0=15 1=7 2=23 3=15 4=11 5=14 6=15
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.016033ms
├─ Worst:     8.684704ms
├─ Completed: 29.401588ms
├─ Workers:   0=15 1=7 2=24 3=14 4=10 5=15 6=15
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      37.324762ms
├─ Worst:     179.763654ms
├─ Completed: 981.030155ms
├─ Workers:   0=15 1=11 2=21 3=15 4=9 5=14 6=15
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.262615ms
├─ Worst:     11.441603ms
├─ Completed: 52.793146ms
├─ Workers:   0=13 1=12 2=23 3=15 4=8 5=15 6=14
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      97.481888ms
├─ Worst:     516.736959ms
├─ Completed: 2.643141493s
├─ Workers:   0=16 1=12 2=14 3=15 4=10 5=18 6=15
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.678609ms
├─ Worst:     10.385394ms
├─ Completed: 45.001936ms
├─ Workers:   0=15 1=16 3=17 4=11 5=24 6=17
└─ Errors:    0
```
#### posts25k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.191304ms
├─ Worst:     6.271942ms
├─ Completed: 2.890037868s
├─ Workers:   0=140 1=146 2=165 3=124 4=161 5=146 6=118
└─ Errors:    0
```
#### posts25k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      26.432428ms
├─ Worst:     269.372327ms
├─ Completed: 271.444079ms
├─ Workers:   0=139 1=159 2=133 3=126 4=162 5=161 6=120
└─ Errors:    0
```
#### posts25k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      27.139755ms
├─ Worst:     104.610815ms
├─ Completed: 106.570742ms
├─ Workers:   0=142 1=115 2=176 3=141 4=126 5=137 6=163
└─ Errors:    0
```
#### posts25k - mixed read and write (simpleA list with additional 300 concurrent random posts25k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      30.302412ms
├─ Worst:     293.660324ms
├─ Completed: 295.565083ms
├─ Workers:   0=141 1=117 2=178 3=140 4=125 5=137 6=162
└─ Errors:    0
```
#### posts25k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.927192ms
├─ Worst:     21.56105ms
├─ Completed: 84.920489ms
├─ Workers:   0=10 1=21 2=14 3=15 4=18 5=21 6=1
└─ Errors:    0
```
#### posts25k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      2.018669ms
├─ Worst:     25.026136ms
├─ Completed: 81.467099ms
├─ Workers:   0=4 1=24 2=8 3=14 4=20 5=25 6=5
└─ Errors:    0
```
#### posts25k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      2.422736ms
├─ Worst:     31.35702ms
├─ Completed: 125.056294ms
├─ Workers:   0=22 1=16 2=4 3=4 4=24 5=23 6=7
└─ Errors:    0
```
#### posts25k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      3.034371ms
├─ Worst:     43.465653ms
├─ Completed: 99.269687ms
├─ Workers:   0=15 1=18 2=13 3=14 4=13 5=13 6=14
└─ Errors:    0
```
#### posts25k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.15109ms
├─ Worst:     13.853143ms
├─ Completed: 52.45526ms
├─ Workers:   0=10 1=23 2=13 3=14 4=14 5=13 6=13
└─ Errors:    0
```
#### posts25k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      7.260027ms
├─ Worst:     62.532477ms
├─ Completed: 197.654702ms
├─ Workers:   0=11 1=20 2=15 3=13 4=14 5=14 6=13
└─ Errors:    0
```
#### posts25k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.0944ms
├─ Worst:     5.020755ms
├─ Completed: 24.021337ms
├─ Workers:   0=10 1=23 2=14 3=14 4=13 5=13 6=13
└─ Errors:    0
```
#### posts25k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      577.328µs
├─ Worst:     7.979721ms
├─ Completed: 25.057229ms
├─ Workers:   0=11 1=22 2=12 3=13 4=14 5=14 6=14
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      7.654592ms
├─ Worst:     73.73452ms
├─ Completed: 205.567784ms
├─ Workers:   0=12 1=18 2=15 3=14 4=13 5=14 6=14
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      555.278µs
├─ Worst:     11.833764ms
├─ Completed: 30.167546ms
├─ Workers:   0=14 2=16 3=17 4=17 5=18 6=18
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      958.954µs
├─ Worst:     7.14616ms
├─ Completed: 25.392742ms
├─ Workers:   0=12 2=15 3=18 4=16 5=18 6=21
└─ Errors:    0
```
#### posts25k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      9.52123ms
├─ Worst:     65.834179ms
├─ Completed: 293.72317ms
├─ Workers:   0=13 2=15 3=19 4=14 5=12 6=27
└─ Errors:    0
```
#### posts25k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      6.539923ms
├─ Worst:     69.844046ms
├─ Completed: 357.828019ms
├─ Workers:   0=39 1=2 2=47 3=2 4=2 5=5 6=3
└─ Errors:    0
```
#### posts25k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.077298ms
├─ Worst:     7.347317ms
├─ Completed: 26.446587ms
├─ Workers:   0=10 1=21 2=14 3=15 4=17 5=22 6=1
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      39.148781ms
├─ Worst:     196.822925ms
├─ Completed: 1.100169165s
├─ Workers:   0=6 1=24 2=7 3=12 4=20 5=26 6=5
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.156446ms
├─ Worst:     10.709662ms
├─ Completed: 40.026744ms
├─ Workers:   0=22 1=15 2=5 3=5 4=24 5=21 6=8
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      16.694037ms
├─ Worst:     106.848295ms
├─ Completed: 475.631556ms
├─ Workers:   0=14 1=19 2=13 3=14 4=14 5=13 6=13
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.002735ms
├─ Worst:     8.671196ms
├─ Completed: 28.84528ms
├─ Workers:   0=10 1=22 2=13 3=14 4=13 5=13 6=15
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      20.743962ms
├─ Worst:     105.946759ms
├─ Completed: 522.343373ms
├─ Workers:   0=11 1=21 2=15 3=13 4=14 5=14 6=12
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.091988ms
├─ Worst:     7.215295ms
├─ Completed: 27.593401ms
├─ Workers:   0=11 1=22 2=14 3=15 4=12 5=13 6=13
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      100.149973ms
├─ Worst:     715.063561ms
├─ Completed: 2.759392093s
├─ Workers:   0=10 1=22 2=13 3=12 4=15 5=14 6=14
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.725073ms
├─ Worst:     39.659857ms
├─ Completed: 93.82664ms
├─ Workers:   0=12 1=17 2=14 3=14 4=15 5=13 6=15
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      241.257626ms
├─ Worst:     1.681576413s
├─ Completed: 7.672095636s
├─ Workers:   0=14 2=16 3=17 4=15 5=20 6=18
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.7883ms
├─ Worst:     11.138914ms
├─ Completed: 49.559299ms
├─ Workers:   0=12 2=16 3=18 4=16 5=17 6=21
└─ Errors:    0
```
#### posts50k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      2.568086ms
├─ Worst:     9.04299ms
├─ Completed: 5.13343115s
├─ Workers:   0=146 1=170 2=155 3=121 4=145 5=153 6=110
└─ Errors:    0
```
#### posts50k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      21.935296ms
├─ Worst:     458.820778ms
├─ Completed: 460.48062ms
├─ Workers:   0=152 1=121 2=160 3=130 4=151 5=162 6=124
└─ Errors:    0
```
#### posts50k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      34.863933ms
├─ Worst:     115.110016ms
├─ Completed: 116.819688ms
├─ Workers:   0=127 1=143 2=194 3=134 4=132 5=135 6=135
└─ Errors:    0
```
#### posts50k - mixed read and write (simpleA list with additional 300 concurrent random posts50k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      31.131768ms
├─ Worst:     521.216616ms
├─ Completed: 523.839539ms
├─ Workers:   0=129 1=143 2=194 3=133 4=131 5=135 6=135
└─ Errors:    0
```
#### posts50k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      2.487285ms
├─ Worst:     20.719027ms
├─ Completed: 99.867074ms
├─ Workers:   0=18 1=18 2=6 3=16 4=8 5=15 6=19
└─ Errors:    0
```
#### posts50k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      3.11342ms
├─ Worst:     27.836077ms
├─ Completed: 134.833137ms
├─ Workers:   0=32 1=20 2=2 3=16 4=5 5=15 6=10
└─ Errors:    0
```
#### posts50k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      3.376043ms
├─ Worst:     30.822702ms
├─ Completed: 161.701236ms
├─ Workers:   0=6 1=8 2=4 3=6 4=46 5=23 6=7
└─ Errors:    0
```
#### posts50k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      3.660666ms
├─ Worst:     34.435521ms
├─ Completed: 154.498218ms
├─ Workers:   0=12 1=11 2=12 3=12 4=9 5=26 6=18
└─ Errors:    0
```
#### posts50k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      2.481118ms
├─ Worst:     18.806005ms
├─ Completed: 81.279752ms
├─ Workers:   0=13 1=14 2=12 3=13 4=12 5=14 6=22
└─ Errors:    0
```
#### posts50k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      17.62326ms
├─ Worst:     134.072586ms
├─ Completed: 522.323816ms
├─ Workers:   0=14 1=13 2=13 3=14 4=11 5=13 6=22
└─ Errors:    0
```
#### posts50k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      988.946µs
├─ Worst:     5.825006ms
├─ Completed: 24.550167ms
├─ Workers:   0=13 1=14 2=13 3=13 4=11 5=14 6=22
└─ Errors:    0
```
#### posts50k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      927.382µs
├─ Worst:     7.919358ms
├─ Completed: 23.951762ms
├─ Workers:   0=13 1=13 2=13 3=14 4=12 5=13 6=22
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      17.38343ms
├─ Worst:     125.367403ms
├─ Completed: 497.410216ms
├─ Workers:   0=14 1=14 2=12 3=13 4=12 5=14 6=21
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      876.1µs
├─ Worst:     6.686205ms
├─ Completed: 25.004386ms
├─ Workers:   0=20 1=16 2=16 3=19 4=14 5=15
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      895.587µs
├─ Worst:     7.755221ms
├─ Completed: 24.507609ms
├─ Workers:   0=23 1=14 2=13 3=23 4=12 5=15
└─ Errors:    0
```
#### posts50k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      17.963171ms
├─ Worst:     170.785704ms
├─ Completed: 526.412913ms
├─ Workers:   0=5 1=22 2=20 3=10 4=20 5=23
└─ Errors:    0
```
#### posts50k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      15.460363ms
├─ Worst:     151.782447ms
├─ Completed: 892.942643ms
├─ Workers:   0=1 1=10 2=65 3=1 4=18 5=4 6=1
└─ Errors:    0
```
#### posts50k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.005279ms
├─ Worst:     6.433165ms
├─ Completed: 21.492896ms
├─ Workers:   0=19 1=17 2=5 3=17 4=8 5=15 6=19
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      86.423305ms
├─ Worst:     883.959875ms
├─ Completed: 2.900821627s
├─ Workers:   0=31 1=21 2=2 3=15 4=6 5=15 6=10
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.152141ms
├─ Worst:     9.737981ms
├─ Completed: 43.454367ms
├─ Workers:   0=6 1=7 2=5 3=6 4=45 5=23 6=8
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      34.239921ms
├─ Worst:     312.657773ms
├─ Completed: 1.091445156s
├─ Workers:   0=13 1=11 2=12 3=12 4=10 5=25 6=17
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.027379ms
├─ Worst:     8.182051ms
├─ Completed: 31.010501ms
├─ Workers:   0=13 1=14 2=12 3=13 4=12 5=14 6=22
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      45.456152ms
├─ Worst:     394.854879ms
├─ Completed: 1.345578436s
├─ Workers:   0=13 1=12 2=13 3=14 4=11 5=14 6=23
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.035129ms
├─ Worst:     5.452872ms
├─ Completed: 27.503177ms
├─ Workers:   0=13 1=15 2=13 3=13 4=11 5=13 6=22
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      221.160409ms
├─ Worst:     1.406324646s
├─ Completed: 5.734945864s
├─ Workers:   0=13 1=13 2=13 3=14 4=12 5=13 6=22
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      3.050423ms
├─ Worst:     16.781228ms
├─ Completed: 61.892875ms
├─ Workers:   0=14 1=15 2=13 3=13 4=12 5=14 6=19
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      561.015615ms
├─ Worst:     3.173951437s
├─ Completed: 15.301233999s
├─ Workers:   0=20 1=15 2=15 3=20 4=14 5=16
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.812013ms
├─ Worst:     16.648995ms
├─ Completed: 54.161946ms
├─ Workers:   0=24 1=14 2=13 3=23 4=13 5=13
└─ Errors:    0
```
#### posts100k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      3.67056ms
├─ Worst:     15.613615ms
├─ Completed: 8.49590321s
├─ Workers:   0=126 1=142 2=160 3=114 4=153 5=160 6=145
└─ Errors:    0
```
#### posts100k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      23.649604ms
├─ Worst:     843.321606ms
├─ Completed: 845.000574ms
├─ Workers:   0=145 1=147 2=163 3=129 4=156 5=163 6=97
└─ Errors:    0
```
#### posts100k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      34.952617ms
├─ Worst:     117.991605ms
├─ Completed: 119.737066ms
├─ Workers:   0=126 1=134 2=179 3=136 4=130 5=133 6=162
└─ Errors:    0
```
#### posts100k - mixed read and write (simpleA list with additional 300 concurrent random posts100k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      31.830693ms
├─ Worst:     926.916895ms
├─ Completed: 929.468028ms
├─ Workers:   0=126 1=134 2=178 3=137 4=131 5=133 6=161
└─ Errors:    0
```
#### posts100k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      4.255267ms
├─ Worst:     39.679895ms
├─ Completed: 138.038403ms
├─ Workers:   0=12 1=17 2=18 3=15 4=15 5=21 6=2
└─ Errors:    0
```
#### posts100k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      4.715182ms
├─ Worst:     48.770198ms
├─ Completed: 191.183346ms
├─ Workers:   0=27 1=19 2=2 3=11 4=19 5=20 6=2
└─ Errors:    0
```
#### posts100k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      4.646799ms
├─ Worst:     64.674646ms
├─ Completed: 218.196065ms
├─ Workers:   0=18 1=18 2=5 3=5 4=25 5=24 6=5
└─ Errors:    0
```
#### posts100k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      5.932094ms
├─ Worst:     41.064337ms
├─ Completed: 172.255685ms
├─ Workers:   0=13 1=13 2=13 3=13 4=14 5=21 6=13
└─ Errors:    0
```
#### posts100k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      4.191889ms
├─ Worst:     33.419147ms
├─ Completed: 113.846171ms
├─ Workers:   0=12 1=13 2=13 3=14 4=13 5=22 6=13
└─ Errors:    0
```
#### posts100k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      33.655773ms
├─ Worst:     259.27469ms
├─ Completed: 930.241798ms
├─ Workers:   0=13 1=14 2=13 3=13 4=13 5=21 6=13
└─ Errors:    0
```
#### posts100k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      954.318µs
├─ Worst:     9.030452ms
├─ Completed: 28.60589ms
├─ Workers:   0=12 1=13 2=16 3=13 4=13 5=20 6=13
└─ Errors:    0
```
#### posts100k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      991.098µs
├─ Worst:     7.120625ms
├─ Completed: 23.612332ms
├─ Workers:   0=12 1=13 2=13 3=14 4=14 5=21 6=13
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      34.746872ms
├─ Worst:     200.985033ms
├─ Completed: 817.707959ms
├─ Workers:   0=13 1=14 2=13 3=17 4=13 5=17 6=13
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.029072ms
├─ Worst:     6.153369ms
├─ Completed: 22.970036ms
├─ Workers:   0=12 1=12 2=13 3=21 4=15 5=15 6=12
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      900.023µs
├─ Worst:     6.838295ms
├─ Completed: 25.94819ms
├─ Workers:   0=12 1=14 2=13 3=26 4=21 6=14
└─ Errors:    0
```
#### posts100k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      34.530002ms
├─ Worst:     275.780608ms
├─ Completed: 1.028670804s
├─ Workers:   0=21 1=18 2=19 3=7 4=15 6=20
└─ Errors:    0
```
#### posts100k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      29.832664ms
├─ Worst:     325.737608ms
├─ Completed: 1.606123651s
├─ Workers:   0=6 1=9 2=51 3=1 4=1 5=1 6=31
└─ Errors:    0
```
#### posts100k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.001493ms
├─ Worst:     6.440115ms
├─ Completed: 25.736006ms
├─ Workers:   0=12 1=17 2=18 3=16 4=15 5=21 6=1
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      188.22438ms
├─ Worst:     1.716286655s
├─ Completed: 6.289811539s
├─ Workers:   0=29 1=18 2=1 3=9 4=20 5=21 6=2
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.119316ms
├─ Worst:     9.536082ms
├─ Completed: 35.351135ms
├─ Workers:   0=17 1=18 2=5 3=6 4=24 5=23 6=7
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      76.777963ms
├─ Worst:     526.471955ms
├─ Completed: 1.963252094s
├─ Workers:   0=13 1=13 2=13 3=13 4=14 5=22 6=12
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      978.913µs
├─ Worst:     7.308154ms
├─ Completed: 24.915293ms
├─ Workers:   0=12 1=14 2=13 3=14 4=13 5=21 6=13
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      90.26403ms
├─ Worst:     663.924709ms
├─ Completed: 2.433010968s
├─ Workers:   0=13 1=13 2=13 3=14 4=13 5=21 6=13
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.156768ms
├─ Worst:     4.316732ms
├─ Completed: 21.920706ms
├─ Workers:   0=12 1=13 2=16 3=12 4=13 5=21 6=13
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      479.50108ms
├─ Worst:     2.852410026s
├─ Completed: 11.144899721s
├─ Workers:   0=12 1=13 2=14 3=14 4=14 5=20 6=13
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.930737ms
├─ Worst:     14.443389ms
├─ Completed: 61.863153ms
├─ Workers:   0=13 1=14 2=13 3=17 4=13 5=17 6=13
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      959.735323ms
├─ Worst:     5.471409526s
├─ Completed: 27.854573049s
├─ Workers:   0=12 1=12 2=11 3=24 4=15 5=14 6=12
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.185337ms
├─ Worst:     10.502056ms
├─ Completed: 43.728505ms
├─ Workers:   0=12 1=14 2=15 3=23 4=21 6=15
└─ Errors:    0
```

## Go vs JS route execution
#### JS route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      40.250783ms
├─ Worst:     1.024043322s
├─ Completed: 1.025008996s
├─ Workers:   0=85 1=80 2=94 3=39 4=75 5=67 6=60
└─ Errors:    0
```
#### Go route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      22.45955ms
├─ Worst:     1.193237196s
├─ Completed: 1.194105786s
├─ Workers:   0=62 1=67 2=68 3=67 4=67 5=105 6=64
└─ Errors:    0
```
#### JS route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      8.958973ms
├─ Worst:     271.122524ms
├─ Completed: 978.750104ms
├─ Workers:   0=77 1=65 2=66 3=91 4=76 5=58 6=67
└─ Errors:    0
```
#### Go route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      8.729737ms
├─ Worst:     275.447147ms
├─ Completed: 1.099163835s
├─ Workers:   0=71 1=94 2=94 3=39 4=75 5=67 6=60
└─ Errors:    0
```
#### JS route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      8.702549ms
├─ Worst:     30.486917ms
├─ Completed: 8.990329544s
├─ Workers:   0=64 1=60 2=69 3=69 4=68 5=105 6=65
└─ Errors:    0
```
#### Go route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      10.611917ms
├─ Worst:     23.119402ms
├─ Completed: 9.122364008s
├─ Workers:   0=86 1=59 2=81 3=72 4=76 5=59 6=67
└─ Errors:    0
```

## Go vs JS hooks execution
#### JS OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      901.225µs
├─ Worst:     13.631217ms
├─ Completed: 30.036966ms
├─ Workers:   0=13 1=15 2=21 3=8 4=15 5=17 6=11
└─ Errors:    0
```
#### Go OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      868.278µs
├─ Worst:     13.285399ms
├─ Completed: 27.483149ms
├─ Workers:   0=14 1=14 2=20 3=12 4=13 5=14 6=13
└─ Errors:    0
```

## Deleting records
#### deleting 100 posts10k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      673.039µs
├─ Worst:     38.764741ms
├─ Completed: 65.207212ms
├─ Workers:   0=7 1=38 2=10 3=9 4=20 5=8 6=8
└─ Errors:    0
```
#### deleting 100 posts10k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      722.086µs
├─ Worst:     35.666461ms
├─ Completed: 47.392446ms
├─ Workers:   0=13 1=20 2=13 3=13 4=13 5=14 6=14
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      757.055µs
├─ Worst:     36.249827ms
├─ Completed: 54.813446ms
├─ Workers:   0=18 1=5 2=15 3=18 4=15 5=14 6=15
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      853.208µs
├─ Worst:     12.051295ms
├─ Completed: 40.253457ms
├─ Workers:   0=5 1=4 2=13 3=9 4=11 5=50 6=8
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      752.659µs
├─ Worst:     35.4625ms
├─ Completed: 52.835296ms
├─ Workers:   0=14 1=17 2=14 3=14 4=14 5=13 6=14
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      841.253µs
├─ Worst:     21.220188ms
├─ Completed: 38.066276ms
├─ Workers:   0=14 1=14 2=14 3=15 4=14 5=14 6=15
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      515.592µs
├─ Worst:     21.072754ms
├─ Completed: 36.876263ms
├─ Workers:   0=14 1=12 2=15 3=17 4=16 5=9 6=17
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      815.216µs
├─ Worst:     22.807791ms
├─ Completed: 41.003754ms
├─ Workers:   0=14 1=12 2=14 3=19 4=14 5=14 6=13
└─ Errors:    0
```
#### deleting 100 users - with cascade deleting all associated posts [conc:10, rule:`""`]
```
┌─ Best:      71.324491ms
├─ Worst:     3.154252742s
├─ Completed: 9.612566374s
├─ Workers:   0=21 1=8 2=11 3=26 4=18 5=8 6=8
└─ Errors:    0
```
#### deleting 100 organizations - with cascade deleting all users and associated posts [conc:10, rule:`""`]
```
┌─ Best:      3.254916ms
├─ Worst:     8.598717364s
├─ Completed: 20.579703231s
├─ Workers:   0=17 1=13 2=20 3=9 4=13 5=14 6=14
└─ Errors:    0
```

---------------------------------------------------
Completed!
