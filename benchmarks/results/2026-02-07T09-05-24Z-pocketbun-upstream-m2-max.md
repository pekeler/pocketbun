# PocketBun Upstream-Port Benchmark Result

- machine: m2-max
- timestamp: 2026-02-07T09:19:59.701Z
- tests: create,auth,search,custom,delete
## Creating organizations (100)
#### Creating 50 organizations [reqs:50, conc:10, rule:`""`]
```
┌─ Best:      1.07875ms
├─ Worst:     14.28075ms
├─ Completed: 34.240625ms
└─ Errors:    0
```
#### Creating 50 organizations [reqs:50, conc:10, rule:`"@request.body.name != ''"`]
```
┌─ Best:      2.076ms
├─ Worst:     10.522917ms
├─ Completed: 29.55575ms
└─ Errors:    0
```

## Creating permissions (50)
#### Creating 25 permissions [reqs:25, conc:5, rule:`""`]
```
┌─ Best:      522.417µs
├─ Worst:     4.344375ms
├─ Completed: 14.882916ms
└─ Errors:    0
```
#### Creating 25 permissions [reqs:25, conc:5, rule:`"@request.body.name != ''"`]
```
┌─ Best:      727.25µs
├─ Worst:     6.394916ms
├─ Completed: 15.869834ms
└─ Errors:    0
```

## Creating users (500 - expected to be slow due to passwordHash generation)
#### Creating 250 users [reqs:250, conc:50, rule:`""`]
```
┌─ Best:      578.187917ms
├─ Worst:     4.505499416s
├─ Completed: 14.556940708s
└─ Errors:    0
```
#### Creating 250 users [reqs:250, conc:50, rule:`"@request.body.email != '' && @request.body.permissions:length > 0"`]
```
┌─ Best:      1.106022416s
├─ Worst:     4.215710291s
├─ Completed: 14.722354541s
└─ Errors:    0
```

## Creating posts (10k, 25k, 50k, 100k)
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`""`]
```
┌─ Best:      35.48325ms
├─ Worst:     318.548625ms
├─ Completed: 2.081929541s
└─ Errors:    0
```
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      43.811ms
├─ Worst:     453.764417ms
├─ Completed: 2.745607417s
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`""`]
```
┌─ Best:      32.064584ms
├─ Worst:     282.307375ms
├─ Completed: 4.949760542s
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      40.7885ms
├─ Worst:     394.133417ms
├─ Completed: 6.797211708s
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`""`]
```
┌─ Best:      31.252667ms
├─ Worst:     298.884916ms
├─ Completed: 10.096475208s
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      43.145167ms
├─ Worst:     390.696708ms
├─ Completed: 13.488765625s
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`""`]
```
┌─ Best:      32.076ms
├─ Worst:     294.035792ms
├─ Completed: 20.238407958s
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      40.705958ms
├─ Worst:     437.605875ms
├─ Completed: 27.247006041s
└─ Errors:    0
```

## User auth with password (expected to be slow due to passwordHash verification)
#### users auth with email/pass - high concurrency [reqs:250, conc:250]
```
┌─ Best:      119.497583ms
├─ Worst:     1.695059125s
├─ Completed: 1.695541959s
└─ Errors:    0
```
#### users auth with email/pass - small concurrency [reqs:250, conc:10]
```
┌─ Best:      60.396542ms
├─ Worst:     85.42075ms
├─ Completed: 1.798358541s
└─ Errors:    0
```

## User auth refresh
#### users - auth refresh (high concurrency) [reqs:1000, conc:1000]
```
┌─ Best:      13.93425ms
├─ Worst:     123.104292ms
├─ Completed: 127.146583ms
└─ Errors:    0
```
#### users - auth refresh (medium concurrency) [reqs:1000, conc:100]
```
┌─ Best:      3.969958ms
├─ Worst:     30.076166ms
├─ Completed: 121.039208ms
└─ Errors:    0
```

