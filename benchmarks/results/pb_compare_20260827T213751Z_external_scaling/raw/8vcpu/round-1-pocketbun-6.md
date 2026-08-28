# PocketBun Upstream-Port Benchmark Result

- machine: hetzner-8vcpu-pocketbun-6
- timestamp: 2026-08-27T15:02:33.777Z
- tests: create,auth,search,custom,delete
- benchmark source: 05625dc2b2d3f9711c51566010944b10ca9531fa
- server workers: 6
- load generator: http://load-generator:19231
- benchmark target host: application-host
- warmup request target/cap: 1000
## Creating organizations (100)
#### Creating 50 organizations [reqs:50, conc:10, rule:`""`]
```
┌─ Best:      735.495µs
├─ Worst:     4.102147ms
├─ Completed: 12.333058ms
├─ Workers:   0=6 1=13 2=7 3=8 4=8 5=8
└─ Errors:    0
```
#### Creating 50 organizations [reqs:50, conc:10, rule:`"@request.body.name != ''"`]
```
┌─ Best:      565.131µs
├─ Worst:     4.812178ms
├─ Completed: 11.868865ms
├─ Workers:   1=15 2=6 3=12 4=6 5=11
└─ Errors:    0
```

## Creating permissions (50)
#### Creating 25 permissions [reqs:25, conc:5, rule:`""`]
```
┌─ Best:      661.804µs
├─ Worst:     3.377046ms
├─ Completed: 6.849141ms
├─ Workers:   1=7 2=6 3=6 5=6
└─ Errors:    0
```
#### Creating 25 permissions [reqs:25, conc:5, rule:`"@request.body.name != ''"`]
```
┌─ Best:      792.093µs
├─ Worst:     3.182046ms
├─ Completed: 7.665319ms
├─ Workers:   1=7 2=3 3=8 5=7
└─ Errors:    0
```

## Creating users (500 - expected to be slow due to passwordHash generation)
#### Creating 250 users [reqs:250, conc:50, rule:`""`]
```
┌─ Best:      150.660971ms
├─ Worst:     927.405949ms
├─ Completed: 2.080398325s
├─ Workers:   0=50 1=39 2=44 3=34 4=29 5=54
└─ Errors:    0
```
#### Creating 250 users [reqs:250, conc:50, rule:`"@request.body.email != '' && @request.body.permissions:length > 0"`]
```
┌─ Best:      166.592309ms
├─ Worst:     909.915518ms
├─ Completed: 2.065648519s
├─ Workers:   0=45 1=40 2=56 3=36 4=37 5=36
└─ Errors:    0
```

## Creating posts (10k, 25k, 50k, 100k)
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`""`]
```
┌─ Best:      934.222µs
├─ Worst:     343.460214ms
├─ Completed: 406.079591ms
├─ Workers:   0=819 1=864 2=720 3=889 4=890 5=818
└─ Errors:    0
```
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      21.72319ms
├─ Worst:     195.871137ms
├─ Completed: 620.328355ms
├─ Workers:   0=769 1=835 2=881 3=847 4=789 5=879
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`""`]
```
┌─ Best:      3.978627ms
├─ Worst:     427.598657ms
├─ Completed: 812.26728ms
├─ Workers:   0=2033 1=2212 2=1986 3=2179 4=2022 5=2068
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      533.828µs
├─ Worst:     246.484747ms
├─ Completed: 1.075418721s
├─ Workers:   0=2053 1=1939 2=2232 3=2051 4=2009 5=2216
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`""`]
```
┌─ Best:      6.78195ms
├─ Worst:     303.122119ms
├─ Completed: 1.808395736s
├─ Workers:   0=3903 1=4320 2=4371 3=4335 4=3802 5=4269
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      961.949µs
├─ Worst:     396.14762ms
├─ Completed: 2.048720244s
├─ Workers:   0=3992 1=3894 2=4437 3=4433 4=4114 5=4130
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`""`]
```
┌─ Best:      8.980717ms
├─ Worst:     275.699587ms
├─ Completed: 5.022469021s
├─ Workers:   0=7874 1=8391 2=8774 3=8582 4=7736 5=8643
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      15.022964ms
├─ Worst:     267.173027ms
├─ Completed: 4.339124352s
├─ Workers:   0=8111 1=8384 2=8671 3=8592 4=7797 5=8445
└─ Errors:    0
```

