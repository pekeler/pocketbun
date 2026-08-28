# PocketBun Upstream-Port Benchmark Result

- machine: hetzner-2vcpu-pocketbun-2
- timestamp: 2026-08-27T18:08:50.719Z
- tests: create,auth,search,custom,delete
- benchmark source: 05625dc2b2d3f9711c51566010944b10ca9531fa
- server workers: 2
- load generator: http://load-generator:19231
- benchmark target host: application-host
- warmup request target/cap: 1000
## Creating organizations (100)
#### Creating 50 organizations [reqs:50, conc:10, rule:`""`]
```
┌─ Best:      747.211µs
├─ Worst:     13.021579ms
├─ Completed: 23.494369ms
├─ Workers:   0=26 1=24
└─ Errors:    0
```
#### Creating 50 organizations [reqs:50, conc:10, rule:`"@request.body.name != ''"`]
```
┌─ Best:      1.611404ms
├─ Worst:     8.097473ms
├─ Completed: 24.928168ms
├─ Workers:   0=25 1=25
└─ Errors:    0
```

## Creating permissions (50)
#### Creating 25 permissions [reqs:25, conc:5, rule:`""`]
```
┌─ Best:      749.274µs
├─ Worst:     4.271525ms
├─ Completed: 11.194517ms
├─ Workers:   0=7 1=18
└─ Errors:    0
```
#### Creating 25 permissions [reqs:25, conc:5, rule:`"@request.body.name != ''"`]
```
┌─ Best:      1.346357ms
├─ Worst:     4.497085ms
├─ Completed: 14.669633ms
├─ Workers:   0=4 1=21
└─ Errors:    0
```

## Creating users (500 - expected to be slow due to passwordHash generation)
#### Creating 250 users [reqs:250, conc:50, rule:`""`]
```
┌─ Best:      98.541588ms
├─ Worst:     4.371301698s
├─ Completed: 8.146063963s
├─ Workers:   0=101 1=149
└─ Errors:    0
```
#### Creating 250 users [reqs:250, conc:50, rule:`"@request.body.email != '' && @request.body.permissions:length > 0"`]
```
┌─ Best:      134.992818ms
├─ Worst:     4.862948536s
├─ Completed: 8.140699718s
├─ Workers:   0=126 1=124
└─ Errors:    0
```

## Creating posts (10k, 25k, 50k, 100k)
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`""`]
```
┌─ Best:      12.060022ms
├─ Worst:     520.946671ms
├─ Completed: 1.008220776s
├─ Workers:   0=2195 1=2805
└─ Errors:    0
```
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      4.356883ms
├─ Worst:     469.765936ms
├─ Completed: 1.216826134s
├─ Workers:   0=2672 1=2328
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`""`]
```
┌─ Best:      15.228655ms
├─ Worst:     426.259772ms
├─ Completed: 2.23653204s
├─ Workers:   0=5652 1=6848
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      14.562935ms
├─ Worst:     455.535389ms
├─ Completed: 2.874608029s
├─ Workers:   0=6109 1=6391
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`""`]
```
┌─ Best:      4.006079ms
├─ Worst:     545.187761ms
├─ Completed: 3.973366881s
├─ Workers:   0=13333 1=11667
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      13.145319ms
├─ Worst:     529.711195ms
├─ Completed: 5.37688965s
├─ Workers:   0=13829 1=11171
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`""`]
```
┌─ Best:      1.382457ms
├─ Worst:     698.741041ms
├─ Completed: 7.471562516s
├─ Workers:   0=21068 1=28932
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      3.917105ms
├─ Worst:     568.459015ms
├─ Completed: 10.430055147s
├─ Workers:   0=27987 1=22013
└─ Errors:    0
```

## User auth with password (expected to be slow due to passwordHash verification)
#### users auth with email/pass - high concurrency [reqs:250, conc:250]
```
┌─ Best:      116.044691ms
├─ Worst:     8.054815203s
├─ Completed: 8.055070425s
├─ Workers:   0=139 1=111
└─ Errors:    0
```
#### users auth with email/pass - small concurrency [reqs:250, conc:10]
```
┌─ Best:      69.634318ms
├─ Worst:     1.100928304s
├─ Completed: 8.089236533s
├─ Workers:   0=142 1=108
└─ Errors:    0
```

