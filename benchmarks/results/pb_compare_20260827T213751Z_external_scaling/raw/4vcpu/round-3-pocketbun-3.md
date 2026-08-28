# PocketBun Upstream-Port Benchmark Result

- machine: hetzner-4vcpu-pocketbun-3
- timestamp: 2026-08-27T17:52:30.822Z
- tests: create,auth,search,custom,delete
- benchmark source: 05625dc2b2d3f9711c51566010944b10ca9531fa
- server workers: 3
- load generator: http://load-generator:19231
- benchmark target host: application-host
- warmup request target/cap: 1000
## Creating organizations (100)
#### Creating 50 organizations [reqs:50, conc:10, rule:`""`]
```
┌─ Best:      640.444µs
├─ Worst:     5.904657ms
├─ Completed: 16.00968ms
├─ Workers:   0=13 1=24 2=13
└─ Errors:    0
```
#### Creating 50 organizations [reqs:50, conc:10, rule:`"@request.body.name != ''"`]
```
┌─ Best:      840.149µs
├─ Worst:     11.472219ms
├─ Completed: 20.876874ms
├─ Workers:   0=16 1=23 2=11
└─ Errors:    0
```

## Creating permissions (50)
#### Creating 25 permissions [reqs:25, conc:5, rule:`""`]
```
┌─ Best:      636.699µs
├─ Worst:     4.81256ms
├─ Completed: 10.296998ms
├─ Workers:   0=13 1=12
└─ Errors:    0
```
#### Creating 25 permissions [reqs:25, conc:5, rule:`"@request.body.name != ''"`]
```
┌─ Best:      931.175µs
├─ Worst:     5.747881ms
├─ Completed: 11.902121ms
├─ Workers:   0=12 1=12 2=1
└─ Errors:    0
```

## Creating users (500 - expected to be slow due to passwordHash generation)
#### Creating 250 users [reqs:250, conc:50, rule:`""`]
```
┌─ Best:      105.268206ms
├─ Worst:     2.579086658s
├─ Completed: 4.112525635s
├─ Workers:   0=110 1=89 2=51
└─ Errors:    0
```
#### Creating 250 users [reqs:250, conc:50, rule:`"@request.body.email != '' && @request.body.permissions:length > 0"`]
```
┌─ Best:      96.901591ms
├─ Worst:     1.757342192s
├─ Completed: 4.126004363s
├─ Workers:   0=83 1=41 2=126
└─ Errors:    0
```

## Creating posts (10k, 25k, 50k, 100k)
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`""`]
```
┌─ Best:      11.454357ms
├─ Worst:     281.705098ms
├─ Completed: 524.746384ms
├─ Workers:   0=1637 1=1675 2=1688
└─ Errors:    0
```
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      15.613735ms
├─ Worst:     338.834983ms
├─ Completed: 780.256195ms
├─ Workers:   0=1539 1=1816 2=1645
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`""`]
```
┌─ Best:      1.713435ms
├─ Worst:     407.883244ms
├─ Completed: 1.338129642s
├─ Workers:   0=4103 1=4562 2=3835
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      6.30521ms
├─ Worst:     926.995584ms
├─ Completed: 1.752811326s
├─ Workers:   0=3178 1=4918 2=4404
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`""`]
```
┌─ Best:      351.265µs
├─ Worst:     591.271163ms
├─ Completed: 2.258311994s
├─ Workers:   0=9633 1=7949 2=7418
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      463.679µs
├─ Worst:     751.008146ms
├─ Completed: 3.248202286s
├─ Workers:   0=7252 1=9361 2=8387
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`""`]
```
┌─ Best:      3.098646ms
├─ Worst:     465.576575ms
├─ Completed: 4.222298865s
├─ Workers:   0=15846 1=16985 2=17169
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      492.259µs
├─ Worst:     451.226143ms
├─ Completed: 6.373059626s
├─ Workers:   0=18373 1=15249 2=16378
└─ Errors:    0
```

