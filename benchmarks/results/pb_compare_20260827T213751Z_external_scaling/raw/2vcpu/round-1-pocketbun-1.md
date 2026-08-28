# PocketBun Upstream-Port Benchmark Result

- machine: hetzner-2vcpu-pocketbun-1
- timestamp: 2026-08-27T15:24:42.220Z
- tests: create,auth,search,custom,delete
- benchmark source: 05625dc2b2d3f9711c51566010944b10ca9531fa
- server workers: 1
- load generator: http://load-generator:19231
- benchmark target host: application-host
- warmup request target/cap: 1000
## Creating organizations (100)
#### Creating 50 organizations [reqs:50, conc:10, rule:`""`]
```
┌─ Best:      2.130803ms
├─ Worst:     8.565482ms
├─ Completed: 29.031745ms
├─ Workers:   0=50
└─ Errors:    0
```
#### Creating 50 organizations [reqs:50, conc:10, rule:`"@request.body.name != ''"`]
```
┌─ Best:      2.260893ms
├─ Worst:     11.059478ms
├─ Completed: 20.430814ms
├─ Workers:   0=50
└─ Errors:    0
```

## Creating permissions (50)
#### Creating 25 permissions [reqs:25, conc:5, rule:`""`]
```
┌─ Best:      1.866459ms
├─ Worst:     3.835108ms
├─ Completed: 12.674178ms
├─ Workers:   0=25
└─ Errors:    0
```
#### Creating 25 permissions [reqs:25, conc:5, rule:`"@request.body.name != ''"`]
```
┌─ Best:      1.856134ms
├─ Worst:     4.037308ms
├─ Completed: 14.658951ms
├─ Workers:   0=25
└─ Errors:    0
```

## Creating users (500 - expected to be slow due to passwordHash generation)
#### Creating 250 users [reqs:250, conc:50, rule:`""`]
```
┌─ Best:      94.900447ms
├─ Worst:     3.546184345s
├─ Completed: 8.060482719s
├─ Workers:   0=250
└─ Errors:    0
```
#### Creating 250 users [reqs:250, conc:50, rule:`"@request.body.email != '' && @request.body.permissions:length > 0"`]
```
┌─ Best:      95.336829ms
├─ Worst:     4.353927711s
├─ Completed: 8.072069461s
├─ Workers:   0=250
└─ Errors:    0
```

## Creating posts (10k, 25k, 50k, 100k)
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`""`]
```
┌─ Best:      11.466671ms
├─ Worst:     145.487698ms
├─ Completed: 1.071744667s
├─ Workers:   0=5000
└─ Errors:    0
```
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      16.146555ms
├─ Worst:     185.486252ms
├─ Completed: 1.55637658s
├─ Workers:   0=5000
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`""`]
```
┌─ Best:      13.365643ms
├─ Worst:     106.040695ms
├─ Completed: 2.392203547s
├─ Workers:   0=12500
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      18.700804ms
├─ Worst:     163.268891ms
├─ Completed: 3.455134889s
├─ Workers:   0=12500
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`""`]
```
┌─ Best:      17.190697ms
├─ Worst:     111.018411ms
├─ Completed: 4.745460104s
├─ Workers:   0=25000
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      15.286016ms
├─ Worst:     173.487046ms
├─ Completed: 7.398882741s
├─ Workers:   0=25000
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`""`]
```
┌─ Best:      13.949379ms
├─ Worst:     136.605709ms
├─ Completed: 10.513406808s
├─ Workers:   0=50000
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      17.47599ms
├─ Worst:     200.495857ms
├─ Completed: 14.34539937s
├─ Workers:   0=50000
└─ Errors:    0
```