## User auth refresh
#### users - auth refresh (high concurrency) [reqs:1000, conc:1000]
```
┌─ Best:      26.082422ms
├─ Worst:     133.424415ms
├─ Completed: 136.02231ms
├─ Workers:   0=472 1=528
└─ Errors:    0
```
#### users - auth refresh (medium concurrency) [reqs:1000, conc:100]
```
┌─ Best:      307.565µs
├─ Worst:     42.846554ms
├─ Completed: 147.735131ms
├─ Workers:   0=583 1=417
└─ Errors:    0
```

## List records
#### users - getOne for auth refresh comparison (medium concurrency) [reqs:1000, conc:100, rule:`""`, query:`/cfpmsz43k005o8w`]
```
┌─ Best:      332.98µs
├─ Worst:     33.085145ms
├─ Completed: 128.592918ms
├─ Workers:   0=455 1=545
└─ Errors:    0
```
#### users - getOne for auth refresh comparison (high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`/cfpmsz43k005o8w`]
```
┌─ Best:      20.890467ms
├─ Worst:     114.452545ms
├─ Completed: 116.057329ms
├─ Workers:   0=507 1=493
└─ Errors:    0
```
#### posts10k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      669.734µs
├─ Worst:     4.338427ms
├─ Completed: 860.202855ms
├─ Workers:   0=504 1=496
└─ Errors:    0
```
#### posts10k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      21.396545ms
├─ Worst:     463.157916ms
├─ Completed: 464.551219ms
├─ Workers:   0=500 1=500
└─ Errors:    0
```
#### posts10k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      27.957259ms
├─ Worst:     268.247128ms
├─ Completed: 270.336731ms
├─ Workers:   0=483 1=517
└─ Errors:    0
```
#### posts10k - mixed read and write (simpleA list with additional 300 concurrent random posts10k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      54.069931ms
├─ Worst:     488.341249ms
├─ Completed: 489.666657ms
├─ Workers:   0=482 1=518
└─ Errors:    0
```
#### posts10k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.458222ms
├─ Worst:     26.361035ms
├─ Completed: 106.525335ms
├─ Workers:   0=27 1=73
└─ Errors:    0
```
#### posts10k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      2.054896ms
├─ Worst:     42.685381ms
├─ Completed: 135.231606ms
├─ Workers:   0=50 1=50
└─ Errors:    0
```
#### posts10k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      1.811439ms
├─ Worst:     34.321921ms
├─ Completed: 131.517973ms
├─ Workers:   0=74 1=26
└─ Errors:    0
```
#### posts10k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      2.255052ms
├─ Worst:     44.592634ms
├─ Completed: 172.012682ms
├─ Workers:   0=57 1=43
└─ Errors:    0
```
#### posts10k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      990.166µs
├─ Worst:     15.390758ms
├─ Completed: 76.693469ms
├─ Workers:   0=45 1=55
└─ Errors:    0
```
#### posts10k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.279886ms
├─ Worst:     50.352882ms
├─ Completed: 153.840706ms
├─ Workers:   0=47 1=53
└─ Errors:    0
```
#### posts10k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      901.634µs
├─ Worst:     8.854779ms
├─ Completed: 53.323973ms
├─ Workers:   0=47 1=53
└─ Errors:    0
```
#### posts10k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.090095ms
├─ Worst:     9.591826ms
├─ Completed: 54.386899ms
├─ Workers:   0=47 1=53
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      8.58812ms
├─ Worst:     49.288814ms
├─ Completed: 149.036147ms
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      580.061µs
├─ Worst:     6.421201ms
├─ Completed: 27.996482ms
├─ Workers:   0=46 1=54
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      619.325µs
├─ Worst:     10.152991ms
├─ Completed: 52.199259ms
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts10k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      10.251657ms
├─ Worst:     51.999084ms
├─ Completed: 162.317824ms
├─ Workers:   0=47 1=53
└─ Errors:    0
```
#### posts10k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      2.595862ms
├─ Worst:     47.840515ms
├─ Completed: 166.319055ms
├─ Workers:   0=70 1=30
└─ Errors:    0
```
#### posts10k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.103112ms
├─ Worst:     10.085658ms
├─ Completed: 56.774893ms
├─ Workers:   0=26 1=74
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      21.628735ms
├─ Worst:     198.909738ms
├─ Completed: 1.12309211s
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      839.648µs
├─ Worst:     11.997005ms
├─ Completed: 64.740264ms
├─ Workers:   0=74 1=26
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      8.742274ms
├─ Worst:     103.557619ms
├─ Completed: 501.730884ms
├─ Workers:   0=57 1=43
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      663.345µs
├─ Worst:     9.396276ms
├─ Completed: 56.041593ms
├─ Workers:   0=45 1=55
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      45.580258ms
├─ Worst:     93.541358ms
├─ Completed: 586.782248ms
├─ Workers:   0=46 1=54
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      709.368µs
├─ Worst:     10.418066ms
├─ Completed: 58.686772ms
├─ Workers:   0=47 1=53
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      101.921162ms
├─ Worst:     452.331348ms
├─ Completed: 3.300598146s
├─ Workers:   0=47 1=53
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.907271ms
├─ Worst:     22.738527ms
├─ Completed: 108.323116ms
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      198.851557ms
├─ Worst:     1.197151205s
├─ Completed: 10.087311293s
├─ Workers:   0=46 1=54
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      3.612847ms
├─ Worst:     14.527717ms
├─ Completed: 83.47603ms
├─ Workers:   0=47 1=53
└─ Errors:    0
```
#### posts25k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.017776ms
├─ Worst:     5.918808ms
├─ Completed: 1.193605843s
├─ Workers:   0=511 1=489
└─ Errors:    0
```
#### posts25k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      24.894942ms
├─ Worst:     761.161076ms
├─ Completed: 763.044596ms
├─ Workers:   0=512 1=488
└─ Errors:    0
```
#### posts25k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      27.03729ms
├─ Worst:     320.04898ms
├─ Completed: 321.721948ms
├─ Workers:   0=501 1=499
└─ Errors:    0
```
#### posts25k - mixed read and write (simpleA list with additional 300 concurrent random posts25k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      68.560757ms
├─ Worst:     793.104416ms
├─ Completed: 794.621499ms
├─ Workers:   0=500 1=500
└─ Errors:    0
```
#### posts25k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.929984ms
├─ Worst:     29.530268ms
├─ Completed: 122.66761ms
├─ Workers:   0=31 1=69
└─ Errors:    0
```
#### posts25k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      2.127586ms
├─ Worst:     36.303465ms
├─ Completed: 143.792762ms
├─ Workers:   0=47 1=53
└─ Errors:    0
```
#### posts25k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      2.544631ms
├─ Worst:     33.644866ms
├─ Completed: 157.029357ms
├─ Workers:   0=67 1=33
└─ Errors:    0
```
#### posts25k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      2.736015ms
├─ Worst:     40.864008ms
├─ Completed: 192.755176ms
├─ Workers:   0=50 1=50
└─ Errors:    0
```
#### posts25k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      4.461136ms
├─ Worst:     23.998795ms
├─ Completed: 103.684644ms
├─ Workers:   0=46 1=54
└─ Errors:    0
```
#### posts25k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      17.576865ms
├─ Worst:     74.31665ms
├─ Completed: 249.995591ms
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### posts25k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.098626ms
├─ Worst:     12.644769ms
├─ Completed: 53.621713ms
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts25k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.014019ms
├─ Worst:     10.664165ms
├─ Completed: 57.228481ms
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      10.656456ms
├─ Worst:     74.623433ms
├─ Completed: 252.358903ms
├─ Workers:   0=50 1=50
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      888.857µs
├─ Worst:     8.990986ms
├─ Completed: 54.83656ms
├─ Workers:   0=47 1=53
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.537873ms
├─ Worst:     11.112564ms
├─ Completed: 52.911974ms
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts25k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      33.650994ms
├─ Worst:     93.179575ms
├─ Completed: 480.451884ms
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts25k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      8.236047ms
├─ Worst:     77.850125ms
├─ Completed: 415.068063ms
├─ Workers:   0=74 1=26
└─ Errors:    0
```
#### posts25k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      834.582µs
├─ Worst:     10.084018ms
├─ Completed: 54.649556ms
├─ Workers:   0=31 1=69
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      105.938253ms
├─ Worst:     358.064489ms
├─ Completed: 3.035333858s
├─ Workers:   0=46 1=54
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      729.207µs
├─ Worst:     16.256757ms
├─ Completed: 69.108581ms
├─ Workers:   0=68 1=32
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      36.881802ms
├─ Worst:     201.729712ms
├─ Completed: 1.257980263s
├─ Workers:   0=50 1=50
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      966.443µs
├─ Worst:     11.173182ms
├─ Completed: 56.123741ms
├─ Workers:   0=45 1=55
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      75.343368ms
├─ Worst:     188.837488ms
├─ Completed: 1.45580216s
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      664.068µs
├─ Worst:     9.290904ms
├─ Completed: 56.666168ms
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      161.070043ms
├─ Worst:     1.492136486s
├─ Completed: 8.132820415s
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.670836ms
├─ Worst:     11.757407ms
├─ Completed: 70.859318ms
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      421.613607ms
├─ Worst:     4.703313668s
├─ Completed: 24.498680381s
├─ Workers:   0=48 1=52
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      996.836µs
├─ Worst:     19.045235ms
├─ Completed: 78.437076ms
├─ Workers:   0=47 1=53
└─ Errors:    0
```
#### posts50k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.825419ms
├─ Worst:     8.813133ms
├─ Completed: 2.093053394s
├─ Workers:   0=508 1=492
└─ Errors:    0
```
#### posts50k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      24.361984ms
├─ Worst:     1.366512056s
├─ Completed: 1.36933342s
├─ Workers:   0=507 1=493
└─ Errors:    0
```
#### posts50k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      26.066235ms
├─ Worst:     255.56399ms
├─ Completed: 257.209392ms
├─ Workers:   0=484 1=516
└─ Errors:    0
```
#### posts50k - mixed read and write (simpleA list with additional 300 concurrent random posts50k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      75.496078ms
├─ Worst:     1.392811873s
├─ Completed: 1.394469159s
├─ Workers:   0=484 1=516
└─ Errors:    0
```
#### posts50k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      2.718671ms
├─ Worst:     50.727112ms
├─ Completed: 204.246143ms
├─ Workers:   0=73 1=27
└─ Errors:    0
```
#### posts50k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      3.162835ms
├─ Worst:     44.480861ms
├─ Completed: 209.781163ms
├─ Workers:   0=59 1=41
└─ Errors:    0
```
#### posts50k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      3.501903ms
├─ Worst:     47.428659ms
├─ Completed: 207.086534ms
├─ Workers:   0=46 1=54
└─ Errors:    0
```
#### posts50k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      15.148969ms
├─ Worst:     50.330645ms
├─ Completed: 238.983908ms
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts50k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      10.488356ms
├─ Worst:     42.239117ms
├─ Completed: 161.7702ms
├─ Workers:   0=52 1=48
└─ Errors:    0
```
#### posts50k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      75.59231ms
├─ Worst:     167.381905ms
├─ Completed: 1.235845893s
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts50k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.054345ms
├─ Worst:     13.156098ms
├─ Completed: 61.665279ms
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts50k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      775.27µs
├─ Worst:     8.336857ms
├─ Completed: 53.436371ms
├─ Workers:   0=52 1=48
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      76.726255ms
├─ Worst:     167.765503ms
├─ Completed: 1.219108682s
├─ Workers:   0=50 1=50
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      626.545µs
├─ Worst:     9.97695ms
├─ Completed: 45.781507ms
├─ Workers:   0=52 1=48
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      594.571µs
├─ Worst:     9.949152ms
├─ Completed: 54.00826ms
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts50k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      75.221589ms
├─ Worst:     180.185095ms
├─ Completed: 1.354216113s
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts50k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      16.209ms
├─ Worst:     127.234234ms
├─ Completed: 991.72862ms
├─ Workers:   0=14 1=86
└─ Errors:    0
```
#### posts50k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      639.803µs
├─ Worst:     13.235878ms
├─ Completed: 61.824969ms
├─ Workers:   0=72 1=28
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      129.151211ms
├─ Worst:     986.823781ms
├─ Completed: 6.91692521s
├─ Workers:   0=59 1=41
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      728.495µs
├─ Worst:     11.221296ms
├─ Completed: 61.331798ms
├─ Workers:   0=46 1=54
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      112.459292ms
├─ Worst:     361.044561ms
├─ Completed: 3.098880752s
├─ Workers:   0=52 1=48
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      882.908µs
├─ Worst:     9.746641ms
├─ Completed: 56.609871ms
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      94.903653ms
├─ Worst:     434.247343ms
├─ Completed: 3.426229017s
├─ Workers:   0=52 1=48
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      721.115µs
├─ Worst:     8.39693ms
├─ Completed: 56.205443ms
├─ Workers:   0=50 1=50
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      338.050986ms
├─ Worst:     3.307063418s
├─ Completed: 17.343865214s
├─ Workers:   0=52 1=48
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      4.032345ms
├─ Worst:     23.012311ms
├─ Completed: 103.198392ms
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      1.049770889s
├─ Worst:     7.964251672s
├─ Completed: 50.347935488s
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.783762ms
├─ Worst:     14.790552ms
├─ Completed: 80.572583ms
├─ Workers:   0=52 1=48
└─ Errors:    0
```
#### posts100k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      3.192958ms
├─ Worst:     19.36639ms
├─ Completed: 3.547448524s
├─ Workers:   0=498 1=502
└─ Errors:    0
```
#### posts100k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      31.613121ms
├─ Worst:     2.424191409s
├─ Completed: 2.427005342s
├─ Workers:   0=499 1=501
└─ Errors:    0
```
#### posts100k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      26.516176ms
├─ Worst:     270.932201ms
├─ Completed: 272.67732ms
├─ Workers:   0=508 1=492
└─ Errors:    0
```
#### posts100k - mixed read and write (simpleA list with additional 300 concurrent random posts100k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      79.079062ms
├─ Worst:     2.444491559s
├─ Completed: 2.445892143s
├─ Workers:   0=509 1=491
└─ Errors:    0
```
#### posts100k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      5.241995ms
├─ Worst:     70.598999ms
├─ Completed: 315.478864ms
├─ Workers:   0=62 1=38
└─ Errors:    0
```
#### posts100k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      16.838901ms
├─ Worst:     71.004528ms
├─ Completed: 311.994984ms
├─ Workers:   0=50 1=50
└─ Errors:    0
```
#### posts100k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      6.834752ms
├─ Worst:     64.708689ms
├─ Completed: 354.490236ms
├─ Workers:   0=31 1=69
└─ Errors:    0
```
#### posts100k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      24.306227ms
├─ Worst:     64.198275ms
├─ Completed: 363.219053ms
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts100k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      16.472396ms
├─ Worst:     59.549058ms
├─ Completed: 278.726748ms
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts100k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      96.887742ms
├─ Worst:     272.813508ms
├─ Completed: 2.329283041s
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts100k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      725.261µs
├─ Worst:     11.606779ms
├─ Completed: 57.197332ms
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts100k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      632.203µs
├─ Worst:     13.863033ms
├─ Completed: 62.281999ms
├─ Workers:   0=50 1=50
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      101.066609ms
├─ Worst:     295.148814ms
├─ Completed: 2.319114843s
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      1.89111ms
├─ Worst:     8.27431ms
├─ Completed: 55.455468ms
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      737.989µs
├─ Worst:     11.3393ms
├─ Completed: 54.489225ms
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts100k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      102.239176ms
├─ Worst:     303.610653ms
├─ Completed: 2.575164204s
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts100k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      63.979223ms
├─ Worst:     251.064289ms
├─ Completed: 2.12788843s
├─ Workers:   0=52 1=48
└─ Errors:    0
```
#### posts100k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.379754ms
├─ Worst:     11.863543ms
├─ Completed: 59.640754ms
├─ Workers:   0=62 1=38
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      323.511439ms
├─ Worst:     1.66550906s
├─ Completed: 13.714394809s
├─ Workers:   0=50 1=50
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      824.458µs
├─ Worst:     10.428573ms
├─ Completed: 67.854139ms
├─ Workers:   0=30 1=70
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      170.664545ms
├─ Worst:     838.048287ms
├─ Completed: 6.066650489s
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.347109ms
├─ Worst:     11.59263ms
├─ Completed: 63.18852ms
├─ Workers:   0=52 1=48
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      185.929345ms
├─ Worst:     850.34747ms
├─ Completed: 6.686967517s
├─ Workers:   0=50 1=50
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.107579ms
├─ Worst:     13.808288ms
├─ Completed: 56.610592ms
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      686.454692ms
├─ Worst:     6.223887291s
├─ Completed: 34.911858349s
├─ Workers:   0=51 1=49
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.495644ms
├─ Worst:     25.480997ms
├─ Completed: 106.634443ms
├─ Workers:   0=50 1=50
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      2.006125216s
├─ Worst:     18.138758955s
├─ Completed: 100.790254556s
├─ Workers:   0=50 1=50
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.096043ms
├─ Worst:     17.048499ms
├─ Completed: 83.58405ms
├─ Workers:   0=53 1=47
└─ Errors:    0
```

