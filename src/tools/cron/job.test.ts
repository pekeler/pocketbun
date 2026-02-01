// Ported from pocketbase/tools/cron/job_test.go

import { describe, expect, it } from "bun:test";
import { Job } from "./job.ts";
import { NewSchedule } from "./schedule.ts";

describe("Job", () => {
  it("returns id", () => {
    const schedule = NewSchedule("* * * * *");
    const job = new Job("test", schedule, () => {});
    expect(job.Id()).toBe("test");
  });

  it("returns expression", () => {
    const schedule = NewSchedule("1 2 3 4 5");
    const job = new Job("test", schedule, () => {});
    expect(job.Expression()).toBe("1 2 3 4 5");
  });

  it("runs safely", () => {
    let calls = "";
    const schedule = NewSchedule("* * * * *");
    const job1 = new Job("one", schedule, null);
    const job2 = new Job("two", schedule, () => {
      calls += "2";
    });

    expect(() => job1.Run()).not.toThrow();
    job2.Run();

    expect(calls).toBe("2");
  });

  it("marshals to json", () => {
    const schedule = NewSchedule("1 2 3 4 5");
    const job = new Job("test_id", schedule, () => {});
    const raw = JSON.stringify(job);
    expect(raw).toBe('{"id":"test_id","expression":"1 2 3 4 5"}');
  });
});
