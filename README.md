# PocketBun

An attempt to port **PocketBase** to JavaScript/TypeScript using Bun. **_Work in progress._**

> [PocketBase](https://pocketbase.io) is an open source Go backend that includes:
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

- No Go extensions (only JavaScript/TypeScript)
- Library-first API (no CLI/binary; use exported helpers)
- Full ES6+ compatibility + native npm package support
- Built on Bun instead of Go + embedded JS VM

## Installation

todo

## Known Differences

### Library Usage (no CLI)

PocketBun does not ship a CLI binary. Use the library exports to run migrations, start the server, and manage superusers:

```ts
import { BaseApp, migrate, serve, superuser } from "pocketbun";

const app = new BaseApp({ dataDir: "pb_data" });

migrate(app);
serve(app, { httpAddr: "127.0.0.1:8090" });

superuser.upsert(app, "admin@example.com", "change-me");
```

### Thumbnails

PocketBun uses Sharp for image resizing. Output bytes may differ from PocketBase’s Go imaging stack, and BMP thumbnails are emitted as PNG because Sharp doesn’t write BMP.

### Templates ($template)

PocketBun exposes the same `$template` helper for JS/TS hooks/migrations. If you install the optional `go-text-template` package, `$template` will understand most Go-style template syntax. HTML escaping is simpler than Go’s `html/template` (the `raw` helper is supported). If you want full control or a different syntax, use any JS templating library.

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
const html = $template.loadString("Hello {{.Name}}!").render({ Name: "Ada" });
```

### DBX Helpers

PocketBun exposes dbx-style SQL placeholder helpers from the package entrypoint so external callers can keep using `[[column]]` and `{{table}}` syntax.

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
