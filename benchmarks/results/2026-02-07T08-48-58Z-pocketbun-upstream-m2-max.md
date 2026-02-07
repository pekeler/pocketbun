# PocketBun Upstream-Port Benchmark Result

- machine: m2-max
- timestamp: 2026-02-07T08:51:21.604Z
- tests: create
## Creating organizations (100)
#### Creating 50 organizations [reqs:50, conc:10, rule:`""`]
```
┌─ Best:      1.374458ms
├─ Worst:     12.652667ms
├─ Completed: 39.902541ms
└─ Errors:    0
```
#### Creating 50 organizations [reqs:50, conc:10, rule:`"@request.body.name != ''"`]
```
┌─ Best:      550.292µs
├─ Worst:     11.416042ms
├─ Completed: 32.24025ms
└─ Errors:    0
```

## Creating permissions (50)
#### Creating 25 permissions [reqs:25, conc:5, rule:`""`]
```
┌─ Best:      716.917µs
├─ Worst:     7.920083ms
├─ Completed: 17.443167ms
└─ Errors:    0
```
#### Creating 25 permissions [reqs:25, conc:5, rule:`"@request.body.name != ''"`]
```
┌─ Best:      865.167µs
├─ Worst:     8.5435ms
├─ Completed: 17.654625ms
└─ Errors:    0
```

## Creating users (500 - expected to be slow due to passwordHash generation)
#### Creating 250 users [reqs:250, conc:50, rule:`""`]
```
┌─ Best:      578.487708ms
├─ Worst:     4.292225459s
├─ Completed: 14.40908s
└─ Errors:    0
```
#### Creating 250 users [reqs:250, conc:50, rule:`"@request.body.email != '' && @request.body.permissions:length > 0"`]
```
┌─ Best:      1.320124333s
├─ Worst:     3.829420959s
├─ Completed: 14.370340125s
└─ Errors:    0
```

## Creating posts (10k, 25k, 50k, 100k)
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`""`]
```
┌─ Best:      28.433583ms
├─ Worst:     295.378375ms
├─ Completed: 2.024634333s
└─ Errors:    0
```
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      44.097334ms
├─ Worst:     391.933166ms
├─ Completed: 2.678427458s
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`""`]
```
┌─ Best:      35.181292ms
├─ Worst:     288.510833ms
├─ Completed: 4.870173584s
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      44.117291ms
├─ Worst:     448.408292ms
├─ Completed: 6.778917792s
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`""`]
```
┌─ Best:      43.88725ms
├─ Worst:     281.663125ms
├─ Completed: 9.984344208s
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      43.808208ms
├─ Worst:     398.70125ms
├─ Completed: 13.508586417s
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`""`]
```
┌─ Best:      34.010708ms
├─ Worst:     295.025708ms
├─ Completed: 19.944934459s
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      52.885542ms
├─ Worst:     391.12475ms
├─ Completed: 26.532161084s
└─ Errors:    0
```

---------------------------------------------------
Completed!
