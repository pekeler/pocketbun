# PocketBun Upstream-Port Benchmark Result

- machine: hetzner-2vcpu-pocketbun-1-clean-r2
- timestamp: 2026-08-27T22:03:55.237Z
- tests: create,auth,search,custom,delete
- benchmark source: 05625dc2b2d3f9711c51566010944b10ca9531fa
- server workers: 1
- load generator: http://load-generator:19231
- benchmark target host: application-host
- warmup request target/cap: 1000
## Creating organizations (100)
#### Creating 50 organizations [reqs:50, conc:10, rule:`""`]
```
┌─ Best:      2.192727ms
├─ Worst:     6.317728ms
├─ Completed: 24.073372ms
├─ Workers:   0=50
└─ Errors:    0
```
#### Creating 50 organizations [reqs:50, conc:10, rule:`"@request.body.name != ''"`]
```
┌─ Best:      2.057969ms
├─ Worst:     6.600209ms
├─ Completed: 26.908685ms
├─ Workers:   0=50
└─ Errors:    0
```

## Creating permissions (50)
#### Creating 25 permissions [reqs:25, conc:5, rule:`""`]
```
┌─ Best:      777.934µs
├─ Worst:     2.041918ms
├─ Completed: 5.431466ms
├─ Workers:   0=25
└─ Errors:    0
```
#### Creating 25 permissions [reqs:25, conc:5, rule:`"@request.body.name != ''"`]
```
┌─ Best:      1.834031ms
├─ Worst:     3.766808ms
├─ Completed: 14.174771ms
├─ Workers:   0=25
└─ Errors:    0
```

## Creating users (500 - expected to be slow due to passwordHash generation)
#### Creating 250 users [reqs:250, conc:50, rule:`""`]
```
┌─ Best:      95.055291ms
├─ Worst:     4.57556792s
├─ Completed: 8.091996128s
├─ Workers:   0=250
└─ Errors:    0
```
#### Creating 250 users [reqs:250, conc:50, rule:`"@request.body.email != '' && @request.body.permissions:length > 0"`]
```
┌─ Best:      95.138866ms
├─ Worst:     4.018620239s
├─ Completed: 8.111097567s
├─ Workers:   0=250
└─ Errors:    0
```

## Creating posts (10k, 25k, 50k, 100k)
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`""`]
```
┌─ Best:      12.51413ms
├─ Worst:     137.375446ms
├─ Completed: 1.012670922s
├─ Workers:   0=5000
└─ Errors:    0
```
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      16.331148ms
├─ Worst:     187.791855ms
├─ Completed: 1.657268603s
├─ Workers:   0=5000
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`""`]
```
┌─ Best:      17.529752ms
├─ Worst:     110.090872ms
├─ Completed: 2.548027981s
├─ Workers:   0=12500
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      14.994634ms
├─ Worst:     172.273396ms
├─ Completed: 3.52777676s
├─ Workers:   0=12500
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`""`]
```
┌─ Best:      22.655686ms
├─ Worst:     106.943828ms
├─ Completed: 4.883618576s
├─ Workers:   0=25000
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      18.556889ms
├─ Worst:     167.222636ms
├─ Completed: 7.468391187s
├─ Workers:   0=25000
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`""`]
```
┌─ Best:      16.358166ms
├─ Worst:     135.289297ms
├─ Completed: 10.03247161s
├─ Workers:   0=50000
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      21.83931ms
├─ Worst:     185.502154ms
├─ Completed: 14.816673918s
├─ Workers:   0=50000
└─ Errors:    0
```

## User auth with password (expected to be slow due to passwordHash verification)
#### users auth with email/pass - high concurrency [reqs:250, conc:250]
```
┌─ Best:      105.961633ms
├─ Worst:     8.04276895s
├─ Completed: 8.043041126s
├─ Workers:   0=250
└─ Errors:    0
```
#### users auth with email/pass - small concurrency [reqs:250, conc:10]
```
┌─ Best:      92.30742ms
├─ Worst:     653.764981ms
├─ Completed: 8.021576754s
├─ Workers:   0=250
└─ Errors:    0
```

## User auth refresh
#### users - auth refresh (high concurrency) [reqs:1000, conc:1000]
```
┌─ Best:      26.626056ms
├─ Worst:     181.230057ms
├─ Completed: 184.640875ms
├─ Workers:   0=1000
└─ Errors:    0
```
#### users - auth refresh (medium concurrency) [reqs:1000, conc:100]
```
┌─ Best:      3.002554ms
├─ Worst:     34.615151ms
├─ Completed: 179.221436ms
├─ Workers:   0=1000
└─ Errors:    0
```

