# PocketBun

[![CI](https://github.com/pekeler/pocketbun/actions/workflows/ci.yml/badge.svg)](https://github.com/pekeler/pocketbun/actions/workflows/ci.yml)

PocketBun is a port of [PocketBase](https://pocketbase.io) to Bun.

> PocketBase is an open source Go backend that includes:
> 
> - embedded database (_SQLite_) with **realtime subscriptions**
> - built-in **files and users management**
> - convenient **Admin dashboard UI**
> - and simple **REST-ish API**
> 
> **For documentation and examples, please visit https://pocketbase.io/docs.**

PocketBase © 2022–present Gani Georgiev. [Project on GitHub](https://github.com/pocketbase/pocketbase).

## Why?

PocketBase is an excellent, well-designed, self-hosted Backend-as-a-Service. You can extend it with Go and JavaScript, but the embedded JS engine has limited ES6/Node compatibility, making complex customizations difficult. Your project may end up with a second backend.

PocketBun is a semi-automated port to Bun that aims for maximum compatibility with PocketBase’s API and behavior. It's a version of PocketBase that feels more native to JS/TS developers.

Key differences:

- Built on Bun instead of Go
- No Go extensions (only JavaScript/TypeScript)
- Full ES6+ compatibility + native npm package support
- CLI binary is named `pocketbun` (not `pocketbase`)
- No `update` command; update via package manager

## Installation

`bun add pocketbun`

## Quick Start

Create a small server script (for example `server.ts`):

```ts
import { BaseApp, serveAsync } from "pocketbun";

const app = new BaseApp({ dataDir: "pb_data" });
await serveAsync(app, { httpAddr: "127.0.0.1:8090" });
```

Run it:

```sh
bun run server.ts
```

Then visit `http://127.0.0.1:8090/_/` for the Admin UI and `http://127.0.0.1:8090/api/health` for a basic API response. See `examples/simple` for a minimal runnable project.

## Examples

- `examples/simple` — minimal server start
- `examples/advanced` — hooks, migrations, auth, CRUD, files, realtime, and custom routes

## Performance

PocketBase is fast for many use cases. PocketBun has been optimized to perform in the same ballpark, but Go (1.25.7) and Bun (1.3.9) are different runtimes, so differences exist.

Depending on the benchmark scenario, **PocketBun is 5.5× faster to 3.1× slower** than PocketBase, with a geometric mean of **1.6× faster**.

Precise comparisons are difficult due to [fluctuating results](https://github.com/pocketbase/benchmarks/issues/8) in the benchmarking suite. PocketBase’s benchmark suite has been run on a Hetzner CCX13 (2 dedicated vCPU, 8 GB RAM) three times for each system and calculated the numbers above from the mean times of those runs.

## Tests

PocketBun keeps upstream test coverage close to PocketBase and adds a small set of PocketBun-specific tests.

Only 2 tests didn't get ported. They are for PocketBase’s self-update command/plugin which doesn't exist in PocketBun.

All tests are passing.

## Known Differences

### Library Usage

PocketBun ships as a library and also provides a CLI wrapper.

```ts
import { BaseApp, migrateAsync, serveAsync, superuser } from "pocketbun";

const app = new BaseApp({ dataDir: "pb_data" });

await migrateAsync(app);
await serveAsync(app, { httpAddr: "127.0.0.1:8090" });

await superuser.upsert(app, "admin@example.com", "change-me");
```

CLI usage (pocketbase-style):

```sh
pocketbun serve
pocketbun superuser upsert admin@example.com change-me
```

### Async API Extensions

PocketBun keeps sync APIs where PocketBase exposes sync behavior, but adds async alternatives for I/O-heavy operations.

Current extensions:

- Archive helpers now expose both sync and async variants:
  - sync: `Create`, `Extract`
  - async: `CreateAsync`, `ExtractAsync`
- Template registry now exposes async filesystem loading variants:
  - sync: `registry.LoadFiles(...)`, `registry.LoadFS(...)`
  - async: `await registry.LoadFilesAsync(...)`, `await registry.LoadFSAsync(...)`
- Base app bootstrap now exposes an async startup variant:
  - sync: `app.bootstrap()`
  - async: `await app.bootstrapAsync()`
- Base app restart now exposes an async variant:
  - sync: `app.Restart()`
  - async: `await app.RestartAsync()`
- Migration helper now exposes an async startup variant:
  - sync: `migrate(app, mode)`
  - async: `await migrateAsync(app, mode)`
- Serve helper now exposes an async startup variant:
  - sync: `serve(app, config)`
  - async: `await serveAsync(app, config)`
- Base app filesystem factory now exposes async variants:
  - sync: `app.NewFilesystem()`, `app.NewBackupsFilesystem()`
  - async: `await app.NewFilesystemAsync()`, `await app.NewBackupsFilesystemAsync()`
- Filesystem readers now expose a non-buffering async variant:
  - sync: `await fsys.GetReader(...)` (buffered `SystemReader`)
  - async: `await fsys.GetReaderAsync(...)` (streaming `SystemAsyncReader`)
- JSVM plugin registration now exposes async startup variants:
  - sync: `RegisterJSVM(...)`, `MustRegisterJSVM(...)`
  - async: `await RegisterJSVMAsync(...)`, `await MustRegisterJSVMAsync(...)`
- JSVM `$filesystem` and `$os` bindings expose async I/O helpers:
  - sync: `$filesystem.fileFromPath(...)`, `$filesystem.fileFromURL(...)`, `$os.readFile(...)`, `$os.writeFile(...)`, ...
  - async: `await $filesystem.fileFromPathAsync(...)`, `await $filesystem.fileFromURLAsync(...)`, `await $os.readFileAsync(...)`, `await $os.writeFileAsync(...)`, ...
- JSVM `$http` binding exposes an async request helper:
  - sync: `$http.send(...)`
  - async: `await $http.sendAsync(...)`
- Field value validation supports an async extension method for custom fields:
  - PocketBase-compatible sync API: `ValidateValue(...)`
  - PocketBun async extension: `async ValidateValueAsync(...)`
  - Optional strict marker: `RequiresAsyncValidation = true` (or method form `RequiresAsyncValidation()`)
  - Used by async model paths (`await app.Validate(...)`, `await app.Save(...)`)
  - If `RequiresAsyncValidation` is `true`, sync model paths fail fast with a validation error

Example: custom webhook URL field that does non-blocking reachability checks in async flows:

```ts
import { toStringValue } from "../internal/compat/cast.ts";
import { newError } from "../internal/compat/validation.ts";
import type { App } from "./app.ts";
import type { RecordLike } from "./field.ts";
import { TextField } from "./field_text.ts";

class WebhookUrlField extends TextField {
  // Enforce full validation through async app APIs only.
  RequiresAsyncValidation = true;

  async ValidateValueAsync(ctx: unknown, app: App, record: RecordLike): Promise<Error | null> {
    const value = toStringValue(record.GetRaw(this.Name));
    const baseErr = this.ValidatePlainValue(value);
    if (baseErr || value === "") {
      return baseErr;
    }

    // Async-only extra check: verify the webhook endpoint responds.
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      const response = await fetch(value, { method: "HEAD", signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) {
        return newError("validation_webhook_unreachable", "Webhook URL must be reachable.");
      }
    } catch {
      return newError("validation_webhook_unreachable", "Webhook URL must be reachable.");
    }

    return null;
  }
}
```

Use it with async model APIs:

```ts
const err = await app.Validate(record); // runs ValidateValueAsync when available
```

If you call sync model APIs while `RequiresAsyncValidation` is `true`, validation fails:

```ts
const err = app.ValidateSync(record); // -> "This field requires async validation..."
```

Example:

```ts
import {
  BaseApp,
  CreateAsync,
  ExtractAsync,
  NewRegistry,
  RegisterJSVMAsync,
  migrateAsync,
  serveAsync,
} from "pocketbun";

await CreateAsync("pb_data", "/tmp/pb_backup.zip", "backups");
await ExtractAsync("/tmp/pb_backup.zip", "/tmp/pb_restore");

const registry = NewRegistry();
const renderer = await registry.LoadFilesAsync("views/base.html", "views/content.html");
const html = renderer.Render({ title: "Hello" });

const app = new BaseApp({ dataDir: "pb_data" });
await app.bootstrapAsync();
await migrateAsync(app, "app");
await RegisterJSVMAsync(app, {});
const fsys = await app.NewFilesystemAsync();
await fsys.Close();

const server = await serveAsync(app, { httpAddr: "127.0.0.1:8090" });
server.stop(true);
```

### CLI Updates

PocketBun does not ship the PocketBase `update` command. Because PocketBun is distributed as a package, update it via your package manager instead (`bun update pocketbun`).

### Activity Logs

PocketBun persists activity logs via a background worker to avoid blocking Bun’s main thread. We also skip wrapping each log batch in an explicit transaction because it didn’t improve throughput in Bun; logs are still inserted one-by-one like PocketBase.

### Thumbnails

PocketBun uses [Sharp](https://sharp.pixelplumbing.com) for image resizing. Output bytes may differ from PocketBase’s Go imaging stack, and BMP thumbnails are emitted as PNG because Sharp doesn’t write BMP.

### Templates ($template)

PocketBun exposes the same `$template` helper for JS/TS hooks/migrations. By default it handles a small, common subset of Go-style templates. If you want closer Go `text/template` compatibility, install the optional `go-text-template` package and `$template` will use it automatically. HTML escaping is basic; use the `raw` helper when you need unescaped output. If you want full control or a different syntax, use any JS templating library.

Example using a JS/TS-native templating engine in hooks:

```ts
import Handlebars from "handlebars";

const source = await Bun.file("email.html").text();
const tpl = Handlebars.compile(source);
const html = tpl({ name: "Ada" });
```

Example enabling Go-style template syntax:

```sh
bun add go-text-template
```

```ts
const tpl = $template.load("templates/welcome.html");
const html = tpl.render({ Name: "Ada" });
```

### SQL Query Helpers and Placeholders

PocketBun exposes SQL rewrite helpers so you can write queries with `[[column]]` and `{{table}}` markers and run them on `bun:sqlite`.

```ts
import { DbxDatabase, attachDbxRewrite, rewriteDbxIdentifiers } from "pocketbun";
import { Database } from "bun:sqlite";

const db = new DbxDatabase("pb_data/data.db");
db.query("select [[id]] from {{users}}").all();

const externalDb = new Database(":memory:");
attachDbxRewrite(externalDb);
externalDb.query("select [[id]] from {{users}}").all();

const sql = rewriteDbxIdentifiers("select [[name]] from {{users}}");
```

PocketBase SQL logs often show dbx-style placeholders like `{:p0}`, `{:p1}`, ...
`bun:sqlite` uses SQLite placeholders (`?`, `?1`, `:name`, `@name`, `$name`).

PocketBun keeps query behavior compatible, but it may remove params that became unnecessary (for example when a filter collapses to a literal). So if you inspect logged SQL/params, placeholder numbering can differ while results stay the same.

Example:

PocketBun will inline the empty string:

```
[[title]] = '' OR [[title]] IS NULL
```

PocketBase may still keep an unused placeholder param:

```
[[title]] = {:p0} OR [[title]] IS NULL
```
