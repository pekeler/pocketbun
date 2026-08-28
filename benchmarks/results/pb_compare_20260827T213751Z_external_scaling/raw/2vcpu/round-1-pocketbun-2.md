# PocketBun Upstream-Port Benchmark Result

- machine: hetzner-2vcpu-pocketbun-2
- timestamp: 2026-08-27T13:28:11.960Z
- tests: create,auth,search,custom,delete
- benchmark source: 05625dc2b2d3f9711c51566010944b10ca9531fa
- server workers: 2
- load generator: http://load-generator:19231
- benchmark target host: application-host
- warmup request target/cap: 1000
## Creating organizations (100)
#### Creating 50 organizations [reqs:50, conc:10, rule:`""`]
```
┌─ Best:      394.866µs
├─ Worst:     12.21301ms
├─ Completed: 19.341927ms
├─ Workers:   0=26 1=24
└─ Errors:    0
```
#### Creating 50 organizations [reqs:50, conc:10, rule:`"@request.body.name != ''"`]
```
┌─ Best:      1.692448ms
├─ Worst:     9.334233ms
├─ Completed: 29.382377ms
├─ Workers:   0=15 1=35
└─ Errors:    0
```

## Creating permissions (50)
#### Creating 25 permissions [reqs:25, conc:5, rule:`""`]
```
┌─ Best:      2.046988ms
├─ Worst:     4.086485ms
├─ Completed: 13.828341ms
├─ Workers:   1=25
└─ Errors:    0
```
#### Creating 25 permissions [reqs:25, conc:5, rule:`"@request.body.name != ''"`]
```
┌─ Best:      1.796281ms
├─ Worst:     3.914507ms
├─ Completed: 16.201309ms
├─ Workers:   0=1 1=24
└─ Errors:    0
```

## Creating users (500 - expected to be slow due to passwordHash generation)
#### Creating 250 users [reqs:250, conc:50, rule:`""`]
```
┌─ Best:      99.777144ms
├─ Worst:     4.561164972s
├─ Completed: 8.185988216s
├─ Workers:   0=103 1=147
└─ Errors:    0
```
#### Creating 250 users [reqs:250, conc:50, rule:`"@request.body.email != '' && @request.body.permissions:length > 0"`]
```
┌─ Best:      142.408362ms
├─ Worst:     4.360316104s
├─ Completed: 8.173015627s
├─ Workers:   0=132 1=118
└─ Errors:    0
```

## Creating posts (10k, 25k, 50k, 100k)
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`""`]
```
┌─ Best:      6.480832ms
├─ Worst:     455.897099ms
├─ Completed: 935.308119ms
├─ Workers:   0=2765 1=2235
└─ Errors:    0
```
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      13.299882ms
├─ Worst:     595.635483ms
├─ Completed: 1.271295013s
├─ Workers:   0=2517 1=2483
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`""`]
```
┌─ Best:      1.320985ms
├─ Worst:     571.829528ms
├─ Completed: 2.379844554s
├─ Workers:   0=5275 1=7225
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      16.355201ms
├─ Worst:     520.478997ms
├─ Completed: 2.859691484s
├─ Workers:   0=6308 1=6192
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`""`]
```
┌─ Best:      1.315979ms
├─ Worst:     497.879549ms
├─ Completed: 3.755999181s
├─ Workers:   0=14186 1=10814
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      9.001744ms
├─ Worst:     583.279264ms
├─ Completed: 5.404070252s
├─ Workers:   0=13577 1=11423
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`""`]
```
┌─ Best:      16.677227ms
├─ Worst:     688.726961ms
├─ Completed: 7.480390201s
├─ Workers:   0=20931 1=29069
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      9.871156ms
├─ Worst:     636.36288ms
├─ Completed: 10.593120802s
├─ Workers:   0=25953 1=24047
└─ Errors:    0
```