## List records
#### users - getOne for auth refresh comparison (medium concurrency) [reqs:1000, conc:100, rule:`""`, query:`/gyx71hz4u19z7ep`]
```
┌─ Best:      2.836675ms
├─ Worst:     37.413483ms
├─ Completed: 164.73257ms
├─ Workers:   0=1000
└─ Errors:    0
```
#### users - getOne for auth refresh comparison (high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`/gyx71hz4u19z7ep`]
```
┌─ Best:      24.186678ms
├─ Worst:     143.61814ms
├─ Completed: 145.504393ms
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts10k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      679.638µs
├─ Worst:     3.788058ms
├─ Completed: 825.120844ms
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts10k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      27.46976ms
├─ Worst:     580.827324ms
├─ Completed: 582.610315ms
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts10k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      27.412401ms
├─ Worst:     324.457889ms
├─ Completed: 326.661871ms
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts10k - mixed read and write (simpleA list with additional 300 concurrent random posts10k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      45.573704ms
├─ Worst:     656.787023ms
├─ Completed: 658.546731ms
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts10k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      4.980212ms
├─ Worst:     23.170335ms
├─ Completed: 119.639478ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      5.392633ms
├─ Worst:     25.108281ms
├─ Completed: 132.460985ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      5.602562ms
├─ Worst:     29.660913ms
├─ Completed: 157.93625ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      5.652912ms
├─ Worst:     36.372085ms
├─ Completed: 171.510173ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      3.437524ms
├─ Worst:     15.562898ms
├─ Completed: 85.370074ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      13.680049ms
├─ Worst:     49.167413ms
├─ Completed: 173.923914ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.657197ms
├─ Worst:     11.686658ms
├─ Completed: 62.513181ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.715928ms
├─ Worst:     10.16689ms
├─ Completed: 61.103086ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      13.927801ms
├─ Worst:     51.326033ms
├─ Completed: 181.280337ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      3.121718ms
├─ Worst:     11.174902ms
├─ Completed: 67.037235ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.663707ms
├─ Worst:     10.248845ms
├─ Completed: 64.843559ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      14.338227ms
├─ Worst:     52.434252ms
├─ Completed: 200.89839ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      14.294518ms
├─ Worst:     48.452087ms
├─ Completed: 180.205353ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.181661ms
├─ Worst:     9.929824ms
├─ Completed: 62.700689ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      50.130552ms
├─ Worst:     167.226953ms
├─ Completed: 1.361091413s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.60869ms
├─ Worst:     10.903919ms
├─ Completed: 68.989238ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      33.575816ms
├─ Worst:     89.160808ms
├─ Completed: 575.403488ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.631581ms
├─ Worst:     14.246972ms
├─ Completed: 67.328908ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      36.467328ms
├─ Worst:     104.551527ms
├─ Completed: 706.494572ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.749194ms
├─ Worst:     10.73107ms
├─ Completed: 67.824743ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      73.100453ms
├─ Worst:     394.604917ms
├─ Completed: 3.626630841s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      5.671448ms
├─ Worst:     27.217431ms
├─ Completed: 126.343491ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      153.121526ms
├─ Worst:     1.183536438s
├─ Completed: 11.412245107s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      3.576476ms
├─ Worst:     19.351496ms
├─ Completed: 99.049534ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.004797ms
├─ Worst:     5.157146ms
├─ Completed: 1.190604852s
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts25k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      24.842344ms
├─ Worst:     919.662255ms
├─ Completed: 921.515904ms
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts25k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      26.980073ms
├─ Worst:     334.576343ms
├─ Completed: 336.328171ms
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts25k - mixed read and write (simpleA list with additional 300 concurrent random posts25k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      105.224696ms
├─ Worst:     983.096528ms
├─ Completed: 985.155399ms
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts25k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      6.806614ms
├─ Worst:     32.850666ms
├─ Completed: 146.343762ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      6.291643ms
├─ Worst:     36.10802ms
├─ Completed: 163.838586ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      6.779005ms
├─ Worst:     38.163767ms
├─ Completed: 173.491979ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      7.854448ms
├─ Worst:     46.754854ms
├─ Completed: 210.601683ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      5.087631ms
├─ Worst:     24.472004ms
├─ Completed: 120.744444ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      26.043922ms
├─ Worst:     79.758181ms
├─ Completed: 335.007569ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.533596ms
├─ Worst:     10.408485ms
├─ Completed: 64.452468ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.44197ms
├─ Worst:     10.22451ms
├─ Completed: 60.842505ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      23.937276ms
├─ Worst:     77.393607ms
├─ Completed: 314.918314ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.81092ms
├─ Worst:     12.634447ms
├─ Completed: 66.033641ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.614248ms
├─ Worst:     11.945285ms
├─ Completed: 61.962052ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      39.214068ms
├─ Worst:     95.632328ms
├─ Completed: 471.570583ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      32.443243ms
├─ Worst:     79.466859ms
├─ Completed: 399.131903ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.563799ms
├─ Worst:     11.486962ms
├─ Completed: 61.812504ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      82.42396ms
├─ Worst:     414.70053ms
├─ Completed: 3.718820259s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.71676ms
├─ Worst:     11.809499ms
├─ Completed: 71.362454ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      59.848303ms
├─ Worst:     180.871122ms
├─ Completed: 1.354281864s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.28289ms
├─ Worst:     11.233482ms
├─ Completed: 63.099821ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      65.359531ms
├─ Worst:     218.639926ms
├─ Completed: 1.676370775s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.652ms
├─ Worst:     9.64498ms
├─ Completed: 63.835897ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      140.045372ms
├─ Worst:     994.029707ms
├─ Completed: 9.481134714s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      6.264435ms
├─ Worst:     28.227134ms
├─ Completed: 127.61842ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      295.451459ms
├─ Worst:     2.523237778s
├─ Completed: 24.793632245s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      3.214387ms
├─ Worst:     15.863122ms
├─ Completed: 87.373801ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.813321ms
├─ Worst:     8.516664ms
├─ Completed: 2.005658812s
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts50k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      25.473124ms
├─ Worst:     1.716279823s
├─ Completed: 1.718246968s
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts50k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      25.053094ms
├─ Worst:     309.113484ms
├─ Completed: 310.840027ms
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts50k - mixed read and write (simpleA list with additional 300 concurrent random posts50k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      98.152806ms
├─ Worst:     1.805870511s
├─ Completed: 1.807902225s
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts50k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      9.75449ms
├─ Worst:     49.315618ms
├─ Completed: 231.036483ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      10.877972ms
├─ Worst:     54.670339ms
├─ Completed: 272.850058ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      10.503976ms
├─ Worst:     52.805544ms
├─ Completed: 256.120882ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      11.519878ms
├─ Worst:     57.070991ms
├─ Completed: 298.63229ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      8.84058ms
├─ Worst:     46.423016ms
├─ Completed: 211.905791ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      66.812444ms
├─ Worst:     211.877684ms
├─ Completed: 1.66333214s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.483958ms
├─ Worst:     9.322965ms
├─ Completed: 58.196204ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.057519ms
├─ Worst:     11.645161ms
├─ Completed: 64.827696ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      68.217794ms
├─ Worst:     209.25246ms
├─ Completed: 1.640545634s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.564649ms
├─ Worst:     9.486311ms
├─ Completed: 62.754064ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      3.106177ms
├─ Worst:     9.37635ms
├─ Completed: 61.6496ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      66.090338ms
├─ Worst:     218.537404ms
├─ Completed: 1.745256421s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      60.93885ms
├─ Worst:     157.197252ms
├─ Completed: 1.066628427s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.135518ms
├─ Worst:     12.838838ms
├─ Completed: 59.950004ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      130.179425ms
├─ Worst:     884.909765ms
├─ Completed: 8.469728626s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.839569ms
├─ Worst:     11.367378ms
├─ Completed: 68.872298ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      65.764788ms
├─ Worst:     403.938647ms
├─ Completed: 3.807323888s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.309396ms
├─ Worst:     12.062697ms
├─ Completed: 61.667154ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      95.859712ms
├─ Worst:     498.228683ms
├─ Completed: 4.53927235s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      3.499149ms
├─ Worst:     11.12297ms
├─ Completed: 68.167065ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      248.822139ms
├─ Worst:     2.012251089s
├─ Completed: 19.703727955s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      6.595532ms
├─ Worst:     30.301447ms
├─ Completed: 136.86358ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      624.8527ms
├─ Worst:     5.781855402s
├─ Completed: 57.007056087s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      3.513358ms
├─ Worst:     17.684556ms
├─ Completed: 92.4023ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      3.205544ms
├─ Worst:     16.188272ms
├─ Completed: 3.422795301s
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts100k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      28.714868ms
├─ Worst:     3.111084461s
├─ Completed: 3.11309742s
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts100k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      27.413313ms
├─ Worst:     338.023591ms
├─ Completed: 340.007659ms
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts100k - mixed read and write (simpleA list with additional 300 concurrent random posts100k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      101.092904ms
├─ Worst:     3.294273644s
├─ Completed: 3.296334889s
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts100k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      18.320333ms
├─ Worst:     84.482211ms
├─ Completed: 387.197224ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      17.064009ms
├─ Worst:     67.417409ms
├─ Completed: 390.860148ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      16.876241ms
├─ Worst:     68.345681ms
├─ Completed: 402.152201ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      18.229627ms
├─ Worst:     72.877246ms
├─ Completed: 440.274452ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      15.672569ms
├─ Worst:     64.451916ms
├─ Completed: 346.038731ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      80.907026ms
├─ Worst:     359.335923ms
├─ Completed: 3.114902249s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.629079ms
├─ Worst:     11.209219ms
├─ Completed: 62.81668ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.963259ms
├─ Worst:     4.786345ms
├─ Completed: 34.183974ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      81.582368ms
├─ Worst:     357.773098ms
├─ Completed: 3.1865731s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      845.196µs
├─ Worst:     10.68772ms
├─ Completed: 62.153194ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.374407ms
├─ Worst:     9.33994ms
├─ Completed: 60.36006ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      84.063823ms
├─ Worst:     388.763235ms
├─ Completed: 3.485110369s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      76.394598ms
├─ Worst:     319.998316ms
├─ Completed: 2.810789916s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.520578ms
├─ Worst:     13.429213ms
├─ Completed: 65.969762ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      224.942724ms
├─ Worst:     1.81110148s
├─ Completed: 17.629127158s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.698864ms
├─ Worst:     11.107469ms
├─ Completed: 67.836078ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      128.554122ms
├─ Worst:     804.04064ms
├─ Completed: 7.570848405s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.659129ms
├─ Worst:     10.514731ms
├─ Completed: 66.197556ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      139.78436ms
├─ Worst:     942.659762ms
├─ Completed: 9.050564345s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      3.332069ms
├─ Worst:     11.443813ms
├─ Completed: 74.862523ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      468.310004ms
├─ Worst:     4.078453374s
├─ Completed: 40.232757362s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      6.433198ms
├─ Worst:     29.223009ms
├─ Completed: 133.714184ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      1.234557798s
├─ Worst:     11.432929991s
├─ Completed: 113.487788269s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      3.459485ms
├─ Worst:     16.643069ms
├─ Completed: 91.504012ms
├─ Workers:   0=100
└─ Errors:    0
```

