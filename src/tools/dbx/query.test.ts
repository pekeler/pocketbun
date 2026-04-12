// PocketBun-only: verifies dbx query bind/execute compatibility used by JSVM hooks.

import { describe, expect, it } from "bun:test";
import { DbxDatabase } from "./database.ts";
import { NewExp } from "./expr.ts";

describe("DbxQuery", () => {
  it("maps named bind values by SQL placeholder order", () => {
    using db = new DbxDatabase(":memory:");
    db.run("create table t (a text, b text)");
    db.run("insert into t (a, b) values (?, ?)", ["first", "second"]);

    const result = db
      .newQuery("delete from t where [[b]] = {:second} and [[a]] = {:first}")
      .Bind({ first: "first", second: "second" })
      .execute();

    expect(result.changes).toBe(1);
  });

  it("bind supports repeated named placeholders", () => {
    using db = new DbxDatabase(":memory:");
    db.run("create table t (token text)");
    db.run("insert into t (token) values (?)", ["x"]);
    db.run("insert into t (token) values (?)", ["y"]);

    const result = db
      .newQuery("delete from t where [[token]] = {:token} or [[token]] = {:token}")
      .Bind({ token: "x" })
      .execute();

    expect(result.changes).toBe(1);
    const row = db.query("select count(*) as total from t where token = ?").get("x") as { total: number } | undefined;
    expect(row?.total).toBe(0);
  });

  it("ignores placeholder-like content in comments and strings when binding", () => {
    using db = new DbxDatabase(":memory:");
    db.run("create table t (token text)");
    db.run("insert into t (token) values (?)", ["x"]);

    const result = db
      .newQuery("delete from t where [[token]] = {:token} and '{:ignored}' != '' -- {:ignored2}\n/* {:ignored3} */")
      .Bind({ token: "x" })
      .execute();

    expect(result.changes).toBe(1);
  });

  it("throws for missing named bind parameters", () => {
    using db = new DbxDatabase(":memory:");
    db.run("create table t (token text)");

    expect(() => {
      db.newQuery("delete from t where [[token]] = {:token} and [[token]] != {:other}").Bind({ token: "x" });
    }).toThrow("missing param :other");
  });

  it("keeps positional binds compatible", () => {
    using db = new DbxDatabase(":memory:");
    db.run("create table t (token text)");
    db.run("insert into t (token) values (?)", ["x"]);

    const result = db.newQuery("delete from t where [[token]] = ?").Bind("x").execute();
    expect(result.changes).toBe(1);
  });

  it("one throws sql.ErrNoRows-compatible error on missing rows", () => {
    using db = new DbxDatabase(":memory:");
    db.run("create table t (token text)");

    expect(() => {
      db.newQuery("select [[token]] from t where [[token]] = {:token}").Bind({ token: "missing" }).one();
    }).toThrow("sql: no rows in result set");
  });

  it("all returns an empty array on missing rows", () => {
    using db = new DbxDatabase(":memory:");
    db.run("create table t (token text)");
    const result = db.newQuery("select [[token]] from t where [[token]] = {:token}").Bind({ token: "missing" }).all();
    expect(result).toEqual([]);
  });

  it("exposes sql and params accessors", () => {
    using db = new DbxDatabase(":memory:");
    const query = db.newQuery("select [[token]] from t where [[token]] = ?", "x");
    expect(query.sql()).toBe("select [[token]] from t where [[token]] = ?");
    expect(query.params()).toEqual(["x"]);
  });

  it("supports prepare and close", () => {
    using db = new DbxDatabase(":memory:");
    db.run("create table t (token text)");
    db.run("insert into t (token) values (?)", ["x"]);

    using query = db.newQuery("select [[token]] as [[token]] from t where [[token]] = ?", "x").prepare();
    const row = query.one<{ token: string }>();
    expect(row?.token).toBe("x");
    query.close();
    query.close();
  });

  it("tracks and clears prepare errors via lastError", () => {
    using db = new DbxDatabase(":memory:");
    const query = db.newQuery("select [[token]] from missing_table").prepare();
    expect(query.lastError).toBeInstanceOf(Error);
    expect(() => query.one()).toThrow();
    expect(query.lastError).toBeNull();
  });

  it("supports row and column helpers", () => {
    using db = new DbxDatabase(":memory:");
    db.run("create table t (a text, b text)");
    db.run("insert into t (a, b) values (?, ?)", ["x", "y"]);
    db.run("insert into t (a, b) values (?, ?)", ["z", "w"]);

    const row = db.newQuery("select [[a]], [[b]] from t where [[a]] = ?", "x").row() as unknown[];
    expect(row).toEqual(["x", "y"]);

    const rowTarget = { value: "" };
    db.newQuery("select [[a]] from t where [[a]] = ?", "x").row(rowTarget);
    expect(rowTarget.value).toBe("x");

    const column = db.newQuery("select [[a]] from t order by [[a]] asc").column() as unknown[];
    expect(column).toEqual(["x", "z"]);

    const columnTarget: unknown[] = [];
    db.newQuery("select [[a]] from t order by [[a]] asc").column(columnTarget);
    expect(columnTarget).toEqual(["x", "z"]);
  });

  it("supports rows cursor helpers", () => {
    using db = new DbxDatabase(":memory:");
    db.run("create table t (a text, b text)");
    db.run("insert into t (a, b) values (?, ?)", ["x", "1"]);
    db.run("insert into t (a, b) values (?, ?)", ["z", "2"]);

    using rows = db.newQuery("select [[a]], [[b]] from t order by [[a]] asc").rows();
    expect(rows.columns()).toEqual(["a", "b"]);
    expect(rows.err()).toBeNull();
    expect(rows.nextResultSet()).toBe(false);

    expect(rows.next()).toBe(true);
    const firstMap: Record<string, unknown> = {};
    rows.scanMap(firstMap);
    expect(firstMap).toEqual({ a: "x", b: "1" });

    expect(rows.next()).toBe(true);
    const secondStruct = { a: "", b: "" };
    rows.scanStruct(secondStruct);
    expect(secondStruct).toEqual({ a: "z", b: "2" });

    using rowsForScan = db.newQuery("select [[a]], [[b]] from t where [[a]] = ?", "x").rows();
    expect(rowsForScan.next()).toBe(true);
    const aTarget = { value: "" };
    const bTarget = { value: "" };
    rowsForScan.scan(aTarget, bTarget);
    expect(aTarget.value).toBe("x");
    expect(bTarget.value).toBe("1");

    rowsForScan.close();
    expect(rowsForScan.next()).toBe(false);

    expect(rows.next()).toBe(false);
  });

  it("supports context and exec/one/all hooks", () => {
    using db = new DbxDatabase(":memory:");
    db.run("create table t (token text)");
    db.run("insert into t (token) values (?)", ["x"]);
    db.run("insert into t (token) values (?)", ["y"]);

    const query = db.newQuery("select [[token]] as [[token]] from t where [[token]] = ?", "x");
    query.withContext({ traceId: "ctx-1" });
    expect(query.context()).toEqual({ traceId: "ctx-1" });

    let execHookCalls = 0;
    let oneHookCalls = 0;
    let allHookCalls = 0;

    query.withExecHook((q, op) => {
      expect(q).toBe(query);
      execHookCalls += 1;
      return op();
    });
    query.withOneHook((q, into, op) => {
      expect(q).toBe(query);
      expect(into as { token: string } | undefined).toEqual({ token: "" });
      oneHookCalls += 1;
      return op(into);
    });
    query.withAllHook((q, into, op) => {
      expect(q).toBe(query);
      expect(into as Array<{ token: string }> | undefined).toEqual([]);
      allHookCalls += 1;
      return op(into);
    });

    const oneTarget = { token: "" };
    const oneResult = query.one(oneTarget);
    expect(oneResult?.token).toBe("x");

    query.Bind("x");
    const allTarget: Array<{ token: string }> = [];
    const allResult = query.all(allTarget);
    expect(allResult).toEqual([{ token: "x" }]);

    query.Bind("x");
    const rowResult = query.row() as unknown[];
    expect(rowResult).toEqual(["x"]);

    query.Bind("x");
    const columnResult = query.column() as unknown[];
    expect(columnResult).toEqual(["x"]);

    query.Bind("x");
    const rows = query.rows();
    expect(rows.next()).toBe(true);

    query.Bind("y");
    const execResult = query.execute();
    expect(execResult.changes).toBe(0);

    expect(oneHookCalls).toBe(1);
    expect(allHookCalls).toBe(1);
    expect(execHookCalls).toBe(5);
  });
});

