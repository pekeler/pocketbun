# Upstream PocketBase Benchmark Result

- machine: m2-max
- timestamp: 2026-02-07T07:54:43.150Z
- tests: create,auth,search,custom,delete
- upstream build target: linux/amd64
- upstream build cgo: 0
- executable used: app-host
## Creating organizations (100)
#### Creating 50 organizations [reqs:50, conc:10, rule:`""`]
```
┌─ Best:      205.167µs
├─ Worst:     3.03125ms
├─ Completed: 4.906375ms
└─ Errors:    0
```
#### Creating 50 organizations [reqs:50, conc:10, rule:`"@request.body.name != ''"`]
```
┌─ Best:      313.709µs
├─ Worst:     5.311167ms
├─ Completed: 5.919125ms
└─ Errors:    0
```

## Creating permissions (50)
#### Creating 25 permissions [reqs:25, conc:5, rule:`""`]
```
┌─ Best:      235.458µs
├─ Worst:     1.276791ms
├─ Completed: 2.339791ms
└─ Errors:    0
```
#### Creating 25 permissions [reqs:25, conc:5, rule:`"@request.body.name != ''"`]
```
┌─ Best:      238.083µs
├─ Worst:     968.083µs
├─ Completed: 2.307375ms
└─ Errors:    0
```

## Creating users (500 - expected to be slow due to passwordHash generation)
#### Creating 250 users [reqs:250, conc:50, rule:`""`]
```
┌─ Best:      355.742625ms
├─ Worst:     1.349270875s
├─ Completed: 3.385826542s
└─ Errors:    0
```
#### Creating 250 users [reqs:250, conc:50, rule:`"@request.body.email != '' && @request.body.permissions:length > 0"`]
```
┌─ Best:      314.708417ms
├─ Worst:     958.133167ms
├─ Completed: 3.454297958s
└─ Errors:    0
```

## Creating posts (10k, 25k, 50k, 100k)
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`""`]
```
┌─ Best:      197.125µs
├─ Worst:     336.978583ms
├─ Completed: 394.525625ms
└─ Errors:    0
```
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      307.375µs
├─ Worst:     355.289375ms
├─ Completed: 487.608667ms
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`""`]
```
┌─ Best:      192.834µs
├─ Worst:     359.465417ms
├─ Completed: 907.507459ms
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      329.708µs
├─ Worst:     490.52925ms
├─ Completed: 1.205177833s
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`""`]
```
┌─ Best:      177.458µs
├─ Worst:     368.911541ms
├─ Completed: 1.820516875s
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      291.833µs
├─ Worst:     456.221209ms
├─ Completed: 2.457209083s
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`""`]
```
┌─ Best:      178.833µs
├─ Worst:     432.997334ms
├─ Completed: 3.856553416s
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      277.834µs
├─ Worst:     639.918209ms
├─ Completed: 5.183092792s
└─ Errors:    0
```

## User auth with password (expected to be slow due to passwordHash verification)
#### users auth with email/pass - high concurrency [reqs:250, conc:250]
```
┌─ Best:      282.005041ms
├─ Worst:     1.720642917s
├─ Completed: 1.72090375s
└─ Errors:    0
```
#### users auth with email/pass - small concurrency [reqs:250, conc:10]
```
┌─ Best:      63.064292ms
├─ Worst:     86.75125ms
├─ Completed: 1.865809s
└─ Errors:    0
```

## User auth refresh
#### users - auth refresh (high concurrency) [reqs:1000, conc:1000]
```
┌─ Best:      7.662792ms
├─ Worst:     97.232708ms
├─ Completed: 98.189125ms
└─ Errors:    0
```
#### users - auth refresh (medium concurrency) [reqs:1000, conc:100]
```
┌─ Best:      256.041µs
├─ Worst:     9.425ms
├─ Completed: 28.030625ms
└─ Errors:    0
```

