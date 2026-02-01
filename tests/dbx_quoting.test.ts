// PocketBun-only: Bun tests for dbx identifier rewrite compatibility.

import { describe, expect, it } from "bun:test";
import { rewriteDbxIdentifiers } from "../src/tools/dbx/identifiers.ts";

describe("dbx identifier quoting", () => {
  it("rewrites dbx-style placeholders", () => {
    const sql = "select [[id]], [[users.name]] from {{users}} where [[users.status]] = 1";
    const rewritten = rewriteDbxIdentifiers(sql);

    expect(rewritten).toBe("select [id], [users].[name] from [users] where [users].[status] = 1");
  });

  it("preserves placeholders inside string literals", () => {
    const sql = "select '[[name]]' as value, \"{{table}}\" as t";
    const rewritten = rewriteDbxIdentifiers(sql);

    expect(rewritten).toBe(sql);
  });

  it("preserves placeholders inside comments", () => {
    const sql = "select 1 -- [[ignored]]\n/* {{also_ignored}} */ select [[id]] from {{users}}";
    const rewritten = rewriteDbxIdentifiers(sql);

    expect(rewritten).toBe("select 1 -- [[ignored]]\n/* {{also_ignored}} */ select [id] from [users]");
  });
});
