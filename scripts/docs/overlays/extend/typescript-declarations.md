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
