# PocketBun Upstream-Port Benchmark Result

- machine: m2-max
- timestamp: 2026-02-08T07:10:32.121Z
- tests: create,auth,search,custom,delete
## Creating organizations (100)
#### Creating 50 organizations [reqs:50, conc:10, rule:`""`]
```
┌─ Best:      480.875µs
├─ Worst:     17.349584ms
├─ Completed: 30.012458ms
└─ Errors:    0
```
#### Creating 50 organizations [reqs:50, conc:10, rule:`"@request.body.name != ''"`]
```
┌─ Best:      616.292µs
├─ Worst:     4.841375ms
├─ Completed: 13.002ms
└─ Errors:    0
```

## Creating permissions (50)
#### Creating 25 permissions [reqs:25, conc:5, rule:`""`]
```
┌─ Best:      355.792µs
├─ Worst:     3.415542ms
├─ Completed: 6.721375ms
└─ Errors:    0
```
#### Creating 25 permissions [reqs:25, conc:5, rule:`"@request.body.name != ''"`]
```
┌─ Best:      569.542µs
├─ Worst:     2.430209ms
├─ Completed: 5.1695ms
└─ Errors:    0
```

## Creating users (500 - expected to be slow due to passwordHash generation)
#### Creating 250 users [reqs:250, conc:50, rule:`""`]
```
┌─ Best:      74.336333ms
├─ Worst:     1.220587667s
├─ Completed: 1.593251834s
└─ Errors:    0
```
#### Creating 250 users [reqs:250, conc:50, rule:`"@request.body.email != '' && @request.body.permissions:length > 0"`]
```
┌─ Best:      69.225959ms
├─ Worst:     773.412833ms
├─ Completed: 1.5466035s
└─ Errors:    0
```

## Creating posts (10k, 25k, 50k, 100k)
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`""`]
```
┌─ Best:      15.54375ms
├─ Worst:     96.163208ms
├─ Completed: 616.068542ms
└─ Errors:    0
```
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      18.569792ms
├─ Worst:     139.615917ms
├─ Completed: 883.8375ms
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`""`]
```
┌─ Best:      11.796625ms
├─ Worst:     130.598709ms
├─ Completed: 1.436777917s
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      23.025875ms
├─ Worst:     133.188875ms
├─ Completed: 2.186899959s
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`""`]
```
┌─ Best:      18.480208ms
├─ Worst:     109.796208ms
├─ Completed: 2.871958584s
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      18.874709ms
├─ Worst:     141.129333ms
├─ Completed: 4.497268333s
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`""`]
```
┌─ Best:      11.539583ms
├─ Worst:     88.941ms
├─ Completed: 5.995011125s
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      16.759417ms
├─ Worst:     286.708ms
├─ Completed: 9.494476417s
└─ Errors:    0
```

## User auth with password (expected to be slow due to passwordHash verification)
#### users auth with email/pass - high concurrency [reqs:250, conc:250]
```
┌─ Best:      66.829833ms
├─ Worst:     1.581524125s
├─ Completed: 1.582174917s
└─ Errors:    0
```
#### users auth with email/pass - small concurrency [reqs:250, conc:10]
```
┌─ Best:      58.978166ms
├─ Worst:     76.183958ms
├─ Completed: 1.675508584s
└─ Errors:    0
```

## User auth refresh
#### users - auth refresh (high concurrency) [reqs:1000, conc:1000]
```
┌─ Best:      17.221208ms
├─ Worst:     78.162667ms
├─ Completed: 78.868833ms
└─ Errors:    0
```
#### users - auth refresh (medium concurrency) [reqs:1000, conc:100]
```
┌─ Best:      4.352833ms
├─ Worst:     17.644708ms
├─ Completed: 75.639083ms
└─ Errors:    0
```

