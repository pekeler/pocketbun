// Ported from pocketbase/core/log_printer_test.go

import { describe, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as slog from "../internal/compat/slog.ts";
import { DbxDatabase } from "../tools/dbx/database.ts";
import { existInSlice } from "../tools/list/list.ts";
import { BatchHandler } from "../tools/logger/batch_handler.ts";
import { BaseApp } from "./base.ts";
import { LogsTableName, type Log } from "./log_model.ts";
import { printLog } from "./log_printer.ts";

describe("BaseApp logger", () => {
  it.serial("prints logs in dev mode", async () => {
    const testLogLevel = 4;

    const scenarios = [
      {
        name: "dev mode",
        isDev: true,
        levels: [testLogLevel - 1, testLogLevel, testLogLevel + 1],
        printedLevels: [testLogLevel - 1, testLogLevel, testLogLevel + 1],
        persistedLevels: [testLogLevel, testLogLevel + 1],
      },
      {
        name: "nondev mode",
        isDev: false,
        levels: [testLogLevel - 1, testLogLevel, testLogLevel + 1],
        printedLevels: [],
        persistedLevels: [testLogLevel, testLogLevel + 1],
      },
    ];

    for (const scenario of scenarios) {
      const dataDir = await mkdtemp(join(tmpdir(), "pocketbun-log-printer-"));
      const app = new BaseApp({ dataDir, isDev: scenario.isDev });
      const originalPrintLog = printLog.fn;

      try {
        app.bootstrap();

        // silence query logs
        const mainDb = app.db() as DbxDatabase;
        const auxDb = app.auxDb() as DbxDatabase;
        mainDb.QueryLogFunc = () => {};
        auxDb.QueryLogFunc = () => {};

        app.settings().logs.minLevel = testLogLevel;
        const saveErr = await app.Save(app.settings());
        if (saveErr) {
          throw saveErr;
        }

        const printedLevels: number[] = [];
        const persistedLevels: number[] = [];

        // track printed logs
        printLog.fn = (log) => {
          printedLevels.push(Number(log.Level));
        };

        // track persisted logs
        app.OnModelAfterCreateSuccess([LogsTableName]).BindFunc((e) => {
          const model = e.Model as Log;
          persistedLevels.push(model.level);
          return e.Next();
        });

        // write and persist logs
        for (const level of scenario.levels) {
          app.Logger().Log({}, new slog.Level(level), "test");
        }
        const handler = app.Logger().Handler();
        if (!(handler instanceof BatchHandler)) {
          throw new Error(`Expected BatchHandler, got ${handler?.constructor?.name ?? typeof handler}`);
        }
        const err = await handler.WriteAll({});
        if (err) {
          throw err;
        }

        // check persisted log levels
        if (scenario.persistedLevels.length !== persistedLevels.length) {
          throw new Error(
            `Expected persisted levels ${JSON.stringify(scenario.persistedLevels)} got ${JSON.stringify(persistedLevels)}`,
          );
        }
        for (const level of persistedLevels) {
          if (!existInSlice(level, scenario.persistedLevels)) {
            throw new Error(`Missing expected persisted level ${level} in ${JSON.stringify(persistedLevels)}`);
          }
        }

        // check printed log levels
        if (scenario.printedLevels.length !== printedLevels.length) {
          throw new Error(
            `Expected printed levels ${JSON.stringify(scenario.printedLevels)} got ${JSON.stringify(printedLevels)}`,
          );
        }
        for (const level of printedLevels) {
          if (!existInSlice(level, scenario.printedLevels)) {
            throw new Error(`Missing expected printed level ${level} in ${JSON.stringify(printedLevels)}`);
          }
        }
      } finally {
        printLog.fn = originalPrintLog;
        app.resetBootstrapState();
        await rm(dataDir, { recursive: true, force: true });
      }
    }
  });
});
