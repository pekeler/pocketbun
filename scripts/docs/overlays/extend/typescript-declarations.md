### TypeScript declarations and code completion

PocketBun can execute `.pb.ts` files directly, and it also provides builtin **ambient TypeScript declarations** for editor completion and inline docs.

The declarations are stored in `pb_data/types.d.ts`. You can reference them from hooks files:

```ts
/// <reference path="../pb_data/types.d.ts" />

onBootstrap((event) => {
  return event.next();
});
```

If your editor still doesn't provide completion, make sure the hook file uses the `.pb.ts` extension.

#### Create models from TypeScript

Import model constructors directly when building a custom Bun application:

```ts
import { BaseApp, Collection, Record, TextField } from "pocketbun";

const app = new BaseApp({ dataDir: "pb_data" });
await app.bootstrapAsync();
app.runAppMigrations();

const articles = new Collection({ name: "articles", type: "base" });
articles.fields.add(new TextField({ name: "title", required: true }));
const collectionError = await app.save(articles);
if (collectionError) throw collectionError;

const article = new Record(articles, { title: "Hello from Bun" });
const recordError = await app.save(article);
if (recordError) throw recordError;
```

Run this once against a database without an `articles` collection. Use migrations for repeatable schema changes. Collection rules default to superuser-only access.

`Collection` accepts the same JSON configuration as the hook constructor, including auth options and `viewQuery`. The factories `newCollection(type, name, id?)`, `newBaseCollection(name, id?)`, `newAuthCollection(name, id?)`, and `newViewCollection(name, id?)` are also exported. All 14 field constructors accept typed lower-camel options, such as `maxSelect`, `onlyInt`, and `onCreate`; Go-style property names remain accepted.

For existing binding-based code, `const core = bindCore({})` returns typed model constructors and collection factories. It still installs the bindings on the supplied object.
