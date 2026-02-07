# Upstream PocketBase Benchmark Result

- machine: m2-max
- timestamp: 2026-02-06T23:43:17.474Z
- tests: create
- upstream build target: linux/amd64
- upstream build cgo: 0
- executable used: app-host
## Creating organizations (100)
#### Creating 50 organizations [reqs:50, conc:10, rule:`""`]
```
┌─ Best:      598.5µs
├─ Worst:     3.110125ms
├─ Completed: 6.412417ms
└─ Errors:    0
```
#### Creating 50 organizations [reqs:50, conc:10, rule:`"@request.body.name != ''"`]
```
┌─ Best:      403.166µs
├─ Worst:     6.18725ms
├─ Completed: 8.511125ms
└─ Errors:    0
```

## Creating permissions (50)
#### Creating 25 permissions [reqs:25, conc:5, rule:`""`]
```
┌─ Best:      538.5µs
├─ Worst:     1.553625ms
├─ Completed: 4.130083ms
└─ Errors:    0
```
#### Creating 25 permissions [reqs:25, conc:5, rule:`"@request.body.name != ''"`]
```
┌─ Best:      505.542µs
├─ Worst:     1.73975ms
├─ Completed: 4.273375ms
└─ Errors:    0
```

## Creating users (500 - expected to be slow due to passwordHash generation)
#### Creating 250 users [reqs:250, conc:50, rule:`""`]
```
┌─ Best:      299.203792ms
├─ Worst:     1.3900145s
├─ Completed: 3.366219792s
└─ Errors:    0
```
#### Creating 250 users [reqs:250, conc:50, rule:`"@request.body.email != '' && @request.body.permissions:length > 0"`]
```
┌─ Best:      334.564167ms
├─ Worst:     1.347956584s
├─ Completed: 3.433076292s
└─ Errors:    0
```

## Creating posts (10k, 25k, 50k, 100k)
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`""`]
```
┌─ Best:      355.084µs
├─ Worst:     12.909654875s
├─ Completed: 12.910711292s
└─ Errors:    0
```
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      498.375µs
├─ Worst:     8.640819708s
├─ Completed: 8.641177583s
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`""`]
```
┌─ Best:      329.625µs
├─ Worst:     17.237476583s
├─ Completed: 17.58148425s
└─ Errors:    1183
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      425.041µs
├─ Worst:     19.249397792s
├─ Completed: 21.418712625s
└─ Errors:    1018
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`""`]
```
┌─ Best:      299.459µs
├─ Worst:     21.728094333s
├─ Completed: 46.546520667s
└─ Errors:    2777
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      417.583µs
├─ Worst:     19.268647125s
├─ Completed: 37.639738458s
└─ Errors:    2006
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`""`]
```
┌─ Best:      305.917µs
├─ Worst:     27.636439167s
├─ Completed: 1m31.432289458s
└─ Errors:    5347
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      412.125µs
├─ Worst:     24.23046675s
├─ Completed: 1m27.155212125s
└─ Errors:    4951
```

---------------------------------------------------
Completed!