## User auth with password (expected to be slow due to passwordHash verification)
#### users auth with email/pass - high concurrency [reqs:250, conc:250]
```
┌─ Best:      358.062396ms
├─ Worst:     2.025145706s
├─ Completed: 2.025241338s
├─ Workers:   0=51 1=31 2=55 3=32 4=25 5=56
└─ Errors:    0
```
#### users auth with email/pass - small concurrency [reqs:250, conc:10]
```
┌─ Best:      61.474293ms
├─ Worst:     145.037282ms
├─ Completed: 2.105010106s
├─ Workers:   0=50 1=40 2=40 3=39 4=34 5=47
└─ Errors:    0
```

## User auth refresh
#### users - auth refresh (high concurrency) [reqs:1000, conc:1000]
```
┌─ Best:      24.646908ms
├─ Worst:     64.666984ms
├─ Completed: 66.381712ms
├─ Workers:   0=141 1=179 2=172 3=183 4=166 5=159
└─ Errors:    0
```
#### users - auth refresh (medium concurrency) [reqs:1000, conc:100]
```
┌─ Best:      353.088µs
├─ Worst:     18.535946ms
├─ Completed: 70.141056ms
├─ Workers:   0=173 1=166 2=182 3=190 4=130 5=159
└─ Errors:    0
```

