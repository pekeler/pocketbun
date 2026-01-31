// PocketBun-only: Bun tests for migrations compatibility.

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BaseApp } from "../src/core/base_app.ts";

describe("migrations", () => {
  let app: BaseApp;
  let dataDir = "";

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "pocketbun-migrations-"));
    app = new BaseApp({ dataDir });
    app.bootstrap();
    app.runAllMigrations();
  });

  afterAll(async () => {
    app.resetBootstrapState();
    await rm(dataDir, { recursive: true, force: true });
  });

  it("creates core system tables", () => {
    const rows = app
      .db()
      .query("select name from sqlite_master where type='table'")
      .all() as Array<{ name: string }>;
    const names = rows.map((row) => row.name);

    expect(names).toContain("_params");
    expect(names).toContain("_collections");
    expect(names).toContain("_migrations");
    expect(names).toContain("_superusers");
    expect(names).toContain("users");
    expect(names).toContain("_mfas");
    expect(names).toContain("_otps");
    expect(names).toContain("_externalAuths");
    expect(names).toContain("_authOrigins");
  });

  it("creates aux logs table", () => {
    const rows = app
      .auxDb()
      .query("select name from sqlite_master where type='table'")
      .all() as Array<{ name: string }>;
    const names = rows.map((row) => row.name);

    expect(names).toContain("_logs");
  });

  it("records the init migration", () => {
    const rows = app
      .db()
      .query("select file from _migrations where file = ?")
      .all("1640988000_init.go") as Array<{ file: string }>;
    expect(rows.length).toBe(1);
  });

  it("inserts system collections", () => {
    const rows = app.db().query("select name, type, system from _collections").all() as Array<{
      name: string;
      type: string;
      system: number;
    }>;

    const names = rows.map((row) => row.name);
    expect(names).toContain("_superusers");
    expect(names).toContain("users");
  });
});
