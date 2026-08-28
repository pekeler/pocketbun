# PocketBun Upstream-Port Benchmark Result

- machine: hetzner-4vcpu-pocketbun-4
- timestamp: 2026-08-27T15:27:49.634Z
- tests: create,auth,search,custom,delete
- benchmark source: 05625dc2b2d3f9711c51566010944b10ca9531fa
- server workers: 4
- load generator: http://load-generator:19231
- benchmark target host: application-host
- warmup request target/cap: 1000
## Creating organizations (100)
#### Creating 50 organizations [reqs:50, conc:10, rule:`""`]
```
┌─ Best:      731.4µs
├─ Worst:     6.408382ms
├─ Completed: 12.57474ms
├─ Workers:   0=12 1=15 2=12 3=11
└─ Errors:    0
```
#### Creating 50 organizations [reqs:50, conc:10, rule:`"@request.body.name != ''"`]
```
┌─ Best:      776.032µs
├─ Worst:     9.997781ms
├─ Completed: 18.95182ms
├─ Workers:   1=23 2=14 3=13
└─ Errors:    0
```

## Creating permissions (50)
#### Creating 25 permissions [reqs:25, conc:5, rule:`""`]
```
┌─ Best:      765.798µs
├─ Worst:     3.892878ms
├─ Completed: 9.390462ms
├─ Workers:   1=7 2=8 3=10
└─ Errors:    0
```
#### Creating 25 permissions [reqs:25, conc:5, rule:`"@request.body.name != ''"`]
```
┌─ Best:      907.553µs
├─ Worst:     3.497692ms
├─ Completed: 12.046821ms
├─ Workers:   1=3 2=17 3=5
└─ Errors:    0
```

## Creating users (500 - expected to be slow due to passwordHash generation)
#### Creating 250 users [reqs:250, conc:50, rule:`""`]
```
┌─ Best:      161.142244ms
├─ Worst:     2.276051643s
├─ Completed: 4.123583207s
├─ Workers:   0=51 1=51 2=102 3=46
└─ Errors:    0
```
#### Creating 250 users [reqs:250, conc:50, rule:`"@request.body.email != '' && @request.body.permissions:length > 0"`]
```
┌─ Best:      254.955528ms
├─ Worst:     2.124136508s
├─ Completed: 4.139678163s
├─ Workers:   0=52 1=83 2=43 3=72
└─ Errors:    0
```

## Creating posts (10k, 25k, 50k, 100k)
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`""`]
```
┌─ Best:      674.733µs
├─ Worst:     404.60185ms
├─ Completed: 548.576698ms
├─ Workers:   0=980 1=1363 2=1334 3=1323
└─ Errors:    0
```
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      10.500226ms
├─ Worst:     542.378906ms
├─ Completed: 743.436299ms
├─ Workers:   0=1125 1=1366 2=1512 3=997
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`""`]
```
┌─ Best:      449.721µs
├─ Worst:     509.229864ms
├─ Completed: 1.271709509s
├─ Workers:   0=3026 1=3346 2=3287 3=2841
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      574.764µs
├─ Worst:     495.291591ms
├─ Completed: 1.790157737s
├─ Workers:   0=3355 1=3470 2=2940 3=2735
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`""`]
```
┌─ Best:      427.271µs
├─ Worst:     659.308604ms
├─ Completed: 2.157181797s
├─ Workers:   0=6631 1=6030 2=6411 3=5928
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      726.914µs
├─ Worst:     518.910115ms
├─ Completed: 3.075533695s
├─ Workers:   0=6375 1=6803 2=4861 3=6961
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`""`]
```
┌─ Best:      2.58431ms
├─ Worst:     689.093389ms
├─ Completed: 3.97860114s
├─ Workers:   0=14474 1=10873 2=12744 3=11909
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      1.249907ms
├─ Worst:     836.993069ms
├─ Completed: 5.746692903s
├─ Workers:   0=12131 1=13249 2=10732 3=13888
└─ Errors:    0
```

## User auth with password (expected to be slow due to passwordHash verification)
#### users auth with email/pass - high concurrency [reqs:250, conc:250]
```
┌─ Best:      129.015313ms
├─ Worst:     4.062746525s
├─ Completed: 4.062856288s
├─ Workers:   0=46 1=35 2=93 3=76
└─ Errors:    0
```
#### users auth with email/pass - small concurrency [reqs:250, conc:10]
```
┌─ Best:      64.088933ms
├─ Worst:     386.245183ms
├─ Completed: 4.072284016s
├─ Workers:   0=41 1=72 2=75 3=62
└─ Errors:    0
```

