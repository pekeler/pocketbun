# PocketBun Upstream-Port Benchmark Result

- machine: hetzner-8vcpu-pocketbun-7
- timestamp: 2026-08-27T14:46:37.961Z
- tests: create,auth,search,custom,delete
- benchmark source: 05625dc2b2d3f9711c51566010944b10ca9531fa
- server workers: 7
- load generator: http://load-generator:19231
- benchmark target host: application-host
- warmup request target/cap: 1000
## Creating organizations (100)
#### Creating 50 organizations [reqs:50, conc:10, rule:`""`]
```
┌─ Best:      480.183µs
├─ Worst:     11.442488ms
├─ Completed: 14.717562ms
├─ Workers:   0=8 1=8 2=6 3=7 4=7 5=7 6=7
└─ Errors:    0
```
#### Creating 50 organizations [reqs:50, conc:10, rule:`"@request.body.name != ''"`]
```
┌─ Best:      704.824µs
├─ Worst:     14.162466ms
├─ Completed: 14.187922ms
├─ Workers:   0=7 1=8 2=7 3=7 4=7 5=8 6=6
└─ Errors:    0
```

## Creating permissions (50)
#### Creating 25 permissions [reqs:25, conc:5, rule:`""`]
```
┌─ Best:      759.579µs
├─ Worst:     3.727049ms
├─ Completed: 8.017708ms
├─ Workers:   0=3 1=5 2=4 3=4 4=2 5=3 6=4
└─ Errors:    0
```
#### Creating 25 permissions [reqs:25, conc:5, rule:`"@request.body.name != ''"`]
```
┌─ Best:      875.21µs
├─ Worst:     3.484825ms
├─ Completed: 8.184218ms
├─ Workers:   0=2 1=8 2=3 3=2 4=3 5=4 6=3
└─ Errors:    0
```

## Creating users (500 - expected to be slow due to passwordHash generation)
#### Creating 250 users [reqs:250, conc:50, rule:`""`]
```
┌─ Best:      172.312177ms
├─ Worst:     1.025730306s
├─ Completed: 2.05011829s
├─ Workers:   0=29 1=40 2=35 3=44 4=32 5=39 6=31
└─ Errors:    0
```
#### Creating 250 users [reqs:250, conc:50, rule:`"@request.body.email != '' && @request.body.permissions:length > 0"`]
```
┌─ Best:      172.080486ms
├─ Worst:     748.601904ms
├─ Completed: 2.073272948s
├─ Workers:   0=39 1=30 2=39 3=34 4=40 5=37 6=31
└─ Errors:    0
```

## Creating posts (10k, 25k, 50k, 100k)
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`""`]
```
┌─ Best:      1.724623ms
├─ Worst:     285.441879ms
├─ Completed: 431.783185ms
├─ Workers:   0=700 1=766 2=744 3=700 4=769 5=722 6=599
└─ Errors:    0
```
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      681.111µs
├─ Worst:     281.388328ms
├─ Completed: 434.767298ms
├─ Workers:   0=784 1=746 2=660 3=659 4=697 5=772 6=682
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`""`]
```
┌─ Best:      2.341544ms
├─ Worst:     306.070108ms
├─ Completed: 901.102229ms
├─ Workers:   0=1733 1=1863 2=1777 3=1770 4=1847 5=1841 6=1669
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      3.890915ms
├─ Worst:     452.128283ms
├─ Completed: 1.0220993s
├─ Workers:   0=1766 1=1841 2=1751 3=1734 4=1916 5=1876 6=1616
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`""`]
```
┌─ Best:      921.132µs
├─ Worst:     373.302723ms
├─ Completed: 1.695547355s
├─ Workers:   0=3422 1=3893 2=3496 3=3532 4=3639 5=3732 6=3286
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      2.82283ms
├─ Worst:     306.319272ms
├─ Completed: 1.793054776s
├─ Workers:   0=3514 1=3818 2=3609 3=3342 4=3737 5=3648 6=3332
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`""`]
```
┌─ Best:      2.977794ms
├─ Worst:     684.579914ms
├─ Completed: 3.364895055s
├─ Workers:   0=6775 1=7835 2=7102 3=7030 4=7390 5=7299 6=6569
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      9.77955ms
├─ Worst:     407.19123ms
├─ Completed: 3.598590814s
├─ Workers:   0=6955 1=7538 2=7148 3=7107 4=7533 5=7187 6=6532
└─ Errors:    0
```