## User auth with password (expected to be slow due to passwordHash verification)
#### users auth with email/pass - high concurrency [reqs:250, conc:250]
```
┌─ Best:      106.641845ms
├─ Worst:     7.993310255s
├─ Completed: 7.993518834s
├─ Workers:   0=250
└─ Errors:    0
```
#### users auth with email/pass - small concurrency [reqs:250, conc:10]
```
┌─ Best:      68.621044ms
├─ Worst:     775.830709ms
├─ Completed: 8.030982267s
├─ Workers:   0=250
└─ Errors:    0
```

## User auth refresh
#### users - auth refresh (high concurrency) [reqs:1000, conc:1000]
```
┌─ Best:      28.451634ms
├─ Worst:     179.203243ms
├─ Completed: 181.434926ms
├─ Workers:   0=1000
└─ Errors:    0
```
#### users - auth refresh (medium concurrency) [reqs:1000, conc:100]
```
┌─ Best:      4.563615ms
├─ Worst:     38.709593ms
├─ Completed: 183.736524ms
├─ Workers:   0=1000
└─ Errors:    0
```

## List records
#### users - getOne for auth refresh comparison (medium concurrency) [reqs:1000, conc:100, rule:`""`, query:`/zzfjunkgfrifr56`]
```
┌─ Best:      3.616847ms
├─ Worst:     37.453759ms
├─ Completed: 168.870489ms
├─ Workers:   0=1000
└─ Errors:    0
```
#### users - getOne for auth refresh comparison (high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`/zzfjunkgfrifr56`]
```
┌─ Best:      51.324311ms
├─ Worst:     168.076462ms
├─ Completed: 170.231419ms
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts10k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      631.282µs
├─ Worst:     4.108546ms
├─ Completed: 805.362374ms
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts10k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      41.518695ms
├─ Worst:     574.386562ms
├─ Completed: 576.08671ms
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts10k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      26.767507ms
├─ Worst:     310.071855ms
├─ Completed: 313.002264ms
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts10k - mixed read and write (simpleA list with additional 300 concurrent random posts10k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      59.513993ms
├─ Worst:     653.125293ms
├─ Completed: 654.831109ms
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts10k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      2.987226ms
├─ Worst:     23.856304ms
├─ Completed: 119.080679ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      4.739427ms
├─ Worst:     26.024411ms
├─ Completed: 133.458532ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      4.569503ms
├─ Worst:     27.872363ms
├─ Completed: 158.117575ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      5.354747ms
├─ Worst:     39.169618ms
├─ Completed: 172.799637ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      3.102197ms
├─ Worst:     15.355401ms
├─ Completed: 85.906872ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      13.584536ms
├─ Worst:     51.343647ms
├─ Completed: 188.360193ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.472485ms
├─ Worst:     8.06391ms
├─ Completed: 54.569473ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.84518ms
├─ Worst:     8.248865ms
├─ Completed: 61.872092ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      5.45098ms
├─ Worst:     49.719544ms
├─ Completed: 173.181695ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.254845ms
├─ Worst:     7.815637ms
├─ Completed: 53.955605ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.253643ms
├─ Worst:     8.357345ms
├─ Completed: 56.140753ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      15.420462ms
├─ Worst:     53.635753ms
├─ Completed: 196.173756ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      12.453693ms
├─ Worst:     50.561597ms
├─ Completed: 182.323632ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      3.094696ms
├─ Worst:     11.007506ms
├─ Completed: 63.638921ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      33.594829ms
├─ Worst:     150.060515ms
├─ Completed: 1.344789621s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.585983ms
├─ Worst:     11.174687ms
├─ Completed: 68.471758ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      32.093484ms
├─ Worst:     89.639299ms
├─ Completed: 557.297445ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.181975ms
├─ Worst:     9.381639ms
├─ Completed: 62.155331ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      35.466795ms
├─ Worst:     105.000549ms
├─ Completed: 693.414107ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.347902ms
├─ Worst:     13.250954ms
├─ Completed: 67.181305ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      71.806233ms
├─ Worst:     398.828996ms
├─ Completed: 3.629679767s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      5.044238ms
├─ Worst:     27.761611ms
├─ Completed: 127.807474ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      149.026987ms
├─ Worst:     1.162750583s
├─ Completed: 11.314525881s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.983461ms
├─ Worst:     15.921875ms
├─ Completed: 88.153207ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.008163ms
├─ Worst:     7.21746ms
├─ Completed: 1.194594241s
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts25k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      23.86698ms
├─ Worst:     937.149806ms
├─ Completed: 939.223932ms
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts25k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      23.380188ms
├─ Worst:     305.020868ms
├─ Completed: 306.874128ms
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts25k - mixed read and write (simpleA list with additional 300 concurrent random posts25k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      52.629453ms
├─ Worst:     1.003656558s
├─ Completed: 1.005467681s
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts25k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      5.935859ms
├─ Worst:     31.449655ms
├─ Completed: 146.969104ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      6.234974ms
├─ Worst:     34.947587ms
├─ Completed: 164.156788ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      6.211201ms
├─ Worst:     36.215458ms
├─ Completed: 169.39203ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      7.912229ms
├─ Worst:     44.345201ms
├─ Completed: 203.023269ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      4.770019ms
├─ Worst:     24.277488ms
├─ Completed: 120.552062ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      22.685418ms
├─ Worst:     77.020177ms
├─ Completed: 292.298814ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.643781ms
├─ Worst:     10.419655ms
├─ Completed: 67.636013ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.88064ms
├─ Worst:     9.854093ms
├─ Completed: 63.48575ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      19.749512ms
├─ Worst:     74.605802ms
├─ Completed: 290.446946ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.341274ms
├─ Worst:     11.734629ms
├─ Completed: 62.480161ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.232965ms
├─ Worst:     9.117716ms
├─ Completed: 61.476294ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      39.374772ms
├─ Worst:     103.441225ms
├─ Completed: 500.840265ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      30.357796ms
├─ Worst:     78.422463ms
├─ Completed: 394.747968ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.798854ms
├─ Worst:     9.961661ms
├─ Completed: 68.982672ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      81.254447ms
├─ Worst:     411.764665ms
├─ Completed: 3.695917427s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.610125ms
├─ Worst:     11.576382ms
├─ Completed: 70.28359ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      64.008342ms
├─ Worst:     185.54281ms
├─ Completed: 1.373039415s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      3.023417ms
├─ Worst:     11.386059ms
├─ Completed: 66.682376ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      64.153763ms
├─ Worst:     217.269658ms
├─ Completed: 1.692114639s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.464455ms
├─ Worst:     9.872428ms
├─ Completed: 63.860848ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      142.264967ms
├─ Worst:     995.038684ms
├─ Completed: 9.558015215s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      4.47334ms
├─ Worst:     22.345758ms
├─ Completed: 109.712739ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      329.672742ms
├─ Worst:     2.839472159s
├─ Completed: 28.041501947s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      3.379227ms
├─ Worst:     18.268917ms
├─ Completed: 96.739557ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.888959ms
├─ Worst:     9.619139ms
├─ Completed: 2.110514091s
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts50k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      27.547205ms
├─ Worst:     1.800244451s
├─ Completed: 1.801940043s
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts50k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      26.44469ms
├─ Worst:     347.986892ms
├─ Completed: 349.804683ms
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts50k - mixed read and write (simpleA list with additional 300 concurrent random posts50k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      108.81719ms
├─ Worst:     1.876519246s
├─ Completed: 1.878353901s
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts50k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      9.711335ms
├─ Worst:     51.006181ms
├─ Completed: 239.066448ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      10.231845ms
├─ Worst:     53.940414ms
├─ Completed: 256.598198ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      10.231994ms
├─ Worst:     61.971008ms
├─ Completed: 298.141716ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      10.913948ms
├─ Worst:     58.327594ms
├─ Completed: 296.528687ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      8.460939ms
├─ Worst:     45.482981ms
├─ Completed: 203.248769ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      65.955171ms
├─ Worst:     200.473495ms
├─ Completed: 1.551254534s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.444688ms
├─ Worst:     9.763007ms
├─ Completed: 63.336843ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.217814ms
├─ Worst:     8.688212ms
├─ Completed: 60.283857ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      65.684368ms
├─ Worst:     198.194097ms
├─ Completed: 1.534672988s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.322589ms
├─ Worst:     8.963462ms
├─ Completed: 68.421047ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.515946ms
├─ Worst:     9.446148ms
├─ Completed: 60.855246ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      66.863936ms
├─ Worst:     214.98352ms
├─ Completed: 1.693239342s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      54.514528ms
├─ Worst:     152.472757ms
├─ Completed: 1.063232037s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.980415ms
├─ Worst:     7.635186ms
├─ Completed: 38.516637ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      134.930594ms
├─ Worst:     901.506869ms
├─ Completed: 8.457764653s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.65631ms
├─ Worst:     11.150163ms
├─ Completed: 68.788845ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      88.805896ms
├─ Worst:     428.821366ms
├─ Completed: 3.783831313s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.546706ms
├─ Worst:     9.793839ms
├─ Completed: 64.271465ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      97.597772ms
├─ Worst:     517.012114ms
├─ Completed: 4.588093467s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.735148ms
├─ Worst:     10.719147ms
├─ Completed: 67.748729ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      252.93012ms
├─ Worst:     2.034527681s
├─ Completed: 19.794237281s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      5.512345ms
├─ Worst:     24.969352ms
├─ Completed: 119.653439ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      620.260242ms
├─ Worst:     5.735291692s
├─ Completed: 56.92222645s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      3.588387ms
├─ Worst:     19.34995ms
├─ Completed: 96.610258ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      3.191448ms
├─ Worst:     60.410312ms
├─ Completed: 3.592309693s
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts100k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      28.895978ms
├─ Worst:     3.135138953s
├─ Completed: 3.138083703s
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts100k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      36.05732ms
├─ Worst:     335.323178ms
├─ Completed: 336.802782ms
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts100k - mixed read and write (simpleA list with additional 300 concurrent random posts100k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      118.780746ms
├─ Worst:     3.199225573s
├─ Completed: 3.201146407s
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts100k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      16.841945ms
├─ Worst:     64.947319ms
├─ Completed: 370.75204ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      12.014999ms
├─ Worst:     54.760076ms
├─ Completed: 377.043591ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      17.432351ms
├─ Worst:     67.644295ms
├─ Completed: 395.410551ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      17.67109ms
├─ Worst:     73.937278ms
├─ Completed: 440.310027ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      15.030624ms
├─ Worst:     63.113315ms
├─ Completed: 346.236025ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      80.474038ms
├─ Worst:     343.133388ms
├─ Completed: 3.027818803s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.472016ms
├─ Worst:     9.564252ms
├─ Completed: 61.971548ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.163408ms
├─ Worst:     10.719998ms
├─ Completed: 63.65892ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      79.70819ms
├─ Worst:     338.261057ms
├─ Completed: 3.052779332s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.659384ms
├─ Worst:     10.297315ms
├─ Completed: 64.99948ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.817583ms
├─ Worst:     10.162649ms
├─ Completed: 71.452686ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      82.427536ms
├─ Worst:     378.149218ms
├─ Completed: 3.362633427s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      76.104391ms
├─ Worst:     321.022202ms
├─ Completed: 2.824142172s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.036203ms
├─ Worst:     10.747147ms
├─ Completed: 60.704518ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      224.788956ms
├─ Worst:     1.7990063s
├─ Completed: 17.465077318s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.68538ms
├─ Worst:     11.236492ms
├─ Completed: 69.804379ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      124.278138ms
├─ Worst:     798.890474ms
├─ Completed: 7.525286536s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.246573ms
├─ Worst:     9.494106ms
├─ Completed: 64.91127ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      143.050091ms
├─ Worst:     978.95115ms
├─ Completed: 9.396350237s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.718456ms
├─ Worst:     10.994929ms
├─ Completed: 65.592079ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      432.231808ms
├─ Worst:     4.104175495s
├─ Completed: 40.647171702s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      5.716557ms
├─ Worst:     27.643847ms
├─ Completed: 128.326461ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      1.205366452s
├─ Worst:     11.467050739s
├─ Completed: 113.739003372s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      3.616656ms
├─ Worst:     18.530819ms
├─ Completed: 97.38537ms
├─ Workers:   0=100
└─ Errors:    0
```