## List records
#### users - getOne for auth refresh comparison (medium concurrency) [reqs:1000, conc:100, rule:`""`, query:`/xon8fgpnq49v63p`]
```
┌─ Best:      2.57ms
├─ Worst:     17.938625ms
├─ Completed: 68.980042ms
└─ Errors:    0
```
#### users - getOne for auth refresh comparison (high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`/xon8fgpnq49v63p`]
```
┌─ Best:      15.5505ms
├─ Worst:     103.997708ms
├─ Completed: 104.540833ms
└─ Errors:    0
```
#### posts10k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      363.917µs
├─ Worst:     8.029875ms
├─ Completed: 434.863041ms
└─ Errors:    0
```
#### posts10k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      32.957ms
├─ Worst:     326.350292ms
├─ Completed: 328.100458ms
└─ Errors:    0
```
#### posts10k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      20.94775ms
├─ Worst:     153.932459ms
├─ Completed: 154.459334ms
└─ Errors:    0
```
#### posts10k - mixed read and write (simpleA list with additional 300 concurrent random posts10k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      34.603083ms
├─ Worst:     359.660042ms
├─ Completed: 361.037042ms
└─ Errors:    0
```
#### posts10k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      3.399458ms
├─ Worst:     10.337375ms
├─ Completed: 56.019875ms
└─ Errors:    0
```
#### posts10k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      1.703125ms
├─ Worst:     12.483167ms
├─ Completed: 68.093ms
└─ Errors:    0
```
#### posts10k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      2.910875ms
├─ Worst:     12.348583ms
├─ Completed: 64.908834ms
└─ Errors:    0
```
#### posts10k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      4.509625ms
├─ Worst:     47.465708ms
├─ Completed: 173.331916ms
└─ Errors:    0
```
#### posts10k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.297291ms
├─ Worst:     7.442667ms
├─ Completed: 36.299333ms
└─ Errors:    0
```
#### posts10k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      7.564375ms
├─ Worst:     29.349709ms
├─ Completed: 118.472917ms
└─ Errors:    0
```
#### posts10k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      848.041µs
├─ Worst:     3.408125ms
├─ Completed: 19.271167ms
└─ Errors:    0
```
#### posts10k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      772.25µs
├─ Worst:     2.893041ms
├─ Completed: 17.519375ms
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      6.722583ms
├─ Worst:     18.154125ms
├─ Completed: 100.192875ms
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.111333ms
├─ Worst:     2.959083ms
├─ Completed: 17.996375ms
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      887.75µs
├─ Worst:     2.976375ms
├─ Completed: 16.920334ms
└─ Errors:    0
```
#### posts10k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      2.921917ms
├─ Worst:     23.8915ms
├─ Completed: 118.846541ms
└─ Errors:    0
```
#### posts10k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      6.200875ms
├─ Worst:     21.851625ms
├─ Completed: 117.851042ms
└─ Errors:    0
```
#### posts10k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      317.292µs
├─ Worst:     2.713875ms
├─ Completed: 15.812125ms
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      72.952167ms
├─ Worst:     178.594917ms
├─ Completed: 1.048197084s
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      538.334µs
├─ Worst:     4.987416ms
├─ Completed: 27.709625ms
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      35.906541ms
├─ Worst:     89.886958ms
├─ Completed: 463.321542ms
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      961µs
├─ Worst:     5.400417ms
├─ Completed: 24.782208ms
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      40.5855ms
├─ Worst:     138.36525ms
├─ Completed: 776.874792ms
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.575542ms
├─ Worst:     5.8695ms
├─ Completed: 25.490709ms
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      270.758375ms
├─ Worst:     699.461ms
├─ Completed: 3.877043833s
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      5.341542ms
├─ Worst:     17.579417ms
├─ Completed: 97.51075ms
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      723.816041ms
├─ Worst:     2.314960042s
├─ Completed: 12.212237667s
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.861ms
├─ Worst:     11.219041ms
├─ Completed: 58.494833ms
└─ Errors:    0
```
#### posts25k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      610.166µs
├─ Worst:     15.606875ms
├─ Completed: 748.585041ms
└─ Errors:    0
```
#### posts25k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      24.924208ms
├─ Worst:     570.693584ms
├─ Completed: 577.153334ms
└─ Errors:    0
```
#### posts25k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      19.931958ms
├─ Worst:     152.199833ms
├─ Completed: 152.790042ms
└─ Errors:    0
```
#### posts25k - mixed read and write (simpleA list with additional 300 concurrent random posts25k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      52.513708ms
├─ Worst:     622.856ms
├─ Completed: 624.421167ms
└─ Errors:    0
```
#### posts25k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      3.723417ms
├─ Worst:     14.633833ms
├─ Completed: 78.173583ms
└─ Errors:    0
```
#### posts25k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      4.635917ms
├─ Worst:     19.715917ms
├─ Completed: 103.629209ms
└─ Errors:    0
```
#### posts25k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      3.224916ms
├─ Worst:     24.150083ms
├─ Completed: 102.375333ms
└─ Errors:    0
```
#### posts25k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      4.495041ms
├─ Worst:     28.853333ms
├─ Completed: 141.973667ms
└─ Errors:    0
```
#### posts25k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      2.183875ms
├─ Worst:     11.968458ms
├─ Completed: 62.287042ms
└─ Errors:    0
```
#### posts25k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      6.623458ms
├─ Worst:     57.136959ms
├─ Completed: 301.918459ms
└─ Errors:    0
```
#### posts25k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      577.917µs
├─ Worst:     4.255333ms
├─ Completed: 19.258083ms
└─ Errors:    0
```
#### posts25k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      949.708µs
├─ Worst:     4.672958ms
├─ Completed: 20.050417ms
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      16.955375ms
├─ Worst:     56.543083ms
├─ Completed: 293.589875ms
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.313875ms
├─ Worst:     3.983583ms
├─ Completed: 21.259375ms
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.2045ms
├─ Worst:     3.988125ms
├─ Completed: 18.71125ms
└─ Errors:    0
```
#### posts25k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      12.799208ms
├─ Worst:     63.043125ms
├─ Completed: 312.391ms
└─ Errors:    0
```
#### posts25k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      8.947417ms
├─ Worst:     52.223459ms
├─ Completed: 275.099708ms
└─ Errors:    0
```
#### posts25k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      960.083µs
├─ Worst:     4.30375ms
├─ Completed: 17.576458ms
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      62.276125ms
├─ Worst:     549.977666ms
├─ Completed: 3.05712425s
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      759.042µs
├─ Worst:     7.751875ms
├─ Completed: 31.341417ms
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      77.795084ms
├─ Worst:     207.819375ms
├─ Completed: 1.14449575s
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.010416ms
├─ Worst:     5.300875ms
├─ Completed: 25.4355ms
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      104.845ms
├─ Worst:     321.440958ms
├─ Completed: 1.78203s
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.200084ms
├─ Worst:     6.22725ms
├─ Completed: 26.333666ms
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      392.242333ms
├─ Worst:     1.769592416s
├─ Completed: 9.778187583s
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      3.164375ms
├─ Worst:     17.457208ms
├─ Completed: 94.743333ms
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      893.332583ms
├─ Worst:     5.555934292s
├─ Completed: 29.995622709s
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.976708ms
├─ Worst:     11.17125ms
├─ Completed: 55.825833ms
└─ Errors:    0
```
#### posts50k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.297459ms
├─ Worst:     28.953ms
├─ Completed: 1.545531667s
└─ Errors:    0
```
#### posts50k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      24.483084ms
├─ Worst:     1.28555325s
├─ Completed: 1.287437666s
└─ Errors:    0
```
#### posts50k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      20.537208ms
├─ Worst:     150.5735ms
├─ Completed: 152.349166ms
└─ Errors:    0
```
#### posts50k - mixed read and write (simpleA list with additional 300 concurrent random posts50k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      100.744625ms
├─ Worst:     1.350514042s
├─ Completed: 1.352205959s
└─ Errors:    0
```
#### posts50k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      7.134875ms
├─ Worst:     28.657875ms
├─ Completed: 151.197709ms
└─ Errors:    0
```
#### posts50k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      3.192958ms
├─ Worst:     56.57125ms
├─ Completed: 202.406541ms
└─ Errors:    0
```
#### posts50k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      10.642333ms
├─ Worst:     35.101791ms
├─ Completed: 174.602875ms
└─ Errors:    0
```
#### posts50k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      13.987834ms
├─ Worst:     41.926584ms
├─ Completed: 216.43775ms
└─ Errors:    0
```
#### posts50k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      4.226875ms
├─ Worst:     25.833ms
├─ Completed: 135.034625ms
└─ Errors:    0
```
#### posts50k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      55.514916ms
├─ Worst:     160.67ms
├─ Completed: 971.391625ms
└─ Errors:    0
```
#### posts50k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.295334ms
├─ Worst:     4.376375ms
├─ Completed: 21.341834ms
└─ Errors:    0
```
#### posts50k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      603.541µs
├─ Worst:     3.939167ms
├─ Completed: 18.562167ms
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      51.179ms
├─ Worst:     164.187708ms
├─ Completed: 895.286083ms
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.210875ms
├─ Worst:     4.586583ms
├─ Completed: 20.707584ms
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.062667ms
├─ Worst:     3.21325ms
├─ Completed: 16.955584ms
└─ Errors:    0
```
#### posts50k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      18.759583ms
├─ Worst:     170.969959ms
├─ Completed: 938.114875ms
└─ Errors:    0
```
#### posts50k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      12.211459ms
├─ Worst:     101.165917ms
├─ Completed: 556.187333ms
└─ Errors:    0
```
#### posts50k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      940.875µs
├─ Worst:     3.563708ms
├─ Completed: 17.596291ms
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      220.256416ms
├─ Worst:     1.318233792s
├─ Completed: 7.245242292s
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.943875ms
├─ Worst:     7.178083ms
├─ Completed: 31.825333ms
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      56.90725ms
├─ Worst:     525.476375ms
├─ Completed: 2.893402916s
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      941.208µs
├─ Worst:     5.580833ms
├─ Completed: 24.273584ms
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      298.90675ms
├─ Worst:     763.542875ms
├─ Completed: 4.23397575s
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.204083ms
├─ Worst:     5.277333ms
├─ Completed: 22.218792ms
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      1.21519625s
├─ Worst:     3.728964625s
├─ Completed: 20.850494291s
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.762583ms
├─ Worst:     16.326666ms
├─ Completed: 80.875375ms
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      2.395169s
├─ Worst:     10.960718s
├─ Completed: 60.277896458s
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      3.181334ms
├─ Worst:     13.597375ms
├─ Completed: 58.546ms
└─ Errors:    0
```
#### posts100k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      2.301959ms
├─ Worst:     55.362209ms
├─ Completed: 2.78481025s
└─ Errors:    0
```
#### posts100k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      36.355167ms
├─ Worst:     2.409111792s
├─ Completed: 2.410671167s
└─ Errors:    0
```
#### posts100k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      20.573583ms
├─ Worst:     148.321708ms
├─ Completed: 149.970583ms
└─ Errors:    0
```
#### posts100k - mixed read and write (simpleA list with additional 300 concurrent random posts100k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      175.142583ms
├─ Worst:     2.470603833s
├─ Completed: 2.472345167s
└─ Errors:    0
```
#### posts100k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      6.755542ms
├─ Worst:     51.027333ms
├─ Completed: 269.452333ms
└─ Errors:    0
```
#### posts100k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      11.166375ms
├─ Worst:     50.114208ms
├─ Completed: 275.813167ms
└─ Errors:    0
```
#### posts100k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      6.709333ms
├─ Worst:     56.610042ms
├─ Completed: 291.931709ms
└─ Errors:    0
```
#### posts100k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      21.175375ms
├─ Worst:     53.907042ms
├─ Completed: 316.822834ms
└─ Errors:    0
```
#### posts100k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      6.8855ms
├─ Worst:     45.592333ms
├─ Completed: 245.382209ms
└─ Errors:    0
```
#### posts100k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      111.42825ms
├─ Worst:     708.885292ms
├─ Completed: 2.533968791s
└─ Errors:    0
```
#### posts100k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.187375ms
├─ Worst:     4.294125ms
├─ Completed: 21.667625ms
└─ Errors:    0
```
#### posts100k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      369.042µs
├─ Worst:     3.433375ms
├─ Completed: 18.110916ms
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      128.112ms
├─ Worst:     381.05425ms
├─ Completed: 2.108181417s
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      609.5µs
├─ Worst:     3.669833ms
├─ Completed: 19.738958ms
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      991.875µs
├─ Worst:     3.349875ms
├─ Completed: 17.841708ms
└─ Errors:    0
```
#### posts100k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      99.336416ms
├─ Worst:     434.632875ms
├─ Completed: 2.411563875s
└─ Errors:    0
```
#### posts100k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      65.091125ms
├─ Worst:     396.448333ms
├─ Completed: 2.158812125s
└─ Errors:    0
```
#### posts100k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      749.875µs
├─ Worst:     4.230292ms
├─ Completed: 19.333375ms
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      314.822667ms
├─ Worst:     2.814715292s
├─ Completed: 15.503683792s
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      947.708µs
├─ Worst:     6.765042ms
├─ Completed: 30.499125ms
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      170.650375ms
├─ Worst:     1.039230625s
├─ Completed: 5.762463459s
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.324834ms
├─ Worst:     4.742666ms
├─ Completed: 23.801458ms
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      171.376458ms
├─ Worst:     1.541535916s
├─ Completed: 8.637136125s
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.714292ms
├─ Worst:     6.592709ms
├─ Completed: 28.764083ms
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      1.745823625s
├─ Worst:     7.855140916s
├─ Completed: 43.305852833s
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      3.993291ms
├─ Worst:     17.427708ms
├─ Completed: 94.5ms
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      2.4244705s
├─ Worst:     21.93024675s
├─ Completed: 121.0993815s
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.997166ms
├─ Worst:     10.620375ms
├─ Completed: 56.288625ms
└─ Errors:    0
```

