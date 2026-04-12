// Ported from pocketbase/tools/cron/schedule_test.go

import { describe, expect, it } from "bun:test";
import { NewSchedule } from "./schedule.ts";

describe("Schedule", () => {
  it("validates supported cron expressions", () => {
    const validExpressions = [
      "* * * * *",
      "0 * * * *",
      "59 23 31 12 6",
      "*/2 */3 */5 */4 */2",
      "1,2,5,7,40-50/2 * * * *",
      "* 3,4,8-16/3,7 * * *",
      "* * * 1,4,5-10/2 *",
      "* * * * 1,2-5/2",
    ];

    for (const cronExpr of validExpressions) {
      expect(() => NewSchedule(cronExpr)).not.toThrow();
      expect(NewSchedule(cronExpr).Expression()).toBe(cronExpr);
    }
  });

  it("normalizes supported macros", () => {
    const scenarios = {
      "@yearly": "0 0 1 1 *",
      "@annually": "0 0 1 1 *",
      "@monthly": "0 0 1 * *",
      "@weekly": "0 0 * * 0",
      "@daily": "0 0 * * *",
      "@midnight": "0 0 * * *",
      "@hourly": "0 * * * *",
    };

    for (const [cronExpr, expected] of Object.entries(scenarios)) {
      expect(NewSchedule(cronExpr).Expression()).toBe(expected);
    }
  });

  it("rejects invalid cron expressions", () => {
    const invalidExpressions = [
      "invalid",
      "* * * *",
      "* * * * * *",
      "2/3 * * * *",
      "-1 * * * *",
      "60 * * * *",
      "* -1 * * *",
      "* 24 * * *",
      "* * 0 * *",
      "* * 32 * *",
      "* * * 0 *",
      "* * * 13 *",
      "* * * * -1",
      "* * * * 7",
    ];

    for (const cronExpr of invalidExpressions) {
      expect(() => NewSchedule(cronExpr)).toThrow();
    }
  });
});
