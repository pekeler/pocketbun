# PocketBun Upstream-Port Benchmark Result

- machine: hetzner-2vcpu-pocketbun-2
- timestamp: 2026-08-27T16:30:22.557Z
- tests: create,auth,search,custom,delete
- benchmark source: 05625dc2b2d3f9711c51566010944b10ca9531fa
- server workers: 2
- load generator: http://load-generator:19231
- benchmark target host: application-host
- warmup request target/cap: 1000
## Creating organizations (100)
#### Creating 50 organizations [reqs:50, conc:10, rule:`""`]
```
┌─ Best:      777.405µs
├─ Worst:     18.56884ms
├─ Completed: 30.108711ms
├─ Workers:   0=26 1=24
└─ Errors:    0
```
#### Creating 50 organizations [reqs:50, conc:10, rule:`"@request.body.name != ''"`]
```
┌─ Best:      814.635µs
├─ Worst:     9.134067ms
├─ Completed: 22.819892ms
├─ Workers:   0=26 1=24
└─ Errors:    0
```

## Creating permissions (50)
#### Creating 25 permissions [reqs:25, conc:5, rule:`""`]
```
┌─ Best:      948.01µs
├─ Worst:     3.871038ms
├─ Completed: 11.989702ms
├─ Workers:   0=12 1=13
└─ Errors:    0
```
#### Creating 25 permissions [reqs:25, conc:5, rule:`"@request.body.name != ''"`]
```
┌─ Best:      815.296µs
├─ Worst:     4.603709ms
├─ Completed: 13.58163ms
├─ Workers:   0=14 1=11
└─ Errors:    0
```

## Creating users (500 - expected to be slow due to passwordHash generation)
#### Creating 250 users [reqs:250, conc:50, rule:`""`]
```
┌─ Best:      135.574085ms
├─ Worst:     4.319664873s
├─ Completed: 8.149950482s
├─ Workers:   0=155 1=95
└─ Errors:    0
```
#### Creating 250 users [reqs:250, conc:50, rule:`"@request.body.email != '' && @request.body.permissions:length > 0"`]
```
┌─ Best:      94.569223ms
├─ Worst:     4.976385171s
├─ Completed: 8.208935322s
├─ Workers:   0=128 1=122
└─ Errors:    0
```

## Creating posts (10k, 25k, 50k, 100k)
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`""`]
```
┌─ Best:      4.695245ms
├─ Worst:     692.383461ms
├─ Completed: 1.010503405s
├─ Workers:   0=2252 1=2748
└─ Errors:    0
```
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      17.14992ms
├─ Worst:     429.839688ms
├─ Completed: 1.272934623s
├─ Workers:   0=2603 1=2397
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`""`]
```
┌─ Best:      3.119579ms
├─ Worst:     576.718138ms
├─ Completed: 2.299462013s
├─ Workers:   0=6998 1=5502
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      14.280987ms
├─ Worst:     572.805752ms
├─ Completed: 2.798254537s
├─ Workers:   0=6430 1=6070
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`""`]
```
┌─ Best:      6.163434ms
├─ Worst:     606.07563ms
├─ Completed: 3.894109914s
├─ Workers:   0=13452 1=11548
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      15.156797ms
├─ Worst:     557.117973ms
├─ Completed: 5.419784609s
├─ Workers:   0=11969 1=13031
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`""`]
```
┌─ Best:      3.806019ms
├─ Worst:     637.533835ms
├─ Completed: 7.432537036s
├─ Workers:   0=21074 1=28926
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      16.082195ms
├─ Worst:     590.080305ms
├─ Completed: 10.547389365s
├─ Workers:   0=22787 1=27213
└─ Errors:    0
```

## User auth with password (expected to be slow due to passwordHash verification)
#### users auth with email/pass - high concurrency [reqs:250, conc:250]
```
┌─ Best:      111.934941ms
├─ Worst:     8.046641625s
├─ Completed: 8.046667831s
├─ Workers:   0=112 1=138
└─ Errors:    0
```
#### users auth with email/pass - small concurrency [reqs:250, conc:10]
```
┌─ Best:      65.165406ms
├─ Worst:     968.393237ms
├─ Completed: 8.080403043s
├─ Workers:   0=116 1=134
└─ Errors:    0
```