## Go vs JS route execution
#### JS route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      68.067078ms
├─ Worst:     5.423774067s
├─ Completed: 5.424811139s
├─ Workers:   0=500
└─ Errors:    0
```
#### Go route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      40.697019ms
├─ Worst:     5.192955946s
├─ Completed: 5.193968846s
├─ Workers:   0=500
└─ Errors:    0
```
#### JS route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      30.079042ms
├─ Worst:     554.111805ms
├─ Completed: 5.280161295s
├─ Workers:   0=500
└─ Errors:    0
```
#### Go route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      30.166423ms
├─ Worst:     545.278392ms
├─ Completed: 5.191060688s
├─ Workers:   0=500
└─ Errors:    0
```
#### JS route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      10.214309ms
├─ Worst:     29.36864ms
├─ Completed: 5.536011574s
├─ Workers:   0=500
└─ Errors:    0
```
#### Go route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      10.170129ms
├─ Worst:     33.35002ms
├─ Completed: 5.425129317s
├─ Workers:   0=500
└─ Errors:    0
```

## Go vs JS hooks execution
#### JS OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      2.894769ms
├─ Worst:     19.551099ms
├─ Completed: 64.757606ms
├─ Workers:   0=100
└─ Errors:    0
```
#### Go OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      637.722µs
├─ Worst:     36.808708ms
├─ Completed: 94.318082ms
├─ Workers:   0=100
└─ Errors:    0
```