## Go vs JS route execution
#### JS route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      203.116833ms
├─ Worst:     5.047110709s
├─ Completed: 5.083679625s
└─ Errors:    0
```
#### Go route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      624.981166ms
├─ Worst:     4.931561208s
├─ Completed: 4.932015541s
└─ Errors:    0
```
#### JS route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      197.530959ms
├─ Worst:     960.215959ms
├─ Completed: 4.885356833s
└─ Errors:    0
```
#### Go route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      255.3155ms
├─ Worst:     980.831417ms
├─ Completed: 4.934056708s
└─ Errors:    0
```
#### JS route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      9.248042ms
├─ Worst:     14.074417ms
├─ Completed: 5.352820917s
└─ Errors:    0
```
#### Go route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      9.137208ms
├─ Worst:     15.00425ms
├─ Completed: 5.176977166s
└─ Errors:    0
```

## Go vs JS hooks execution
#### JS OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      701.083µs
├─ Worst:     3.7585ms
├─ Completed: 16.189917ms
└─ Errors:    0
```
#### Go OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      911.5µs
├─ Worst:     3.672167ms
├─ Completed: 15.586709ms
└─ Errors:    0
```

## Deleting records
#### deleting 100 posts10k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      687.708µs
├─ Worst:     6.161667ms
├─ Completed: 15.954917ms
└─ Errors:    0
```
#### deleting 100 posts10k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      647.875µs
├─ Worst:     4.324292ms
├─ Completed: 15.935458ms
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      580.25µs
├─ Worst:     2.889875ms
├─ Completed: 13.730916ms
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      419.5µs
├─ Worst:     17.919333ms
├─ Completed: 30.37775ms
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      477.125µs
├─ Worst:     2.148458ms
├─ Completed: 10.683875ms
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      618.125µs
├─ Worst:     2.82825ms
├─ Completed: 12.631708ms
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      302.875µs
├─ Worst:     3.810167ms
├─ Completed: 13.659ms
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      859.75µs
├─ Worst:     3.12025ms
├─ Completed: 14.85075ms
└─ Errors:    0
```
#### deleting 100 users - with cascade deleting all associated posts [conc:10, rule:`""`]
```
┌─ Best:      312.202084ms
├─ Worst:     1.160973125s
├─ Completed: 6.495549792s
└─ Errors:    0
```
#### deleting 100 organizations - with cascade deleting all users and associated posts [conc:10, rule:`""`]
```
┌─ Best:      447.709125ms
├─ Worst:     4.175183458s
├─ Completed: 15.983810709s
└─ Errors:    0
```

---------------------------------------------------
Completed!
