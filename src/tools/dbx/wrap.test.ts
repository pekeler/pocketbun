// PocketBun-only: Bun tests for dbx wrapper behavior.

import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { attachDbxRewrite } from "./wrap.ts";

describe("dbx database wrapper", () => {
  it("rewrites placeholders for an existing Database instance", () => {
    const db = new Database(":memory:");
    attachDbxRewrite(db);

    db.query("create table {{users}} ([[id]] integer primary key, [[name]] text)").run();
    db.query("insert into {{users}} ([[name]]) values (?)").run("Ada");

    const row = db.query("select [[name]] as name from {{users}} where [[id]] = 1").get() as { name: string } | undefined;

    expect(row?.name).toBe("Ada");
    db.close();
  });

  it("is idempotent when attached multiple times", () => {
    const db = new Database(":memory:");
    attachDbxRewrite(db);
    attachDbxRewrite(db);

    db.query("create table [[items]] ([[value]] text)").run();
    db.query("insert into [[items]] ([[value]]) values ('ok')").run();

    const row = db.query("select [[value]] as value from [[items]]").get() as { value: string } | undefined;

    expect(row?.value).toBe("ok");
    db.close();
  });
});