## List records
#### users - getOne for auth refresh comparison (medium concurrency) [reqs:1000, conc:100, rule:`""`, query:`/egty16fj2scgexf`]
```
┌─ Best:      5.027375ms
├─ Worst:     30.629166ms
├─ Completed: 123.547792ms
└─ Errors:    0
```
#### users - getOne for auth refresh comparison (high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`/egty16fj2scgexf`]
```
┌─ Best:      10.789584ms
├─ Worst:     106.630792ms
├─ Completed: 109.964916ms
└─ Errors:    0
```
#### posts10k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      405.708µs
├─ Worst:     7.708458ms
├─ Completed: 516.854333ms
└─ Errors:    0
```
#### posts10k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      27.073375ms
├─ Worst:     424.830625ms
├─ Completed: 428.4025ms
└─ Errors:    0
```
#### posts10k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      15.314959ms
├─ Worst:     206.272834ms
├─ Completed: 209.282125ms
└─ Errors:    0
```
#### posts10k - mixed read and write (simpleA list with additional 300 concurrent random posts10k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      33.872792ms
├─ Worst:     511.073667ms
├─ Completed: 515.589792ms
└─ Errors:    0
```
#### posts10k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      2.276834ms
├─ Worst:     11.129959ms
├─ Completed: 66.312625ms
└─ Errors:    0
```
#### posts10k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      4.215625ms
├─ Worst:     14.714583ms
├─ Completed: 89.958167ms
└─ Errors:    0
```
#### posts10k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      3.902875ms
├─ Worst:     17.374667ms
├─ Completed: 89.762417ms
└─ Errors:    0
```
#### posts10k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      5.3625ms
├─ Worst:     20.494583ms
├─ Completed: 126.308292ms
└─ Errors:    0
```
#### posts10k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.325292ms
├─ Worst:     8.104958ms
├─ Completed: 47.379958ms
└─ Errors:    0
```
#### posts10k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      3.400916ms
├─ Worst:     34.167542ms
├─ Completed: 175.447917ms
└─ Errors:    0
```
#### posts10k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      773.958µs
├─ Worst:     3.965375ms
├─ Completed: 26.159125ms
└─ Errors:    0
```
#### posts10k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.262417ms
├─ Worst:     4.866625ms
├─ Completed: 29.822292ms
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      5.640834ms
├─ Worst:     28.74875ms
├─ Completed: 156.519209ms
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      758.584µs
├─ Worst:     4.383334ms
├─ Completed: 30.162583ms
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      734.708µs
├─ Worst:     3.965375ms
├─ Completed: 25.054875ms
└─ Errors:    0
```
#### posts10k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      7.274666ms
├─ Worst:     23.926583ms
├─ Completed: 153.830208ms
└─ Errors:    0
```
#### posts10k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      4.249666ms
├─ Worst:     20.697042ms
├─ Completed: 135.243833ms
└─ Errors:    0
```
#### posts10k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      922.417µs
├─ Worst:     5.219583ms
├─ Completed: 28.024125ms
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      29.916875ms
├─ Worst:     213.273416ms
├─ Completed: 1.221081875s
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.435083ms
├─ Worst:     7.2075ms
├─ Completed: 42.6925ms
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      12.013625ms
├─ Worst:     80.768417ms
├─ Completed: 511.805416ms
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.379709ms
├─ Worst:     6.954333ms
├─ Completed: 36.315625ms
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      24.070333ms
├─ Worst:     131.42025ms
├─ Completed: 774.134042ms
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.546709ms
├─ Worst:     5.995375ms
├─ Completed: 36.159459ms
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      149.077083ms
├─ Worst:     557.195458ms
├─ Completed: 3.694398917s
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.736166ms
├─ Worst:     17.951584ms
├─ Completed: 113.349708ms
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      361.648542ms
├─ Worst:     1.331599875s
├─ Completed: 12.11456175s
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.879167ms
├─ Worst:     10.521666ms
├─ Completed: 66.260584ms
└─ Errors:    0
```
#### posts25k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      639.667µs
├─ Worst:     15.457417ms
├─ Completed: 851.720209ms
└─ Errors:    0
```
#### posts25k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      14.307375ms
├─ Worst:     627.474916ms
├─ Completed: 631.654125ms
└─ Errors:    0
```
#### posts25k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      20.161292ms
├─ Worst:     201.929583ms
├─ Completed: 203.210875ms
└─ Errors:    0
```
#### posts25k - mixed read and write (simpleA list with additional 300 concurrent random posts25k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      50.811208ms
├─ Worst:     757.62325ms
├─ Completed: 761.719959ms
└─ Errors:    0
```
#### posts25k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      2.585167ms
├─ Worst:     16.223334ms
├─ Completed: 93.253625ms
└─ Errors:    0
```
#### posts25k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      5.707917ms
├─ Worst:     19.302625ms
├─ Completed: 110.669666ms
└─ Errors:    0
```
#### posts25k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      2.140208ms
├─ Worst:     57.5905ms
├─ Completed: 174.616375ms
└─ Errors:    0
```
#### posts25k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      4.197958ms
├─ Worst:     28.628917ms
├─ Completed: 159.254875ms
└─ Errors:    0
```
#### posts25k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      2.077416ms
├─ Worst:     11.769667ms
├─ Completed: 69.556958ms
└─ Errors:    0
```
#### posts25k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      8.356791ms
├─ Worst:     67.373042ms
├─ Completed: 368.5715ms
└─ Errors:    0
```
#### posts25k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.256209ms
├─ Worst:     5.9755ms
├─ Completed: 33.375792ms
└─ Errors:    0
```
#### posts25k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      813.916µs
├─ Worst:     5.447583ms
├─ Completed: 30.781916ms
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      6.236542ms
├─ Worst:     68.225083ms
├─ Completed: 362.023625ms
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.312875ms
├─ Worst:     6.436125ms
├─ Completed: 28.701541ms
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      985.292µs
├─ Worst:     5.266875ms
├─ Completed: 30.581583ms
└─ Errors:    0
```
#### posts25k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      6.780458ms
├─ Worst:     62.088ms
├─ Completed: 338.44675ms
└─ Errors:    0
```
#### posts25k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      9.108958ms
├─ Worst:     48.437708ms
├─ Completed: 311.48325ms
└─ Errors:    0
```
#### posts25k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      780.167µs
├─ Worst:     4.881709ms
├─ Completed: 28.687875ms
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      65.808709ms
├─ Worst:     588.039459ms
├─ Completed: 3.253485333s
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      671.917µs
├─ Worst:     7.3525ms
├─ Completed: 43.776292ms
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      27.089834ms
├─ Worst:     243.7845ms
├─ Completed: 1.26206675s
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      801.583µs
├─ Worst:     6.246459ms
├─ Completed: 32.335209ms
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      56.39375ms
├─ Worst:     366.699666ms
├─ Completed: 1.97914775s
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      788.458µs
├─ Worst:     6.968791ms
├─ Completed: 36.005625ms
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      190.813584ms
├─ Worst:     1.250004458s
├─ Completed: 9.642765416s
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.786875ms
├─ Worst:     16.599667ms
├─ Completed: 118.369791ms
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      352.6505ms
├─ Worst:     5.6911225s
├─ Completed: 30.06070675s
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.651666ms
├─ Worst:     13.4555ms
├─ Completed: 70.403875ms
└─ Errors:    0
```
#### posts50k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.378625ms
├─ Worst:     31.882917ms
├─ Completed: 1.669755667s
└─ Errors:    0
```
#### posts50k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      22.212125ms
├─ Worst:     1.384182s
├─ Completed: 1.387948083s
└─ Errors:    0
```
#### posts50k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      19.93725ms
├─ Worst:     214.18375ms
├─ Completed: 218.829334ms
└─ Errors:    0
```
#### posts50k - mixed read and write (simpleA list with additional 300 concurrent random posts50k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      102.890625ms
├─ Worst:     1.50435s
├─ Completed: 1.508772833s
└─ Errors:    0
```
#### posts50k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      4.401166ms
├─ Worst:     33.289667ms
├─ Completed: 168.880917ms
└─ Errors:    0
```
#### posts50k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      3.68375ms
├─ Worst:     34.106125ms
├─ Completed: 190.1095ms
└─ Errors:    0
```
#### posts50k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      7.071084ms
├─ Worst:     29.123042ms
├─ Completed: 187.944625ms
└─ Errors:    0
```
#### posts50k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      10.940958ms
├─ Worst:     44.166791ms
├─ Completed: 231.583583ms
└─ Errors:    0
```
#### posts50k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      6.744084ms
├─ Worst:     23.600625ms
├─ Completed: 150.017375ms
└─ Errors:    0
```
#### posts50k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      25.04175ms
├─ Worst:     219.924834ms
├─ Completed: 1.266351416s
└─ Errors:    0
```
#### posts50k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      640.959µs
├─ Worst:     6.036917ms
├─ Completed: 31.543667ms
└─ Errors:    0
```
#### posts50k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      671.792µs
├─ Worst:     4.2155ms
├─ Completed: 24.109375ms
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      57.713459ms
├─ Worst:     171.672834ms
├─ Completed: 1.101479208s
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.160958ms
├─ Worst:     5.079834ms
├─ Completed: 31.861625ms
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      952.25µs
├─ Worst:     5.747167ms
├─ Completed: 28.737ms
└─ Errors:    0
```
#### posts50k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      20.977291ms
├─ Worst:     205.575333ms
├─ Completed: 1.087219209s
└─ Errors:    0
```
#### posts50k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      13.828917ms
├─ Worst:     114.513542ms
├─ Completed: 646.121416ms
└─ Errors:    0
```
#### posts50k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.05ms
├─ Worst:     4.506834ms
├─ Completed: 27.298792ms
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      308.400792ms
├─ Worst:     1.224555791s
├─ Completed: 7.664336583s
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.691875ms
├─ Worst:     5.545ms
├─ Completed: 34.5045ms
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      60.160791ms
├─ Worst:     561.67275ms
├─ Completed: 3.101131167s
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.0465ms
├─ Worst:     5.271875ms
├─ Completed: 34.081708ms
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      90.273917ms
├─ Worst:     549.09475ms
├─ Completed: 4.548435958s
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      860.5µs
├─ Worst:     5.903958ms
├─ Completed: 33.775ms
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      208.143625ms
├─ Worst:     2.266500166s
├─ Completed: 20.574010125s
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      4.002667ms
├─ Worst:     17.7305ms
├─ Completed: 112.5665ms
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      1.202903208s
├─ Worst:     10.275597708s
├─ Completed: 60.631013375s
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.587333ms
├─ Worst:     9.878958ms
├─ Completed: 67.008791ms
└─ Errors:    0
```
#### posts100k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      2.446875ms
├─ Worst:     42.753917ms
├─ Completed: 3.095657666s
└─ Errors:    0
```
#### posts100k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      38.119709ms
├─ Worst:     2.655219667s
├─ Completed: 2.659194333s
└─ Errors:    0
```
#### posts100k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      20.775917ms
├─ Worst:     207.785375ms
├─ Completed: 211.960708ms
└─ Errors:    0
```
#### posts100k - mixed read and write (simpleA list with additional 300 concurrent random posts100k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      175.429708ms
├─ Worst:     2.752654291s
├─ Completed: 2.756906792s
└─ Errors:    0
```
#### posts100k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      9.213083ms
├─ Worst:     46.888958ms
├─ Completed: 294.898ms
└─ Errors:    0
```
#### posts100k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      21.763542ms
├─ Worst:     51.784834ms
├─ Completed: 309.380833ms
└─ Errors:    0
```
#### posts100k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      8.296958ms
├─ Worst:     62.05275ms
├─ Completed: 323.89ms
└─ Errors:    0
```
#### posts100k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      4.74325ms
├─ Worst:     59.664583ms
├─ Completed: 353.919ms
└─ Errors:    0
```
#### posts100k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      7.465084ms
├─ Worst:     44.097ms
├─ Completed: 283.077ms
└─ Errors:    0
```
#### posts100k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      26.230041ms
├─ Worst:     275.218541ms
├─ Completed: 2.484260041s
└─ Errors:    0
```
#### posts100k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      592.292µs
├─ Worst:     5.709875ms
├─ Completed: 32.032084ms
└─ Errors:    0
```
#### posts100k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      675.084µs
├─ Worst:     4.607208ms
├─ Completed: 25.4485ms
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      47.942916ms
├─ Worst:     430.733541ms
├─ Completed: 2.381505875s
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      721.25µs
├─ Worst:     5.276708ms
├─ Completed: 28.678917ms
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      520.042µs
├─ Worst:     6.397417ms
├─ Completed: 27.411583ms
└─ Errors:    0
```
#### posts100k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      135.357708ms
├─ Worst:     282.530583ms
├─ Completed: 2.737125709s
└─ Errors:    0
```
#### posts100k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      220.457667ms
├─ Worst:     265.793042ms
├─ Completed: 2.282659s
└─ Errors:    0
```
#### posts100k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      744.375µs
├─ Worst:     4.444208ms
├─ Completed: 28.431875ms
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      163.822625ms
├─ Worst:     1.904260125s
├─ Completed: 15.902629166s
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.197416ms
├─ Worst:     5.856292ms
├─ Completed: 41.0905ms
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      180.329667ms
├─ Worst:     660.319ms
├─ Completed: 5.987353625s
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      890.708µs
├─ Worst:     4.897584ms
├─ Completed: 33.12325ms
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      89.866583ms
├─ Worst:     1.141472292s
├─ Completed: 8.878232667s
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      543.459µs
├─ Worst:     5.528416ms
├─ Completed: 33.160583ms
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      826.493125ms
├─ Worst:     7.566798083s
├─ Completed: 42.054673625s
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      5.4565ms
├─ Worst:     19.445709ms
├─ Completed: 110.806375ms
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      4.881619791s
├─ Worst:     18.117379666s
├─ Completed: 120.668356292s
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.69575ms
├─ Worst:     12.77925ms
├─ Completed: 66.018541ms
└─ Errors:    0
```