## Go vs JS route execution
#### JS route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      57.83398ms
├─ Worst:     4.136474736s
├─ Completed: 4.137264075s
├─ Workers:   0=250 1=250
└─ Errors:    0
```
#### Go route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      45.03759ms
├─ Worst:     4.104634598s
├─ Completed: 4.105573935s
├─ Workers:   0=250 1=250
└─ Errors:    0
```
#### JS route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      39.781846ms
├─ Worst:     521.235591ms
├─ Completed: 4.169456114s
├─ Workers:   0=250 1=250
└─ Errors:    0
```
#### Go route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      40.549995ms
├─ Worst:     450.426142ms
├─ Completed: 4.073726882s
├─ Workers:   0=250 1=250
└─ Errors:    0
```
#### JS route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      9.822968ms
├─ Worst:     30.146967ms
├─ Completed: 5.754022746s
├─ Workers:   0=250 1=250
└─ Errors:    0
```
#### Go route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      9.370853ms
├─ Worst:     26.33089ms
├─ Completed: 5.552438129s
├─ Workers:   0=250 1=250
└─ Errors:    0
```

## Go vs JS hooks execution
#### JS OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      566.431µs
├─ Worst:     15.787969ms
├─ Completed: 55.512076ms
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### Go OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      553.534µs
├─ Worst:     6.663427ms
├─ Completed: 24.158533ms
├─ Workers:   0=49 1=51
└─ Errors:    0
```

## Deleting records
#### deleting 100 posts10k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      799.073µs
├─ Worst:     9.584599ms
├─ Completed: 49.925566ms
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### deleting 100 posts10k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      893.984µs
├─ Worst:     9.154113ms
├─ Completed: 51.155063ms
├─ Workers:   0=50 1=50
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      779.666µs
├─ Worst:     12.626016ms
├─ Completed: 53.979791ms
├─ Workers:   0=53 1=47
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      741.734µs
├─ Worst:     11.49802ms
├─ Completed: 54.300524ms
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      951.654µs
├─ Worst:     10.518347ms
├─ Completed: 52.663455ms
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      947.528µs
├─ Worst:     10.440859ms
├─ Completed: 53.702658ms
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      759.398µs
├─ Worst:     12.02726ms
├─ Completed: 56.844235ms
├─ Workers:   0=50 1=50
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      467.205µs
├─ Worst:     13.110113ms
├─ Completed: 37.361284ms
├─ Workers:   0=53 1=47
└─ Errors:    0
```
#### deleting 100 users - with cascade deleting all associated posts [conc:10, rule:`""`]
```
┌─ Best:      65.759639ms
├─ Worst:     1.683910718s
├─ Completed: 7.39975837s
├─ Workers:   0=49 1=51
└─ Errors:    0
```
#### deleting 100 organizations - with cascade deleting all users and associated posts [conc:10, rule:`""`]
```
┌─ Best:      130.903919ms
├─ Worst:     4.221034078s
├─ Completed: 17.143674993s
├─ Workers:   0=49 1=51
└─ Errors:    0
```

---------------------------------------------------
Completed!
