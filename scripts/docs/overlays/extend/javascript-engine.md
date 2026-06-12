### JavaScript engine

PocketBun executes your hooks and custom server code with Bun, allowing you to write server-side logic in JavaScript or TypeScript.

You can start by creating `*.pb.js` or `*.pb.ts` file(s) inside a `pb_hooks` directory in your project.

```js
// pb_hooks/main.pb.js

routerAdd("GET", "/hello/{name}", (e) => {
  let name = e.request.pathValue("name");

  return e.json(200, { message: "Hello " + name });
});

onRecordAfterUpdateSuccess((e) => {
  console.log("user updated...", e.record.get("email"));

  e.next();
}, "users");
```

- For convenience, when making changes to files inside `pb_hooks`, the process will automatically restart/reload itself (currently supported only on UNIX based platforms). Hook files are loaded per filename sort order.

On Windows, HooksWatch restart behavior has no effect.

For most parts, the JavaScript APIs mirror the upstream server APIs with 2 main differences:

- Go exported method and field names are exposed in camelCase, for example `$app.findRecordById("example", "RECORD_ID")`.

- Errors are thrown as regular JavaScript exceptions and not returned as explicit error values.

PocketBun still accepts older Go-style uppercase hook and migration names where they were exposed by previous PocketBun releases, but those names are deprecated compatibility aliases. New hooks and migrations should use the lowercase names from the PocketBase JavaScript docs and generated `pb_data/types.d.ts`.

To update older hooks and migrations automatically, run `pocketbun server-js upgrade-source`. It scans `./pb_hooks` and `./pb_migrations` by default; use `pocketbun server-js upgrade-source --check` in CI to fail when deprecated aliases remain, and review the generated diff before committing. The fixer rewrites deprecated uppercase server-side JavaScript member access and object-literal keys to their lower camelCase equivalents, including app, record, `DateTime`, form, `ApiError`, `ValidationError`, `RequestInfo`, `Cookie`, `Command`, `SubscriptionMessage`, `Context`, field option, auth provider, and hook handler names. It also updates released PocketBun package aliases like `RegisterHooksPlugin*` / `RegisterJSVM*`, `JSVMConfig`, and `TemplateLangGo` when you pass files that contain package setup code.

In the PocketBun package API, use `RegisterServerJS*` / `MustRegisterServerJS*` and `ServerJSConfig` for server-side hooks and JavaScript migrations. PocketBase's upstream JavaScript extension package is named `jsvm` because it runs code in an embedded JavaScript VM; PocketBun keeps `RegisterJSVM*` / `MustRegisterJSVM*` and `JSVMConfig` as upstream-parity aliases. `RegisterHooksPlugin*` / `MustRegisterHooksPlugin*` remain available for compatibility with released PocketBun versions.

Many I/O-heavy APIs also expose Async variants (for example `serveAsync(...)`, `migrateAsync(...)`, and `RegisterServerJSAsync(...)`).