## User auth with password (expected to be slow due to passwordHash verification)
#### users auth with email/pass - high concurrency [reqs:250, conc:250]
```
┌─ Best:      157.966032ms
├─ Worst:     8.077992639s
├─ Completed: 8.07809405s
├─ Workers:   0=108 1=142
└─ Errors:    0
```
#### users auth with email/pass - small concurrency [reqs:250, conc:10]
```
┌─ Best:      64.585443ms
├─ Worst:     987.059564ms
├─ Completed: 8.091845604s
├─ Workers:   0=113 1=137
└─ Errors:    0
```

## User auth refresh
#### users - auth refresh (high concurrency) [reqs:1000, conc:1000]
```
┌─ Best:      28.649084ms
├─ Worst:     130.746422ms
├─ Completed: 132.508767ms
├─ Workers:   0=513 1=487
└─ Errors:    0
```
#### users - auth refresh (medium concurrency) [reqs:1000, conc:100]
```
┌─ Best:      565.33µs
├─ Worst:     38.884143ms
├─ Completed: 124.583248ms
├─ Workers:   0=512 1=488
└─ Errors:    0
```

## List records
#### users - getOne for auth refresh comparison (medium concurrency) [reqs:1000, conc:100, rule:`""`, query:`/pqfrntorgf8n1j8`]
```
┌─ Best:      313.203µs
├─ Worst:     37.584415ms
├─ Completed: 131.149229ms
├─ Workers:   0=501 1=499
└─ Errors:    0
```
#### users - getOne for auth refresh comparison (high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`/pqfrntorgf8n1j8`]
```
┌─ Best:      23.38341ms
├─ Worst:     115.022132ms
├─ Completed: 116.603066ms
├─ Workers:   0=439 1=561
└─ Errors:    0
```
#### posts10k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      669.946µs
├─ Worst:     3.384585ms
├─ Completed: 844.354333ms
├─ Workers:   0=520 1=480
└─ Errors:    0
```
#### posts10k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      25.122983ms
├─ Worst:     460.232999ms
├─ Completed: 462.017664ms
├─ Workers:   0=490 1=510
└─ Errors:    0
```
#### posts10k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      26.334206ms
├─ Worst:     262.367473ms
├─ Completed: 264.386453ms
├─ Workers:   0=469 1=531
└─ Errors:    0
```
#### posts10k - mixed read and write (simpleA list with additional 300 concurrent random posts10k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      79.059156ms
├─ Worst:     509.334333ms
├─ Completed: 510.900367ms
├─ Workers:   0=469 1=531
└─ Errors:    0
```
#### posts10k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.393895ms
├─ Worst:     27.310435ms
├─ Completed: 103.377197ms
├─ Workers:   0=66 1=34
└─ Errors:    0
```
#### posts10k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      3.27186ms
├─ Worst:     26.821679ms
├─ Completed: 120.082962ms
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts10k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      3.210926ms
├─ Worst:     32.14389ms
├─ Completed: 125.994809ms
├─ Workers:   0=44 1=56
└─ Errors:    0
```
#### posts10k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      7.81863ms
├─ Worst:     32.058724ms
├─ Completed: 152.837398ms
├─ Workers:   0=52 1=48
└─ Errors:    0
```
#### posts10k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      3.59737ms
├─ Worst:     16.173982ms
├─ Completed: 73.406888ms
├─ Workers:   0=53 1=47
└─ Errors:    0
```
#### posts10k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.301359ms
├─ Worst:     51.591304ms
├─ Completed: 151.503915ms
├─ Workers:   0=53 1=47
└─ Errors:    0
```
#### posts10k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      908.235µs
├─ Worst:     10.401256ms
├─ Completed: 54.507683ms
├─ Workers:   0=53 1=47
└─ Errors:    0
```
#### posts10k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      881.588µs
├─ Worst:     10.280722ms
├─ Completed: 52.624992ms
├─ Workers:   0=53 1=47
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      3.442605ms
├─ Worst:     48.484082ms
├─ Completed: 147.910932ms
├─ Workers:   0=52 1=48
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.885695ms
├─ Worst:     8.936504ms
├─ Completed: 48.512521ms
├─ Workers:   0=54 1=46
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      869.22µs
├─ Worst:     10.566396ms
├─ Completed: 53.760771ms
├─ Workers:   0=52 1=48
└─ Errors:    0
```
#### posts10k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      3.814209ms
├─ Worst:     51.937833ms
├─ Completed: 165.062213ms
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts10k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      14.379403ms
├─ Worst:     49.207631ms
├─ Completed: 181.844385ms
├─ Workers:   1=100
└─ Errors:    0
```
#### posts10k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      842.624µs
├─ Worst:     12.704268ms
├─ Completed: 59.015219ms
├─ Workers:   0=66 1=34
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      19.586806ms
├─ Worst:     189.256864ms
├─ Completed: 1.088731845s
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.447789ms
├─ Worst:     18.741929ms
├─ Completed: 60.249714ms
├─ Workers:   0=44 1=56
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      15.365084ms
├─ Worst:     84.069696ms
├─ Completed: 479.522804ms
├─ Workers:   0=52 1=48
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.247814ms
├─ Worst:     10.335497ms
├─ Completed: 54.907906ms
├─ Workers:   0=53 1=47
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      29.976107ms
├─ Worst:     91.474546ms
├─ Completed: 562.584419ms
├─ Workers:   0=53 1=47
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      993.302µs
├─ Worst:     14.182971ms
├─ Completed: 56.705169ms
├─ Workers:   0=53 1=47
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      98.262453ms
├─ Worst:     493.098336ms
├─ Completed: 3.193761701s
├─ Workers:   0=53 1=47
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.516036ms
├─ Worst:     29.948699ms
├─ Completed: 112.54484ms
├─ Workers:   0=52 1=48
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      195.324875ms
├─ Worst:     1.821496046s
├─ Completed: 10.072490094s
├─ Workers:   0=54 1=46
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.294368ms
├─ Worst:     14.901724ms
├─ Completed: 81.311988ms
├─ Workers:   0=52 1=48
└─ Errors:    0
```
#### posts25k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.013549ms
├─ Worst:     6.806292ms
├─ Completed: 1.205916785s
├─ Workers:   0=476 1=524
└─ Errors:    0
```
#### posts25k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      24.486803ms
├─ Worst:     758.945284ms
├─ Completed: 761.804185ms
├─ Workers:   0=475 1=525
└─ Errors:    0
```
#### posts25k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      25.771248ms
├─ Worst:     302.661442ms
├─ Completed: 304.222459ms
├─ Workers:   0=529 1=471
└─ Errors:    0
```
#### posts25k - mixed read and write (simpleA list with additional 300 concurrent random posts25k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      52.056497ms
├─ Worst:     790.001023ms
├─ Completed: 791.549532ms
├─ Workers:   0=529 1=471
└─ Errors:    0
```
#### posts25k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.942754ms
├─ Worst:     35.19864ms
├─ Completed: 136.573141ms
├─ Workers:   0=34 1=66
└─ Errors:    0
```
#### posts25k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      2.306035ms
├─ Worst:     45.545573ms
├─ Completed: 156.240959ms
├─ Workers:   0=39 1=61
└─ Errors:    0
```
#### posts25k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      2.357567ms
├─ Worst:     35.120873ms
├─ Completed: 160.936094ms
├─ Workers:   0=35 1=65
└─ Errors:    0
```
#### posts25k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      2.821386ms
├─ Worst:     48.950526ms
├─ Completed: 192.524409ms
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts25k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.614671ms
├─ Worst:     14.906811ms
├─ Completed: 80.260556ms
├─ Workers:   0=47 1=53
└─ Errors:    0
```
#### posts25k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      11.182696ms
├─ Worst:     74.511324ms
├─ Completed: 260.849517ms
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts25k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      972.234µs
├─ Worst:     11.344601ms
├─ Completed: 59.6747ms
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### posts25k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      585.989µs
├─ Worst:     11.719408ms
├─ Completed: 59.081471ms
├─ Workers:   0=47 1=53
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      5.37906ms
├─ Worst:     77.039426ms
├─ Completed: 265.203542ms
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      639.964µs
├─ Worst:     11.865109ms
├─ Completed: 55.843448ms
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      620.887µs
├─ Worst:     9.793537ms
├─ Completed: 55.079952ms
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts25k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      8.617863ms
├─ Worst:     108.543453ms
├─ Completed: 506.468446ms
├─ Workers:   0=46 1=54
└─ Errors:    0
```
#### posts25k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      32.027009ms
├─ Worst:     83.28265ms
├─ Completed: 387.706887ms
├─ Workers:   0=97 1=3
└─ Errors:    0
```
#### posts25k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      656.747µs
├─ Worst:     13.670332ms
├─ Completed: 61.229547ms
├─ Workers:   0=34 1=66
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      56.970695ms
├─ Worst:     531.012507ms
├─ Completed: 3.096819829s
├─ Workers:   0=39 1=61
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.356004ms
├─ Worst:     15.448793ms
├─ Completed: 65.445378ms
├─ Workers:   0=35 1=65
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      72.873751ms
├─ Worst:     177.065271ms
├─ Completed: 1.299260728s
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      816.799µs
├─ Worst:     11.067351ms
├─ Completed: 57.997007ms
├─ Workers:   0=47 1=53
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      74.85536ms
├─ Worst:     186.697039ms
├─ Completed: 1.431916233s
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      859.808µs
├─ Worst:     12.371823ms
├─ Completed: 59.669438ms
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      205.200823ms
├─ Worst:     1.163389378s
├─ Completed: 8.056061821s
├─ Workers:   0=47 1=53
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      6.653472ms
├─ Worst:     24.161971ms
├─ Completed: 113.631452ms
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      540.996426ms
├─ Worst:     3.717170887s
├─ Completed: 24.143624825s
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.166842ms
├─ Worst:     17.337253ms
├─ Completed: 82.639544ms
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts50k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.870985ms
├─ Worst:     9.524639ms
├─ Completed: 2.106628508s
├─ Workers:   0=490 1=510
└─ Errors:    0
```
#### posts50k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      24.055485ms
├─ Worst:     1.357757678s
├─ Completed: 1.36059587s
├─ Workers:   0=490 1=510
└─ Errors:    0
```
#### posts50k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      27.698738ms
├─ Worst:     252.336146ms
├─ Completed: 254.072364ms
├─ Workers:   0=507 1=493
└─ Errors:    0
```
#### posts50k - mixed read and write (simpleA list with additional 300 concurrent random posts50k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      78.204666ms
├─ Worst:     1.392759547s
├─ Completed: 1.394386957s
├─ Workers:   0=507 1=493
└─ Errors:    0
```
#### posts50k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      3.054099ms
├─ Worst:     48.67606ms
├─ Completed: 205.127572ms
├─ Workers:   0=31 1=69
└─ Errors:    0
```
#### posts50k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      3.366552ms
├─ Worst:     50.527758ms
├─ Completed: 223.649523ms
├─ Workers:   0=42 1=58
└─ Errors:    0
```
#### posts50k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      3.569873ms
├─ Worst:     49.014668ms
├─ Completed: 225.330715ms
├─ Workers:   0=56 1=44
└─ Errors:    0
```
#### posts50k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      10.434836ms
├─ Worst:     53.624497ms
├─ Completed: 242.687484ms
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### posts50k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      6.168432ms
├─ Worst:     35.925664ms
├─ Completed: 152.027308ms
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts50k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      44.388367ms
├─ Worst:     187.950702ms
├─ Completed: 1.215957476s
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts50k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      839.931µs
├─ Worst:     11.770292ms
├─ Completed: 56.024732ms
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts50k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      669.655µs
├─ Worst:     11.324986ms
├─ Completed: 55.691563ms
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      66.487799ms
├─ Worst:     191.284176ms
├─ Completed: 1.20081805s
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.032387ms
├─ Worst:     11.400571ms
├─ Completed: 61.901391ms
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      666.411µs
├─ Worst:     10.570604ms
├─ Completed: 57.521731ms
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts50k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      77.134117ms
├─ Worst:     186.052417ms
├─ Completed: 1.368627112s
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### posts50k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      35.84311ms
├─ Worst:     109.563411ms
├─ Completed: 866.502091ms
├─ Workers:   0=69 1=31
└─ Errors:    0
```
#### posts50k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      900.796µs
├─ Worst:     11.298699ms
├─ Completed: 55.819038ms
├─ Workers:   0=31 1=69
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      127.283964ms
├─ Worst:     986.131611ms
├─ Completed: 6.869621748s
├─ Workers:   0=42 1=58
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      755.894µs
├─ Worst:     12.919058ms
├─ Completed: 63.762202ms
├─ Workers:   0=56 1=44
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      111.77676ms
├─ Worst:     365.351686ms
├─ Completed: 3.085448498s
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      670.346µs
├─ Worst:     9.319506ms
├─ Completed: 51.843416ms
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      120.035229ms
├─ Worst:     407.821891ms
├─ Completed: 3.4444376s
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.819824ms
├─ Worst:     9.844241ms
├─ Completed: 55.173778ms
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      356.849669ms
├─ Worst:     2.621608441s
├─ Completed: 16.075814476s
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.853101ms
├─ Worst:     26.290081ms
├─ Completed: 110.398335ms
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      849.343403ms
├─ Worst:     9.210000099s
├─ Completed: 46.504807888s
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      4.2274ms
├─ Worst:     15.019762ms
├─ Completed: 79.533563ms
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts100k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      3.248238ms
├─ Worst:     16.044597ms
├─ Completed: 3.605745579s
├─ Workers:   0=489 1=511
└─ Errors:    0
```
#### posts100k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      31.949612ms
├─ Worst:     2.420134089s
├─ Completed: 2.422123398s
├─ Workers:   0=489 1=511
└─ Errors:    0
```
#### posts100k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      29.802795ms
├─ Worst:     262.380423ms
├─ Completed: 264.868149ms
├─ Workers:   0=488 1=512
└─ Errors:    0
```
#### posts100k - mixed read and write (simpleA list with additional 300 concurrent random posts100k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      70.213116ms
├─ Worst:     2.454624235s
├─ Completed: 2.457430082s
├─ Workers:   0=488 1=512
└─ Errors:    0
```
#### posts100k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      5.214244ms
├─ Worst:     78.341575ms
├─ Completed: 333.627275ms
├─ Workers:   0=27 1=73
└─ Errors:    0
```
#### posts100k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      5.501721ms
├─ Worst:     70.989939ms
├─ Completed: 327.581744ms
├─ Workers:   0=41 1=59
└─ Errors:    0
```
#### posts100k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      6.374848ms
├─ Worst:     64.539396ms
├─ Completed: 359.012587ms
├─ Workers:   0=75 1=25
└─ Errors:    0
```
#### posts100k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      5.996964ms
├─ Worst:     64.126286ms
├─ Completed: 354.441242ms
├─ Workers:   0=46 1=54
└─ Errors:    0
```
#### posts100k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      20.980927ms
├─ Worst:     57.174952ms
├─ Completed: 276.16126ms
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### posts100k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      97.828829ms
├─ Worst:     275.43644ms
├─ Completed: 2.32215737s
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### posts100k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      637.311µs
├─ Worst:     12.175331ms
├─ Completed: 56.302106ms
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### posts100k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      652.01µs
├─ Worst:     9.749109ms
├─ Completed: 53.892327ms
├─ Workers:   0=50 1=50
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      99.791401ms
├─ Worst:     278.144893ms
├─ Completed: 2.325526475s
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      649.518µs
├─ Worst:     11.642976ms
├─ Completed: 55.568853ms
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      801.957µs
├─ Worst:     11.187546ms
├─ Completed: 54.403944ms
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### posts100k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      102.188342ms
├─ Worst:     314.493581ms
├─ Completed: 2.64336477s
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### posts100k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      43.245017ms
├─ Worst:     318.68294ms
├─ Completed: 2.192216135s
├─ Workers:   0=52 1=48
└─ Errors:    0
```
#### posts100k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      651.049µs
├─ Worst:     8.4971ms
├─ Completed: 54.239366ms
├─ Workers:   0=27 1=73
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      268.063856ms
├─ Worst:     2.279802642s
├─ Completed: 14.262049065s
├─ Workers:   0=41 1=59
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      941.071µs
├─ Worst:     10.317584ms
├─ Completed: 64.314002ms
├─ Workers:   0=75 1=25
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      171.265997ms
├─ Worst:     688.595691ms
├─ Completed: 6.170203863s
├─ Workers:   0=46 1=54
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      685.227µs
├─ Worst:     11.0096ms
├─ Completed: 58.038011ms
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      180.503138ms
├─ Worst:     790.850358ms
├─ Completed: 6.789599963s
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.455261ms
├─ Worst:     9.782555ms
├─ Completed: 56.747058ms
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      706.763951ms
├─ Worst:     4.862305882s
├─ Completed: 34.669128306s
├─ Workers:   0=50 1=50
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      4.388793ms
├─ Worst:     23.833316ms
├─ Completed: 108.191659ms
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      1.719373956s
├─ Worst:     17.979885676s
├─ Completed: 92.388212466s
├─ Workers:   0=46 1=54
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.086691ms
├─ Worst:     15.115543ms
├─ Completed: 81.80793ms
├─ Workers:   0=49 1=51
└─ Errors:    0
```

## Go vs JS route execution
#### JS route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      59.621138ms
├─ Worst:     4.211844531s
├─ Completed: 4.213287164s
├─ Workers:   0=253 1=247
└─ Errors:    0
```
#### Go route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      43.774355ms
├─ Worst:     4.171002687s
├─ Completed: 4.172180885s
├─ Workers:   0=253 1=247
└─ Errors:    0
```
#### JS route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      40.963843ms
├─ Worst:     514.186301ms
├─ Completed: 4.185432703s
├─ Workers:   0=253 1=247
└─ Errors:    0
```
#### Go route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      41.28721ms
├─ Worst:     449.761256ms
├─ Completed: 4.135674831s
├─ Workers:   0=253 1=247
└─ Errors:    0
```
#### JS route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      10.501749ms
├─ Worst:     28.541381ms
├─ Completed: 5.850377196s
├─ Workers:   0=253 1=247
└─ Errors:    0
```
#### Go route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      10.225237ms
├─ Worst:     27.2308ms
├─ Completed: 5.731980306s
├─ Workers:   0=253 1=247
└─ Errors:    0
```

## Go vs JS hooks execution
#### JS OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      596.724µs
├─ Worst:     17.653538ms
├─ Completed: 53.212844ms
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### Go OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      1.71554ms
├─ Worst:     9.2438ms
├─ Completed: 47.435142ms
├─ Workers:   0=50 1=50
└─ Errors:    0
```