## List records
#### users - getOne for auth refresh comparison (medium concurrency) [reqs:1000, conc:100, rule:`""`, query:`/qyl3o2zueufddx2`]
```
┌─ Best:      174.584µs
├─ Worst:     106.395708ms
├─ Completed: 109.17325ms
└─ Errors:    0
```
#### users - getOne for auth refresh comparison (high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`/qyl3o2zueufddx2`]
```
┌─ Best:      4.4835ms
├─ Worst:     94.836708ms
├─ Completed: 95.729333ms
└─ Errors:    0
```
#### posts10k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      695.667µs
├─ Worst:     31.155875ms
├─ Completed: 906.271833ms
└─ Errors:    0
```
#### posts10k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      28.334542ms
├─ Worst:     233.939292ms
├─ Completed: 235.226792ms
└─ Errors:    0
```
#### posts10k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      6.052292ms
├─ Worst:     135.145958ms
├─ Completed: 135.370375ms
└─ Errors:    0
```
#### posts10k - mixed read and write (simpleA list with additional 300 concurrent random posts10k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      28.823083ms
├─ Worst:     301.447417ms
├─ Completed: 302.1635ms
└─ Errors:    0
```
#### posts10k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.523625ms
├─ Worst:     8.584333ms
├─ Completed: 32.999625ms
└─ Errors:    0
```
#### posts10k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      1.642666ms
├─ Worst:     11.743083ms
├─ Completed: 35.334084ms
└─ Errors:    0
```
#### posts10k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      2.335458ms
├─ Worst:     10.806375ms
├─ Completed: 45.727959ms
└─ Errors:    0
```
#### posts10k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      2.501709ms
├─ Worst:     12.370417ms
├─ Completed: 51.55375ms
└─ Errors:    0
```
#### posts10k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.095083ms
├─ Worst:     9.028125ms
├─ Completed: 22.422333ms
└─ Errors:    0
```
#### posts10k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      15.414667ms
├─ Worst:     111.814959ms
├─ Completed: 373.892583ms
└─ Errors:    0
```
#### posts10k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      367.625µs
├─ Worst:     24.699709ms
├─ Completed: 29.0945ms
└─ Errors:    0
```
#### posts10k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      388.125µs
├─ Worst:     9.8705ms
├─ Completed: 17.716083ms
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      13.891542ms
├─ Worst:     136.776667ms
├─ Completed: 389.661917ms
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      379.375µs
├─ Worst:     25.537333ms
├─ Completed: 32.157084ms
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      460.167µs
├─ Worst:     8.968625ms
├─ Completed: 16.882167ms
└─ Errors:    0
```
#### posts10k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      9.034166ms
├─ Worst:     71.425542ms
├─ Completed: 216.899416ms
└─ Errors:    0
```
#### posts10k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      6.691333ms
├─ Worst:     71.2145ms
├─ Completed: 189.964417ms
└─ Errors:    0
```
#### posts10k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      537.459µs
├─ Worst:     14.580875ms
├─ Completed: 21.404625ms
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      205.568083ms
├─ Worst:     275.693292ms
├─ Completed: 2.344451667s
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      940.5µs
├─ Worst:     14.86575ms
├─ Completed: 31.731417ms
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      55.55975ms
├─ Worst:     116.970417ms
├─ Completed: 735.186958ms
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      486.25µs
├─ Worst:     15.257ms
├─ Completed: 23.504417ms
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      184.972625ms
├─ Worst:     257.94925ms
├─ Completed: 2.150633292s
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      558.375µs
├─ Worst:     11.6965ms
├─ Completed: 21.232083ms
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      537.363541ms
├─ Worst:     614.67025ms
├─ Completed: 5.827256833s
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      7.857ms
├─ Worst:     22.242042ms
├─ Completed: 112.649084ms
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      298.452334ms
├─ Worst:     402.837458ms
├─ Completed: 3.2908695s
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.146834ms
├─ Worst:     15.25625ms
├─ Completed: 34.562958ms
└─ Errors:    0
```
#### posts25k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.339042ms
├─ Worst:     16.044708ms
├─ Completed: 1.52902525s
└─ Errors:    0
```
#### posts25k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      25.638625ms
├─ Worst:     402.2475ms
├─ Completed: 404.140708ms
└─ Errors:    0
```
#### posts25k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      5.828917ms
├─ Worst:     145.751334ms
├─ Completed: 146.431625ms
└─ Errors:    0
```
#### posts25k - mixed read and write (simpleA list with additional 300 concurrent random posts25k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      42.987875ms
├─ Worst:     528.285ms
├─ Completed: 529.452166ms
└─ Errors:    0
```
#### posts25k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.997167ms
├─ Worst:     18.867334ms
├─ Completed: 48.42375ms
└─ Errors:    0
```
#### posts25k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      2.337791ms
├─ Worst:     18.5915ms
├─ Completed: 52.497042ms
└─ Errors:    0
```
#### posts25k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      2.614417ms
├─ Worst:     10.662375ms
├─ Completed: 55.935417ms
└─ Errors:    0
```
#### posts25k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      3.250917ms
├─ Worst:     13.662625ms
├─ Completed: 61.119959ms
└─ Errors:    0
```
#### posts25k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.894458ms
├─ Worst:     12.846084ms
├─ Completed: 37.430292ms
└─ Errors:    0
```
#### posts25k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      10.279208ms
├─ Worst:     179.163041ms
├─ Completed: 788.59875ms
└─ Errors:    0
```
#### posts25k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      444.416µs
├─ Worst:     48.108958ms
├─ Completed: 58.8195ms
└─ Errors:    0
```
#### posts25k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      498.083µs
├─ Worst:     8.427292ms
├─ Completed: 14.166875ms
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      35.417041ms
├─ Worst:     238.657583ms
├─ Completed: 750.971209ms
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      434.083µs
├─ Worst:     51.653667ms
├─ Completed: 57.557792ms
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      489.667µs
├─ Worst:     7.596166ms
├─ Completed: 13.445375ms
└─ Errors:    0
```
#### posts25k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      14.231167ms
├─ Worst:     162.680958ms
├─ Completed: 570.92375ms
└─ Errors:    0
```
#### posts25k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      10.582042ms
├─ Worst:     223.905458ms
├─ Completed: 551.932917ms
└─ Errors:    0
```
#### posts25k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      437.25µs
├─ Worst:     30.65425ms
├─ Completed: 38.934834ms
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      625.090875ms
├─ Worst:     839.594625ms
├─ Completed: 7.415448541s
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      722µs
├─ Worst:     37.934917ms
├─ Completed: 55.755167ms
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      151.773667ms
├─ Worst:     276.271042ms
├─ Completed: 1.804285541s
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      563µs
├─ Worst:     31.445416ms
├─ Completed: 44.991459ms
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      415.516625ms
├─ Worst:     639.789875ms
├─ Completed: 5.368903417s
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      605.833µs
├─ Worst:     30.674625ms
├─ Completed: 44.598334ms
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      1.486296084s
├─ Worst:     1.707236166s
├─ Completed: 16.128044458s
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      7.676875ms
├─ Worst:     46.609958ms
├─ Completed: 143.139458ms
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      730.163916ms
├─ Worst:     907.523792ms
├─ Completed: 7.739345833s
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.158208ms
├─ Worst:     37.701166ms
├─ Completed: 58.750292ms
└─ Errors:    0
```
#### posts50k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      2.673791ms
├─ Worst:     33.266916ms
├─ Completed: 3.024242167s
└─ Errors:    0
```
#### posts50k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      33.73475ms
├─ Worst:     725.944583ms
├─ Completed: 727.733125ms
└─ Errors:    0
```
#### posts50k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      4.751416ms
├─ Worst:     143.618292ms
├─ Completed: 143.814958ms
└─ Errors:    0
```
#### posts50k - mixed read and write (simpleA list with additional 300 concurrent random posts50k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      58.600167ms
├─ Worst:     933.081459ms
├─ Completed: 934.318667ms
└─ Errors:    0
```
#### posts50k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      4.75925ms
├─ Worst:     35.20075ms
├─ Completed: 90.698291ms
└─ Errors:    0
```
#### posts50k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      4.2755ms
├─ Worst:     23.416417ms
├─ Completed: 83.077ms
└─ Errors:    0
```
#### posts50k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      4.981167ms
├─ Worst:     28.258291ms
├─ Completed: 91.806292ms
└─ Errors:    0
```
#### posts50k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      4.907916ms
├─ Worst:     27.166083ms
├─ Completed: 99.526042ms
└─ Errors:    0
```
#### posts50k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      4.155292ms
├─ Worst:     29.550292ms
├─ Completed: 79.780833ms
└─ Errors:    0
```
#### posts50k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      65.89725ms
├─ Worst:     348.548083ms
├─ Completed: 1.399684166s
└─ Errors:    0
```
#### posts50k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      460.292µs
├─ Worst:     104.504792ms
├─ Completed: 113.822875ms
└─ Errors:    0
```
#### posts50k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      468.083µs
├─ Worst:     9.252208ms
├─ Completed: 17.623666ms
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      37.691167ms
├─ Worst:     421.250208ms
├─ Completed: 1.257347s
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      467.709µs
├─ Worst:     75.815625ms
├─ Completed: 100.498ms
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      470.542µs
├─ Worst:     8.266958ms
├─ Completed: 14.252125ms
└─ Errors:    0
```
#### posts50k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      51.294208ms
├─ Worst:     360.526667ms
├─ Completed: 1.165787583s
└─ Errors:    0
```
#### posts50k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      41.297958ms
├─ Worst:     345.040041ms
├─ Completed: 999.09725ms
└─ Errors:    0
```
#### posts50k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      458.834µs
├─ Worst:     37.995083ms
├─ Completed: 43.080625ms
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      1.502827167s
├─ Worst:     1.737470208s
├─ Completed: 16.065340208s
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      926.417µs
├─ Worst:     103.864833ms
├─ Completed: 117.16ms
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      312.797583ms
├─ Worst:     540.522458ms
├─ Completed: 3.69552025s
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      485.125µs
├─ Worst:     84.902667ms
├─ Completed: 96.053166ms
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      920.33975ms
├─ Worst:     1.243297708s
├─ Completed: 10.747643167s
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      641.291µs
├─ Worst:     67.487542ms
├─ Completed: 81.420417ms
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      3.06754975s
├─ Worst:     3.502387958s
├─ Completed: 33.145863833s
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      9.904667ms
├─ Worst:     77.67575ms
├─ Completed: 185.6185ms
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      1.528785542s
├─ Worst:     1.723322042s
├─ Completed: 15.858012167s
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.2265ms
├─ Worst:     72.589959ms
├─ Completed: 92.380792ms
└─ Errors:    0
```
#### posts100k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      4.939625ms
├─ Worst:     58.88875ms
├─ Completed: 5.616911375s
└─ Errors:    0
```
#### posts100k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      101.003417ms
├─ Worst:     1.376283084s
├─ Completed: 1.380675042s
└─ Errors:    0
```
#### posts100k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      42.207708ms
├─ Worst:     163.518ms
├─ Completed: 163.972667ms
└─ Errors:    0
```
#### posts100k - mixed read and write (simpleA list with additional 300 concurrent random posts100k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      112.689042ms
├─ Worst:     1.699078958s
├─ Completed: 1.699704917s
└─ Errors:    0
```
#### posts100k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      8.014792ms
├─ Worst:     53.343334ms
├─ Completed: 157.088666ms
└─ Errors:    0
```
#### posts100k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      10.020375ms
├─ Worst:     33.085833ms
├─ Completed: 139.930333ms
└─ Errors:    0
```
#### posts100k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      10.120833ms
├─ Worst:     31.161333ms
├─ Completed: 143.454ms
└─ Errors:    0
```
#### posts100k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      10.329959ms
├─ Worst:     30.971792ms
├─ Completed: 148.185292ms
└─ Errors:    0
```
#### posts100k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      6.961708ms
├─ Worst:     27.050833ms
├─ Completed: 127.02025ms
└─ Errors:    0
```
#### posts100k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      47.291125ms
├─ Worst:     516.979958ms
├─ Completed: 2.84571375s
└─ Errors:    0
```
#### posts100k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      460.333µs
├─ Worst:     145.867541ms
├─ Completed: 150.963417ms
└─ Errors:    0
```
#### posts100k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      472.042µs
├─ Worst:     8.389792ms
├─ Completed: 14.485041ms
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      43.318458ms
├─ Worst:     972.759959ms
├─ Completed: 2.382058208s
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      485.084µs
├─ Worst:     242.646833ms
├─ Completed: 251.603917ms
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      544.459µs
├─ Worst:     10.29225ms
├─ Completed: 19.978792ms
└─ Errors:    0
```
#### posts100k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      138.720583ms
├─ Worst:     477.593375ms
├─ Completed: 2.460736375s
└─ Errors:    0
```
#### posts100k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      83.191292ms
├─ Worst:     381.831ms
├─ Completed: 1.896902834s
└─ Errors:    0
```
#### posts100k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      419µs
├─ Worst:     65.831791ms
├─ Completed: 73.026167ms
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      3.14554025s
├─ Worst:     3.781986375s
├─ Completed: 35.683929958s
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.053167ms
├─ Worst:     402.653916ms
├─ Completed: 420.700625ms
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      560.214792ms
├─ Worst:     862.089417ms
├─ Completed: 7.318601541s
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      518.041µs
├─ Worst:     279.784875ms
├─ Completed: 287.708417ms
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      1.806725334s
├─ Worst:     2.433360625s
├─ Completed: 22.59661175s
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      605.041µs
├─ Worst:     211.544542ms
├─ Completed: 220.803417ms
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      6.663106125s
├─ Worst:     7.209079291s
├─ Completed: 1m9.695576s
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      7.194916ms
├─ Worst:     249.082875ms
├─ Completed: 331.049917ms
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      3.057953917s
├─ Worst:     3.325343875s
├─ Completed: 31.604721584s
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.188167ms
├─ Worst:     233.466ms
├─ Completed: 252.827ms
└─ Errors:    0
```

