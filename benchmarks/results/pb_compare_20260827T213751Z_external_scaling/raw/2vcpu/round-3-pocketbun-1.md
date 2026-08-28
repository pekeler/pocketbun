# PocketBun Upstream-Port Benchmark Result

- machine: hetzner-2vcpu-pocketbun-1
- timestamp: 2026-08-27T20:05:19.234Z
- tests: create,auth,search,custom,delete
- benchmark source: 05625dc2b2d3f9711c51566010944b10ca9531fa
- server workers: 1
- load generator: http://load-generator:19231
- benchmark target host: application-host
- warmup request target/cap: 1000
## Creating organizations (100)
#### Creating 50 organizations [reqs:50, conc:10, rule:`""`]
```
┌─ Best:      2.287527ms
├─ Worst:     6.815004ms
├─ Completed: 26.170906ms
├─ Workers:   0=50
└─ Errors:    0
```
#### Creating 50 organizations [reqs:50, conc:10, rule:`"@request.body.name != ''"`]
```
┌─ Best:      1.57283ms
├─ Worst:     8.806874ms
├─ Completed: 30.040287ms
├─ Workers:   0=50
└─ Errors:    0
```

## Creating permissions (50)
#### Creating 25 permissions [reqs:25, conc:5, rule:`""`]
```
┌─ Best:      1.487213ms
├─ Worst:     3.523361ms
├─ Completed: 12.508662ms
├─ Workers:   0=25
└─ Errors:    0
```
#### Creating 25 permissions [reqs:25, conc:5, rule:`"@request.body.name != ''"`]
```
┌─ Best:      1.768271ms
├─ Worst:     3.979772ms
├─ Completed: 14.977569ms
├─ Workers:   0=25
└─ Errors:    0
```

## Creating users (500 - expected to be slow due to passwordHash generation)
#### Creating 250 users [reqs:250, conc:50, rule:`""`]
```
┌─ Best:      95.35939ms
├─ Worst:     4.546387494s
├─ Completed: 8.080881616s
├─ Workers:   0=250
└─ Errors:    0
```
#### Creating 250 users [reqs:250, conc:50, rule:`"@request.body.email != '' && @request.body.permissions:length > 0"`]
```
┌─ Best:      95.949423ms
├─ Worst:     3.829535271s
├─ Completed: 8.079600189s
├─ Workers:   0=250
└─ Errors:    0
```

## Creating posts (10k, 25k, 50k, 100k)
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`""`]
```
┌─ Best:      13.566963ms
├─ Worst:     140.370036ms
├─ Completed: 1.029227235s
├─ Workers:   0=5000
└─ Errors:    0
```
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      12.869421ms
├─ Worst:     199.273236ms
├─ Completed: 1.683769288s
├─ Workers:   0=5000
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`""`]
```
┌─ Best:      11.58741ms
├─ Worst:     109.702134ms
├─ Completed: 2.432883897s
├─ Workers:   0=12500
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      16.544523ms
├─ Worst:     177.047152ms
├─ Completed: 3.85631697s
├─ Workers:   0=12500
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`""`]
```
┌─ Best:      12.858345ms
├─ Worst:     114.106531ms
├─ Completed: 4.927520253s
├─ Workers:   0=25000
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      15.072101ms
├─ Worst:     165.772482ms
├─ Completed: 7.332423646s
├─ Workers:   0=25000
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`""`]
```
┌─ Best:      14.711283ms
├─ Worst:     128.229021ms
├─ Completed: 9.655047888s
├─ Workers:   0=50000
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      13.91953ms
├─ Worst:     162.564065ms
├─ Completed: 14.122820139s
├─ Workers:   0=50000
└─ Errors:    0
```