## User auth with password (expected to be slow due to passwordHash verification)
#### users auth with email/pass - high concurrency [reqs:250, conc:250]
```
┌─ Best:      136.357995ms
├─ Worst:     2.04338629s
├─ Completed: 2.043526002s
├─ Workers:   0=20 1=51 2=44 3=36 4=27 5=37 6=35
└─ Errors:    0
```
#### users auth with email/pass - small concurrency [reqs:250, conc:10]
```
┌─ Best:      62.671343ms
├─ Worst:     140.182559ms
├─ Completed: 2.099462922s
├─ Workers:   0=33 1=43 2=44 3=32 4=34 5=32 6=32
└─ Errors:    0
```

## User auth refresh
#### users - auth refresh (high concurrency) [reqs:1000, conc:1000]
```
┌─ Best:      27.133566ms
├─ Worst:     69.224217ms
├─ Completed: 70.912559ms
├─ Workers:   0=143 1=137 2=125 3=146 4=159 5=154 6=136
└─ Errors:    0
```
#### users - auth refresh (medium concurrency) [reqs:1000, conc:100]
```
┌─ Best:      593.38µs
├─ Worst:     26.422905ms
├─ Completed: 75.399036ms
├─ Workers:   0=146 1=180 2=105 3=142 4=142 5=136 6=149
└─ Errors:    0
```

