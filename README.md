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
> **Start with PocketBun docs:** [`docs/index.md`](./docs/index.md)  
> **Supplemental upstream reference:** <https://pocketbase.io/docs/>

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

## Warning
PocketBase is still under active development and NOT recommended for production.

Naturally, the same applies to PocketBun.

## Installation

`bun add pocketbun` to add to an existing project, or `bun create pocketbun my-app` to create a new project.

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

Then visit `http://127.0.0.1:8090/_/` for the Admin UI and `http://127.0.0.1:8090/api/health` for a basic API response.

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

## Differences

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

### CLI Default Directories

PocketBase resolves default directories relative to the executable location. PocketBun intentionally resolves CLI defaults from the current working directory to avoid writing project data into `node_modules` or wrapper-script directories.

In practice, default paths are:

- `./pb_data`
- `./pb_hooks` and `./pb_migrations` (derived from `pb_data` unless `--hooksDir`/`--migrationsDir` are set)
- `./pb_public` (unless `--publicDir` is set)

### Hooks Plugin Naming

PocketBase names this plugin package `jsvm`, so PocketBun keeps compatibility aliases: `RegisterJSVM*` / `MustRegisterJSVM*`.
In PocketBun app code, prefer the clearer names `RegisterHooksPlugin*` / `MustRegisterHooksPlugin*` for the same hooks/migrations integration APIs.

### Async API Extensions

PocketBun keeps sync APIs where PocketBase exposes sync behavior, but adds async alternatives for I/O-heavy operations.

| Area | PocketBase-compatible sync API | PocketBun async extension |
| --- | --- | --- |
| Archive helpers | `Create`, `Extract` | `CreateAsync`, `ExtractAsync` |
| Template registry loading | `registry.LoadFiles(...)`, `registry.LoadFS(...)` | `registry.LoadFilesAsync(...)`, `registry.LoadFSAsync(...)` |
| App bootstrap | `app.bootstrap()` | `app.bootstrapAsync()` |
| App restart | `app.Restart()` | `app.RestartAsync()` |
| Migration helper | `migrate(app, mode)` | `migrateAsync(app, mode)` |
| Serve helper | `serve(app, config)` | `serveAsync(app, config)` |
| Filesystem factories | `app.NewFilesystem()`, `app.NewBackupsFilesystem()` | `app.NewFilesystemAsync()`, `app.NewBackupsFilesystemAsync()` |
| Filesystem readers | `fsys.GetReader(...)` (buffered `SystemReader`) | `fsys.GetReaderAsync(...)` (streaming `SystemAsyncReader`) |
| Hooks/migrations plugin registration | `RegisterHooksPlugin(...)`, `MustRegisterHooksPlugin(...)` | `RegisterHooksPluginAsync(...)`, `MustRegisterHooksPluginAsync(...)` |
| JSVM `$filesystem` and `$os` | `$filesystem.fileFromPath(...)`, `$filesystem.fileFromURL(...)`, `$os.readFile(...)`, `$os.writeFile(...)`, ... | `$filesystem.fileFromPathAsync(...)`, `$filesystem.fileFromURLAsync(...)`, `$os.readFileAsync(...)`, `$os.writeFileAsync(...)`, ... |
| JSVM `$http` | `$http.send(...)` | `$http.sendAsync(...)` |
| Field validation extension | `ValidateValue(...)` | `async ValidateValueAsync(...)` |

For field validation, you can mark a field as async-only with `RequiresAsyncValidation = true` (or `RequiresAsyncValidation()`). Async model paths (`await app.Validate(...)`, `await app.Save(...)`) run `ValidateValueAsync(...)`; sync model paths fail fast with a validation error when async validation is required.

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
  RegisterHooksPluginAsync,
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
await RegisterHooksPluginAsync(app, {});
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

PocketBun exposes the same `$template` helper for JS/TS hooks/migrations. The built-in parser handles the common Go-style patterns used by PocketBase templates (includes, pipelines, function calls, and literal values). For closer end-to-end Go `text/template` behavior, install the optional `go-text-template` package and `$template` will use it automatically. HTML escaping is basic; use the `raw` helper when you need unescaped output. If you want full control or a different syntax, use any JS templating library.

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

### Regex Autogeneration

PocketBun's `randomStringByRegex` is tuned for PocketBase autogenerate patterns and common regex constructs (`[]`, groups/alternation, quantifiers, `\d/\w/\s` and their inverse forms). Extremely advanced regex syntax may still differ from Go's full regexp parser.

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

## Development Setup

If you want to contribute after cloning from GitHub:

```sh
bun install
bun run upstream:sync
bun run format:fix
bun test --concurrent
bun run typecheck
bun run lint
```

Optional quick smoke test:

```sh
cd examples/simple
bun install
bun run start
```