## User auth with password (expected to be slow due to passwordHash verification)
#### users auth with email/pass - high concurrency [reqs:250, conc:250]
```
┌─ Best:      118.257144ms
├─ Worst:     4.03824033s
├─ Completed: 4.038600457s
├─ Workers:   0=76 1=92 2=82
└─ Errors:    0
```
#### users auth with email/pass - small concurrency [reqs:250, conc:10]
```
┌─ Best:      68.089277ms
├─ Worst:     481.87851ms
├─ Completed: 4.045251925s
├─ Workers:   0=83 1=62 2=105
└─ Errors:    0
```

## User auth refresh
#### users - auth refresh (high concurrency) [reqs:1000, conc:1000]
```
┌─ Best:      24.358452ms
├─ Worst:     103.864112ms
├─ Completed: 106.51518ms
├─ Workers:   0=350 1=362 2=288
└─ Errors:    0
```
#### users - auth refresh (medium concurrency) [reqs:1000, conc:100]
```
┌─ Best:      352.147µs
├─ Worst:     31.765854ms
├─ Completed: 93.529992ms
├─ Workers:   0=247 1=386 2=367
└─ Errors:    0
```

## List records
#### users - getOne for auth refresh comparison (medium concurrency) [reqs:1000, conc:100, rule:`""`, query:`/z9rb0y2n7p8fg3b`]
```
┌─ Best:      288.547µs
├─ Worst:     22.728653ms
├─ Completed: 101.838138ms
├─ Workers:   0=347 1=348 2=305
└─ Errors:    0
```
#### users - getOne for auth refresh comparison (high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`/z9rb0y2n7p8fg3b`]
```
┌─ Best:      22.111232ms
├─ Worst:     98.728788ms
├─ Completed: 100.329537ms
├─ Workers:   0=403 1=339 2=258
└─ Errors:    0
```
#### posts10k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      663.316µs
├─ Worst:     4.888085ms
├─ Completed: 1.522471159s
├─ Workers:   0=226 1=365 2=409
└─ Errors:    0
```
#### posts10k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      24.004874ms
├─ Worst:     301.333223ms
├─ Completed: 303.379026ms
├─ Workers:   0=342 1=323 2=335
└─ Errors:    0
```
#### posts10k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      23.170643ms
├─ Worst:     179.664812ms
├─ Completed: 181.419333ms
├─ Workers:   0=287 1=446 2=267
└─ Errors:    0
```
#### posts10k - mixed read and write (simpleA list with additional 300 concurrent random posts10k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      28.026685ms
├─ Worst:     341.377661ms
├─ Completed: 342.900543ms
├─ Workers:   0=287 1=446 2=267
└─ Errors:    0
```
#### posts10k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.389206ms
├─ Worst:     24.489804ms
├─ Completed: 97.47677ms
├─ Workers:   0=70 1=11 2=19
└─ Errors:    0
```
#### posts10k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      1.950651ms
├─ Worst:     28.911756ms
├─ Completed: 127.989394ms
├─ Workers:   0=70 1=8 2=22
└─ Errors:    0
```
#### posts10k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      1.334761ms
├─ Worst:     27.496893ms
├─ Completed: 117.856482ms
├─ Workers:   0=36 1=18 2=46
└─ Errors:    0
```
#### posts10k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      2.752129ms
├─ Worst:     28.607115ms
├─ Completed: 119.033395ms
├─ Workers:   0=31 1=19 2=50
└─ Errors:    0
```
#### posts10k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.45608ms
├─ Worst:     12.934579ms
├─ Completed: 62.737412ms
├─ Workers:   0=44 1=30 2=26
└─ Errors:    0
```
#### posts10k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.124831ms
├─ Worst:     47.20623ms
├─ Completed: 131.905477ms
├─ Workers:   0=50 1=27 2=23
└─ Errors:    0
```
#### posts10k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.040316ms
├─ Worst:     6.960054ms
├─ Completed: 38.56788ms
├─ Workers:   0=48 1=30 2=22
└─ Errors:    0
```
#### posts10k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.040967ms
├─ Worst:     7.768569ms
├─ Completed: 34.550676ms
├─ Workers:   0=48 1=29 2=23
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.20386ms
├─ Worst:     46.601175ms
├─ Completed: 117.161352ms
├─ Workers:   0=47 1=29 2=24
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.169344ms
├─ Worst:     6.784842ms
├─ Completed: 43.432142ms
├─ Workers:   1=46 2=54
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.921662ms
├─ Worst:     8.026235ms
├─ Completed: 40.787382ms
├─ Workers:   1=45 2=55
└─ Errors:    0
```
#### posts10k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      6.005287ms
├─ Worst:     43.129004ms
├─ Completed: 157.658626ms
├─ Workers:   1=55 2=45
└─ Errors:    0
```
#### posts10k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      12.626444ms
├─ Worst:     51.415849ms
├─ Completed: 189.276014ms
├─ Workers:   0=1 1=99
└─ Errors:    0
```
#### posts10k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.052383ms
├─ Worst:     8.100758ms
├─ Completed: 50.245024ms
├─ Workers:   0=69 1=12 2=19
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      14.604223ms
├─ Worst:     203.47612ms
├─ Completed: 1.291493658s
├─ Workers:   0=70 1=8 2=22
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.241043ms
├─ Worst:     11.311649ms
├─ Completed: 49.46675ms
├─ Workers:   0=36 1=17 2=47
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      6.706625ms
├─ Worst:     69.54758ms
├─ Completed: 340.816126ms
├─ Workers:   0=31 1=19 2=50
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.034368ms
├─ Worst:     9.617961ms
├─ Completed: 43.775917ms
├─ Workers:   0=44 1=31 2=25
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      8.331225ms
├─ Worst:     82.530055ms
├─ Completed: 394.664242ms
├─ Workers:   0=50 1=27 2=23
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      967.426µs
├─ Worst:     10.560182ms
├─ Completed: 49.877656ms
├─ Workers:   0=49 1=29 2=22
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      36.275007ms
├─ Worst:     425.927213ms
├─ Completed: 1.953079537s
├─ Workers:   0=47 1=30 2=23
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.648404ms
├─ Worst:     21.895905ms
├─ Completed: 95.604426ms
├─ Workers:   0=47 1=29 2=24
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      138.315063ms
├─ Worst:     796.254072ms
├─ Completed: 5.444012742s
├─ Workers:   1=46 2=54
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      830.806µs
├─ Worst:     14.099175ms
├─ Completed: 84.634558ms
├─ Workers:   1=44 2=56
└─ Errors:    0
```
#### posts25k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.031904ms
├─ Worst:     5.312571ms
├─ Completed: 2.278400034s
├─ Workers:   0=397 1=327 2=276
└─ Errors:    0
```
#### posts25k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      24.043377ms
├─ Worst:     472.09619ms
├─ Completed: 474.470477ms
├─ Workers:   0=299 1=360 2=341
└─ Errors:    0
```
#### posts25k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      28.051579ms
├─ Worst:     187.913865ms
├─ Completed: 189.647106ms
├─ Workers:   0=444 1=276 2=280
└─ Errors:    0
```
#### posts25k - mixed read and write (simpleA list with additional 300 concurrent random posts25k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      27.143966ms
├─ Worst:     528.706088ms
├─ Completed: 530.391675ms
├─ Workers:   0=444 1=276 2=280
└─ Errors:    0
```
#### posts25k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.299694ms
├─ Worst:     20.191472ms
├─ Completed: 91.175393ms
├─ Workers:   0=5 1=45 2=50
└─ Errors:    0
```
#### posts25k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      1.788588ms
├─ Worst:     26.761078ms
├─ Completed: 113.170896ms
├─ Workers:   0=8 1=39 2=53
└─ Errors:    0
```
#### posts25k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      1.658339ms
├─ Worst:     29.066499ms
├─ Completed: 132.233311ms
├─ Workers:   0=10 1=58 2=32
└─ Errors:    0
```
#### posts25k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      2.055626ms
├─ Worst:     42.069322ms
├─ Completed: 161.068111ms
├─ Workers:   0=25 1=40 2=35
└─ Errors:    0
```
#### posts25k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      2.293845ms
├─ Worst:     13.623188ms
├─ Completed: 73.27282ms
├─ Workers:   0=31 1=31 2=38
└─ Errors:    0
```
#### posts25k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      5.164898ms
├─ Worst:     73.75844ms
├─ Completed: 252.667138ms
├─ Workers:   0=30 1=27 2=43
└─ Errors:    0
```
#### posts25k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      837.186µs
├─ Worst:     12.072568ms
├─ Completed: 44.224956ms
├─ Workers:   0=27 1=31 2=42
└─ Errors:    0
```
#### posts25k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      877.682µs
├─ Worst:     35.873621ms
├─ Completed: 62.415868ms
├─ Workers:   0=32 1=27 2=41
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      4.842233ms
├─ Worst:     75.369082ms
├─ Completed: 239.410224ms
├─ Workers:   0=29 1=29 2=42
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      880.125µs
├─ Worst:     9.067323ms
├─ Completed: 44.8372ms
├─ Workers:   0=34 1=33 2=33
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      835.583µs
├─ Worst:     9.071838ms
├─ Completed: 45.050245ms
├─ Workers:   0=55 1=45
└─ Errors:    0
```
#### posts25k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      23.582982ms
├─ Worst:     82.603405ms
├─ Completed: 487.276449ms
├─ Workers:   0=59 1=41
└─ Errors:    0
```
#### posts25k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      36.308513ms
├─ Worst:     81.661706ms
├─ Completed: 537.720377ms
├─ Workers:   0=99 2=1
└─ Errors:    0
```
#### posts25k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      947.648µs
├─ Worst:     8.235295ms
├─ Completed: 43.363186ms
├─ Workers:   0=5 1=45 2=50
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      38.05303ms
├─ Worst:     394.146699ms
├─ Completed: 2.13738291s
├─ Workers:   0=9 1=39 2=52
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.445454ms
├─ Worst:     9.237497ms
├─ Completed: 52.813497ms
├─ Workers:   0=9 1=59 2=32
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      15.241212ms
├─ Worst:     149.076242ms
├─ Completed: 862.052667ms
├─ Workers:   0=25 1=39 2=36
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      904.117µs
├─ Worst:     8.690553ms
├─ Completed: 44.791047ms
├─ Workers:   0=31 1=32 2=37
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      20.682318ms
├─ Worst:     191.414324ms
├─ Completed: 1.041237357s
├─ Workers:   0=30 1=26 2=44
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.09402ms
├─ Worst:     8.6597ms
├─ Completed: 44.94439ms
├─ Workers:   0=27 1=31 2=42
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      136.816435ms
├─ Worst:     797.856173ms
├─ Completed: 4.568966489s
├─ Workers:   0=32 1=28 2=40
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.944474ms
├─ Worst:     22.334149ms
├─ Completed: 88.773679ms
├─ Workers:   0=29 1=28 2=43
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      277.25052ms
├─ Worst:     2.906813229s
├─ Completed: 13.626512338s
├─ Workers:   0=35 1=33 2=32
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      898.159µs
├─ Worst:     12.619172ms
├─ Completed: 70.016776ms
├─ Workers:   0=55 1=45
└─ Errors:    0
```
#### posts50k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.859055ms
├─ Worst:     37.934507ms
├─ Completed: 4.152469293s
├─ Workers:   0=326 1=340 2=334
└─ Errors:    0
```
#### posts50k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      37.122767ms
├─ Worst:     974.441845ms
├─ Completed: 976.385146ms
├─ Workers:   0=355 1=361 2=284
└─ Errors:    0
```
#### posts50k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      29.482483ms
├─ Worst:     167.561139ms
├─ Completed: 169.755988ms
├─ Workers:   0=269 1=376 2=355
└─ Errors:    0
```
#### posts50k - mixed read and write (simpleA list with additional 300 concurrent random posts50k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      42.621624ms
├─ Worst:     802.957953ms
├─ Completed: 804.487543ms
├─ Workers:   0=269 1=376 2=355
└─ Errors:    0
```
#### posts50k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      3.393693ms
├─ Worst:     47.907618ms
├─ Completed: 134.245537ms
├─ Workers:   0=32 1=35 2=33
└─ Errors:    0
```
#### posts50k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      3.952533ms
├─ Worst:     37.58953ms
├─ Completed: 168.244262ms
├─ Workers:   0=49 1=31 2=20
└─ Errors:    0
```
#### posts50k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      4.130459ms
├─ Worst:     52.848215ms
├─ Completed: 236.215797ms
├─ Workers:   0=83 1=7 2=10
└─ Errors:    0
```
#### posts50k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      2.889348ms
├─ Worst:     66.341486ms
├─ Completed: 185.281512ms
├─ Workers:   0=34 1=27 2=39
└─ Errors:    0
```
#### posts50k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      2.069004ms
├─ Worst:     28.484345ms
├─ Completed: 114.73221ms
├─ Workers:   0=27 1=31 2=42
└─ Errors:    0
```
#### posts50k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      16.356771ms
├─ Worst:     146.479497ms
├─ Completed: 774.506212ms
├─ Workers:   0=30 1=29 2=41
└─ Errors:    0
```
#### posts50k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      467.955µs
├─ Worst:     10.482266ms
├─ Completed: 40.771181ms
├─ Workers:   0=29 1=29 2=42
└─ Errors:    0
```
#### posts50k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      816.596µs
├─ Worst:     9.024774ms
├─ Completed: 39.567749ms
├─ Workers:   0=28 1=36 2=36
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      16.86387ms
├─ Worst:     136.228493ms
├─ Completed: 808.78302ms
├─ Workers:   0=26 1=45 2=29
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      949.641µs
├─ Worst:     10.08779ms
├─ Completed: 39.403243ms
├─ Workers:   0=27 1=44 2=29
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      941.97µs
├─ Worst:     9.714495ms
├─ Completed: 38.390817ms
├─ Workers:   0=26 1=45 2=29
└─ Errors:    0
```
#### posts50k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      27.196319ms
├─ Worst:     130.438554ms
├─ Completed: 838.650935ms
├─ Workers:   0=26 1=45 2=29
└─ Errors:    0
```
#### posts50k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      12.666479ms
├─ Worst:     105.744238ms
├─ Completed: 551.125965ms
├─ Workers:   0=27 1=43 2=30
└─ Errors:    0
```
#### posts50k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      894.935µs
├─ Worst:     9.334211ms
├─ Completed: 42.380872ms
├─ Workers:   0=32 1=35 2=33
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      108.109451ms
├─ Worst:     839.966801ms
├─ Completed: 4.873178611s
├─ Workers:   0=50 1=30 2=20
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      954.987µs
├─ Worst:     10.476086ms
├─ Completed: 58.893958ms
├─ Workers:   0=82 1=8 2=10
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      32.959602ms
├─ Worst:     448.417997ms
├─ Completed: 2.039188122s
├─ Workers:   0=34 1=26 2=40
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      931.635µs
├─ Worst:     8.804259ms
├─ Completed: 47.825544ms
├─ Workers:   0=27 1=32 2=41
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      44.691911ms
├─ Worst:     493.897856ms
├─ Completed: 2.427210679s
├─ Workers:   0=31 1=28 2=41
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      966.544µs
├─ Worst:     11.929101ms
├─ Completed: 50.903012ms
├─ Workers:   0=28 1=29 2=43
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      191.986925ms
├─ Worst:     1.857218449s
├─ Completed: 9.400927654s
├─ Workers:   0=28 1=37 2=35
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.583224ms
├─ Worst:     22.422561ms
├─ Completed: 89.001193ms
├─ Workers:   0=26 1=45 2=29
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      516.912234ms
├─ Worst:     6.174313926s
├─ Completed: 25.716662279s
├─ Workers:   0=27 1=44 2=29
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      939.716µs
├─ Worst:     17.36314ms
├─ Completed: 75.305165ms
├─ Workers:   0=26 1=45 2=29
└─ Errors:    0
```
#### posts100k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      3.231419ms
├─ Worst:     15.353807ms
├─ Completed: 7.714190336s
├─ Workers:   0=365 1=312 2=323
└─ Errors:    0
```
#### posts100k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      22.880783ms
├─ Worst:     1.581971042s
├─ Completed: 1.583725293s
├─ Workers:   0=358 1=353 2=289
└─ Errors:    0
```
#### posts100k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      29.038109ms
├─ Worst:     171.596097ms
├─ Completed: 173.435526ms
├─ Workers:   0=410 1=288 2=302
└─ Errors:    0
```
#### posts100k - mixed read and write (simpleA list with additional 300 concurrent random posts100k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      32.072536ms
├─ Worst:     1.644257821s
├─ Completed: 1.64596715s
├─ Workers:   0=410 1=288 2=302
└─ Errors:    0
```
#### posts100k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      3.943061ms
├─ Worst:     58.437139ms
├─ Completed: 245.869048ms
├─ Workers:   0=33 1=49 2=18
└─ Errors:    0
```
#### posts100k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      4.154252ms
├─ Worst:     67.734548ms
├─ Completed: 285.257811ms
├─ Workers:   0=3 1=63 2=34
└─ Errors:    0
```
#### posts100k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      4.970609ms
├─ Worst:     57.227196ms
├─ Completed: 259.034484ms
├─ Workers:   0=3 1=41 2=56
└─ Errors:    0
```
#### posts100k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      13.530781ms
├─ Worst:     54.349257ms
├─ Completed: 245.405448ms
├─ Workers:   0=30 1=28 2=42
└─ Errors:    0
```
#### posts100k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      9.9637ms
├─ Worst:     47.853144ms
├─ Completed: 177.876624ms
├─ Workers:   0=28 1=29 2=43
└─ Errors:    0
```
#### posts100k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      83.02712ms
├─ Worst:     239.338967ms
├─ Completed: 1.420428588s
├─ Workers:   0=30 1=28 2=42
└─ Errors:    0
```
#### posts100k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      931.164µs
├─ Worst:     8.056919ms
├─ Completed: 40.593435ms
├─ Workers:   0=28 1=29 2=43
└─ Errors:    0
```
#### posts100k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.033225ms
├─ Worst:     7.015932ms
├─ Completed: 38.432453ms
├─ Workers:   0=29 1=29 2=42
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      30.107246ms
├─ Worst:     338.009875ms
├─ Completed: 1.64693028s
├─ Workers:   0=29 1=29 2=42
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      995.163µs
├─ Worst:     7.884509ms
├─ Completed: 41.015218ms
├─ Workers:   0=29 1=28 2=43
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      815.906µs
├─ Worst:     9.501072ms
├─ Completed: 47.97439ms
├─ Workers:   0=49 1=47 2=4
└─ Errors:    0
```
#### posts100k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      83.836517ms
├─ Worst:     308.105859ms
├─ Completed: 1.872374344s
├─ Workers:   0=54 1=46
└─ Errors:    0
```
#### posts100k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      76.063502ms
├─ Worst:     340.367918ms
├─ Completed: 2.969715399s
├─ Workers:   0=99 2=1
└─ Errors:    0
```
#### posts100k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      933.338µs
├─ Worst:     8.631269ms
├─ Completed: 37.980079ms
├─ Workers:   0=33 1=49 2=18
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      182.066997ms
├─ Worst:     1.845373145s
├─ Completed: 11.598519866s
├─ Workers:   0=3 1=64 2=33
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.42037ms
├─ Worst:     8.717079ms
├─ Completed: 54.711307ms
├─ Workers:   0=3 1=40 2=57
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      74.790423ms
├─ Worst:     767.513201ms
├─ Completed: 3.886928572s
├─ Workers:   0=30 1=28 2=42
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      895.215µs
├─ Worst:     10.782269ms
├─ Completed: 48.334506ms
├─ Workers:   0=28 1=29 2=43
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      96.916507ms
├─ Worst:     595.191362ms
├─ Completed: 4.08303987s
├─ Workers:   0=30 1=28 2=42
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.207947ms
├─ Worst:     7.329665ms
├─ Completed: 40.935537ms
├─ Workers:   0=28 1=29 2=43
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      482.279804ms
├─ Worst:     3.596041594s
├─ Completed: 20.814300823s
├─ Workers:   0=29 1=30 2=41
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.80424ms
├─ Worst:     23.728513ms
├─ Completed: 95.038214ms
├─ Workers:   0=29 1=28 2=43
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      1.131354812s
├─ Worst:     12.540777709s
├─ Completed: 54.370432212s
├─ Workers:   0=29 1=30 2=41
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.13795ms
├─ Worst:     15.87102ms
├─ Completed: 81.449744ms
├─ Workers:   0=87 1=8 2=5
└─ Errors:    0
```