## Go vs JS route execution
#### JS route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      108.52025ms
├─ Worst:     5.270283125s
├─ Completed: 5.27134425s
└─ Errors:    0
```
#### Go route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      660.3535ms
├─ Worst:     5.068392667s
├─ Completed: 5.069449709s
└─ Errors:    0
```
#### JS route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      117.219542ms
├─ Worst:     653.476791ms
├─ Completed: 5.2114535s
└─ Errors:    0
```
#### Go route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      138.934583ms
├─ Worst:     928.933958ms
├─ Completed: 5.215875625s
└─ Errors:    0
```
#### JS route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      9.54975ms
├─ Worst:     14.783167ms
├─ Completed: 5.620207208s
└─ Errors:    0
```
#### Go route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      9.646833ms
├─ Worst:     13.877208ms
├─ Completed: 5.650991792s
└─ Errors:    0
```

## Go vs JS hooks execution
#### JS OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      645.542µs
├─ Worst:     11.267125ms
├─ Completed: 51.227458ms
└─ Errors:    0
```
#### Go OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      636.834µs
├─ Worst:     10.355084ms
├─ Completed: 50.851042ms
└─ Errors:    0
```

## Deleting records
#### deleting 100 posts10k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      435.917µs
├─ Worst:     6.187417ms
├─ Completed: 26.847167ms
└─ Errors:    0
```
#### deleting 100 posts10k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      853.125µs
├─ Worst:     4.0725ms
├─ Completed: 23.529584ms
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      761.792µs
├─ Worst:     3.594333ms
├─ Completed: 21.612833ms
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      772.458µs
├─ Worst:     16.970042ms
├─ Completed: 35.006708ms
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      416.083µs
├─ Worst:     3.425125ms
├─ Completed: 20.812166ms
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      561.5µs
├─ Worst:     3.585792ms
├─ Completed: 20.858541ms
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      510.5µs
├─ Worst:     3.388167ms
├─ Completed: 19.074041ms
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      466.708µs
├─ Worst:     3.262042ms
├─ Completed: 21.321125ms
└─ Errors:    0
```
#### deleting 100 users - with cascade deleting all associated posts [conc:10, rule:`""`]
```
┌─ Best:      56.828041ms
├─ Worst:     1.305575458s
├─ Completed: 6.793500875s
└─ Errors:    0
```
#### deleting 100 organizations - with cascade deleting all users and associated posts [conc:10, rule:`""`]
```
┌─ Best:      280.912875ms
├─ Worst:     4.324472s
├─ Completed: 16.845526375s
└─ Errors:    0
```

---------------------------------------------------
Completed!
