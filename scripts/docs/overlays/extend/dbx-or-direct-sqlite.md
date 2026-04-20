### DBX or direct SQLite style?

Both styles are supported and can be mixed in the same project:

- Use dbx-style APIs (`newQuery(...)`, `select(...)`, `$dbx.*` expressions) when you want PocketBase-compatible behavior and easier migration/porting of existing PocketBase code.
- Use direct Bun SQLite-style APIs (`query(...)`, `run(...)`, `prepare(...)`) for low-level control and measured hot paths.

The same lookup in dbx style:

```js
const user = new DynamicModel({
  id: "",
  email: "",
});

$app.db().newQuery("SELECT id, email FROM users WHERE email = {:email} LIMIT 1").bind({ email: "test@example.com" }).one(user); // throws on db failure or missing row
```

The same lookup in direct Bun SQLite style:

```js
const row = $app.db().query("SELECT id, email FROM users WHERE email = ? LIMIT 1").get("test@example.com");

if (!row) {
  throw new Error("missing row");
}

console.log(row.id, row.email);
```

Main practical differences:

- placeholders and binding:
  - dbx style supports named placeholders (`{:email}`) and dbx markers (`[[field]]`, `{{table}}`)
  - direct style typically uses positional placeholders (`?`)
- missing-row behavior:
  - `newQuery(...).one(...)` throws when there is no matching row
  - `query(...).get(...)` returns `undefined` when there is no matching row
- result shape:
  - dbx style can map directly to `DynamicModel` or `arrayOf(...)` targets
  - direct style returns plain row objects from SQLite
- compatibility and portability:
  - dbx style is closer to PocketBase docs/snippets and usually easier to port
  - direct style is lower-level and usually better for measured hot paths

In most cases, prefer `$app.db()` / `$app.auxDb()` over opening a separate `new Database(...)` so you keep PocketBun DB configuration and compatibility behavior.
