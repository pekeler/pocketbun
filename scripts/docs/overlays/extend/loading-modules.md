#### Loading modules

Please note that the hooks runtime is not a browser environment. Use APIs that are supported by Bun and PocketBun hooks runtime.

You can load modules either by specifying their local filesystem path or by using their name, which will automatically search in:

- the current working directory (_affects also relative paths_)
- any `node_modules` directory
- any parent `node_modules` directory

In `.pb.ts` files, you can use ESM imports:

- local/relative imports (for example `import { helper } from "./helper.ts"`)
- dependency imports from `node_modules` (for example `import { helper } from "my-hooks-dependency"`)

In `.pb.js` files, `require(...)` remains supported.

A common usage is loading shared helpers from local modules:

```ts
// pb_hooks/utils.ts
export const hello = (name: string) => {
  console.log("Hello " + name);
};
```

```ts
// pb_hooks/main.pb.ts
import { hello } from "./utils.ts";

onBootstrap((event) => {
  hello("world");
  return event.next();
});
```

Loaded modules use a shared registry and mutations should be avoided when possible to prevent concurrency issues.