## Go vs JS route execution
#### JS route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      54.803742ms
├─ Worst:     5.262859699s
├─ Completed: 5.263790864s
├─ Workers:   0=500
└─ Errors:    0
```
#### Go route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      39.10592ms
├─ Worst:     5.185168851s
├─ Completed: 5.186629727s
├─ Workers:   0=500
└─ Errors:    0
```
#### JS route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      28.682123ms
├─ Worst:     556.572404ms
├─ Completed: 5.35035346s
├─ Workers:   0=500
└─ Errors:    0
```
#### Go route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      29.388819ms
├─ Worst:     548.646263ms
├─ Completed: 5.163947282s
├─ Workers:   0=500
└─ Errors:    0
```
#### JS route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      10.116531ms
├─ Worst:     30.065042ms
├─ Completed: 5.445117399s
├─ Workers:   0=500
└─ Errors:    0
```
#### Go route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      10.138482ms
├─ Worst:     31.108411ms
├─ Completed: 5.422949355s
├─ Workers:   0=500
└─ Errors:    0
```

## Go vs JS hooks execution
#### JS OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      2.769823ms
├─ Worst:     10.942922ms
├─ Completed: 60.458667ms
├─ Workers:   0=100
└─ Errors:    0
```
#### Go OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      2.510584ms
├─ Worst:     9.184556ms
├─ Completed: 56.103337ms
├─ Workers:   0=100
└─ Errors:    0
```