## User auth refresh
#### users - auth refresh (high concurrency) [reqs:1000, conc:1000]
```
┌─ Best:      24.584982ms
├─ Worst:     84.391438ms
├─ Completed: 85.994614ms
├─ Workers:   0=270 1=289 2=218 3=223
└─ Errors:    0
```
#### users - auth refresh (medium concurrency) [reqs:1000, conc:100]
```
┌─ Best:      371.933µs
├─ Worst:     24.654068ms
├─ Completed: 95.430268ms
├─ Workers:   0=226 1=282 2=229 3=263
└─ Errors:    0
```

## List records
#### users - getOne for auth refresh comparison (medium concurrency) [reqs:1000, conc:100, rule:`""`, query:`/ygbuuultc5nxsao`]
```
┌─ Best:      488.926µs
├─ Worst:     31.385487ms
├─ Completed: 77.58772ms
├─ Workers:   0=201 1=287 2=266 3=246
└─ Errors:    0
```
#### users - getOne for auth refresh comparison (high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`/ygbuuultc5nxsao`]
```
┌─ Best:      22.937066ms
├─ Worst:     82.278952ms
├─ Completed: 83.91436ms
├─ Workers:   0=221 1=256 2=285 3=238
└─ Errors:    0
```
#### posts10k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.258469ms
├─ Worst:     5.922652ms
├─ Completed: 1.717945863s
├─ Workers:   0=305 1=264 2=274 3=157
└─ Errors:    0
```
#### posts10k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      23.473898ms
├─ Worst:     269.598165ms
├─ Completed: 271.415756ms
├─ Workers:   0=210 1=305 2=226 3=259
└─ Errors:    0
```
#### posts10k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      24.683758ms
├─ Worst:     151.826754ms
├─ Completed: 153.579756ms
├─ Workers:   0=299 1=247 2=271 3=183
└─ Errors:    0
```
#### posts10k - mixed read and write (simpleA list with additional 300 concurrent random posts10k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      30.663518ms
├─ Worst:     287.985946ms
├─ Completed: 290.208977ms
├─ Workers:   0=299 1=247 2=271 3=183
└─ Errors:    0
```
#### posts10k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.415966ms
├─ Worst:     19.844833ms
├─ Completed: 101.973476ms
├─ Workers:   0=12 1=9 2=18 3=61
└─ Errors:    0
```
#### posts10k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      1.22976ms
├─ Worst:     25.219057ms
├─ Completed: 97.406228ms
├─ Workers:   1=49 2=13 3=38
└─ Errors:    0
```
#### posts10k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      1.929655ms
├─ Worst:     21.016873ms
├─ Completed: 90.832597ms
├─ Workers:   0=11 1=43 2=21 3=25
└─ Errors:    0
```
#### posts10k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      3.45297ms
├─ Worst:     39.997894ms
├─ Completed: 118.863199ms
├─ Workers:   0=19 1=34 2=22 3=25
└─ Errors:    0
```
#### posts10k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.046365ms
├─ Worst:     17.270268ms
├─ Completed: 56.162343ms
├─ Workers:   0=21 1=27 2=26 3=26
└─ Errors:    0
```
#### posts10k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.60543ms
├─ Worst:     38.306457ms
├─ Completed: 106.9123ms
├─ Workers:   0=21 1=25 2=25 3=29
└─ Errors:    0
```
#### posts10k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      993.512µs
├─ Worst:     10.793251ms
├─ Completed: 34.944142ms
├─ Workers:   0=24 1=30 2=20 3=26
└─ Errors:    0
```
#### posts10k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      939.639µs
├─ Worst:     10.27199ms
├─ Completed: 38.337029ms
├─ Workers:   0=20 1=30 2=28 3=22
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.335326ms
├─ Worst:     41.002602ms
├─ Completed: 103.801913ms
├─ Workers:   0=22 1=30 2=28 3=20
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.130983ms
├─ Worst:     8.711945ms
├─ Completed: 36.237239ms
├─ Workers:   0=22 1=25 2=26 3=27
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      841.642µs
├─ Worst:     14.283682ms
├─ Completed: 49.597665ms
├─ Workers:   0=24 1=44 2=30 3=2
└─ Errors:    0
```
#### posts10k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      1.953469ms
├─ Worst:     53.383994ms
├─ Completed: 179.55637ms
├─ Workers:   0=40 1=15 2=45
└─ Errors:    0
```
#### posts10k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      4.318175ms
├─ Worst:     39.082499ms
├─ Completed: 182.904987ms
├─ Workers:   0=75 2=25
└─ Errors:    0
```
#### posts10k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.00637ms
├─ Worst:     10.264649ms
├─ Completed: 54.82776ms
├─ Workers:   0=12 1=9 2=18 3=61
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      14.593259ms
├─ Worst:     182.578856ms
├─ Completed: 856.301151ms
├─ Workers:   1=49 2=13 3=38
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.125945ms
├─ Worst:     13.626463ms
├─ Completed: 55.79798ms
├─ Workers:   0=11 1=43 2=21 3=25
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      5.419535ms
├─ Worst:     79.985242ms
├─ Completed: 344.441564ms
├─ Workers:   0=19 1=34 2=22 3=25
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.034138ms
├─ Worst:     8.609012ms
├─ Completed: 39.262027ms
├─ Workers:   0=21 1=27 2=26 3=26
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      8.291835ms
├─ Worst:     76.454626ms
├─ Completed: 373.410853ms
├─ Workers:   0=21 1=25 2=25 3=29
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.312883ms
├─ Worst:     9.641799ms
├─ Completed: 41.203138ms
├─ Workers:   0=24 1=30 2=20 3=26
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      36.641827ms
├─ Worst:     382.110459ms
├─ Completed: 1.598317156s
├─ Workers:   0=20 1=30 2=28 3=22
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.477951ms
├─ Worst:     13.171404ms
├─ Completed: 67.63402ms
├─ Workers:   0=22 1=30 2=28 3=20
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      164.906142ms
├─ Worst:     708.51624ms
├─ Completed: 4.817621417s
├─ Workers:   0=22 1=25 2=26 3=27
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.703653ms
├─ Worst:     16.107312ms
├─ Completed: 67.382182ms
├─ Workers:   0=24 1=44 2=30 3=2
└─ Errors:    0
```
#### posts25k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.044764ms
├─ Worst:     7.075013ms
├─ Completed: 2.266035445s
├─ Workers:   0=243 1=262 2=243 3=252
└─ Errors:    0
```
#### posts25k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      23.282674ms
├─ Worst:     417.120233ms
├─ Completed: 420.001043ms
├─ Workers:   0=246 1=276 2=254 3=224
└─ Errors:    0
```
#### posts25k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      27.084755ms
├─ Worst:     153.142442ms
├─ Completed: 154.825137ms
├─ Workers:   0=218 1=259 2=261 3=262
└─ Errors:    0
```
#### posts25k - mixed read and write (simpleA list with additional 300 concurrent random posts25k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      43.189492ms
├─ Worst:     425.449749ms
├─ Completed: 427.11519ms
├─ Workers:   0=218 1=259 2=261 3=262
└─ Errors:    0
```
#### posts25k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.363304ms
├─ Worst:     23.416628ms
├─ Completed: 91.213082ms
├─ Workers:   0=34 1=19 2=36 3=11
└─ Errors:    0
```
#### posts25k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      1.93258ms
├─ Worst:     30.109553ms
├─ Completed: 114.576307ms
├─ Workers:   0=34 1=19 2=21 3=26
└─ Errors:    0
```
#### posts25k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      1.743028ms
├─ Worst:     30.936756ms
├─ Completed: 124.052026ms
├─ Workers:   0=29 1=53 2=10 3=8
└─ Errors:    0
```
#### posts25k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      3.281383ms
├─ Worst:     48.054403ms
├─ Completed: 134.304559ms
├─ Workers:   0=24 1=28 2=26 3=22
└─ Errors:    0
```
#### posts25k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.64399ms
├─ Worst:     15.043432ms
├─ Completed: 70.75313ms
├─ Workers:   0=25 1=26 2=26 3=23
└─ Errors:    0
```
#### posts25k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      6.078275ms
├─ Worst:     67.399297ms
├─ Completed: 214.301087ms
├─ Workers:   0=23 1=26 2=27 3=24
└─ Errors:    0
```
#### posts25k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      960.217µs
├─ Worst:     13.017593ms
├─ Completed: 38.254424ms
├─ Workers:   0=27 1=25 2=26 3=22
└─ Errors:    0
```
#### posts25k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.112477ms
├─ Worst:     12.201415ms
├─ Completed: 34.517903ms
├─ Workers:   0=26 1=26 2=26 3=22
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      5.680518ms
├─ Worst:     66.9035ms
├─ Completed: 212.36984ms
├─ Workers:   0=24 1=26 2=27 3=23
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      908.445µs
├─ Worst:     12.27777ms
├─ Completed: 42.144528ms
├─ Workers:   0=26 1=26 2=26 3=22
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.314356ms
├─ Worst:     10.982712ms
├─ Completed: 42.568064ms
├─ Workers:   0=25 1=25 2=26 3=24
└─ Errors:    0
```
#### posts25k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      9.347842ms
├─ Worst:     75.216425ms
├─ Completed: 325.463049ms
├─ Workers:   0=14 1=27 2=29 3=30
└─ Errors:    0
```
#### posts25k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      5.960614ms
├─ Worst:     72.44708ms
├─ Completed: 328.116063ms
├─ Workers:   1=35 2=21 3=44
└─ Errors:    0
```
#### posts25k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      946.307µs
├─ Worst:     11.816383ms
├─ Completed: 41.403826ms
├─ Workers:   0=34 1=19 2=36 3=11
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      56.670585ms
├─ Worst:     305.706094ms
├─ Completed: 1.767571837s
├─ Workers:   0=34 1=19 2=21 3=26
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.363594ms
├─ Worst:     10.285468ms
├─ Completed: 57.587382ms
├─ Workers:   0=29 1=53 2=10 3=8
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      24.346212ms
├─ Worst:     124.244754ms
├─ Completed: 706.093212ms
├─ Workers:   0=24 1=28 2=26 3=22
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.017636ms
├─ Worst:     10.07737ms
├─ Completed: 39.128072ms
├─ Workers:   0=25 1=26 2=26 3=23
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      28.242655ms
├─ Worst:     137.665682ms
├─ Completed: 815.648152ms
├─ Workers:   0=23 1=26 2=27 3=24
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.078009ms
├─ Worst:     11.337201ms
├─ Completed: 40.442067ms
├─ Workers:   0=27 1=25 2=26 3=22
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      113.953776ms
├─ Worst:     762.242537ms
├─ Completed: 3.982789634s
├─ Workers:   0=26 1=26 2=26 3=22
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.702973ms
├─ Worst:     15.922385ms
├─ Completed: 72.714468ms
├─ Workers:   0=24 1=26 2=27 3=23
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      292.165801ms
├─ Worst:     2.480637281s
├─ Completed: 12.38513542s
├─ Workers:   0=26 1=26 2=26 3=22
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.134508ms
├─ Worst:     11.506105ms
├─ Completed: 58.897412ms
├─ Workers:   0=25 1=25 2=26 3=24
└─ Errors:    0
```
#### posts50k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.968659ms
├─ Worst:     9.268545ms
├─ Completed: 4.518612112s
├─ Workers:   0=236 1=284 2=248 3=232
└─ Errors:    0
```
#### posts50k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      26.250152ms
├─ Worst:     774.3333ms
├─ Completed: 776.48303ms
├─ Workers:   0=235 1=284 2=248 3=233
└─ Errors:    0
```
#### posts50k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      31.913817ms
├─ Worst:     166.25783ms
├─ Completed: 168.165335ms
├─ Workers:   0=256 1=238 2=261 3=245
└─ Errors:    0
```
#### posts50k - mixed read and write (simpleA list with additional 300 concurrent random posts50k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      35.276661ms
├─ Worst:     750.356628ms
├─ Completed: 752.737156ms
├─ Workers:   0=256 1=238 2=261 3=245
└─ Errors:    0
```
#### posts50k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      2.196964ms
├─ Worst:     41.744987ms
├─ Completed: 128.625344ms
├─ Workers:   0=35 1=37 2=17 3=11
└─ Errors:    0
```
#### posts50k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      2.609775ms
├─ Worst:     41.137277ms
├─ Completed: 168.874905ms
├─ Workers:   0=17 1=44 2=20 3=19
└─ Errors:    0
```
#### posts50k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      2.491372ms
├─ Worst:     38.128441ms
├─ Completed: 140.947786ms
├─ Workers:   0=9 1=32 2=33 3=26
└─ Errors:    0
```
#### posts50k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      4.465317ms
├─ Worst:     41.663585ms
├─ Completed: 168.551899ms
├─ Workers:   0=25 1=25 2=26 3=24
└─ Errors:    0
```
#### posts50k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      2.664631ms
├─ Worst:     40.159266ms
├─ Completed: 127.256443ms
├─ Workers:   0=21 1=38 2=21 3=20
└─ Errors:    0
```
#### posts50k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      23.965406ms
├─ Worst:     125.098902ms
├─ Completed: 687.05352ms
├─ Workers:   0=28 1=24 2=23 3=25
└─ Errors:    0
```
#### posts50k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      934.822µs
├─ Worst:     11.982052ms
├─ Completed: 40.643185ms
├─ Workers:   0=25 1=28 2=24 3=23
└─ Errors:    0
```
#### posts50k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      960.928µs
├─ Worst:     8.532758ms
├─ Completed: 37.781261ms
├─ Workers:   0=29 1=25 2=23 3=23
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      23.740424ms
├─ Worst:     125.899919ms
├─ Completed: 674.892812ms
├─ Workers:   0=25 1=26 2=26 3=23
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.060965ms
├─ Worst:     15.232702ms
├─ Completed: 44.371437ms
├─ Workers:   0=28 1=28 2=18 3=26
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      987.304µs
├─ Worst:     10.623695ms
├─ Completed: 36.788249ms
├─ Workers:   0=25 1=26 2=25 3=24
└─ Errors:    0
```
#### posts50k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      25.443478ms
├─ Worst:     128.824981ms
├─ Completed: 728.108335ms
├─ Workers:   0=26 1=26 2=24 3=24
└─ Errors:    0
```
#### posts50k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      30.915787ms
├─ Worst:     117.306497ms
├─ Completed: 678.796746ms
├─ Workers:   0=18 1=2 2=47 3=33
└─ Errors:    0
```
#### posts50k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      540.387µs
├─ Worst:     10.982681ms
├─ Completed: 41.653571ms
├─ Workers:   0=35 1=37 2=17 3=11
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      118.282977ms
├─ Worst:     780.725469ms
├─ Completed: 4.084218049s
├─ Workers:   0=17 1=44 2=20 3=19
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.113138ms
├─ Worst:     9.737212ms
├─ Completed: 49.117972ms
├─ Workers:   0=9 1=32 2=33 3=26
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      51.80897ms
├─ Worst:     259.499874ms
├─ Completed: 1.591514599s
├─ Workers:   0=25 1=25 2=26 3=24
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      963.229µs
├─ Worst:     11.460272ms
├─ Completed: 45.868624ms
├─ Workers:   0=21 1=38 2=21 3=20
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      119.158596ms
├─ Worst:     254.112493ms
├─ Completed: 1.834583036s
├─ Workers:   0=28 1=24 2=23 3=25
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.244589ms
├─ Worst:     10.817964ms
├─ Completed: 38.59847ms
├─ Workers:   0=25 1=28 2=24 3=23
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      200.691768ms
├─ Worst:     1.851287161s
├─ Completed: 8.680990702s
├─ Workers:   0=29 1=25 2=23 3=23
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.696734ms
├─ Worst:     19.402904ms
├─ Completed: 75.814171ms
├─ Workers:   0=25 1=26 2=26 3=23
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      789.627287ms
├─ Worst:     5.807832473s
├─ Completed: 25.706022385s
├─ Workers:   0=28 1=28 2=18 3=26
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.268211ms
├─ Worst:     11.271311ms
├─ Completed: 59.430128ms
├─ Workers:   0=25 1=26 2=25 3=24
└─ Errors:    0
```
#### posts100k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      3.560118ms
├─ Worst:     18.745997ms
├─ Completed: 8.528704978s
├─ Workers:   0=233 1=281 2=258 3=228
└─ Errors:    0
```
#### posts100k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      30.282672ms
├─ Worst:     1.394864742s
├─ Completed: 1.397142849s
├─ Workers:   0=229 1=284 2=257 3=230
└─ Errors:    0
```
#### posts100k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      29.65746ms
├─ Worst:     163.625945ms
├─ Completed: 165.339332ms
├─ Workers:   0=261 1=257 2=247 3=235
└─ Errors:    0
```
#### posts100k - mixed read and write (simpleA list with additional 300 concurrent random posts100k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      47.551128ms
├─ Worst:     1.358077579s
├─ Completed: 1.359926824s
├─ Workers:   0=261 1=257 2=247 3=235
└─ Errors:    0
```
#### posts100k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      3.915881ms
├─ Worst:     59.807398ms
├─ Completed: 206.316487ms
├─ Workers:   0=27 1=35 2=9 3=29
└─ Errors:    0
```
#### posts100k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      3.865109ms
├─ Worst:     56.055837ms
├─ Completed: 236.563081ms
├─ Workers:   0=18 1=35 2=19 3=28
└─ Errors:    0
```
#### posts100k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      6.216217ms
├─ Worst:     56.928572ms
├─ Completed: 302.371077ms
├─ Workers:   0=9 1=28 2=55 3=8
└─ Errors:    0
```
#### posts100k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      12.042586ms
├─ Worst:     55.571666ms
├─ Completed: 230.340975ms
├─ Workers:   0=24 1=26 2=25 3=25
└─ Errors:    0
```
#### posts100k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      6.245006ms
├─ Worst:     47.182688ms
├─ Completed: 168.418034ms
├─ Workers:   0=26 1=25 2=24 3=25
└─ Errors:    0
```
#### posts100k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      66.249668ms
├─ Worst:     186.912733ms
├─ Completed: 1.189325773s
├─ Workers:   0=26 1=25 2=24 3=25
└─ Errors:    0
```
#### posts100k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      988.345µs
├─ Worst:     11.580087ms
├─ Completed: 39.39457ms
├─ Workers:   0=25 1=26 2=24 3=25
└─ Errors:    0
```
#### posts100k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      980.215µs
├─ Worst:     8.551062ms
├─ Completed: 36.190024ms
├─ Workers:   0=24 1=26 2=25 3=25
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      31.800269ms
├─ Worst:     408.512572ms
├─ Completed: 1.379373196s
├─ Workers:   0=24 1=33 2=21 3=22
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.078589ms
├─ Worst:     9.304294ms
├─ Completed: 36.996787ms
├─ Workers:   0=25 1=26 2=24 3=25
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.051262ms
├─ Worst:     10.103097ms
├─ Completed: 36.178808ms
├─ Workers:   0=26 1=25 2=24 3=25
└─ Errors:    0
```
#### posts100k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      50.749926ms
├─ Worst:     328.019469ms
├─ Completed: 1.487858769s
├─ Workers:   0=23 1=24 2=22 3=31
└─ Errors:    0
```
#### posts100k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      83.671193ms
├─ Worst:     232.642885ms
├─ Completed: 1.35797789s
├─ Workers:   0=34 1=27 2=31 3=8
└─ Errors:    0
```
#### posts100k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.024696ms
├─ Worst:     10.628272ms
├─ Completed: 38.752324ms
├─ Workers:   0=27 1=35 2=9 3=29
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      180.809922ms
├─ Worst:     1.671036373s
├─ Completed: 8.357601025s
├─ Workers:   0=18 1=35 2=19 3=28
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.344007ms
├─ Worst:     11.598343ms
├─ Completed: 58.999313ms
├─ Workers:   0=9 1=28 2=55 3=8
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      119.026225ms
├─ Worst:     474.489595ms
├─ Completed: 3.089200177s
├─ Workers:   0=24 1=26 2=25 3=25
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.029623ms
├─ Worst:     13.374845ms
├─ Completed: 42.573762ms
├─ Workers:   0=26 1=25 2=24 3=25
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      184.372414ms
├─ Worst:     506.472126ms
├─ Completed: 3.436164295s
├─ Workers:   0=26 1=25 2=24 3=25
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.051252ms
├─ Worst:     12.651818ms
├─ Completed: 41.024953ms
├─ Workers:   0=25 1=26 2=24 3=25
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      567.815536ms
├─ Worst:     2.755438211s
├─ Completed: 17.309600392s
├─ Workers:   0=24 1=26 2=25 3=25
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.712676ms
├─ Worst:     16.087263ms
├─ Completed: 81.636493ms
├─ Workers:   0=24 1=33 2=21 3=22
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      1.686487894s
├─ Worst:     8.157846055s
├─ Completed: 51.881115601s
├─ Workers:   0=25 1=26 2=24 3=25
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.006943ms
├─ Worst:     10.433453ms
├─ Completed: 62.052299ms
├─ Workers:   0=26 1=25 2=24 3=25
└─ Errors:    0
```

