// PocketBun-only: verifies dbx query bind/execute compatibility used by JSVM hooks.

import { describe, expect, it } from "bun:test";
import { DbxDatabase } from "./database.ts";

describe("DbxQuery", () => {
  it("maps named bind values by SQL placeholder order", () => {
    const db = new DbxDatabase(":memory:");
    try {
      db.run("create table t (a text, b text)");
      db.run("insert into t (a, b) values (?, ?)", ["first", "second"]);

      const result = db
        .newQuery("delete from t where [[b]] = {:second} and [[a]] = {:first}")
        .Bind({ first: "first", second: "second" })
        .execute();

      expect(result.changes).toBe(1);
    } finally {
      db.close();
    }
  });

  it("bind supports repeated named placeholders", () => {
    const db = new DbxDatabase(":memory:");
    try {
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
    } finally {
      db.close();
    }
  });

  it("ignores placeholder-like content in comments and strings when binding", () => {
    const db = new DbxDatabase(":memory:");
    try {
      db.run("create table t (token text)");
      db.run("insert into t (token) values (?)", ["x"]);

      const result = db
        .newQuery("delete from t where [[token]] = {:token} and '{:ignored}' != '' -- {:ignored2}\n/* {:ignored3} */")
        .Bind({ token: "x" })
        .execute();

      expect(result.changes).toBe(1);
    } finally {
      db.close();
    }
  });

  it("throws for missing named bind parameters", () => {
    const db = new DbxDatabase(":memory:");
    try {
      db.run("create table t (token text)");

      expect(() => {
        db.newQuery("delete from t where [[token]] = {:token} and [[token]] != {:other}").Bind({ token: "x" });
      }).toThrow("missing param :other");
    } finally {
      db.close();
    }
  });

  it("keeps positional binds compatible", () => {
    const db = new DbxDatabase(":memory:");
    try {
      db.run("create table t (token text)");
      db.run("insert into t (token) values (?)", ["x"]);

      const result = db.newQuery("delete from t where [[token]] = ?").Bind("x").execute();
      expect(result.changes).toBe(1);
    } finally {
      db.close();
    }
  });
});