## Deleting records
#### deleting 100 posts10k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      1.943745ms
├─ Worst:     7.027148ms
├─ Completed: 28.668894ms
├─ Workers:   0=100
└─ Errors:    0
```
#### deleting 100 posts10k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      1.750728ms
├─ Worst:     6.919589ms
├─ Completed: 53.008966ms
├─ Workers:   0=100
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      1.779839ms
├─ Worst:     6.851995ms
├─ Completed: 51.09334ms
├─ Workers:   0=100
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      2.021373ms
├─ Worst:     9.259501ms
├─ Completed: 53.467591ms
├─ Workers:   0=100
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      1.453698ms
├─ Worst:     6.562065ms
├─ Completed: 50.602072ms
├─ Workers:   0=100
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      1.611456ms
├─ Worst:     6.950492ms
├─ Completed: 51.2447ms
├─ Workers:   0=100
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      1.517346ms
├─ Worst:     6.714356ms
├─ Completed: 51.27319ms
├─ Workers:   0=100
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      1.865256ms
├─ Worst:     7.187299ms
├─ Completed: 52.283484ms
├─ Workers:   0=100
└─ Errors:    0
```
#### deleting 100 users - with cascade deleting all associated posts [conc:10, rule:`""`]
```
┌─ Best:      118.172265ms
├─ Worst:     734.013924ms
├─ Completed: 6.725914267s
├─ Workers:   0=100
└─ Errors:    0
```
#### deleting 100 organizations - with cascade deleting all users and associated posts [conc:10, rule:`""`]
```
┌─ Best:      333.643858ms
├─ Worst:     2.962958142s
├─ Completed: 16.316925069s
├─ Workers:   0=100
└─ Errors:    0
```

---------------------------------------------------
Completed!