## Go vs JS route execution
#### JS route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      54.982274ms
├─ Worst:     2.079670704s
├─ Completed: 2.080505996s
├─ Workers:   0=111 1=149 2=136 3=104
└─ Errors:    0
```
#### Go route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      39.212979ms
├─ Worst:     1.953814743s
├─ Completed: 1.954895746s
├─ Workers:   0=125 1=128 2=122 3=125
└─ Errors:    0
```
#### JS route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      15.142959ms
├─ Worst:     370.850796ms
├─ Completed: 2.03795245s
├─ Workers:   0=124 1=134 2=119 3=123
└─ Errors:    0
```
#### Go route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      14.9921ms
├─ Worst:     546.746311ms
├─ Completed: 2.118776011s
├─ Workers:   0=113 1=149 2=136 3=102
└─ Errors:    0
```
#### JS route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      10.525831ms
├─ Worst:     45.851099ms
├─ Completed: 10.462807714s
├─ Workers:   0=124 1=128 2=123 3=125
└─ Errors:    0
```
#### Go route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      9.898804ms
├─ Worst:     26.368234ms
├─ Completed: 9.050798388s
├─ Workers:   0=124 1=133 2=119 3=124
└─ Errors:    0
```

## Go vs JS hooks execution
#### JS OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      1.030914ms
├─ Worst:     16.908688ms
├─ Completed: 46.985737ms
├─ Workers:   0=24 1=28 2=34 3=14
└─ Errors:    0
```
#### Go OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      830.668µs
├─ Worst:     17.386868ms
├─ Completed: 34.084194ms
├─ Workers:   0=24 1=25 2=26 3=25
└─ Errors:    0
```