## List records
#### users - getOne for auth refresh comparison (medium concurrency) [reqs:1000, conc:100, rule:`""`, query:`/y1uaq3qenbdn80p`]
```
┌─ Best:      369.181µs
├─ Worst:     10.824633ms
├─ Completed: 52.350509ms
├─ Workers:   0=163 1=175 2=185 3=121 4=167 5=189
└─ Errors:    0
```
#### users - getOne for auth refresh comparison (high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`/y1uaq3qenbdn80p`]
```
┌─ Best:      21.884281ms
├─ Worst:     64.271668ms
├─ Completed: 65.715383ms
├─ Workers:   0=138 1=172 2=167 3=195 4=163 5=165
└─ Errors:    0
```
#### posts10k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.256855ms
├─ Worst:     4.700504ms
├─ Completed: 1.630297731s
├─ Workers:   0=160 1=167 2=224 3=147 4=78 5=224
└─ Errors:    0
```
#### posts10k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      24.19883ms
├─ Worst:     164.087048ms
├─ Completed: 165.750076ms
├─ Workers:   0=169 1=169 2=160 3=172 4=171 5=159
└─ Errors:    0
```
#### posts10k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      19.707344ms
├─ Worst:     102.444362ms
├─ Completed: 104.062638ms
├─ Workers:   0=194 1=156 2=136 3=146 4=200 5=168
└─ Errors:    0
```
#### posts10k - mixed read and write (simpleA list with additional 300 concurrent random posts10k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      22.261623ms
├─ Worst:     187.069148ms
├─ Completed: 188.620039ms
├─ Workers:   0=194 1=156 2=137 3=146 4=200 5=167
└─ Errors:    0
```
#### posts10k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.449092ms
├─ Worst:     12.423883ms
├─ Completed: 62.014028ms
├─ Workers:   0=13 1=21 2=25 3=20 4=1 5=20
└─ Errors:    0
```
#### posts10k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      1.49863ms
├─ Worst:     15.209321ms
├─ Completed: 71.018188ms
├─ Workers:   0=7 1=21 2=24 3=17 4=7 5=24
└─ Errors:    0
```
#### posts10k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      1.992823ms
├─ Worst:     18.835881ms
├─ Completed: 75.565099ms
├─ Workers:   0=8 1=16 2=31 3=24 4=8 5=13
└─ Errors:    0
```
#### posts10k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      2.094733ms
├─ Worst:     25.970587ms
├─ Completed: 98.294339ms
├─ Workers:   0=14 1=20 2=24 3=14 4=14 5=14
└─ Errors:    0
```
#### posts10k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.401967ms
├─ Worst:     8.229779ms
├─ Completed: 40.121417ms
├─ Workers:   0=15 1=19 2=21 3=16 4=15 5=14
└─ Errors:    0
```
#### posts10k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      3.656271ms
├─ Worst:     35.331589ms
├─ Completed: 110.569497ms
├─ Workers:   0=14 1=17 2=28 3=13 4=14 5=14
└─ Errors:    0
```
#### posts10k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      813.584µs
├─ Worst:     8.412672ms
├─ Completed: 25.875896ms
├─ Workers:   0=14 1=23 2=21 3=14 4=14 5=14
└─ Errors:    0
```
#### posts10k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      783.342µs
├─ Worst:     6.625453ms
├─ Completed: 25.142493ms
├─ Workers:   0=14 1=16 2=20 3=22 4=14 5=14
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      2.107882ms
├─ Worst:     44.390543ms
├─ Completed: 105.020421ms
├─ Workers:   0=14 1=17 2=21 3=16 4=14 5=18
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      768.711µs
├─ Worst:     6.602811ms
├─ Completed: 23.201051ms
├─ Workers:   0=17 1=20 2=13 3=17 4=17 5=16
└─ Errors:    0
```
#### posts10k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      746.07µs
├─ Worst:     7.064178ms
├─ Completed: 25.713051ms
├─ Workers:   0=19 1=24 3=19 4=19 5=19
└─ Errors:    0
```
#### posts10k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      3.305286ms
├─ Worst:     35.526198ms
├─ Completed: 123.033064ms
├─ Workers:   0=22 1=5 3=30 4=22 5=21
└─ Errors:    0
```
#### posts10k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      1.638943ms
├─ Worst:     39.295315ms
├─ Completed: 117.242165ms
├─ Workers:   0=34 3=1 4=41 5=24
└─ Errors:    0
```
#### posts10k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      980.714µs
├─ Worst:     6.382687ms
├─ Completed: 25.569132ms
├─ Workers:   0=13 1=21 2=25 3=20 4=1 5=20
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      13.412789ms
├─ Worst:     98.502887ms
├─ Completed: 457.032109ms
├─ Workers:   0=7 1=21 2=24 3=16 4=8 5=24
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.140325ms
├─ Worst:     5.873794ms
├─ Completed: 31.667797ms
├─ Workers:   0=8 1=16 2=32 3=24 4=7 5=13
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      5.558569ms
├─ Worst:     56.825832ms
├─ Completed: 224.960753ms
├─ Workers:   0=15 1=21 2=23 3=14 4=14 5=13
└─ Errors:    0
```
#### posts10k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      979.464µs
├─ Worst:     5.818788ms
├─ Completed: 27.901445ms
├─ Workers:   0=14 1=18 2=21 3=17 4=15 5=15
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      8.133136ms
├─ Worst:     77.199168ms
├─ Completed: 300.527844ms
├─ Workers:   0=14 1=18 2=28 3=13 4=14 5=13
└─ Errors:    0
```
#### posts10k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.028129ms
├─ Worst:     9.168536ms
├─ Completed: 29.132795ms
├─ Workers:   0=15 1=22 2=22 3=13 4=14 5=14
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      35.672921ms
├─ Worst:     305.036564ms
├─ Completed: 1.153309544s
├─ Workers:   0=14 1=16 2=19 3=22 4=14 5=15
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.46159ms
├─ Worst:     20.415863ms
├─ Completed: 75.620555ms
├─ Workers:   0=13 1=17 2=22 3=16 4=14 5=18
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      98.333512ms
├─ Worst:     677.869926ms
├─ Completed: 3.157848774s
├─ Workers:   0=18 1=20 2=12 3=17 4=17 5=16
└─ Errors:    0
```
#### posts10k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.659932ms
├─ Worst:     11.534485ms
├─ Completed: 49.040928ms
├─ Workers:   0=19 1=24 3=19 4=19 5=19
└─ Errors:    0
```
#### posts25k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.254984ms
├─ Worst:     7.704584ms
├─ Completed: 2.641126616s
├─ Workers:   0=156 1=158 2=194 3=171 4=150 5=171
└─ Errors:    0
```
#### posts25k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      28.670307ms
├─ Worst:     266.990925ms
├─ Completed: 268.997067ms
├─ Workers:   0=162 1=164 2=159 3=174 4=159 5=182
└─ Errors:    0
```
#### posts25k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      24.510299ms
├─ Worst:     143.947106ms
├─ Completed: 145.646083ms
├─ Workers:   0=166 1=161 2=228 3=151 4=147 5=147
└─ Errors:    0
```
#### posts25k - mixed read and write (simpleA list with additional 300 concurrent random posts25k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      32.633081ms
├─ Worst:     289.121409ms
├─ Completed: 291.70769ms
├─ Workers:   0=167 1=160 2=228 3=151 4=147 5=147
└─ Errors:    0
```
#### posts25k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      1.479454ms
├─ Worst:     23.537336ms
├─ Completed: 83.79586ms
├─ Workers:   0=24 1=10 3=20 4=22 5=24
└─ Errors:    0
```
#### posts25k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      1.87522ms
├─ Worst:     24.011991ms
├─ Completed: 90.493721ms
├─ Workers:   0=17 1=8 2=4 3=23 4=24 5=24
└─ Errors:    0
```
#### posts25k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      2.632247ms
├─ Worst:     23.520362ms
├─ Completed: 109.072248ms
├─ Workers:   0=8 1=30 2=7 3=21 4=8 5=26
└─ Errors:    0
```
#### posts25k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      2.876144ms
├─ Worst:     36.725264ms
├─ Completed: 111.232423ms
├─ Workers:   0=23 1=19 2=13 3=13 4=14 5=18
└─ Errors:    0
```
#### posts25k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.790104ms
├─ Worst:     24.238555ms
├─ Completed: 64.892776ms
├─ Workers:   0=21 1=12 2=15 3=14 4=14 5=24
└─ Errors:    0
```
#### posts25k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      6.283921ms
├─ Worst:     66.629216ms
├─ Completed: 191.439345ms
├─ Workers:   0=22 1=12 2=14 3=13 4=15 5=24
└─ Errors:    0
```
#### posts25k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      940.259µs
├─ Worst:     11.207522ms
├─ Completed: 28.025126ms
├─ Workers:   0=22 1=11 2=13 3=20 4=13 5=21
└─ Errors:    0
```
#### posts25k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      891.612µs
├─ Worst:     7.041918ms
├─ Completed: 25.617168ms
├─ Workers:   0=22 1=11 2=15 3=14 4=14 5=24
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      6.649697ms
├─ Worst:     61.208186ms
├─ Completed: 191.054174ms
├─ Workers:   0=24 1=12 2=14 3=13 4=14 5=23
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      953.638µs
├─ Worst:     8.960218ms
├─ Completed: 28.047646ms
├─ Workers:   0=22 1=14 2=16 3=16 4=16 5=16
└─ Errors:    0
```
#### posts25k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      840.492µs
├─ Worst:     8.032617ms
├─ Completed: 32.55991ms
├─ Workers:   1=21 2=28 3=23 4=28
└─ Errors:    0
```
#### posts25k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      8.618938ms
├─ Worst:     67.143916ms
├─ Completed: 284.790094ms
├─ Workers:   1=27 2=30 3=25 4=18
└─ Errors:    0
```
#### posts25k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      7.199155ms
├─ Worst:     60.160208ms
├─ Completed: 309.369378ms
├─ Workers:   0=1 1=32 2=59 3=7 5=1
└─ Errors:    0
```
#### posts25k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      906.963µs
├─ Worst:     8.403057ms
├─ Completed: 31.940905ms
├─ Workers:   0=24 1=10 3=21 4=22 5=23
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      37.59846ms
├─ Worst:     217.277659ms
├─ Completed: 1.061998562s
├─ Workers:   0=17 1=8 2=4 3=22 4=25 5=24
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.152993ms
├─ Worst:     8.83879ms
├─ Completed: 35.57117ms
├─ Workers:   0=8 1=31 2=7 3=21 4=7 5=26
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      13.108068ms
├─ Worst:     127.24911ms
├─ Completed: 548.818438ms
├─ Workers:   0=23 1=18 2=13 3=14 4=14 5=18
└─ Errors:    0
```
#### posts25k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.047377ms
├─ Worst:     6.986381ms
├─ Completed: 28.863484ms
├─ Workers:   0=20 1=12 2=15 3=14 4=15 5=24
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      19.43634ms
├─ Worst:     194.799216ms
├─ Completed: 673.797541ms
├─ Workers:   0=22 1=12 2=14 3=13 4=14 5=25
└─ Errors:    0
```
#### posts25k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.075947ms
├─ Worst:     4.950319ms
├─ Completed: 26.068442ms
├─ Workers:   0=22 1=11 2=13 3=20 4=14 5=20
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      90.271455ms
├─ Worst:     616.43771ms
├─ Completed: 2.881681742s
├─ Workers:   0=22 1=12 2=15 3=14 4=13 5=24
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.56318ms
├─ Worst:     11.172143ms
├─ Completed: 56.247293ms
├─ Workers:   0=24 1=11 2=15 3=13 4=14 5=23
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      242.435013ms
├─ Worst:     1.424448832s
├─ Completed: 7.212424587s
├─ Workers:   0=22 1=15 2=15 3=15 4=17 5=16
└─ Errors:    0
```
#### posts25k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.619899ms
├─ Worst:     13.268169ms
├─ Completed: 52.982593ms
├─ Workers:   1=21 2=29 3=23 4=27
└─ Errors:    0
```
#### posts50k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      1.904972ms
├─ Worst:     8.589957ms
├─ Completed: 4.868456008s
├─ Workers:   0=160 1=172 2=169 3=171 4=142 5=186
└─ Errors:    0
```
#### posts50k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      23.068097ms
├─ Worst:     453.864243ms
├─ Completed: 456.947062ms
├─ Workers:   0=139 1=185 2=187 3=175 4=159 5=155
└─ Errors:    0
```
#### posts50k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      38.999756ms
├─ Worst:     131.882901ms
├─ Completed: 133.739956ms
├─ Workers:   0=168 1=169 2=144 3=204 4=143 5=172
└─ Errors:    0
```
#### posts50k - mixed read and write (simpleA list with additional 300 concurrent random posts50k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      37.15645ms
├─ Worst:     456.668888ms
├─ Completed: 458.454825ms
├─ Workers:   0=167 1=170 2=145 3=203 4=143 5=172
└─ Errors:    0
```
#### posts50k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      2.255296ms
├─ Worst:     25.016588ms
├─ Completed: 95.462347ms
├─ Workers:   0=14 1=19 2=17 3=19 4=19 5=12
└─ Errors:    0
```
#### posts50k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      2.677108ms
├─ Worst:     24.544367ms
├─ Completed: 131.633896ms
├─ Workers:   0=21 1=28 2=22 4=14 5=15
└─ Errors:    0
```
#### posts50k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      2.485544ms
├─ Worst:     31.296575ms
├─ Completed: 133.899996ms
├─ Workers:   0=5 1=5 2=43 3=5 4=20 5=22
└─ Errors:    0
```
#### posts50k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      3.448323ms
├─ Worst:     26.723708ms
├─ Completed: 115.83495ms
├─ Workers:   0=15 1=23 2=14 3=19 4=15 5=14
└─ Errors:    0
```
#### posts50k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      1.947321ms
├─ Worst:     18.361736ms
├─ Completed: 82.185336ms
├─ Workers:   0=15 1=22 2=15 3=19 4=14 5=15
└─ Errors:    0
```
#### posts50k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      16.510278ms
├─ Worst:     100.338082ms
├─ Completed: 483.369073ms
├─ Workers:   0=14 1=23 2=15 3=19 4=15 5=14
└─ Errors:    0
```
#### posts50k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      922.815µs
├─ Worst:     9.255466ms
├─ Completed: 25.976004ms
├─ Workers:   0=14 1=23 2=14 3=20 4=14 5=15
└─ Errors:    0
```
#### posts50k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      862.962µs
├─ Worst:     11.099924ms
├─ Completed: 29.738733ms
├─ Workers:   0=15 1=22 2=14 3=19 4=15 5=15
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      16.829379ms
├─ Worst:     119.45478ms
├─ Completed: 484.482991ms
├─ Workers:   0=14 1=23 2=15 3=20 4=14 5=14
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      911.029µs
├─ Worst:     6.509142ms
├─ Completed: 25.275887ms
├─ Workers:   0=14 1=22 2=15 3=19 4=15 5=15
└─ Errors:    0
```
#### posts50k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      885.192µs
├─ Worst:     8.940491ms
├─ Completed: 26.484106ms
├─ Workers:   0=18 1=9 2=18 3=22 4=17 5=16
└─ Errors:    0
```
#### posts50k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      17.643614ms
├─ Worst:     103.647424ms
├─ Completed: 507.582832ms
├─ Workers:   0=23 2=25 3=22 4=15 5=15
└─ Errors:    0
```
#### posts50k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      12.239088ms
├─ Worst:     118.225233ms
├─ Completed: 574.849118ms
├─ Workers:   0=24 1=1 2=1 3=19 4=13 5=42
└─ Errors:    0
```
#### posts50k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      899.623µs
├─ Worst:     7.491388ms
├─ Completed: 22.923598ms
├─ Workers:   0=14 1=18 2=18 3=19 4=19 5=12
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      77.260762ms
├─ Worst:     612.445757ms
├─ Completed: 2.573002187s
├─ Workers:   0=20 1=28 2=22 4=15 5=15
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.149698ms
├─ Worst:     6.843865ms
├─ Completed: 37.78667ms
├─ Workers:   0=5 1=6 2=42 3=6 4=19 5=22
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      33.329632ms
├─ Worst:     179.527079ms
├─ Completed: 964.847722ms
├─ Workers:   0=15 1=22 2=14 3=19 4=16 5=14
└─ Errors:    0
```
#### posts50k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      536.751µs
├─ Worst:     6.447257ms
├─ Completed: 24.325195ms
├─ Workers:   0=16 1=22 2=15 3=18 4=13 5=16
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      44.577541ms
├─ Worst:     271.243581ms
├─ Completed: 1.349452064s
├─ Workers:   0=14 1=24 2=15 3=19 4=15 5=13
└─ Errors:    0
```
#### posts50k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      954.659µs
├─ Worst:     7.380195ms
├─ Completed: 28.7024ms
├─ Workers:   0=13 1=23 2=14 3=20 4=15 5=15
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      190.250172ms
├─ Worst:     1.205385885s
├─ Completed: 5.348087097s
├─ Workers:   0=16 1=21 2=14 3=19 4=15 5=15
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.251641ms
├─ Worst:     16.38074ms
├─ Completed: 60.606675ms
├─ Workers:   0=13 1=24 2=15 3=20 4=14 5=14
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      539.022375ms
├─ Worst:     2.62572514s
├─ Completed: 13.844664081s
├─ Workers:   0=14 1=21 2=16 3=19 4=15 5=15
└─ Errors:    0
```
#### posts50k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.775292ms
├─ Worst:     9.379187ms
├─ Completed: 49.632424ms
├─ Workers:   0=19 1=9 2=17 3=23 4=16 5=16
└─ Errors:    0
```
#### posts100k - simpleA (many requests, no rules, no concurrency) [reqs:1000, conc:1, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      3.266883ms
├─ Worst:     29.179279ms
├─ Completed: 8.665197016s
├─ Workers:   0=159 1=166 2=180 3=161 4=155 5=179
└─ Errors:    0
```
#### posts100k - simpleB (many requests, no rules, high concurrency) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      37.367031ms
├─ Worst:     834.660726ms
├─ Completed: 836.604191ms
├─ Workers:   0=162 1=151 2=186 3=164 4=155 5=182
└─ Errors:    0
```
#### posts100k - simpleC (many requests, no rules, high concurrency, skipTotal) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      30.118047ms
├─ Worst:     114.674377ms
├─ Completed: 116.893383ms
├─ Workers:   0=202 1=167 2=140 3=148 4=141 5=202
└─ Errors:    0
```
#### posts100k - mixed read and write (simpleA list with additional 300 concurrent random posts100k updates running in the background) [reqs:1000, conc:1000, rule:`""`, query:`?perPage=20`]
```
┌─ Best:      37.148228ms
├─ Worst:     865.433217ms
├─ Completed: 867.257978ms
├─ Workers:   0=201 1=167 2=140 3=149 4=141 5=202
└─ Errors:    0
```
#### posts100k - expand author [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author`]
```
┌─ Best:      3.637174ms
├─ Worst:     37.007874ms
├─ Completed: 160.357316ms
├─ Workers:   0=4 1=20 2=15 3=24 4=20 5=17
└─ Errors:    0
```
#### posts100k - expand author (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author&fields=id,collectionId,expand.author.id`]
```
┌─ Best:      4.070272ms
├─ Worst:     59.005293ms
├─ Completed: 186.014921ms
├─ Workers:   1=23 2=15 3=28 4=30 5=4
└─ Errors:    0
```
#### posts100k - expand author.permissions [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions`]
```
┌─ Best:      6.257535ms
├─ Worst:     43.844249ms
├─ Completed: 203.983905ms
├─ Workers:   0=8 1=10 2=38 3=21 4=14 5=9
└─ Errors:    0
```
#### posts100k - expand author.permissions (limited fields) [reqs:100, conc:10, rule:`""`, query:`?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id`]
```
┌─ Best:      5.049195ms
├─ Worst:     47.164797ms
├─ Completed: 201.507293ms
├─ Workers:   0=11 1=11 2=12 3=30 4=25 5=11
└─ Errors:    0
```
#### posts100k - simple auth rule [reqs:100, conc:10, rule:`"@request.auth.id != ''"`, query:`?perPage=20`]
```
┌─ Best:      3.406496ms
├─ Worst:     35.683164ms
├─ Completed: 124.339709ms
├─ Workers:   0=12 1=18 2=13 3=22 4=22 5=13
└─ Errors:    0
```
#### posts100k - author check (no index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      35.366117ms
├─ Worst:     189.825004ms
├─ Completed: 831.636027ms
├─ Workers:   0=13 1=16 2=13 3=23 4=22 5=13
└─ Errors:    0
```
#### posts100k - author check (with index) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      937.195µs
├─ Worst:     7.624403ms
├─ Completed: 31.990464ms
├─ Workers:   0=9 1=10 2=37 3=17 4=17 5=10
└─ Errors:    0
```
#### posts100k - author check (with index and skipTotal) [reqs:100, conc:10, rule:`"author = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      655.786µs
├─ Worst:     4.863168ms
├─ Completed: 19.975916ms
├─ Workers:   0=13 1=14 2=13 3=23 4=23 5=14
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (no index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      32.689529ms
├─ Worst:     169.725637ms
├─ Completed: 884.243773ms
├─ Workers:   0=14 1=14 2=14 3=23 4=18 5=17
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20`]
```
┌─ Best:      871.224µs
├─ Worst:     10.971086ms
├─ Completed: 27.16668ms
├─ Workers:   0=18 1=18 2=18 3=11 4=9 5=26
└─ Errors:    0
```
#### posts100k - author.id (extra join) check (with index and skipTotal) [reqs:100, conc:10, rule:`"author.id = @request.auth.id"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      839.78µs
├─ Worst:     10.174405ms
├─ Completed: 31.599433ms
├─ Workers:   0=25 1=26 2=25 5=24
└─ Errors:    0
```
#### posts100k - loose large text search (no index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      33.202528ms
├─ Worst:     168.668057ms
├─ Completed: 1.058437924s
├─ Workers:   0=28 1=30 2=15 5=27
└─ Errors:    0
```
#### posts100k - loose large text search (with index) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20`]
```
┌─ Best:      53.123228ms
├─ Worst:     292.287001ms
├─ Completed: 1.542530846s
├─ Workers:   0=50 1=10 2=1 5=39
└─ Errors:    0
```
#### posts100k - loose large text search (with index and skipTotal) [reqs:100, conc:10, rule:`"description ~ 'ipsum dolor'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      913.772µs
├─ Worst:     7.703643ms
├─ Completed: 26.159407ms
├─ Workers:   0=4 1=20 2=14 3=24 4=20 5=18
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20`]
```
┌─ Best:      167.163508ms
├─ Worst:     1.373835159s
├─ Completed: 5.579353671s
├─ Workers:   1=23 2=15 3=28 4=30 5=4
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, match-all, skipTotal) [reqs:100, conc:10, rule:`"type:each != 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.121269ms
├─ Worst:     9.921586ms
├─ Completed: 39.724517ms
├─ Workers:   0=9 1=9 2=38 3=21 4=15 5=8
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20`]
```
┌─ Best:      68.307074ms
├─ Worst:     624.685905ms
├─ Completed: 2.636169277s
├─ Workers:   0=10 1=11 2=12 3=31 4=25 5=11
└─ Errors:    0
```
#### posts100k - multiple select :each (no index, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"type:each ?!= 'c'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.075707ms
├─ Worst:     5.840889ms
├─ Completed: 25.755419ms
├─ Workers:   0=12 1=18 2=14 3=22 4=21 5=13
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20`]
```
┌─ Best:      91.610226ms
├─ Worst:     437.160057ms
├─ Completed: 2.160968148s
├─ Workers:   0=13 1=17 2=12 3=22 4=23 5=13
└─ Errors:    0
```
#### posts100k - nested single relations lookup (no indexes, skipTotal) [reqs:100, conc:10, rule:`"author.organization.name != 'test'"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      893.005µs
├─ Worst:     8.308368ms
├─ Completed: 34.793376ms
├─ Workers:   0=10 1=9 2=38 3=17 4=16 5=10
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20`]
```
┌─ Best:      409.140408ms
├─ Worst:     2.49014289s
├─ Completed: 11.52998526s
├─ Workers:   0=13 1=15 2=12 3=23 4=23 5=14
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, match-all, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active = true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      2.2654ms
├─ Worst:     11.739227ms
├─ Completed: 61.796378ms
├─ Workers:   0=13 1=13 2=15 3=23 4=18 5=18
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20`]
```
┌─ Best:      978.995177ms
├─ Worst:     6.856771436s
├─ Completed: 30.485596317s
├─ Workers:   0=18 1=19 2=18 3=11 4=9 5=25
└─ Errors:    0
```
#### posts100k - nested multiple relations lookup (no indexes, at-least-one, skipTotal) [reqs:100, conc:10, rule:`"author.permissions.active ?= true"`, query:`?perPage=20&skipTotal=1`]
```
┌─ Best:      1.553235ms
├─ Worst:     14.102552ms
├─ Completed: 60.240349ms
├─ Workers:   0=25 1=26 2=25 5=24
└─ Errors:    0
```

## Go vs JS route execution
#### JS route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      47.927069ms
├─ Worst:     1.182565759s
├─ Completed: 1.184077509s
├─ Workers:   0=92 1=91 2=82 3=73 4=65 5=97
└─ Errors:    0
```
#### Go route (high concurrency) [reqs:500, conc:500]
```
┌─ Best:      26.735053ms
├─ Worst:     1.335127688s
├─ Completed: 1.336230682s
├─ Workers:   0=57 1=71 2=89 3=115 4=108 5=60
└─ Errors:    0
```
#### JS route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      9.732005ms
├─ Worst:     311.945809ms
├─ Completed: 1.309816311s
├─ Workers:   0=85 1=86 2=100 3=78 4=56 5=95
└─ Errors:    0
```
#### Go route (medium concurrency) [reqs:500, conc:50]
```
┌─ Best:      8.710673ms
├─ Worst:     286.055944ms
├─ Completed: 1.166344693s
├─ Workers:   0=91 1=91 2=68 3=57 4=80 5=113
└─ Errors:    0
```
#### JS route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      7.811611ms
├─ Worst:     27.263973ms
├─ Completed: 10.151605703s
├─ Workers:   0=66 1=83 2=91 3=121 4=91 5=48
└─ Errors:    0
```
#### Go route (no concurrency) [reqs:500, conc:1]
```
┌─ Best:      7.913513ms
├─ Worst:     31.91605ms
├─ Completed: 10.33934072s
├─ Workers:   0=77 1=76 2=108 3=73 4=59 5=107
└─ Errors:    0
```

