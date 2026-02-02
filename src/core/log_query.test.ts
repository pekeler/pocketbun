// Ported from pocketbase/core/log_query_test.go.

import { describe, expect, it } from "bun:test";
import { newTestApp } from "../tests/app.ts";
import { StubLogsData } from "../tests/dynamic_stubs.ts";
import { NewExp } from "../tools/dbx/expr.ts";
import { NowDateTime, ParseDateTime } from "../tools/types/index.ts";
import { Log } from "./log_model.ts";

describe("log queries", () => {
  it("FindLogById", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const stubErr = StubLogsData(app);
      expect(stubErr).toBeNull();

      const scenarios = [
        { id: "", expectError: true },
        { id: "invalid", expectError: true },
        { id: "00000000-9f38-44fb-bf82-c8f53b310d91", expectError: true },
        { id: "873f2133-9f38-44fb-bf82-c8f53b310d91", expectError: false },
      ];

      for (const scenario of scenarios) {
        let err: Error | null = null;
        let logId = "";

        try {
          const log = app.FindLogById(scenario.id);
          logId = log.id;
        } catch (error) {
          err = error as Error;
        }

        const hasErr = err !== null;
        expect(hasErr).toBe(scenario.expectError);
        if (!scenario.expectError) {
          expect(logId).toBe(scenario.id);
        }
      }
    } finally {
      await cleanup();
    }
  });

  it("LogsStats", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const stubErr = StubLogsData(app);
      expect(stubErr).toBeNull();

      const expected = '[{"date":"2022-05-01 10:00:00.000Z","total":1},{"date":"2022-05-02 10:00:00.000Z","total":1}]';

      const now = NowDateTime().String();
      const expr = NewExp("[[created]] <= {:date}", { date: now });
      const result = app.LogsStats(expr);

      const encoded = JSON.stringify(result);
      expect(encoded).toBe(expected);
    } finally {
      await cleanup();
    }
  });

  it("DeleteOldLogs", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const stubErr = StubLogsData(app);
      expect(stubErr).toBeNull();

      const scenarios = [
        { date: "2022-01-01 10:00:00.000Z", expectedTotal: 2 },
        { date: "2022-05-01 11:00:00.000Z", expectedTotal: 1 },
        { date: "2022-05-03 11:00:00.000Z", expectedTotal: 0 },
        { date: "2022-05-04 11:00:00.000Z", expectedTotal: 0 },
      ];

      for (const scenario of scenarios) {
        const parsed = ParseDateTime(scenario.date);
        const deleteErr = app.DeleteOldLogs(parsed.time());
        expect(deleteErr).toBeNull();

        const total = app.AuxModelQuery(new Log()).Select("count(*)").Row<number>() ?? 0;
        expect(total).toBe(scenario.expectedTotal);
      }
    } finally {
      await cleanup();
    }
  });
});
