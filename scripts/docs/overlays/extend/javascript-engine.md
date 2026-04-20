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

- Go exported method and field names are converted to camelCase, for example:

  `app.FindRecordById("example", "RECORD_ID")` becomes
  `$app.findRecordById("example", "RECORD_ID")`.

- Errors are thrown as regular JavaScript exceptions and not returned as explicit error values.

In the PocketBun package API, use `RegisterJSVM*` / `MustRegisterJSVM*` as the preferred names for PocketBase JSVM parity. `RegisterHooksPlugin*` / `MustRegisterHooksPlugin*` remain available as aliases.

Many I/O-heavy APIs also expose Async variants (for example `serveAsync(...)`, `migrateAsync(...)`, and `RegisterJSVMAsync(...)`).