## List records
#### users - getOne for auth refresh comparison (medium concurrency) [reqs:1000, conc:100, rule:`""`, query:`/mhz32lkyq2xjy0e`]
```
┌─ Best:      2.098949ms
├─ Worst:     20.648167ms
├─ Completed: 65.643859ms
├─ Workers:   0=139 1=148 2=159 3=152 4=110 5=160 6=132
└─ Errors:    0
```
#### users - getOne for auth refresh comparison (high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`/mhz32lkyq2xjy0e`]
```
┌─ Best:      33.378183ms
├─ Worst:     65.290191ms
├─ Completed: 67.07651ms
├─ Workers:   0=107 1=150 2=162 3=138 4=165 5=153 6=125
└─ Errors:    0
```
#### posts10k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.426561ms
├─ Worst:     4.776227ms
├─ Completed: 1.742823649s
├─ Workers:   0=164 1=167 2=133 3=158 4=144 5=73 6=161
└─ Errors:    0
```
#### posts10k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      25.85456ms
├─ Worst:     178.202614ms
├─ Completed: 180.010651ms
├─ Workers:   0=138 1=155 2=140 3=135 4=144 5=167 6=121
└─ Errors:    0
```
#### posts10k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      43.184752ms
├─ Worst:     123.305021ms
├─ Completed: 127.248529ms
├─ Workers:   0=136 1=170 2=168 3=100 4=137 5=120 6=169
└─ Errors:    0
```
#### posts10k - mixed read and write (simpleA list with additional 300 concurrent random posts10k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      33.789081ms
├─ Worst:     172.801291ms
├─ Completed: 174.70322ms
├─ Workers:   0=137 1=169 2=168 3=100 4=137 5=120 6=169
└─ Errors:    0
```
#### posts10k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      2.01171ms
├─ Worst:     11.994091ms
├─ Completed: 67.023776ms
├─ Workers:   0=21 1=11 2=15 3=14 4=20 5=18 6=1
└─ Errors:    0
```
#### posts10k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      1.476039ms
├─ Worst:     19.876571ms
├─ Completed: 88.032401ms
├─ Workers:   0=19 1=21 3=19 4=17 5=20 6=4
└─ Errors:    0
```
#### posts10k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      2.284145ms
├─ Worst:     21.574606ms
├─ Completed: 91.648406ms
├─ Workers:   0=8 1=4 2=4 3=21 4=23 5=33 6=7
└─ Errors:    0
```
#### posts10k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      2.908978ms
├─ Worst:     40.325462ms
├─ Completed: 127.633181ms
├─ Workers:   0=7 1=12 2=10 3=33 4=13 5=12 6=13
└─ Errors:    0
```
#### posts10k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.494976ms
├─ Worst:     9.968071ms
├─ Completed: 37.967865ms
├─ Workers:   0=16 1=14 2=11 3=14 4=15 5=15 6=15
└─ Errors:    0
```
#### posts10k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.881761ms
├─ Worst:     34.688294ms
├─ Completed: 92.905913ms
├─ Workers:   0=21 1=13 2=10 3=15 4=13 5=14 6=14
└─ Errors:    0
```
#### posts10k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      977.21µs
├─ Worst:     8.537265ms
├─ Completed: 24.867505ms
├─ Workers:   0=22 1=13 2=10 3=13 4=14 5=14 6=14
└─ Errors:    0
```
#### posts10k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      939.879µs
├─ Worst:     5.345665ms
├─ Completed: 22.360693ms
├─ Workers:   0=23 1=10 2=10 3=15 4=14 5=14 6=14
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      3.055542ms
├─ Worst:     38.744498ms
├─ Completed: 102.009811ms
├─ Workers:   0=20 1=13 2=10 3=14 4=14 5=15 6=14
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      973.725µs
├─ Worst:     9.889853ms
├─ Completed: 28.838691ms
├─ Workers:   0=15 1=12 2=11 3=15 4=16 5=15 6=16
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      828.315µs
├─ Worst:     9.919625ms
├─ Completed: 28.101654ms
├─ Workers:   0=4 1=17 2=13 3=9 4=17 5=17 6=23
└─ Errors:    0
```
#### posts10k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      4.520495ms
├─ Worst:     41.01936ms
├─ Completed: 151.870565ms
├─ Workers:   1=23 2=20 4=17 5=5 6=35
└─ Errors:    0
```
#### posts10k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      1.67984ms
├─ Worst:     33.420923ms
├─ Completed: 128.509651ms
├─ Workers:   1=39 2=60 5=1
└─ Errors:    0
```
#### posts10k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      955.79µs
├─ Worst:     8.080444ms
├─ Completed: 28.381811ms
├─ Workers:   0=21 1=12 2=14 3=14 4=20 5=18 6=1
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      14.516124ms
├─ Worst:     101.261617ms
├─ Completed: 450.54809ms
├─ Workers:   0=19 1=21 3=19 4=17 5=20 6=4
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.148486ms
├─ Worst:     11.806231ms
├─ Completed: 45.018916ms
├─ Workers:   0=8 1=3 2=4 3=21 4=24 5=32 6=8
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      6.741555ms
├─ Worst:     69.356921ms
├─ Completed: 288.926463ms
├─ Workers:   0=7 1=12 2=10 3=34 4=12 5=13 6=12
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.021882ms
├─ Worst:     9.222781ms
├─ Completed: 25.86992ms
├─ Workers:   0=17 1=14 2=12 3=13 4=15 5=14 6=15
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      8.292096ms
├─ Worst:     60.831723ms
├─ Completed: 238.151637ms
├─ Workers:   0=21 1=13 2=9 3=15 4=14 5=14 6=14
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.084037ms
├─ Worst:     8.280379ms
├─ Completed: 29.790017ms
├─ Workers:   0=21 1=13 2=10 3=13 4=13 5=15 6=15
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      36.453141ms
├─ Worst:     224.82193ms
├─ Completed: 1.025442539s
├─ Workers:   0=23 1=10 2=10 3=16 4=14 5=14 6=13
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.233654ms
├─ Worst:     19.468136ms
├─ Completed: 64.668843ms
├─ Workers:   0=21 1=13 2=10 3=14 4=14 5=14 6=14
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      102.626403ms
├─ Worst:     571.568174ms
├─ Completed: 2.891222056s
├─ Workers:   0=15 1=12 2=12 3=14 4=16 5=15 6=16
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.608943ms
├─ Worst:     17.535876ms
├─ Completed: 55.123215ms
├─ Workers:   0=3 1=17 2=13 3=9 4=17 5=18 6=23
└─ Errors:    0
```
#### posts25k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      2.249047ms
├─ Worst:     13.852117ms
├─ Completed: 2.836728869s
├─ Workers:   0=137 1=160 2=148 3=146 4=146 5=146 6=117
└─ Errors:    0
```
#### posts25k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      26.194448ms
├─ Worst:     259.07982ms
├─ Completed: 260.869421ms
├─ Workers:   0=112 1=167 2=154 3=137 4=152 5=149 6=129
└─ Errors:    0
```
#### posts25k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      54.665622ms
├─ Worst:     133.858741ms
├─ Completed: 136.252168ms
├─ Workers:   0=142 1=131 2=129 3=182 4=135 5=143 6=138
└─ Errors:    0
```
#### posts25k - mixed read and write (simpleA list with additional 300 concurrent random posts25k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      36.058557ms
├─ Worst:     263.455945ms
├─ Completed: 266.538473ms
├─ Workers:   0=143 1=131 2=128 3=182 4=135 5=143 6=138
└─ Errors:    0
```
#### posts25k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.739253ms
├─ Worst:     26.06443ms
├─ Completed: 83.717809ms
├─ Workers:   0=16 1=21 2=8 4=18 5=19 6=18
└─ Errors:    0
```
#### posts25k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      2.180613ms
├─ Worst:     23.680316ms
├─ Completed: 106.53337ms
├─ Workers:   0=17 1=20 2=3 3=3 4=15 5=29 6=13
└─ Errors:    0
```
#### posts25k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      2.622012ms
├─ Worst:     23.941676ms
├─ Completed: 96.663384ms
├─ Workers:   0=6 1=30 2=20 3=4 4=23 5=12 6=5
└─ Errors:    0
```
#### posts25k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      2.937398ms
├─ Worst:     42.610789ms
├─ Completed: 130.026828ms
├─ Workers:   0=12 1=9 2=24 3=10 4=12 5=21 6=12
└─ Errors:    0
```
#### posts25k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.094373ms
├─ Worst:     15.192549ms
├─ Completed: 53.970142ms
├─ Workers:   0=14 1=14 2=5 3=15 4=14 5=23 6=15
└─ Errors:    0
```
#### posts25k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      7.456481ms
├─ Worst:     72.299445ms
├─ Completed: 183.47603ms
├─ Workers:   0=15 1=13 2=12 3=14 4=17 5=16 6=13
└─ Errors:    0
```
#### posts25k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      961.969µs
├─ Worst:     7.49135ms
├─ Completed: 22.760063ms
├─ Workers:   0=13 1=13 2=14 3=14 4=18 5=14 6=14
└─ Errors:    0
```
#### posts25k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      956.982µs
├─ Worst:     8.090897ms
├─ Completed: 23.829992ms
├─ Workers:   0=14 1=14 2=14 3=13 4=18 5=14 6=13
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      7.135137ms
├─ Worst:     71.360687ms
├─ Completed: 185.020502ms
├─ Workers:   0=14 1=13 2=14 3=14 4=18 5=14 6=13
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      965.274µs
├─ Worst:     8.634489ms
├─ Completed: 24.426656ms
├─ Workers:   0=14 1=13 2=14 3=13 4=18 5=14 6=14
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      944.946µs
├─ Worst:     7.575886ms
├─ Completed: 23.963908ms
├─ Workers:   0=14 1=13 2=13 3=14 4=19 5=12 6=15
└─ Errors:    0
```
#### posts25k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      8.593683ms
├─ Worst:     74.854234ms
├─ Completed: 283.208103ms
├─ Workers:   0=15 1=17 2=27 3=17 4=3 5=4 6=17
└─ Errors:    0
```
#### posts25k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      5.889076ms
├─ Worst:     65.169905ms
├─ Completed: 299.334633ms
├─ Workers:   0=13 1=12 2=15 3=51 5=1 6=8
└─ Errors:    0
```
#### posts25k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      919.321µs
├─ Worst:     8.531838ms
├─ Completed: 27.955082ms
├─ Workers:   0=16 1=21 2=9 4=18 5=18 6=18
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      34.74397ms
├─ Worst:     274.573694ms
├─ Completed: 1.179866022s
├─ Workers:   0=16 1=20 2=2 3=4 4=15 5=30 6=13
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.029613ms
├─ Worst:     6.143667ms
├─ Completed: 34.218284ms
├─ Workers:   0=6 1=30 2=21 3=3 4=23 5=12 6=5
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      13.146933ms
├─ Worst:     122.006506ms
├─ Completed: 459.345534ms
├─ Workers:   0=12 1=10 2=23 3=10 4=12 5=21 6=12
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      985.723µs
├─ Worst:     6.539935ms
├─ Completed: 26.591748ms
├─ Workers:   0=14 1=13 2=5 3=15 4=15 5=23 6=15
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      19.632613ms
├─ Worst:     104.319521ms
├─ Completed: 485.375756ms
├─ Workers:   0=15 1=14 2=12 3=14 4=16 5=15 6=14
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.018468ms
├─ Worst:     10.319787ms
├─ Completed: 30.601458ms
├─ Workers:   0=13 1=13 2=14 3=14 4=19 5=14 6=13
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      91.075244ms
├─ Worst:     410.878956ms
├─ Completed: 2.346018676s
├─ Workers:   0=15 1=14 2=14 3=13 4=17 5=14 6=13
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.65631ms
├─ Worst:     12.375237ms
├─ Completed: 55.282856ms
├─ Workers:   0=13 1=12 2=15 3=14 4=19 5=14 6=13
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      240.327241ms
├─ Worst:     1.365919322s
├─ Completed: 6.926110699s
├─ Workers:   0=14 1=14 2=13 3=13 4=17 5=14 6=15
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.601612ms
├─ Worst:     9.282405ms
├─ Completed: 40.907266ms
├─ Workers:   0=14 1=13 2=13 3=15 4=19 5=12 6=14
└─ Errors:    0
```
#### posts50k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.84525ms
├─ Worst:     27.015473ms
├─ Completed: 4.855333605s
├─ Workers:   0=136 1=163 2=142 3=141 4=138 5=152 6=128
└─ Errors:    0
```
#### posts50k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      22.421758ms
├─ Worst:     438.683897ms
├─ Completed: 440.275256ms
├─ Workers:   0=132 1=162 2=143 3=141 4=142 5=149 6=131
└─ Errors:    0
```
#### posts50k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      21.364156ms
├─ Worst:     109.000891ms
├─ Completed: 111.07751ms
├─ Workers:   0=176 1=136 2=124 3=139 4=150 5=142 6=133
└─ Errors:    0
```
#### posts50k - mixed read and write (simpleA list with additional 300 concurrent random posts50k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      23.689759ms
├─ Worst:     431.41828ms
├─ Completed: 432.964977ms
├─ Workers:   0=175 1=136 2=124 3=141 4=150 5=141 6=133
└─ Errors:    0
```
#### posts50k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      2.129843ms
├─ Worst:     46.61372ms
├─ Completed: 137.043445ms
├─ Workers:   0=2 1=21 2=9 3=31 4=19 6=18
└─ Errors:    0
```
#### posts50k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      2.632777ms
├─ Worst:     44.397238ms
├─ Completed: 127.545672ms
├─ Workers:   0=3 1=24 2=19 3=9 4=20 5=12 6=13
└─ Errors:    0
```
#### posts50k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      2.517818ms
├─ Worst:     36.848579ms
├─ Completed: 146.369048ms
├─ Workers:   0=3 1=16 2=31 3=5 4=4 5=37 6=4
└─ Errors:    0
```
#### posts50k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      3.570833ms
├─ Worst:     26.886976ms
├─ Completed: 114.803158ms
├─ Workers:   0=20 1=14 2=14 3=13 4=13 5=13 6=13
└─ Errors:    0
```
#### posts50k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      2.007002ms
├─ Worst:     26.561877ms
├─ Completed: 83.390529ms
├─ Workers:   0=21 1=13 2=14 3=13 4=14 5=12 6=13
└─ Errors:    0
```
#### posts50k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      17.3565ms
├─ Worst:     125.238204ms
├─ Completed: 498.501959ms
├─ Workers:   0=21 1=14 2=13 3=13 4=14 5=12 6=13
└─ Errors:    0
```
#### posts50k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      962.209µs
├─ Worst:     6.922835ms
├─ Completed: 22.927056ms
├─ Workers:   0=21 1=14 2=13 3=14 4=13 5=12 6=13
└─ Errors:    0
```
#### posts50k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      927.001µs
├─ Worst:     9.08458ms
├─ Completed: 24.246689ms
├─ Workers:   0=20 1=13 2=14 3=14 4=13 5=13 6=13
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      17.315983ms
├─ Worst:     135.892734ms
├─ Completed: 516.774333ms
├─ Workers:   0=21 1=14 2=13 3=14 4=14 5=11 6=13
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      876.041µs
├─ Worst:     9.674226ms
├─ Completed: 24.994452ms
├─ Workers:   0=20 1=13 2=14 3=13 4=13 5=13 6=14
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      899.833µs
├─ Worst:     6.907704ms
├─ Completed: 23.488491ms
├─ Workers:   0=20 1=13 2=12 3=13 4=13 5=11 6=18
└─ Errors:    0
```
#### posts50k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      17.692924ms
├─ Worst:     107.828102ms
├─ Completed: 474.876961ms
├─ Workers:   0=4 1=16 2=17 3=16 4=16 5=15 6=16
└─ Errors:    0
```
#### posts50k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      12.097824ms
├─ Worst:     105.924471ms
├─ Completed: 495.268722ms
├─ Workers:   1=17 3=15 4=27 5=31 6=10
└─ Errors:    0
```
#### posts50k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      878.202µs
├─ Worst:     5.121165ms
├─ Completed: 26.951705ms
├─ Workers:   0=2 1=22 2=9 3=31 4=19 6=17
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      84.761614ms
├─ Worst:     461.132943ms
├─ Completed: 2.371541782s
├─ Workers:   0=3 1=23 2=19 3=9 4=20 5=13 6=13
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.20868ms
├─ Worst:     9.56177ms
├─ Completed: 45.961659ms
├─ Workers:   0=4 1=16 2=31 3=4 4=5 5=36 6=4
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      38.001151ms
├─ Worst:     233.387649ms
├─ Completed: 1.059566584s
├─ Workers:   0=19 1=14 2=15 3=13 4=12 5=13 6=14
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.072823ms
├─ Worst:     7.982669ms
├─ Completed: 25.07313ms
├─ Workers:   0=21 1=13 2=13 3=14 4=14 5=13 6=12
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      45.425848ms
├─ Worst:     334.41977ms
├─ Completed: 1.25256497s
├─ Workers:   0=21 1=15 2=13 3=13 4=14 5=11 6=13
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.089966ms
├─ Worst:     9.123254ms
├─ Completed: 30.809705ms
├─ Workers:   0=21 1=14 2=13 3=13 4=13 5=13 6=13
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      208.429517ms
├─ Worst:     1.405690974s
├─ Completed: 5.390902092s
├─ Workers:   0=20 1=12 2=14 3=15 4=13 5=13 6=13
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.651301ms
├─ Worst:     16.688266ms
├─ Completed: 62.571326ms
├─ Workers:   0=22 1=14 2=13 3=13 4=14 5=11 6=13
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      556.51642ms
├─ Worst:     3.300276064s
├─ Completed: 15.041937999s
├─ Workers:   0=19 1=13 2=14 3=13 4=14 5=13 6=14
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.907706ms
├─ Worst:     8.919393ms
├─ Completed: 43.209235ms
├─ Workers:   0=21 1=13 2=13 3=13 4=12 5=10 6=18
└─ Errors:    0
```
#### posts100k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      3.367394ms
├─ Worst:     14.776595ms
├─ Completed: 8.620735818s
├─ Workers:   0=114 1=162 2=144 3=143 4=154 5=158 6=125
└─ Errors:    0
```
#### posts100k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      24.314011ms
├─ Worst:     795.411206ms
├─ Completed: 797.192457ms
├─ Workers:   0=115 1=162 2=142 3=141 4=153 5=156 6=131
└─ Errors:    0
```
#### posts100k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      34.974218ms
├─ Worst:     237.459695ms
├─ Completed: 237.620146ms
├─ Workers:   0=156 1=131 2=135 3=127 4=188 5=130 6=133
└─ Errors:    0
```
#### posts100k - mixed read and write (simpleA list with additional 300 concurrent random posts100k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      29.076521ms
├─ Worst:     791.535122ms
├─ Completed: 793.587007ms
├─ Workers:   0=155 1=131 2=135 3=127 4=188 5=130 6=134
└─ Errors:    0
```
#### posts100k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      3.673666ms
├─ Worst:     35.234859ms
├─ Completed: 147.214274ms
├─ Workers:   0=15 1=8 2=20 3=21 4=5 5=12 6=19
└─ Errors:    0
```
#### posts100k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      4.256801ms
├─ Worst:     37.136917ms
├─ Completed: 165.007808ms
├─ Workers:   0=3 1=9 2=16 3=25 4=1 5=31 6=15
└─ Errors:    0
```
#### posts100k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      3.854916ms
├─ Worst:     81.590703ms
├─ Completed: 245.272519ms
├─ Workers:   0=4 1=54 2=4 3=11 4=7 5=16 6=4
└─ Errors:    0
```
#### posts100k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      5.317136ms
├─ Worst:     54.411442ms
├─ Completed: 176.96665ms
├─ Workers:   0=11 1=10 2=24 3=12 4=20 5=11 6=12
└─ Errors:    0
```
#### posts100k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      3.674547ms
├─ Worst:     35.785971ms
├─ Completed: 136.326934ms
├─ Workers:   0=12 1=13 2=13 3=13 4=22 5=14 6=13
└─ Errors:    0
```
#### posts100k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      33.358916ms
├─ Worst:     271.996278ms
├─ Completed: 976.333952ms
├─ Workers:   0=13 1=12 2=13 3=13 4=22 5=13 6=14
└─ Errors:    0
```
#### posts100k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      917.617µs
├─ Worst:     10.23486ms
├─ Completed: 32.57851ms
├─ Workers:   0=14 1=12 2=13 3=14 4=21 5=13 6=13
└─ Errors:    0
```
#### posts100k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      958.275µs
├─ Worst:     5.459152ms
├─ Completed: 21.686591ms
├─ Workers:   0=16 1=12 2=13 3=13 4=20 5=13 6=13
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      33.93296ms
├─ Worst:     161.605538ms
├─ Completed: 804.814108ms
├─ Workers:   0=13 1=12 2=14 3=13 4=21 5=14 6=13
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      993.683µs
├─ Worst:     6.928081ms
├─ Completed: 23.234059ms
├─ Workers:   0=13 1=13 2=13 3=13 4=21 5=13 6=14
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.007882ms
├─ Worst:     8.476571ms
├─ Completed: 24.192583ms
├─ Workers:   0=13 1=12 2=14 3=14 4=21 5=13 6=13
└─ Errors:    0
```
#### posts100k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      34.785639ms
├─ Worst:     245.032076ms
├─ Completed: 849.998032ms
├─ Workers:   0=14 1=14 2=15 3=14 4=12 5=16 6=15
└─ Errors:    0
```
#### posts100k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      29.239136ms
├─ Worst:     293.897587ms
├─ Completed: 1.238920441s
├─ Workers:   0=36 1=21 2=11 3=6 4=1 5=13 6=12
└─ Errors:    0
```
#### posts100k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      941.641µs
├─ Worst:     6.375258ms
├─ Completed: 26.669906ms
├─ Workers:   0=14 1=8 2=21 3=22 4=4 5=12 6=19
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      165.414521ms
├─ Worst:     1.256906829s
├─ Completed: 6.039052942s
├─ Workers:   0=3 1=9 2=15 3=24 4=2 5=32 6=15
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.097766ms
├─ Worst:     8.743659ms
├─ Completed: 47.459828ms
├─ Workers:   0=5 1=54 2=4 3=11 4=6 5=15 6=5
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      66.448461ms
├─ Worst:     723.34213ms
├─ Completed: 2.234520179s
├─ Workers:   0=10 1=10 2=24 3=13 4=20 5=12 6=11
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.028872ms
├─ Worst:     7.362542ms
├─ Completed: 24.583884ms
├─ Workers:   0=12 1=13 2=13 3=12 4=22 5=14 6=14
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      89.260359ms
├─ Worst:     636.188282ms
├─ Completed: 2.362367268s
├─ Workers:   0=13 1=13 2=13 3=13 4=22 5=12 6=14
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.08526ms
├─ Worst:     7.88875ms
├─ Completed: 26.760631ms
├─ Workers:   0=14 1=12 2=13 3=14 4=21 5=14 6=12
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      416.644118ms
├─ Worst:     2.709285395s
├─ Completed: 10.568513164s
├─ Workers:   0=16 1=11 2=13 3=14 4=20 5=12 6=14
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.310091ms
├─ Worst:     11.087839ms
├─ Completed: 53.052936ms
├─ Workers:   0=14 1=13 2=14 3=12 4=21 5=14 6=12
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      1.005020535s
├─ Worst:     5.570268139s
├─ Completed: 25.354148165s
├─ Workers:   0=13 1=12 2=13 3=13 4=21 5=13 6=15
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.58488ms
├─ Worst:     11.88547ms
├─ Completed: 42.996232ms
├─ Workers:   0=13 1=12 2=14 3=14 4=21 5=14 6=12
└─ Errors:    0
```