describe("DbxSelectQuery", () => {
  it("supports documented select builder methods", () => {
    using db = new DbxDatabase(":memory:");
    db.run("create table users (id text, email text, created text)");
    db.run("insert into users (id, email, created) values (?, ?, ?)", ["u1", "alice@example.com", "2023-06-25 00:00:00.000Z"]);
    db.run("insert into users (id, email, created) values (?, ?, ?)", ["u2", "bob@test.dev", "2023-06-26 00:00:00.000Z"]);

    const result = db
      .select("id", "email")
      .andSelect("created")
      .distinct(true)
      .from("users")
      .andWhere(NewExp("[[email]] LIKE {:email}", { email: "%example.com%" }))
      .orderBy("created ASC")
      .andOrderBy("id ASC")
      .limit(100)
      .all<{ id: string; email: string; created: string }>();

    expect(result).toEqual([{ id: "u1", email: "alice@example.com", created: "2023-06-25 00:00:00.000Z" }]);
  });

  it("supports groupBy/having and join helpers", () => {
    using db = new DbxDatabase(":memory:");
    db.run("create table users (id text, email text)");
    db.run("create table profiles (id text, user_id text)");
    db.run("insert into users (id, email) values (?, ?)", ["u1", "alice@example.com"]);
    db.run("insert into users (id, email) values (?, ?)", ["u2", "bob@example.com"]);
    db.run("insert into profiles (id, user_id) values (?, ?)", ["p1", "u1"]);
    db.run("insert into profiles (id, user_id) values (?, ?)", ["p2", "u1"]);

    const result = db
      .select("[[users.id]] as [[id]]", "count([[profiles.id]]) as [[total]]")
      .from("users")
      .innerJoin("profiles", NewExp("[[profiles.user_id]] = [[users.id]]"))
      .groupBy("[[users.id]]")
      .having(NewExp("count([[profiles.id]]) > {:min}", { min: 1 }))
      .all<{ id: string; total: number }>();

    expect(result).toEqual([{ id: "u1", total: 2 }]);
  });

  it("supports andGroupBy/andHaving/orHaving and join alias chaining", () => {
    using db = new DbxDatabase(":memory:");
    const select = db
      .select("id")
      .from("users")
      .leftJoin("profiles", NewExp("[[profiles.user_id]] = [[users.id]]"))
      .rightJoin("teams", NewExp("[[teams.user_id]] = [[users.id]]"))
      .groupBy("[[users.id]]")
      .andGroupBy("[[profiles.id]]")
      .having(NewExp("count(*) > {:min}", { min: 0 }))
      .andHaving(NewExp("sum(1) >= {:sum}", { sum: 1 }))
      .orHaving(NewExp("max(1) = {:max}", { max: 1 }));

    const info = select.info();
    expect(info.join.map((join) => join.typ)).toEqual(["LEFT JOIN", "RIGHT JOIN"]);
    expect(info.groupBy).toEqual(["[[users.id]]", "[[profiles.id]]"]);
    expect(info.having?.sql).toBe("(count(*) > ?) AND (sum(1) >= ?) OR (max(1) = ?)");
    expect(info.having?.params).toEqual([0, 1, 1]);
  });

  it("supports where and orWhere chaining", () => {
    using db = new DbxDatabase(":memory:");
    db.run("create table users (id text, email text)");
    db.run("insert into users (id, email) values (?, ?)", ["u1", "alice@example.com"]);
    db.run("insert into users (id, email) values (?, ?)", ["u2", "bob@example.com"]);

    const result = db
      .select("id")
      .from("users")
      .where(NewExp("[[id]] = {:id}", { id: "u1" }))
      .orWhere(NewExp("[[id]] = {:id}", { id: "u2" }))
      .orderBy("id ASC")
      .all<{ id: string }>();

    expect(result).toEqual([{ id: "u1" }, { id: "u2" }]);
  });

  it("supports build hooks, context, fragments and unions", () => {
    using db = new DbxDatabase(":memory:");
    db.run("create table users (id text)");
    db.run("insert into users (id) values (?)", ["u1"]);
    db.run("insert into users (id) values (?)", ["u2"]);

    let buildHookCalls = 0;
    let builtSql = "";

    const query = db
      .select("[[id]] as [[id]]")
      .selectOption("ALL")
      .from("users")
      .where(NewExp("[[id]] = {:id}", { id: "u1" }))
      .preFragment("/*pre*/")
      .postFragment("/*post*/")
      .unionAll(db.newQuery("SELECT [[id]] as [[id]] FROM users WHERE [[id]] = ?", "u2"))
      .withContext({ traceId: "ctx-2" })
      .withBuildHook((built) => {
        buildHookCalls += 1;
        builtSql = built.sql();
      })
      .build();

    expect(query.context()).toEqual({ traceId: "ctx-2" });
    const rows = query.all<{ id: string }>();
    expect(rows.map((row) => row.id).sort()).toEqual(["u1", "u2"]);
    expect(buildHookCalls).toBe(1);
    expect(builtSql).toContain("/*pre*/");
    expect(builtSql).toContain("SELECT ALL");
    expect(builtSql).toContain("/*post*/");
    expect(builtSql).toContain("UNION ALL");
  });

  it("supports select info snapshots", () => {
    using db = new DbxDatabase(":memory:");
    const select = db
      .select("id")
      .from("users")
      .where(NewExp("[[id]] = {:id}", { id: "u1" }))
      .groupBy("id")
      .having(NewExp("count(*) > {:min}", { min: 0 }))
      .orderBy("id ASC")
      .bind({ id: "u1" })
      .withContext({ traceId: "ctx-info" });

    const info = select.info();
    expect(info.selects).toEqual(["id"]);
    expect(info.from).toEqual(["users"]);
    expect(info.where?.sql).toContain("[[id]] = ?");
    expect(info.where?.params).toEqual(["u1"]);
    expect(info.groupBy).toEqual(["id"]);
    expect(info.having?.sql).toContain("count(*) > ?");
    expect(info.having?.params).toEqual([0]);
    expect(info.orderBy).toEqual(["id ASC"]);
    expect(info.params).toEqual([{ id: "u1" }]);
    expect(info.context).toEqual({ traceId: "ctx-info" });

    info.from.push("modified");
    expect(select.info().from).toEqual(["users"]);
  });

  it("supports model shortcut and table-name inference", () => {
    using db = new DbxDatabase(":memory:");
    db.run("create table users (id text, email text)");
    db.run("insert into users (id, email) values (?, ?)", ["u1", "alice@example.com"]);

    const model: { id: string; email: string; tableName: () => string } = {
      id: "",
      email: "",
      tableName: () => "users",
    };

    const result = db.select("id", "email").model("u1", model);
    expect(result).toBe(model);
    expect(model.id).toBe("u1");
    expect(model.email).toBe("alice@example.com");

    const tableNameUpperModel: { id: string; email: string; TableName: () => string } = {
      id: "",
      email: "",
      TableName: () => "users",
    };
    expect(db.select("id", "email").model("u1", tableNameUpperModel)).toBe(tableNameUpperModel);
    expect(tableNameUpperModel.id).toBe("u1");

    const collectionMethodModel: { id: string; email: string; collection: () => { name: string } } = {
      id: "",
      email: "",
      collection: () => ({ name: "users" }),
    };
    expect(db.select("id", "email").model("u1", collectionMethodModel)).toBe(collectionMethodModel);
    expect(collectionMethodModel.id).toBe("u1");

    const collectionPropModel: { id: string; email: string; Collection: { name: string } } = {
      id: "",
      email: "",
      Collection: { name: "users" },
    };
    expect(db.select("id", "email").model("u1", collectionPropModel)).toBe(collectionPropModel);
    expect(collectionPropModel.id).toBe("u1");

    const tablePropModel: { id: string; email: string; table: string } = {
      id: "",
      email: "",
      table: "users",
    };
    expect(db.select("id", "email").model("u1", tablePropModel)).toBe(tablePropModel);
    expect(tablePropModel.id).toBe("u1");
  });

  it("supports select bind and andBind combinations", () => {
    using db = new DbxDatabase(":memory:");
    db.run("create table users (id text)");
    db.run("insert into users (id) values (?)", ["u1"]);
    db.run("insert into users (id) values (?)", ["u2"]);

    const namedRows = db
      .select("id")
      .from("users")
      .where("[[id]] = {:id}")
      .bind({ id: "u1" })
      .andBind({ ignored: "ignored" })
      .all<{ id: string }>();
    expect(namedRows).toEqual([{ id: "u1" }]);

    expect(() => {
      db.select("id")
        .from("users")
        .where(NewExp("[[id]] = {:id}", { id: "u1" }))
        .bind({ id: "u1" })
        .all();
    }).toThrow("cannot combine named bind params with expression-generated params");
  });
});
