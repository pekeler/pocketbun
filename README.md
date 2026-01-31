# PocketBun

An attempt at porting PocketBase to JavaScript. Not even WIP yet.

[PocketBase](https://github.com/pocketbase/pocketbase) is Copyright (c) 2022 - present, Gani Georgiev.

## DBX Helpers

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
