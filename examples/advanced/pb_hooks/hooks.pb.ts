// PocketBun-only: hooks + custom routes for the advanced example.

const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

routerAdd("GET", "/hello", (e) => {
  return e.json(200, { message: "Hello from PocketBun hooks." });
});

onRecordCreate((e) => {
  const record = e.record;
  if (!record) {
    return e.next();
  }

  if (record.collection().name !== "projects") {
    return e.next();
  }

  const title = String(record.get("title") ?? "");
  if (title) {
    record.set("slug", slugify(title));
  }

  return e.next();
}, "projects");

onRecordAfterCreateSuccess((e) => {
  const record = e.record;
  if (record && record.collection().name === "projects") {
    console.log(`[hooks] created project ${record.id}`);
  }
  return e.next();
}, "projects");
