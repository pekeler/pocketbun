# Upstream PocketBase Benchmark Result

- machine: m2-max
- timestamp: 2026-02-06T23:46:20.509Z
- tests: create
- upstream build target: linux/amd64
- upstream build cgo: 0
- executable used: app-host
## Creating organizations (100)
#### Creating 50 organizations [reqs:50, conc:10, rule:`""`]
```
┌─ Best:      225.958µs
├─ Worst:     3.705625ms
├─ Completed: 4.797458ms
└─ Errors:    0
```
#### Creating 50 organizations [reqs:50, conc:10, rule:`"@request.body.name != ''"`]
```
┌─ Best:      276.25µs
├─ Worst:     5.364584ms
├─ Completed: 5.707791ms
└─ Errors:    0
```

## Creating permissions (50)
#### Creating 25 permissions [reqs:25, conc:5, rule:`""`]
```
┌─ Best:      274µs
├─ Worst:     1.121375ms
├─ Completed: 2.486833ms
└─ Errors:    0
```
#### Creating 25 permissions [reqs:25, conc:5, rule:`"@request.body.name != ''"`]
```
┌─ Best:      263.791µs
├─ Worst:     975µs
├─ Completed: 2.468083ms
└─ Errors:    0
```

## Creating users (500 - expected to be slow due to passwordHash generation)
#### Creating 250 users [reqs:250, conc:50, rule:`""`]
```
┌─ Best:      181.08175ms
├─ Worst:     1.610204917s
├─ Completed: 3.397109083s
└─ Errors:    0
```
#### Creating 250 users [reqs:250, conc:50, rule:`"@request.body.email != '' && @request.body.permissions:length > 0"`]
```
┌─ Best:      332.959333ms
├─ Worst:     1.04324925s
├─ Completed: 3.396400375s
└─ Errors:    0
```

## Creating posts (10k, 25k, 50k, 100k)
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`""`]
```
┌─ Best:      221µs
├─ Worst:     271.487042ms
├─ Completed: 397.483667ms
└─ Errors:    0
```
#### Creating 5000 posts10k [reqs:5000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      317.625µs
├─ Worst:     370.806042ms
├─ Completed: 486.510792ms
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`""`]
```
┌─ Best:      183.833µs
├─ Worst:     304.314584ms
├─ Completed: 835.470916ms
└─ Errors:    0
```
#### Creating 12500 posts25k [reqs:12500, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      275.208µs
├─ Worst:     392.190625ms
├─ Completed: 1.207322208s
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`""`]
```
┌─ Best:      161.417µs
├─ Worst:     336.676625ms
├─ Completed: 1.770161125s
└─ Errors:    0
```
#### Creating 25000 posts50k [reqs:25000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      324.75µs
├─ Worst:     541.080708ms
├─ Completed: 2.564991583s
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`""`]
```
┌─ Best:      182.041µs
├─ Worst:     418.249167ms
├─ Completed: 3.839869875s
└─ Errors:    0
```
#### Creating 50000 posts100k [reqs:50000, conc:500, rule:`"@request.auth.id != '' && @request.body.public:isset = true"`]
```
┌─ Best:      298.75µs
├─ Worst:     603.859375ms
├─ Completed: 5.239410708s
└─ Errors:    0
```

---------------------------------------------------
Completed!