## Go vs JS route execution
#### JS route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      29.181847ms
├─ Worst:     1.187899732s
├─ Completed: 1.18975071s
├─ Workers:   0=71 1=107 2=66 3=78 4=25 5=87 6=66
└─ Errors:    0
```
#### Go route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      25.041117ms
├─ Worst:     1.133847036s
├─ Completed: 1.134880784s
├─ Workers:   0=65 1=58 2=77 3=65 4=106 5=64 6=65
└─ Errors:    0
```
#### JS route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      9.023756ms
├─ Worst:     376.444801ms
├─ Completed: 1.057799782s
├─ Workers:   0=67 1=64 2=67 3=66 4=87 5=71 6=78
└─ Errors:    0
```
#### Go route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      8.686451ms
├─ Worst:     395.859663ms
├─ Completed: 1.18045726s
├─ Workers:   0=71 1=107 2=66 3=78 4=27 5=98 6=53
└─ Errors:    0
```
#### JS route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      8.125696ms
├─ Worst:     28.962033ms
├─ Completed: 9.457231404s
├─ Workers:   0=66 1=59 2=79 3=66 4=107 5=54 6=69
└─ Errors:    0
```
#### Go route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      8.747896ms
├─ Worst:     30.452551ms
├─ Completed: 9.756780078s
├─ Workers:   0=77 1=66 2=77 3=76 4=59 5=70 6=75
└─ Errors:    0
```