## Deleting records
#### deleting 100 posts10k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      2.013418ms
├─ Worst:     7.23134ms
├─ Completed: 47.716813ms
├─ Workers:   0=100
└─ Errors:    0
```
#### deleting 100 posts10k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      1.832379ms
├─ Worst:     7.091566ms
├─ Completed: 54.318092ms
├─ Workers:   0=100
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      2.00622ms
├─ Worst:     7.327393ms
├─ Completed: 52.394768ms
├─ Workers:   0=100
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      1.852597ms
├─ Worst:     9.172008ms
├─ Completed: 54.290875ms
├─ Workers:   0=100
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      2.083285ms
├─ Worst:     7.560164ms
├─ Completed: 50.309531ms
├─ Workers:   0=100
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      1.922534ms
├─ Worst:     7.283522ms
├─ Completed: 52.668327ms
├─ Workers:   0=100
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      1.758137ms
├─ Worst:     6.645901ms
├─ Completed: 49.818133ms
├─ Workers:   0=100
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      1.891861ms
├─ Worst:     7.078339ms
├─ Completed: 51.023757ms
├─ Workers:   0=100
└─ Errors:    0
```
#### deleting 100 users - with cascade deleting all associated posts [conc:10, rule:`""`]
```
┌─ Best:      119.660811ms
├─ Worst:     744.105242ms
├─ Completed: 6.776963738s
├─ Workers:   0=100
└─ Errors:    0
```
#### deleting 100 organizations - with cascade deleting all users and associated posts [conc:10, rule:`""`]
```
┌─ Best:      242.524813ms
├─ Worst:     3.377526597s
├─ Completed: 16.643114406s
├─ Workers:   0=100
└─ Errors:    0
```

---------------------------------------------------
Completed!