## Go vs JS route execution
#### JS route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      46.674946ms
├─ Worst:     2.636676176s
├─ Completed: 2.637495355s
├─ Workers:   0=97 1=209 2=194
└─ Errors:    0
```
#### Go route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      28.246157ms
├─ Worst:     2.723455061s
├─ Completed: 2.724191478s
├─ Workers:   0=157 1=138 2=205
└─ Errors:    0
```
#### JS route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      11.268981ms
├─ Worst:     574.829876ms
├─ Completed: 2.610326093s
├─ Workers:   0=167 1=167 2=166
└─ Errors:    0
```
#### Go route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      10.864312ms
├─ Worst:     527.243258ms
├─ Completed: 2.388336275s
├─ Workers:   0=157 1=178 2=165
└─ Errors:    0
```
#### JS route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      8.825809ms
├─ Worst:     27.383728ms
├─ Completed: 8.764058835s
├─ Workers:   0=167 1=132 2=201
└─ Errors:    0
```
#### Go route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      10.011206ms
├─ Worst:     27.53119ms
├─ Completed: 8.930521291s
├─ Workers:   0=122 1=199 2=179
└─ Errors:    0
```

## Go vs JS hooks execution
#### JS OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      973.282µs
├─ Worst:     9.400291ms
├─ Completed: 41.678921ms
├─ Workers:   0=35 1=33 2=32
└─ Errors:    0
```
#### Go OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      750.686µs
├─ Worst:     11.764634ms
├─ Completed: 52.169579ms
├─ Workers:   0=22 1=9 2=69
└─ Errors:    0
```