## Go vs JS route execution
#### JS route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      1.000682334s
├─ Worst:     4.019859375s
├─ Completed: 4.023149959s
└─ Errors:    0
```
#### Go route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      898.355083ms
├─ Worst:     5.966824458s
├─ Completed: 5.968390375s
└─ Errors:    0
```
#### JS route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      241.161375ms
├─ Worst:     385.227583ms
├─ Completed: 2.847367584s
└─ Errors:    0
```
#### Go route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      217.424208ms
├─ Worst:     390.958917ms
├─ Completed: 2.813262s
└─ Errors:    0
```
#### JS route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      5.117375ms
├─ Worst:     9.611792ms
├─ Completed: 3.170341708s
└─ Errors:    0
```
#### Go route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      5.192167ms
├─ Worst:     9.106ms
├─ Completed: 3.129219875s
└─ Errors:    0
```

## Go vs JS hooks execution
#### JS OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      403.75µs
├─ Worst:     102.835708ms
├─ Completed: 109.654708ms
└─ Errors:    0
```
#### Go OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      457.25µs
├─ Worst:     9.023292ms
├─ Completed: 19.594834ms
└─ Errors:    0
```

## Deleting records
#### deleting 100 posts10k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      349.916µs
├─ Worst:     8.194791ms
├─ Completed: 12.8505ms
└─ Errors:    0
```
#### deleting 100 posts10k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      283.417µs
├─ Worst:     7.888916ms
├─ Completed: 14.54325ms
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      325.333µs
├─ Worst:     2.958417ms
├─ Completed: 8.377833ms
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      335.833µs
├─ Worst:     4.144958ms
├─ Completed: 9.8985ms
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      317.292µs
├─ Worst:     4.218667ms
├─ Completed: 12.012833ms
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      370.75µs
├─ Worst:     2.913875ms
├─ Completed: 10.046ms
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      281.583µs
├─ Worst:     20.147375ms
├─ Completed: 27.878709ms
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      365.166µs
├─ Worst:     2.353417ms
├─ Completed: 10.371291ms
└─ Errors:    0
```
#### deleting 100 users - with cascade deleting all associated posts [conc:10, rule:`""`]
```
┌─ Best:      74.423833ms
├─ Worst:     2.643305916s
├─ Completed: 7.465056416s
└─ Errors:    0
```
#### deleting 100 organizations - with cascade deleting all users and associated posts [conc:10, rule:`""`]
```
┌─ Best:      85.985958ms
├─ Worst:     8.02116975s
├─ Completed: 17.130726167s
└─ Errors:    0
```

---------------------------------------------------
Completed!