## Deleting records
#### deleting 100 posts10k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      723.239µs
├─ Worst:     11.049094ms
├─ Completed: 50.462786ms
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### deleting 100 posts10k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      686.539µs
├─ Worst:     9.505783ms
├─ Completed: 50.708114ms
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      728.557µs
├─ Worst:     18.99363ms
├─ Completed: 67.439359ms
├─ Workers:   0=50 1=50
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      880.276µs
├─ Worst:     15.891204ms
├─ Completed: 59.812642ms
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      774.749µs
├─ Worst:     12.175791ms
├─ Completed: 68.006213ms
├─ Workers:   0=50 1=50
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      996.717µs
├─ Worst:     10.399347ms
├─ Completed: 53.777784ms
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      1.204052ms
├─ Worst:     8.909068ms
├─ Completed: 54.373049ms
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      860.149µs
├─ Worst:     11.704921ms
├─ Completed: 55.646918ms
├─ Workers:   0=50 1=50
└─ Errors:    0
```
#### deleting 100 users - with cascade deleting all associated posts [conc:10, rule:`""`]
```
┌─ Best:      65.725782ms
├─ Worst:     1.921877389s
├─ Completed: 7.264574059s
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### deleting 100 organizations - with cascade deleting all users and associated posts [conc:10, rule:`""`]
```
┌─ Best:      22.70619ms
├─ Worst:     5.503796326s
├─ Completed: 16.900748467s
├─ Workers:   0=50 1=50
└─ Errors:    0
```

---------------------------------------------------
Completed!