## Deleting records
#### deleting 100 posts10k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      694.788µs
├─ Worst:     12.452573ms
├─ Completed: 41.497823ms
├─ Workers:   0=45 1=26 2=29
└─ Errors:    0
```
#### deleting 100 posts10k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      740.011µs
├─ Worst:     9.728655ms
├─ Completed: 38.116497ms
├─ Workers:   0=43 1=28 2=29
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      747.681µs
├─ Worst:     8.613696ms
├─ Completed: 38.121224ms
├─ Workers:   0=43 1=28 2=29
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      754.481µs
├─ Worst:     11.154963ms
├─ Completed: 42.806799ms
├─ Workers:   0=14 1=40 2=46
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      698.995µs
├─ Worst:     8.327781ms
├─ Completed: 45.704268ms
├─ Workers:   1=53 2=47
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      732.321µs
├─ Worst:     10.014159ms
├─ Completed: 46.581709ms
├─ Workers:   0=28 1=43 2=29
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      766.306µs
├─ Worst:     9.278343ms
├─ Completed: 41.479649ms
├─ Workers:   0=29 1=42 2=29
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      813.973µs
├─ Worst:     11.546763ms
├─ Completed: 46.837051ms
├─ Workers:   0=29 1=30 2=41
└─ Errors:    0
```
#### deleting 100 users - with cascade deleting all associated posts [conc:10, rule:`""`]
```
┌─ Best:      68.418441ms
├─ Worst:     1.955236004s
├─ Completed: 7.709537487s
├─ Workers:   0=42 1=30 2=28
└─ Errors:    0
```
#### deleting 100 organizations - with cascade deleting all users and associated posts [conc:10, rule:`""`]
```
┌─ Best:      86.038896ms
├─ Worst:     6.015945207s
├─ Completed: 18.332494392s
├─ Workers:   0=29 1=27 2=44
└─ Errors:    0
```

---------------------------------------------------
Completed!