## User auth with password (expected to be slow due to passwordHash verification)
#### users auth with email/pass - high concurrency [reqs:250, conc:250]
```
┌─ Best:      102.567687ms
├─ Worst:     8.024181728s
├─ Completed: 8.024949608s
├─ Workers:   0=250
└─ Errors:    0
```
#### users auth with email/pass - small concurrency [reqs:250, conc:10]
```
┌─ Best:      67.629903ms
├─ Worst:     761.781739ms
├─ Completed: 8.002584937s
├─ Workers:   0=250
└─ Errors:    0
```

## User auth refresh
#### users - auth refresh (high concurrency) [reqs:1000, conc:1000]
```
┌─ Best:      27.155113ms
├─ Worst:     179.512354ms
├─ Completed: 181.017091ms
├─ Workers:   0=1000
└─ Errors:    0
```
#### users - auth refresh (medium concurrency) [reqs:1000, conc:100]
```
┌─ Best:      3.427719ms
├─ Worst:     40.502986ms
├─ Completed: 183.341197ms
├─ Workers:   0=1000
└─ Errors:    0
```

## List records
#### users - getOne for auth refresh comparison (medium concurrency) [reqs:1000, conc:100, rule:`""`, query:`/z1j4ypdty2ugyiy`]
```
┌─ Best:      3.79025ms
├─ Worst:     32.558452ms
├─ Completed: 157.685581ms
├─ Workers:   0=1000
└─ Errors:    0
```
#### users - getOne for auth refresh comparison (high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`/z1j4ypdty2ugyiy`]
```
┌─ Best:      22.071359ms
├─ Worst:     147.956236ms
├─ Completed: 149.656612ms
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts10k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      653.161µs
├─ Worst:     3.126234ms
├─ Completed: 795.690524ms
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts10k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      24.553965ms
├─ Worst:     587.836838ms
├─ Completed: 589.536273ms
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts10k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      22.8396ms
├─ Worst:     337.639437ms
├─ Completed: 339.664249ms
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts10k - mixed read and write (simpleA list with additional 300 concurrent random posts10k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      104.738363ms
├─ Worst:     678.195687ms
├─ Completed: 679.938413ms
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts10k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      4.803158ms
├─ Worst:     23.602933ms
├─ Completed: 120.083831ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      4.762493ms
├─ Worst:     29.988314ms
├─ Completed: 150.137005ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      4.806162ms
├─ Worst:     26.891612ms
├─ Completed: 150.769318ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      6.47075ms
├─ Worst:     35.246772ms
├─ Completed: 196.146499ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      3.27536ms
├─ Worst:     16.397949ms
├─ Completed: 87.937087ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      13.57998ms
├─ Worst:     50.203612ms
├─ Completed: 174.457347ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.646232ms
├─ Worst:     11.137039ms
├─ Completed: 56.071109ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.264865ms
├─ Worst:     7.938595ms
├─ Completed: 56.02093ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      13.721276ms
├─ Worst:     50.013912ms
├─ Completed: 176.010572ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.461026ms
├─ Worst:     9.380185ms
├─ Completed: 59.956432ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.327783ms
├─ Worst:     8.256164ms
├─ Completed: 49.818391ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      15.183264ms
├─ Worst:     51.131563ms
├─ Completed: 193.776538ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      14.408244ms
├─ Worst:     47.690204ms
├─ Completed: 180.637636ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.18884ms
├─ Worst:     11.070267ms
├─ Completed: 68.431678ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      50.504558ms
├─ Worst:     169.108287ms
├─ Completed: 1.349936527s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.888346ms
├─ Worst:     13.530231ms
├─ Completed: 73.36789ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      32.345228ms
├─ Worst:     89.831621ms
├─ Completed: 564.231161ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.234093ms
├─ Worst:     10.258087ms
├─ Completed: 67.635999ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      37.438046ms
├─ Worst:     107.967609ms
├─ Completed: 735.256323ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.443072ms
├─ Worst:     10.484039ms
├─ Completed: 69.052074ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      77.013062ms
├─ Worst:     445.644167ms
├─ Completed: 4.100176345s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      5.579229ms
├─ Worst:     26.918908ms
├─ Completed: 128.870846ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      151.830532ms
├─ Worst:     1.184780303s
├─ Completed: 11.482282674s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      3.045252ms
├─ Worst:     16.145341ms
├─ Completed: 89.024927ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      975.786µs
├─ Worst:     4.670045ms
├─ Completed: 1.152656862s
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts25k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      22.566062ms
├─ Worst:     896.474469ms
├─ Completed: 899.19197ms
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts25k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      23.729407ms
├─ Worst:     313.332201ms
├─ Completed: 315.152623ms
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts25k - mixed read and write (simpleA list with additional 300 concurrent random posts25k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      101.498291ms
├─ Worst:     979.095481ms
├─ Completed: 980.831707ms
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts25k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      5.799864ms
├─ Worst:     30.748123ms
├─ Completed: 146.292479ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      6.87708ms
├─ Worst:     43.090185ms
├─ Completed: 179.162341ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      6.292384ms
├─ Worst:     36.751949ms
├─ Completed: 168.810984ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      8.065291ms
├─ Worst:     53.038795ms
├─ Completed: 225.774098ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      4.974236ms
├─ Worst:     25.218522ms
├─ Completed: 125.775895ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      21.370994ms
├─ Worst:     73.562018ms
├─ Completed: 290.37619ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.569035ms
├─ Worst:     10.392111ms
├─ Completed: 65.689104ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.571738ms
├─ Worst:     9.776632ms
├─ Completed: 65.225705ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      23.210742ms
├─ Worst:     81.362063ms
├─ Completed: 302.614931ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.635527ms
├─ Worst:     10.085308ms
├─ Completed: 64.589726ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.104624ms
├─ Worst:     9.094881ms
├─ Completed: 60.857125ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      40.400844ms
├─ Worst:     97.450144ms
├─ Completed: 490.892811ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      33.232832ms
├─ Worst:     78.217184ms
├─ Completed: 392.51059ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.672128ms
├─ Worst:     10.820453ms
├─ Completed: 62.341272ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      82.512751ms
├─ Worst:     421.185623ms
├─ Completed: 3.810139966s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.44931ms
├─ Worst:     10.932376ms
├─ Completed: 69.435884ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      60.466085ms
├─ Worst:     189.752836ms
├─ Completed: 1.395460932s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.07192ms
├─ Worst:     11.680279ms
├─ Completed: 67.662147ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      65.30964ms
├─ Worst:     231.388635ms
├─ Completed: 1.860700609s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.552793ms
├─ Worst:     9.845717ms
├─ Completed: 64.032807ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      147.162751ms
├─ Worst:     1.066316389s
├─ Completed: 10.297220362s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      5.48594ms
├─ Worst:     26.416295ms
├─ Completed: 125.412784ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      330.102264ms
├─ Worst:     2.890311645s
├─ Completed: 28.394478365s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      3.380726ms
├─ Worst:     18.209831ms
├─ Completed: 93.306928ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.850454ms
├─ Worst:     27.059923ms
├─ Completed: 2.065306584s
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts50k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      22.189672ms
├─ Worst:     1.753384009s
├─ Completed: 1.755147073s
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts50k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      25.31073ms
├─ Worst:     312.043623ms
├─ Completed: 313.879968ms
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts50k - mixed read and write (simpleA list with additional 300 concurrent random posts50k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      94.482509ms
├─ Worst:     1.802535369s
├─ Completed: 1.806675943s
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts50k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      9.422053ms
├─ Worst:     49.73087ms
├─ Completed: 231.393782ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      8.437073ms
├─ Worst:     34.82509ms
├─ Completed: 253.153751ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      9.498098ms
├─ Worst:     42.479154ms
├─ Completed: 288.098647ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      11.012097ms
├─ Worst:     59.518498ms
├─ Completed: 317.299886ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      8.699014ms
├─ Worst:     47.251668ms
├─ Completed: 211.620875ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      69.599621ms
├─ Worst:     209.591934ms
├─ Completed: 1.615928966s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.698204ms
├─ Worst:     18.511045ms
├─ Completed: 78.438588ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.930485ms
├─ Worst:     22.136749ms
├─ Completed: 84.36756ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      66.872506ms
├─ Worst:     204.644797ms
├─ Completed: 1.581883082s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.80453ms
├─ Worst:     10.880596ms
├─ Completed: 66.750137ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.513038ms
├─ Worst:     10.429874ms
├─ Completed: 65.341974ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      67.330808ms
├─ Worst:     220.516892ms
├─ Completed: 1.760991437s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      59.66459ms
├─ Worst:     158.507576ms
├─ Completed: 1.118458066s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.080031ms
├─ Worst:     9.476988ms
├─ Completed: 61.205505ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      134.88024ms
├─ Worst:     892.818845ms
├─ Completed: 8.540063544s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.787868ms
├─ Worst:     12.337626ms
├─ Completed: 71.922827ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      88.544474ms
├─ Worst:     427.990273ms
├─ Completed: 3.833269685s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.349122ms
├─ Worst:     10.03513ms
├─ Completed: 64.650921ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      97.558555ms
├─ Worst:     517.481235ms
├─ Completed: 4.725384089s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.575494ms
├─ Worst:     10.783211ms
├─ Completed: 67.154916ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      267.193838ms
├─ Worst:     2.201096139s
├─ Completed: 21.563455168s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      6.423194ms
├─ Worst:     29.848261ms
├─ Completed: 119.486645ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      549.579932ms
├─ Worst:     5.092120007s
├─ Completed: 50.407904414s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      3.301906ms
├─ Worst:     16.65224ms
├─ Completed: 90.500474ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      3.271094ms
├─ Worst:     15.379725ms
├─ Completed: 3.506779121s
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts100k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      37.755734ms
├─ Worst:     3.221007619s
├─ Completed: 3.222837796s
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts100k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      25.515062ms
├─ Worst:     342.607752ms
├─ Completed: 344.282053ms
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts100k - mixed read and write (simpleA list with additional 300 concurrent random posts100k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      103.147968ms
├─ Worst:     3.265427514s
├─ Completed: 3.267488818s
├─ Workers:   0=1000
└─ Errors:    0
```
#### posts100k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      12.958563ms
├─ Worst:     62.545345ms
├─ Completed: 372.348997ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      18.335352ms
├─ Worst:     72.485713ms
├─ Completed: 427.144085ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      16.843815ms
├─ Worst:     69.105297ms
├─ Completed: 401.301011ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      18.75356ms
├─ Worst:     77.603306ms
├─ Completed: 459.051419ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      15.509935ms
├─ Worst:     73.538236ms
├─ Completed: 352.561679ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      81.394759ms
├─ Worst:     345.188585ms
├─ Completed: 3.051371033s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.39832ms
├─ Worst:     10.124923ms
├─ Completed: 64.647125ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      3.185436ms
├─ Worst:     9.687439ms
├─ Completed: 60.468018ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      81.214208ms
├─ Worst:     348.499453ms
├─ Completed: 3.042428391s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.59448ms
├─ Worst:     9.461737ms
├─ Completed: 62.668655ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.212633ms
├─ Worst:     9.399542ms
├─ Completed: 66.346731ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      84.458697ms
├─ Worst:     381.717725ms
├─ Completed: 3.377027682s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      78.024157ms
├─ Worst:     324.626438ms
├─ Completed: 2.829310209s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.833781ms
├─ Worst:     10.714567ms
├─ Completed: 65.256327ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      228.626052ms
├─ Worst:     1.829253742s
├─ Completed: 17.748721046s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      3.231239ms
├─ Worst:     12.790872ms
├─ Completed: 72.48372ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      127.6348ms
├─ Worst:     804.132184ms
├─ Completed: 7.603472703s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.574544ms
├─ Worst:     10.553885ms
├─ Completed: 66.451446ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      142.458327ms
├─ Worst:     976.27629ms
├─ Completed: 9.375000058s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.783121ms
├─ Worst:     10.497707ms
├─ Completed: 66.871793ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      486.449382ms
├─ Worst:     4.425307765s
├─ Completed: 43.640715444s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      5.748063ms
├─ Worst:     26.658859ms
├─ Completed: 125.318881ms
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      1.189192154s
├─ Worst:     11.461370571s
├─ Completed: 110.25947607s
├─ Workers:   0=100
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      3.648755ms
├─ Worst:     19.907912ms
├─ Completed: 108.329356ms
├─ Workers:   0=100
└─ Errors:    0
```

## Go vs JS route execution
#### JS route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      52.990979ms
├─ Worst:     5.31255298s
├─ Completed: 5.313279783s
├─ Workers:   0=500
└─ Errors:    0
```
#### Go route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      34.906812ms
├─ Worst:     5.162208306s
├─ Completed: 5.163089843s
├─ Workers:   0=500
└─ Errors:    0
```
#### JS route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      29.019197ms
├─ Worst:     549.425312ms
├─ Completed: 5.237202097s
├─ Workers:   0=500
└─ Errors:    0
```
#### Go route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      29.610853ms
├─ Worst:     568.135071ms
├─ Completed: 5.261548075s
├─ Workers:   0=500
└─ Errors:    0
```
#### JS route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      10.153162ms
├─ Worst:     41.545914ms
├─ Completed: 5.588152979s
├─ Workers:   0=500
└─ Errors:    0
```
#### Go route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      10.085348ms
├─ Worst:     72.358375ms
├─ Completed: 5.551602952s
├─ Workers:   0=500
└─ Errors:    0
```

## Go vs JS hooks execution
#### JS OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      11.970569ms
├─ Worst:     36.545593ms
├─ Completed: 200.294538ms
├─ Workers:   0=100
└─ Errors:    0
```
#### Go OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      2.245929ms
├─ Worst:     7.925998ms
├─ Completed: 55.618654ms
├─ Workers:   0=100
└─ Errors:    0
```

## Deleting records
#### deleting 100 posts10k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      2.670936ms
├─ Worst:     12.684394ms
├─ Completed: 72.049409ms
├─ Workers:   0=100
└─ Errors:    0
```
#### deleting 100 posts10k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      3.175342ms
├─ Worst:     9.189721ms
├─ Completed: 52.82605ms
├─ Workers:   0=100
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      1.979983ms
├─ Worst:     6.734174ms
├─ Completed: 51.102302ms
├─ Workers:   0=100
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      1.859907ms
├─ Worst:     9.132563ms
├─ Completed: 53.188821ms
├─ Workers:   0=100
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      1.792183ms
├─ Worst:     6.526065ms
├─ Completed: 49.978941ms
├─ Workers:   0=100
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      1.553253ms
├─ Worst:     9.238069ms
├─ Completed: 54.240842ms
├─ Workers:   0=100
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      2.137239ms
├─ Worst:     7.34099ms
├─ Completed: 51.283391ms
├─ Workers:   0=100
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      2.081373ms
├─ Worst:     7.55ms
├─ Completed: 53.099619ms
├─ Workers:   0=100
└─ Errors:    0
```
#### deleting 100 users - with cascade deleting all associated posts [conc:10, rule:`""`]
```
┌─ Best:      127.691816ms
├─ Worst:     762.983433ms
├─ Completed: 6.8746898s
├─ Workers:   0=100
└─ Errors:    0
```
#### deleting 100 organizations - with cascade deleting all users and associated posts [conc:10, rule:`""`]
```
┌─ Best:      246.800167ms
├─ Worst:     2.781864712s
├─ Completed: 16.642180327s
├─ Workers:   0=100
└─ Errors:    0
```

---------------------------------------------------
Completed!