## Go vs JS hooks execution
#### JS OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      1.024866ms
├─ Worst:     12.491328ms
├─ Completed: 33.827935ms
├─ Workers:   0=12 1=27 2=6 3=19 4=6 5=24 6=6
└─ Errors:    0
```
#### Go OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      894.625µs
├─ Worst:     10.738756ms
├─ Completed: 24.128525ms
├─ Workers:   0=13 1=16 2=14 3=14 4=14 5=16 6=13
└─ Errors:    0
```

## Deleting records
#### deleting 100 posts10k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      702.241µs
├─ Worst:     37.982715ms
├─ Completed: 60.4535ms
├─ Workers:   0=8 1=34 2=8 3=7 4=7 5=29 6=7
└─ Errors:    0
```
#### deleting 100 posts10k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      741.004µs
├─ Worst:     21.28096ms
├─ Completed: 39.778607ms
├─ Workers:   0=13 1=14 2=13 3=14 4=14 5=19 6=13
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      765.036µs
├─ Worst:     40.332112ms
├─ Completed: 43.497353ms
├─ Workers:   0=19 1=15 2=15 3=15 4=15 5=3 6=18
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      808.827µs
├─ Worst:     10.72717ms
├─ Completed: 44.408824ms
├─ Workers:   0=7 1=3 2=22 3=9 4=50 6=9
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      770.144µs
├─ Worst:     56.415542ms
├─ Completed: 69.936782ms
├─ Workers:   0=13 1=13 2=13 3=14 4=14 5=18 6=15
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      807.316µs
├─ Worst:     56.354107ms
├─ Completed: 70.351925ms
├─ Workers:   0=14 1=14 2=16 3=14 4=14 5=13 6=15
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      703.031µs
├─ Worst:     20.324831ms
├─ Completed: 32.475176ms
├─ Workers:   0=14 1=14 2=17 3=14 4=14 5=13 6=14
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      788.76µs
├─ Worst:     35.671693ms
├─ Completed: 46.638334ms
├─ Workers:   0=15 1=14 2=13 3=15 4=15 5=14 6=14
└─ Errors:    0
```
#### deleting 100 users - with cascade deleting all associated posts [conc:10, rule:`""`]
```
┌─ Best:      67.862226ms
├─ Worst:     4.550197832s
├─ Completed: 9.272921989s
├─ Workers:   0=11 1=8 2=8 3=10 4=30 5=13 6=20
└─ Errors:    0
```
#### deleting 100 organizations - with cascade deleting all users and associated posts [conc:10, rule:`""`]
```
┌─ Best:      41.841657ms
├─ Worst:     9.828754644s
├─ Completed: 19.501091068s
├─ Workers:   0=20 1=15 2=22 3=15 5=14 6=14
└─ Errors:    0
```

---------------------------------------------------
Completed!
