// PocketBun-only: Bun tests for dbx identifier rewrite compatibility.

import { describe, expect, it } from "bun:test";
import { extractDbxParamNames, rewriteDbxIdentifiers } from "./identifiers.ts";

describe("dbx identifier quoting", () => {
  it("rewrites dbx-style placeholders", () => {
    const sql = "select [[id]], [[users.name]] from {{users}} where [[users.status]] = 1";
    const rewritten = rewriteDbxIdentifiers(sql);

    expect(rewritten).toBe("select `id`, `users`.`name` from `users` where `users`.`status` = 1");
  });

  it("preserves placeholders inside string literals", () => {
    const sql = "select '[[name]]' as value, \"{{table}}\" as t";
    const rewritten = rewriteDbxIdentifiers(sql);

    expect(rewritten).toBe(sql);
  });

  it("preserves placeholders inside comments", () => {
    const sql = "select 1 -- [[ignored]]\n/* {{also_ignored}} */ select [[id]] from {{users}}";
    const rewritten = rewriteDbxIdentifiers(sql);

    expect(rewritten).toBe("select 1 -- [[ignored]]\n/* {{also_ignored}} */ select `id` from `users`");
  });

  it("extracts named dbx params in order", () => {
    const sql = "select [[id]] from {{users}} where [[first]] = {:first} and [[second]] = {:second} and [[first]] = {:first}";

    expect(extractDbxParamNames(sql)).toEqual(["first", "second", "first"]);
  });

  it("ignores named dbx params in comments and string literals", () => {
    const sql =
      "select '{:ignored}' -- {:ignored2}\n/* {:ignored3} */ from {{users}} where [[name]] = {:name} and [[state]] = {:state}";

    expect(extractDbxParamNames(sql)).toEqual(["name", "state"]);
  });

  it("returns empty list when no named placeholders exist", () => {
    const sql = "select [[id]] from {{users}} where [[active]] = TRUE";

    expect(extractDbxParamNames(sql)).toEqual([]);
  });

  it("ignores named placeholders in escaped single-quoted strings", () => {
    const sql = "select 'it''s {:ignored}' as note from {{users}} where [[id]] = {:id}";

    expect(extractDbxParamNames(sql)).toEqual(["id"]);
  });

  it("ignores named placeholders in escaped double-quoted strings", () => {
    const sql = 'select "a ""{:ignored}"" b" as note from {{users}} where [[id]] = {:id}';

    expect(extractDbxParamNames(sql)).toEqual(["id"]);
  });

  it("ignores named placeholders in backtick and bracket quoted identifiers", () => {
    const sql = "select `{:ignored}` from [users] where [id] = {:id}";

    expect(extractDbxParamNames(sql)).toEqual(["id"]);
  });

  it("ignores dbx table and identifier markers while extracting named placeholders", () => {
    const sql = "select [[users.name]], [[users.id]] from {{users}} where [[users.id]] = {:id}";

    expect(extractDbxParamNames(sql)).toEqual(["id"]);
  });

  it("supports trimmed placeholder names", () => {
    const sql = "select [[id]] from {{users}} where [[id]] = {:  id  }";

    expect(extractDbxParamNames(sql)).toEqual(["id"]);
  });

  it("ignores unclosed named placeholders", () => {
    const sql = "select [[id]] from {{users}} where [[id]] = {:broken";

    expect(extractDbxParamNames(sql)).toEqual([]);
  });

  it("returns cached immutable placeholder results for identical SQL", () => {
    const sql = "select [[id]] from {{users}} where [[id]] = {:id} and [[status]] = {:status}";

    const first = extractDbxParamNames(sql);
    const second = extractDbxParamNames(sql);

    expect(Object.isFrozen(first)).toBe(true);
    expect(second).toBe(first);
    expect(first).toEqual(["id", "status"]);
  });
});
