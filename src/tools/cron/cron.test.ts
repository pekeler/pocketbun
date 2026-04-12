// Ported from pocketbase/tools/cron/cron_test.go

import { describe, expect, it, setDefaultTimeout, spyOn } from "bun:test";
import type { Job } from "./job.ts";
import { Cron } from "./cron.ts";

type FakeBunCronRegistration = {
  cronExpr: string;
  handler: () => void;
  stopCalls: number;
};

const bunWithCron = Bun as typeof Bun & {
  cron: (
    cronExpr: string,
    handler: () => void,
  ) => {
    stop(): void;
  };
};

function createFakeBunCron(): {
  registrations: FakeBunCronRegistration[];
  register: (
    cronExpr: string,
    handler: () => void,
  ) => {
    cron: string;
    ref(): void;
    stop(): void;
    unref(): void;
    [Symbol.dispose](): void;
  };
} {
  const registrations: FakeBunCronRegistration[] = [];

  return {
    registrations,
    register: (cronExpr, handler) => {
      const registration: FakeBunCronRegistration = {
        cronExpr,
        handler,
        stopCalls: 0,
      };
      registrations.push(registration);

      return {
        cron: cronExpr,
        ref(): void {},
        stop(): void {
          registration.stopCalls += 1;
        },
        unref(): void {},
        [Symbol.dispose](): void {
          registration.stopCalls += 1;
        },
      };
    },
  };
}

setDefaultTimeout(15_000);

describe("Cron", () => {
  it("uses defaults", () => {
    const c = new Cron();
    const internal = c as unknown as {
      handles: Map<string, unknown>;
      started: boolean;
      jobs: Job[];
    };

    expect(internal.handles.size).toBe(0);
    expect(internal.started).toBe(false);
    expect(internal.jobs.length).toBe(0);
  });

  it("does not expose interval configuration", () => {
    const c = new Cron();
    expect("SetInterval" in (c as object)).toBe(false);
  });

  it("does not expose timezone configuration", () => {
    const c = new Cron();
    expect("SetTimezone" in (c as object)).toBe(false);
  });

  it("adds and removes jobs", () => {
    const c = new Cron();
    const internal = c as unknown as { jobs: Job[] };

    expect(c.Add("test0", "* * * * *", null)).toBeInstanceOf(Error);
    expect(c.Add("test1", "invalid", () => {})).toBeInstanceOf(Error);

    expect(c.Add("test2", "* * * * *", () => {})).toBeNull();
    expect(c.Add("test3", "* * * * *", () => {})).toBeNull();
    expect(c.Add("test4", "* * * * *", () => {})).toBeNull();

    expect(c.Add("test2", "1 2 3 4 5", () => {})).toBeNull();
    expect(c.Add("test5", "1 2 3 4 5", () => {})).toBeNull();

    c.Remove("test4");
    c.Remove("missing");

    const indexedJobs = new Map<string, Job>();
    for (const job of internal.jobs) {
      indexedJobs.set(job.Id(), job);
    }

    const expectedKeys = ["test3", "test2", "test5"];
    expect(internal.jobs.length).toBe(expectedKeys.length);
    for (const key of expectedKeys) {
      expect(indexedJobs.get(key)).toBeTruthy();
    }

    const expectedExpressions: Record<string, string> = {
      test2: "1 2 3 4 5",
      test3: "* * * * *",
      test5: "1 2 3 4 5",
    };

    for (const [key, expected] of Object.entries(expectedExpressions)) {
      const job = indexedJobs.get(key);
      expect(job).toBeTruthy();
      if (!job) {
        continue;
      }
      expect(job.Expression()).toBe(expected);
    }
  });

  it("must add panics on error", () => {
    const c = new Cron();

    expect(() => c.MustAdd("test1", "* * * * *", null)).toThrow();

    c.MustAdd("test2", "* * * * *", () => {});
    const internal = c as unknown as { jobs: Job[] };
    expect(internal.jobs.some((job) => job.Id() === "test2")).toBe(true);
  });

  it("removes all jobs", () => {
    const c = new Cron();
    const internal = c as unknown as { jobs: Job[] };

    c.Add("test1", "* * * * *", () => {});
    c.Add("test2", "* * * * *", () => {});
    c.Add("test3", "* * * * *", () => {});

    expect(internal.jobs.length).toBe(3);

    c.RemoveAll();
    expect(internal.jobs.length).toBe(0);
  });

  it("counts jobs", () => {
    const c = new Cron();

    expect(c.Total()).toBe(0);

    c.Add("test1", "* * * * *", () => {});
    c.Add("test2", "* * * * *", () => {});
    c.Add("test1", "* * * * *", () => {});

    expect(c.Total()).toBe(2);
  });

  it("returns job copies", () => {
    const c = new Cron();
    let calls = "";

    c.Add("a", "1 * * * *", () => {
      calls += "a";
    });
    c.Add("b", "2 * * * *", () => {
      calls += "b";
    });
    c.Add("b", "3 * * * *", () => {
      calls += "b";
    });

    const jobs = c.Jobs();
    expect(jobs.length).toBe(2);

    for (const job of jobs) {
      job.Run();
    }

    expect(calls).toBe("ab");
  });

  it("uses Bun.cron for the default scheduler", () => {
    const fake = createFakeBunCron();
    using _bunCronSpy = spyOn(bunWithCron, "cron").mockImplementation(fake.register) as unknown as {
      [Symbol.dispose](): void;
    };

    const c = new Cron();
    let calls = "";

    c.Add("a", "1 * * * *", () => {
      calls += "a";
    });
    c.Add("b", "2 * * * *", () => {
      calls += "b";
    });

    c.Start();

    expect(c.HasStarted()).toBe(true);
    expect(fake.registrations.map((registration) => registration.cronExpr)).toEqual(["1 * * * *", "2 * * * *"]);

    fake.registrations[1]?.handler();
    fake.registrations[0]?.handler();
    expect(calls).toBe("ba");

    c.Add("a", "3 * * * *", () => {
      calls += "A";
    });

    expect(fake.registrations.map((registration) => registration.cronExpr)).toEqual(["1 * * * *", "2 * * * *", "3 * * * *"]);
    expect(fake.registrations[0]?.stopCalls).toBe(1);

    c.Remove("b");
    expect(fake.registrations[1]?.stopCalls).toBe(1);

    fake.registrations[2]?.handler();
    expect(calls).toBe("baA");

    c.Stop();
    expect(fake.registrations[2]?.stopCalls).toBe(1);
    expect(c.HasStarted()).toBe(false);
  });
});