## User auth refresh
#### users - auth refresh (high concurrency) [reqs:1000, conc:1000]
```
┌─ Best:      23.295399ms
├─ Worst:     136.697197ms
├─ Completed: 138.606564ms
├─ Workers:   0=528 1=472
└─ Errors:    0
```
#### users - auth refresh (medium concurrency) [reqs:1000, conc:100]
```
┌─ Best:      333.761µs
├─ Worst:     38.949152ms
├─ Completed: 147.30567ms
├─ Workers:   0=473 1=527
└─ Errors:    0
```

## List records
#### users - getOne for auth refresh comparison (medium concurrency) [reqs:1000, conc:100, rule:`""`, query:`/f6dynp6si06wm7y`]
```
┌─ Best:      316.217µs
├─ Worst:     36.959664ms
├─ Completed: 124.666486ms
├─ Workers:   0=549 1=451
└─ Errors:    0
```
#### users - getOne for auth refresh comparison (high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`/f6dynp6si06wm7y`]
```
┌─ Best:      24.639044ms
├─ Worst:     114.799478ms
├─ Completed: 116.932844ms
├─ Workers:   0=460 1=540
└─ Errors:    0
```
#### posts10k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      675.794µs
├─ Worst:     4.985086ms
├─ Completed: 847.768843ms
├─ Workers:   0=499 1=501
└─ Errors:    0
```
#### posts10k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      25.964947ms
├─ Worst:     464.689298ms
├─ Completed: 466.446034ms
├─ Workers:   0=513 1=487
└─ Errors:    0
```
#### posts10k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      28.150876ms
├─ Worst:     258.961646ms
├─ Completed: 261.285886ms
├─ Workers:   0=476 1=524
└─ Errors:    0
```
#### posts10k - mixed read and write (simpleA list with additional 300 concurrent random posts10k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      44.281027ms
├─ Worst:     500.455392ms
├─ Completed: 501.897034ms
├─ Workers:   0=476 1=524
└─ Errors:    0
```
#### posts10k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.477471ms
├─ Worst:     26.968663ms
├─ Completed: 107.891436ms
├─ Workers:   0=23 1=77
└─ Errors:    0
```
#### posts10k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      1.756256ms
├─ Worst:     33.348505ms
├─ Completed: 138.860845ms
├─ Workers:   0=63 1=37
└─ Errors:    0
```
#### posts10k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      1.616443ms
├─ Worst:     30.972653ms
├─ Completed: 133.157347ms
├─ Workers:   0=73 1=27
└─ Errors:    0
```
#### posts10k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      6.800074ms
├─ Worst:     51.866415ms
├─ Completed: 172.514632ms
├─ Workers:   0=53 1=47
└─ Errors:    0
```
#### posts10k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.098207ms
├─ Worst:     21.723257ms
├─ Completed: 75.088633ms
├─ Workers:   0=45 1=55
└─ Errors:    0
```
#### posts10k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.415206ms
├─ Worst:     48.56904ms
├─ Completed: 150.948502ms
├─ Workers:   0=47 1=53
└─ Errors:    0
```
#### posts10k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.071691ms
├─ Worst:     10.752123ms
├─ Completed: 49.816684ms
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### posts10k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      897.349µs
├─ Worst:     8.482849ms
├─ Completed: 50.767708ms
├─ Workers:   0=47 1=53
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.311254ms
├─ Worst:     51.021898ms
├─ Completed: 157.331708ms
├─ Workers:   0=42 1=58
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.966727ms
├─ Worst:     8.517996ms
├─ Completed: 51.748902ms
├─ Workers:   0=47 1=53
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      903.608µs
├─ Worst:     9.837259ms
├─ Completed: 51.416894ms
├─ Workers:   0=47 1=53
└─ Errors:    0
```
#### posts10k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      2.470742ms
├─ Worst:     54.436196ms
├─ Completed: 164.866228ms
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts10k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      3.050043ms
├─ Worst:     50.213342ms
├─ Completed: 163.805932ms
├─ Workers:   0=72 1=28
└─ Errors:    0
```
#### posts10k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      759.029µs
├─ Worst:     10.155749ms
├─ Completed: 59.160702ms
├─ Workers:   0=23 1=77
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      20.558679ms
├─ Worst:     164.423375ms
├─ Completed: 1.169260595s
├─ Workers:   0=63 1=37
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      772.887µs
├─ Worst:     14.534477ms
├─ Completed: 73.632631ms
├─ Workers:   0=73 1=27
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      8.171468ms
├─ Worst:     99.17902ms
├─ Completed: 498.561666ms
├─ Workers:   0=53 1=47
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      695.882µs
├─ Worst:     12.433154ms
├─ Completed: 59.12355ms
├─ Workers:   0=45 1=55
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      31.269894ms
├─ Worst:     88.988984ms
├─ Completed: 573.362092ms
├─ Workers:   0=47 1=53
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      922.235µs
├─ Worst:     9.304813ms
├─ Completed: 57.461884ms
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      64.91449ms
├─ Worst:     626.525759ms
├─ Completed: 3.352521662s
├─ Workers:   0=47 1=53
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.573925ms
├─ Worst:     22.091805ms
├─ Completed: 108.618119ms
├─ Workers:   0=42 1=58
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      169.098092ms
├─ Worst:     1.779352432s
├─ Completed: 9.427131498s
├─ Workers:   0=47 1=53
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.616504ms
├─ Worst:     9.517106ms
├─ Completed: 52.092477ms
├─ Workers:   0=47 1=53
└─ Errors:    0
```
#### posts25k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.012738ms
├─ Worst:     5.462115ms
├─ Completed: 1.189615942s
├─ Workers:   0=520 1=480
└─ Errors:    0
```
#### posts25k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      25.053157ms
├─ Worst:     766.854782ms
├─ Completed: 769.498495ms
├─ Workers:   0=513 1=487
└─ Errors:    0
```
#### posts25k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      27.946525ms
├─ Worst:     294.059548ms
├─ Completed: 296.108348ms
├─ Workers:   0=508 1=492
└─ Errors:    0
```
#### posts25k - mixed read and write (simpleA list with additional 300 concurrent random posts25k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      75.631423ms
├─ Worst:     798.116114ms
├─ Completed: 799.602728ms
├─ Workers:   0=508 1=492
└─ Errors:    0
```
#### posts25k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.945308ms
├─ Worst:     40.185219ms
├─ Completed: 128.857227ms
├─ Workers:   0=39 1=61
└─ Errors:    0
```
#### posts25k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      2.522705ms
├─ Worst:     46.258419ms
├─ Completed: 157.677788ms
├─ Workers:   0=55 1=45
└─ Errors:    0
```
#### posts25k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      2.609234ms
├─ Worst:     39.884764ms
├─ Completed: 151.959599ms
├─ Workers:   0=53 1=47
└─ Errors:    0
```
#### posts25k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      9.813837ms
├─ Worst:     45.988215ms
├─ Completed: 195.979856ms
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### posts25k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      5.489563ms
├─ Worst:     23.38302ms
├─ Completed: 106.212096ms
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts25k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      5.990175ms
├─ Worst:     73.04457ms
├─ Completed: 247.863645ms
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts25k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      638.392µs
├─ Worst:     9.375572ms
├─ Completed: 57.800002ms
├─ Workers:   0=38 1=62
└─ Errors:    0
```
#### posts25k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      651.349µs
├─ Worst:     10.071923ms
├─ Completed: 53.395959ms
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      5.061472ms
├─ Worst:     74.631782ms
├─ Completed: 279.62564ms
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      656.948µs
├─ Worst:     11.731024ms
├─ Completed: 56.151985ms
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      789.641µs
├─ Worst:     10.113139ms
├─ Completed: 54.915699ms
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts25k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      19.97346ms
├─ Worst:     91.017016ms
├─ Completed: 484.393423ms
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts25k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      33.024278ms
├─ Worst:     78.477873ms
├─ Completed: 396.258219ms
├─ Workers:   0=85 1=15
└─ Errors:    0
```
#### posts25k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      655.816µs
├─ Worst:     11.418081ms
├─ Completed: 56.779442ms
├─ Workers:   0=39 1=61
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      76.501855ms
├─ Worst:     382.217886ms
├─ Completed: 2.901224423s
├─ Workers:   0=55 1=45
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      734.555µs
├─ Worst:     12.226729ms
├─ Completed: 65.077835ms
├─ Workers:   0=53 1=47
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      41.329631ms
├─ Worst:     189.057023ms
├─ Completed: 1.152936524s
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      689.292µs
├─ Worst:     12.084331ms
├─ Completed: 57.740891ms
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      72.062553ms
├─ Worst:     200.594921ms
├─ Completed: 1.43832869s
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      712.564µs
├─ Worst:     9.882942ms
├─ Completed: 59.513438ms
├─ Workers:   0=38 1=62
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      161.285761ms
├─ Worst:     1.508557881s
├─ Completed: 8.155316299s
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.125426ms
├─ Worst:     24.576459ms
├─ Completed: 109.748671ms
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      515.715201ms
├─ Worst:     3.981432235s
├─ Completed: 24.066181121s
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.139444ms
├─ Worst:     19.928748ms
├─ Completed: 81.517634ms
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts50k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.850867ms
├─ Worst:     24.499082ms
├─ Completed: 2.115193717s
├─ Workers:   0=511 1=489
└─ Errors:    0
```
#### posts50k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      24.202381ms
├─ Worst:     1.37043175s
├─ Completed: 1.372686005s
├─ Workers:   0=522 1=478
└─ Errors:    0
```
#### posts50k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      27.086606ms
├─ Worst:     257.888132ms
├─ Completed: 259.904688ms
├─ Workers:   0=474 1=526
└─ Errors:    0
```
#### posts50k - mixed read and write (simpleA list with additional 300 concurrent random posts50k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      74.395686ms
├─ Worst:     1.3977516s
├─ Completed: 1.399471766s
├─ Workers:   0=474 1=526
└─ Errors:    0
```
#### posts50k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      3.152304ms
├─ Worst:     47.737291ms
├─ Completed: 192.259447ms
├─ Workers:   0=61 1=39
└─ Errors:    0
```
#### posts50k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      3.455453ms
├─ Worst:     30.859096ms
├─ Completed: 187.494245ms
├─ Workers:   0=58 1=42
└─ Errors:    0
```
#### posts50k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      3.479166ms
├─ Worst:     50.505223ms
├─ Completed: 217.609053ms
├─ Workers:   0=62 1=38
└─ Errors:    0
```
#### posts50k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      10.904102ms
├─ Worst:     56.558056ms
├─ Completed: 257.081178ms
├─ Workers:   0=50 1=50
└─ Errors:    0
```
#### posts50k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      5.084193ms
├─ Worst:     38.070267ms
├─ Completed: 164.061725ms
├─ Workers:   0=52 1=48
└─ Errors:    0
```
#### posts50k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      75.807997ms
├─ Worst:     171.424476ms
├─ Completed: 1.262411267s
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts50k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      807.665µs
├─ Worst:     9.408308ms
├─ Completed: 53.124984ms
├─ Workers:   0=52 1=48
└─ Errors:    0
```
#### posts50k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      634.987µs
├─ Worst:     9.290273ms
├─ Completed: 50.767868ms
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      76.058983ms
├─ Worst:     171.843483ms
├─ Completed: 1.228812735s
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      699.627µs
├─ Worst:     10.500905ms
├─ Completed: 54.763869ms
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      670.195µs
├─ Worst:     11.413186ms
├─ Completed: 54.872818ms
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts50k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      76.822318ms
├─ Worst:     179.224261ms
├─ Completed: 1.345414612s
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts50k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      36.063696ms
├─ Worst:     132.050206ms
├─ Completed: 1.091846538s
├─ Workers:   0=15 1=85
└─ Errors:    0
```
#### posts50k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.681814ms
├─ Worst:     9.289501ms
├─ Completed: 54.701622ms
├─ Workers:   0=61 1=39
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      180.103837ms
├─ Worst:     1.008917225s
├─ Completed: 6.820502778s
├─ Workers:   0=58 1=42
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      735.647µs
├─ Worst:     10.140398ms
├─ Completed: 63.793842ms
├─ Workers:   0=62 1=38
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      112.490589ms
├─ Worst:     477.035841ms
├─ Completed: 3.033718886s
├─ Workers:   0=50 1=50
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      716.129µs
├─ Worst:     11.731315ms
├─ Completed: 57.260396ms
├─ Workers:   0=52 1=48
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      119.293966ms
├─ Worst:     418.095806ms
├─ Completed: 3.482846728s
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.272068ms
├─ Worst:     9.317882ms
├─ Completed: 56.204869ms
├─ Workers:   0=52 1=48
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      341.126123ms
├─ Worst:     3.046140392s
├─ Completed: 17.160489917s
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.551425ms
├─ Worst:     24.183895ms
├─ Completed: 99.335226ms
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      984.179231ms
├─ Worst:     8.863762174s
├─ Completed: 49.11520847s
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.00662ms
├─ Worst:     17.72953ms
├─ Completed: 80.504256ms
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts100k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      3.175678ms
├─ Worst:     17.053647ms
├─ Completed: 3.67515908s
├─ Workers:   0=503 1=497
└─ Errors:    0
```
#### posts100k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      28.871242ms
├─ Worst:     2.427022331s
├─ Completed: 2.428786067s
├─ Workers:   0=502 1=498
└─ Errors:    0
```
#### posts100k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      27.838204ms
├─ Worst:     254.019319ms
├─ Completed: 256.070352ms
├─ Workers:   0=497 1=503
└─ Errors:    0
```
#### posts100k - mixed read and write (simpleA list with additional 300 concurrent random posts100k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      68.620378ms
├─ Worst:     2.451949004s
├─ Completed: 2.454190069s
├─ Workers:   0=497 1=503
└─ Errors:    0
```
#### posts100k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      5.239137ms
├─ Worst:     82.645012ms
├─ Completed: 350.655158ms
├─ Workers:   0=76 1=24
└─ Errors:    0
```
#### posts100k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      5.511173ms
├─ Worst:     60.944936ms
├─ Completed: 337.159165ms
├─ Workers:   0=57 1=43
└─ Errors:    0
```
#### posts100k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      6.101168ms
├─ Worst:     61.249166ms
├─ Completed: 356.140661ms
├─ Workers:   0=26 1=74
└─ Errors:    0
```
#### posts100k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      20.068662ms
├─ Worst:     57.01024ms
├─ Completed: 343.073051ms
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts100k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      14.9855ms
├─ Worst:     59.749656ms
├─ Completed: 281.756684ms
├─ Workers:   0=50 1=50
└─ Errors:    0
```
#### posts100k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      96.129578ms
├─ Worst:     313.447751ms
├─ Completed: 2.307397635s
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts100k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      627.898µs
├─ Worst:     12.373863ms
├─ Completed: 57.599965ms
├─ Workers:   0=50 1=50
└─ Errors:    0
```
#### posts100k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      711.002µs
├─ Worst:     9.32433ms
├─ Completed: 53.736319ms
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      71.137085ms
├─ Worst:     245.992261ms
├─ Completed: 2.239261897s
├─ Workers:   0=50 1=50
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      676.414µs
├─ Worst:     10.904112ms
├─ Completed: 55.666855ms
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.750207ms
├─ Worst:     11.449506ms
├─ Completed: 71.41621ms
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts100k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      74.960897ms
├─ Worst:     293.301921ms
├─ Completed: 2.59473693s
├─ Workers:   0=50 1=50
└─ Errors:    0
```
#### posts100k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      91.910139ms
├─ Worst:     289.762983ms
├─ Completed: 2.253905103s
├─ Workers:   0=42 1=58
└─ Errors:    0
```
#### posts100k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.058532ms
├─ Worst:     13.310486ms
├─ Completed: 69.25128ms
├─ Workers:   0=76 1=24
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      267.78947ms
├─ Worst:     1.849020687s
├─ Completed: 14.007294468s
├─ Workers:   0=57 1=43
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      912.601µs
├─ Worst:     11.643294ms
├─ Completed: 63.629784ms
├─ Workers:   0=26 1=74
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      150.2954ms
├─ Worst:     853.645601ms
├─ Completed: 6.096398553s
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      809.178µs
├─ Worst:     10.356275ms
├─ Completed: 56.023137ms
├─ Workers:   0=50 1=50
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      186.087842ms
├─ Worst:     729.46952ms
├─ Completed: 6.747001875s
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.011417ms
├─ Worst:     9.125035ms
├─ Completed: 55.046898ms
├─ Workers:   0=50 1=50
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      715.052324ms
├─ Worst:     6.224186183s
├─ Completed: 35.154930376s
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.578821ms
├─ Worst:     23.309078ms
├─ Completed: 112.360098ms
├─ Workers:   0=50 1=50
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      2.020658088s
├─ Worst:     16.921842524s
├─ Completed: 98.208487031s
├─ Workers:   0=42 1=58
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.119807ms
├─ Worst:     15.555868ms
├─ Completed: 81.678125ms
├─ Workers:   0=54 1=46
└─ Errors:    0
```

## Go vs JS route execution
#### JS route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      58.478428ms
├─ Worst:     4.187225709s
├─ Completed: 4.188170864s
├─ Workers:   0=256 1=244
└─ Errors:    0
```
#### Go route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      47.17095ms
├─ Worst:     4.091187648s
├─ Completed: 4.092394625s
├─ Workers:   0=256 1=244
└─ Errors:    0
```
#### JS route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      41.851822ms
├─ Worst:     449.826858ms
├─ Completed: 4.203078528s
├─ Workers:   0=256 1=244
└─ Errors:    0
```
#### Go route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      41.541493ms
├─ Worst:     500.45409ms
├─ Completed: 4.12643844s
├─ Workers:   0=256 1=244
└─ Errors:    0
```
#### JS route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      9.818293ms
├─ Worst:     27.564926ms
├─ Completed: 5.590402698s
├─ Workers:   0=256 1=244
└─ Errors:    0
```
#### Go route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      9.71548ms
├─ Worst:     27.952502ms
├─ Completed: 5.556859385s
├─ Workers:   0=256 1=244
└─ Errors:    0
```

## Go vs JS hooks execution
#### JS OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      1.320645ms
├─ Worst:     16.226455ms
├─ Completed: 55.491583ms
├─ Workers:   0=50 1=50
└─ Errors:    0
```
#### Go OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      1.150899ms
├─ Worst:     19.421418ms
├─ Completed: 51.756283ms
├─ Workers:   0=50 1=50
└─ Errors:    0
```

## Deleting records
#### deleting 100 posts10k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      1.084708ms
├─ Worst:     10.457656ms
├─ Completed: 50.717508ms
├─ Workers:   0=50 1=50
└─ Errors:    0
```
#### deleting 100 posts10k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      705.524µs
├─ Worst:     11.51692ms
├─ Completed: 53.221176ms
├─ Workers:   0=50 1=50
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      797.131µs
├─ Worst:     10.940343ms
├─ Completed: 54.57059ms
├─ Workers:   0=56 1=44
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      724.821µs
├─ Worst:     11.767174ms
├─ Completed: 52.484699ms
├─ Workers:   0=50 1=50
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      739.571µs
├─ Worst:     12.367304ms
├─ Completed: 52.695011ms
├─ Workers:   0=50 1=50
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      1.096555ms
├─ Worst:     11.086885ms
├─ Completed: 54.130003ms
├─ Workers:   0=50 1=50
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      975.977µs
├─ Worst:     10.958928ms
├─ Completed: 52.998549ms
├─ Workers:   0=50 1=50
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      1.841233ms
├─ Worst:     7.815466ms
├─ Completed: 52.980485ms
├─ Workers:   0=56 1=44
└─ Errors:    0
```
#### deleting 100 users - with cascade deleting all associated posts [conc:10, rule:`""`]
```
┌─ Best:      64.071765ms
├─ Worst:     2.137658265s
├─ Completed: 7.243834884s
├─ Workers:   0=50 1=50
└─ Errors:    0
```
#### deleting 100 organizations - with cascade deleting all users and associated posts [conc:10, rule:`""`]
```
┌─ Best:      160.012071ms
├─ Worst:     4.7673074s
├─ Completed: 16.843245137s
├─ Workers:   0=50 1=50
└─ Errors:    0
```

---------------------------------------------------
Completed!
