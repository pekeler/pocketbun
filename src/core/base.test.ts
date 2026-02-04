// Ported from pocketbase/core/base_test.go.

import { describe, expect, it } from "bun:test";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DbxDatabase } from "../tools/dbx/database.ts";
import * as slog from "../internal/compat/slog.ts";
import { newTestApp } from "../tests/app.ts";
import { BatchHandler } from "../tools/logger/batch_handler.ts";
import { Sendmail } from "../tools/mailer/sendmail.ts";
import { SMTPClient } from "../tools/mailer/smtp.ts";
import { BaseApp } from "./base.ts";
import { StoreKeyCachedCollections } from "./collection_query.ts";
import { TerminateEvent } from "./events.ts";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasDb(getter: () => unknown): boolean {
  try {
    getter();
    return true;
  } catch {
    return false;
  }
}

function execSql(db: DbxDatabase, sql: string): void {
  if (/^\s*(select|with)\b/i.test(sql)) {
    void db.query(sql).get();
    return;
  }
  db.run(sql);
}

describe("BaseApp", () => {
  it("NewBaseApp", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "pb_base_app_test_data_dir_"));
    const app = new BaseApp({
      dataDir,
      encryptionEnv: "test_env",
      isDev: true,
    });

    expect(app.DataDir()).toBe(dataDir);
    expect(app.encryptionEnv()).toBe("test_env");
    expect(app.IsDev()).toBe(true);
    expect(app.store()).not.toBeNull();
    expect(app.settings()).not.toBeNull();
    expect(app.SubscriptionsBroker()).not.toBeNull();
    expect(app.Cron()).not.toBeNull();

    await rm(dataDir, { recursive: true, force: true });
  });

  it("BaseAppBootstrap", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "pb_base_app_test_data_dir_"));
    await rm(dataDir, { recursive: true, force: true });

    const app = new BaseApp({ dataDir });

    expect(app.isBootstrapped()).toBe(false);
    app.bootstrap();
    expect(app.isBootstrapped()).toBe(true);

    const statInfo = await stat(dataDir);
    expect(statInfo.isDirectory()).toBe(true);

    expect(hasDb(() => app.db())).toBe(true);
    expect(hasDb(() => app.auxDb())).toBe(true);
    expect(app.settings()).not.toBeNull();
    expect(app.Logger()).not.toBeNull();
    expect(app.store().get(StoreKeyCachedCollections)).not.toBeUndefined();

    app.resetBootstrapState();

    expect(hasDb(() => app.db())).toBe(false);
    expect(hasDb(() => app.auxDb())).toBe(false);
    expect(app.settings()).not.toBeNull();
    expect(app.Logger()).not.toBeNull();
    expect(app.store().get(StoreKeyCachedCollections)).not.toBeUndefined();

    await rm(dataDir, { recursive: true, force: true });
  });

  it("NewBaseAppTx", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "pb_base_app_test_data_dir_"));
    const app = new BaseApp({ dataDir });
    app.bootstrap();

    const mustNotHaveTx = (ctxApp: BaseApp) => {
      expect(ctxApp.IsTransactional()).toBe(false);
      expect(ctxApp.TxInfo()).toBeNull();
    };

    const mustHaveTx = (ctxApp: BaseApp) => {
      expect(ctxApp.IsTransactional()).toBe(true);
      expect(ctxApp.TxInfo()).not.toBeNull();
    };

    mustNotHaveTx(app);

    await app.RunInTransaction(async (txApp) => {
      mustHaveTx(txApp as BaseApp);
      return null;
    });

    mustNotHaveTx(app);

    app.resetBootstrapState();
    await rm(dataDir, { recursive: true, force: true });
  });

  it("BaseAppNewMailClient", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "pb_base_app_test_data_dir_"));
    const app = new BaseApp({ dataDir, encryptionEnv: "pb_test_env" });

    const client1 = app.NewMailClient();
    expect(client1).toBeInstanceOf(Sendmail);
    expect(client1.OnSend().Length()).toBeGreaterThan(0);

    app.settings().smtp.enabled = true;

    const client2 = app.NewMailClient();
    expect(client2).toBeInstanceOf(SMTPClient);
    expect(client2.OnSend().Length()).toBeGreaterThan(0);

    await rm(dataDir, { recursive: true, force: true });
  });

  it("BaseAppNewFilesystem", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "pb_base_app_test_data_dir_"));
    const app = new BaseApp({ dataDir });

    const local = app.NewFilesystem();
    expect(local).not.toBeNull();
    await local.Close();

    app.settings().s3.enabled = true;
    let s3Err: Error | null = null;
    try {
      app.NewFilesystem();
    } catch (err) {
      s3Err = err as Error;
    }
    expect(s3Err).not.toBeNull();

    await rm(dataDir, { recursive: true, force: true });
  });

  it("BaseAppNewBackupsFilesystem", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "pb_base_app_test_data_dir_"));
    const app = new BaseApp({ dataDir });

    const local = app.NewBackupsFilesystem();
    expect(local).not.toBeNull();
    await local.Close();

    app.settings().backups.s3.enabled = true;
    let s3Err: Error | null = null;
    try {
      app.NewBackupsFilesystem();
    } catch (err) {
      s3Err = err as Error;
    }
    expect(s3Err).not.toBeNull();

    await rm(dataDir, { recursive: true, force: true });
  });

  it("BaseAppLoggerWrites", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const resetErr = app.DeleteOldLogs(new Date());
      expect(resetErr).toBeNull();

      const logsThreshold = 200;
      const totalLogs = () => app.LogQuery().Select("count(*)").Row<number>() ?? 0;

      app.settings().logs.maxDays = 0;
      for (let i = 0; i < logsThreshold + 1; i += 1) {
        app.Logger().Error("test");
      }
      expect(totalLogs()).toBe(0);

      app.settings().logs.maxDays = 1;
      for (let i = 0; i < logsThreshold - 1; i += 1) {
        app.Logger().Error("test");
      }
      expect(totalLogs()).toBe(0);

      app.Logger().Error("test");
      await sleep(100);
      app.Logger().Error("test");

      await sleep(100);
      expect(totalLogs()).toBe(logsThreshold);

      await sleep(3200);
      await sleep(100);
      expect(totalLogs()).toBe(logsThreshold + 1);
    } finally {
      await cleanup();
    }
  });

  it("BaseAppRefreshSettingsLoggerMinLevelEnabled", async () => {
    const scenarios = [
      {
        name: "dev mode",
        isDev: true,
        level: 4,
        expectations: new Map([
          [3, true],
          [4, true],
          [5, true],
        ]),
      },
      {
        name: "nondev mode",
        isDev: false,
        level: 4,
        expectations: new Map([
          [3, false],
          [4, true],
          [5, true],
        ]),
      },
    ];

    for (const scenario of scenarios) {
      const dataDir = await mkdtemp(join(tmpdir(), "pb_base_app_test_data_dir_"));
      const app = new BaseApp({ dataDir, isDev: scenario.isDev });
      app.bootstrap();

      const handler = app.Logger().Handler();
      if (!(handler instanceof BatchHandler)) {
        const handlerName =
          handler && typeof handler === "object" && "constructor" in handler
            ? ((handler as { constructor?: { name?: string } }).constructor?.name ?? "object")
            : typeof handler;

        throw new Error(`Expected BatchHandler, got ${handlerName}`);
      }

      app.settings().logs.minLevel = scenario.level;
      const saveErr = await app.Save(app.settings());
      expect(saveErr).toBeNull();

      for (const [level, enabled] of scenario.expectations.entries()) {
        expect(handler.Enabled({}, new slog.Level(level))).toBe(enabled);
      }

      app.resetBootstrapState();
      await rm(dataDir, { recursive: true, force: true });
    }
  });

  it("BaseAppDBDualBuilder", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const db = app.db() as DbxDatabase;
      const queries: string[] = [];
      db.QueryLogFunc = (sql) => {
        queries.push(sql);
      };

      const regularTests = [
        { query: "  \n  sEleCt 1" },
        { query: "With abc(x) AS (select 2) SELECT x FROM abc" },
        { query: "create table t1(x int)" },
        { query: "insert into t1(x) values(1)" },
        { query: "update t1 set x = 2" },
        { query: "delete from t1" },
      ];

      const txTests = [
        { query: "select 3" },
        { query: " \n WITH abc(x) AS (select 4) SELECT x FROM abc" },
        { query: "create table t2(x int)" },
        { query: "insert into t2(x) values(1)" },
        { query: "update t2 set x = 2" },
        { query: "delete from t2" },
      ];

      for (const item of regularTests) {
        execSql(db, item.query);
      }

      await app.RunInTransaction(async (txApp) => {
        const txDb = txApp.db() as DbxDatabase;
        for (const item of txTests) {
          execSql(txDb, item.query);
        }
        return null;
      });

      const allQueries = [...regularTests, ...txTests].map((item) => item.query);
      for (const query of allQueries) {
        expect(queries.includes(query)).toBe(true);
      }
    } finally {
      await cleanup();
    }
  });

  it("BaseAppAuxDBDualBuilder", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const db = app.auxDb() as DbxDatabase;
      const queries: string[] = [];
      db.QueryLogFunc = (sql) => {
        queries.push(sql);
      };

      const regularTests = [
        { query: "  \n  sEleCt 1" },
        { query: "With abc(x) AS (select 2) SELECT x FROM abc" },
        { query: "create table t1(x int)" },
        { query: "insert into t1(x) values(1)" },
        { query: "update t1 set x = 2" },
        { query: "delete from t1" },
      ];

      const txTests = [
        { query: "select 3" },
        { query: " \n WITH abc(x) AS (select 4) SELECT x FROM abc" },
        { query: "create table t2(x int)" },
        { query: "insert into t2(x) values(1)" },
        { query: "update t2 set x = 2" },
        { query: "delete from t2" },
      ];

      for (const item of regularTests) {
        execSql(db, item.query);
      }

      await app.AuxRunInTransaction(async (txApp) => {
        const txDb = txApp.auxDb() as DbxDatabase;
        for (const item of txTests) {
          execSql(txDb, item.query);
        }
        return null;
      });

      const allQueries = [...regularTests, ...txTests].map((item) => item.query);
      for (const query of allQueries) {
        expect(queries.includes(query)).toBe(true);
      }
    } finally {
      await cleanup();
    }
  });

  it("BaseAppTriggerOnTerminate", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const event = new TerminateEvent(app);
      app.OnTerminate().Trigger(event);
      app.OnTerminate().Trigger(event);
      app.OnTerminate().Trigger(event);
    } finally {
      await cleanup();
    }
  });
});
