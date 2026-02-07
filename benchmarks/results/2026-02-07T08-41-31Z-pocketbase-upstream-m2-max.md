# Upstream PocketBase Benchmark Result

- machine: m2-max
- timestamp: 2026-02-07T08:42:31.598Z
- tests: create
- upstream build target: linux/amd64
- upstream build cgo: 0
- executable used: app-host
## Creating organizations (100)
#### Creating 50 organizations [reqs:50, conc:10, rule:`""`]
```
┌─ Best:      232.667µs
├─ Worst:     2.718ms
├─ Completed: 4.668625ms
└─ Errors:    0
```
#### Creating 50 organizations [reqs:50, conc:10, rule:`"@request.body.name != ''"`]
```
┌─ Best:      284.5µs
├─ Worst:     4.938792ms
├─ Completed: 5.968125ms
└─ Errors:    0
```

## Creating permissions (50)
#### Creating 25 permissions [reqs:25, conc:5, rule:`""`]
```
┌─ Best:      206.334µs
├─ Worst:     1.230875ms
├─ Completed: 2.313209ms
└─ Errors:    0
```
#### Creating 25 permissions [reqs:25, conc:5, rule:`"@request.body.name != ''"`]
```
┌─ Best:      242µs
├─ Worst:     916.209µs
├─ Completed: 2.10525ms
└─ Errors:    0
```

## Creating users (500 - expected to be slow due to passwordHash generation)
#### Creating 250 users [reqs:250, conc:50, rule:`""`]
```
┌─ Best:      225.869042ms
├─ Worst:     1.648650791s
├─ Completed: 3.432605208s
└─ Errors:    0
```
#### Creating 250 users [reqs:250, conc:50, rule:`"@request.body.email != '' && @request.body.permissions:length > 0"`]
```
┌─ Best:      351.054333ms
├─ Worst:     1.086930584s
├─ Completed: 3.469819333s
└─ Errors:    0
```

## Creating posts (10k, 25k, 50k, 100k)
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`""`]
```
┌─ Best:      185.792µs
├─ Worst:     262.016083ms
├─ Completed: 387.028417ms
└─ Errors:    0
```
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      349.625µs
├─ Worst:     356.044167ms
├─ Completed: 488.302792ms
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`""`]
```
┌─ Best:      171.125µs
├─ Worst:     303.552917ms
├─ Completed: 843.370042ms
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      334.291µs
├─ Worst:     410.291708ms
├─ Completed: 1.195476417s
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`""`]
```
┌─ Best:      190.167µs
├─ Worst:     433.133458ms
├─ Completed: 1.950624917s
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      273µs
├─ Worst:     604.628125ms
├─ Completed: 2.466211625s
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`""`]
```
┌─ Best:      174.75µs
├─ Worst:     397.640583ms
├─ Completed: 3.781472334s
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      292.292µs
├─ Worst:     567.177667ms
├─ Completed: 5.238383583s
└─ Errors:    0
```

---------------------------------------------------
Completed!
