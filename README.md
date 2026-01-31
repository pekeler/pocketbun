# PocketBun

An early-stage attempt to port **PocketBase** to JavaScript/TypeScript using Bun. **Work in progress.**

[PocketBase](https://github.com/pocketbase/pocketbase) © 2022–present Gani Georgiev.

## Why?

PocketBase is an excellent, well-designed, self-hosted Backend-as-a-Service.  You can extend it with Go **or** JavaScript — but the embedded JS engine has limited ES6/Node compatibility, making complex custom logic difficult. Your project may end up running two backends.

PocketBun is a semi-automated port to **Bun** that aims for maximum compatibility with PocketBase’s API and behavior.

Key differences:

- No Go extensions (only JavaScript/TypeScript)
- Runs as an **npm library** (not a single binary)
- Full ES6+ compatibility + native npm package support
- Built on Bun instead of Go + embedded JS VM

## Installation

todo

## Known Differences

### Thumbnails

PocketBun uses Sharp for image resizing. Output bytes may differ from PocketBase’s Go imaging stack, and BMP thumbnails are emitted as PNG because Sharp doesn’t write BMP.

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