## Go vs JS hooks execution
#### JS OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      856.303µs
├─ Worst:     15.913234ms
├─ Completed: 31.567729ms
├─ Workers:   0=22 1=26 2=6 3=6 4=13 5=27
└─ Errors:    0
```
#### Go OnRecordBeforeUpdateRequest hook handler - [reqs:100, conc:10]
```
┌─ Best:      860.959µs
├─ Worst:     11.956507ms
├─ Completed: 27.048215ms
├─ Workers:   0=14 1=21 2=15 3=14 4=14 5=22
└─ Errors:    0
```

## Deleting records
#### deleting 100 posts10k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      608.85µs
├─ Worst:     36.730201ms
├─ Completed: 55.631822ms
├─ Workers:   0=27 1=13 2=8 3=8 4=23 5=21
└─ Errors:    0
```
#### deleting 100 posts10k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      741.715µs
├─ Worst:     11.710637ms
├─ Completed: 34.631962ms
├─ Workers:   0=14 1=17 2=17 3=14 4=23 5=15
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      731.47µs
├─ Worst:     12.560943ms
├─ Completed: 34.44179ms
├─ Workers:   0=14 1=23 2=23 3=17 4=23
└─ Errors:    0
```
#### deleting 100 posts25k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      757.387µs
├─ Worst:     11.298139ms
├─ Completed: 48.915556ms
├─ Workers:   0=1 1=3 2=20 3=56 4=19 5=1
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      745.93µs
├─ Worst:     12.170003ms
├─ Completed: 30.776736ms
├─ Workers:   0=14 1=20 2=15 3=15 4=22 5=14
└─ Errors:    0
```
#### deleting 100 posts50k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      803.75µs
├─ Worst:     10.048663ms
├─ Completed: 32.36469ms
├─ Workers:   0=22 1=21 2=17 3=19 4=4 5=17
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, no rule) [conc:10, rule:`""`]
```
┌─ Best:      704.433µs
├─ Worst:     11.249331ms
├─ Completed: 33.599958ms
├─ Workers:   0=23 1=19 2=20 3=7 4=7 5=24
└─ Errors:    0
```
#### deleting 100 posts100k - simple (no cascade, with rule) [conc:10, rule:`"@request.auth.id != ''"`]
```
┌─ Best:      788.66µs
├─ Worst:     35.553135ms
├─ Completed: 48.124592ms
├─ Workers:   0=18 1=15 2=14 3=15 4=14 5=24
└─ Errors:    0
```
#### deleting 100 users - with cascade deleting all associated posts [conc:10, rule:`""`]
```
┌─ Best:      67.220262ms
├─ Worst:     4.270582196s
├─ Completed: 8.780493736s
├─ Workers:   0=7 1=10 2=35 3=23 4=9 5=16
└─ Errors:    0
```
#### deleting 100 organizations - with cascade deleting all users and associated posts [conc:10, rule:`""`]
```
┌─ Best:      4.178803ms
├─ Worst:     9.634426051s
├─ Completed: 19.066912276s
├─ Workers:   0=14 1=15 2=22 3=14 4=14 5=21
└─ Errors:    0
```

---------------------------------------------------
Completed!