## Deleting records
#### deleting 100 posts10k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      735.476µs
├─ Worst:     11.590361ms
├─ Completed: 44.07751ms
├─ Workers:   0=15 1=47 2=25 3=13
└─ Errors:    0
```
#### deleting 100 posts10k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      762.924µs
├─ Worst:     13.683613ms
├─ Completed: 40.34268ms
├─ Workers:   0=25 1=26 2=25 3=24
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      764.195µs
├─ Worst:     9.260773ms
├─ Completed: 35.858615ms
├─ Workers:   0=26 1=25 2=25 3=24
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      789.5µs
├─ Worst:     10.911123ms
├─ Completed: 38.04047ms
├─ Workers:   0=23 1=27 2=22 3=28
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      786.287µs
├─ Worst:     14.307635ms
├─ Completed: 42.295897ms
├─ Workers:   0=25 1=25 2=26 3=24
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      794.378µs
├─ Worst:     21.926399ms
├─ Completed: 49.422243ms
├─ Workers:   0=25 1=25 2=25 3=25
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      796.45µs
├─ Worst:     13.384659ms
├─ Completed: 38.524189ms
├─ Workers:   0=26 1=25 2=25 3=24
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      796.059µs
├─ Worst:     12.340858ms
├─ Completed: 36.736889ms
├─ Workers:   0=25 1=26 2=25 3=24
└─ Errors:    0
```
#### deleting 100 users - with cascade deleting all associated posts [conc:10, rule:`""`]
```
┌─ Best:      68.186615ms
├─ Worst:     2.733031368s
├─ Completed: 8.405850893s
├─ Workers:   0=23 1=33 2=18 3=26
└─ Errors:    0
```
#### deleting 100 organizations - with cascade deleting all users and associated posts [conc:10, rule:`""`]
```
┌─ Best:      77.483548ms
├─ Worst:     5.886798734s
├─ Completed: 18.809549538s
├─ Workers:   0=25 1=24 2=26 3=25
└─ Errors:    0
```

---------------------------------------------------
Completed!
