// Ported from pocketbase/tools/cron/cron_test.go

import { describe, expect, it, setDefaultTimeout, spyOn } from "bun:test";
import type { Job } from "./job.ts";
import { Cron } from "./cron.ts";

type FakeBunCronRegistration = {
  cronExpr: string;
  handler: () => void;
  options?: Bun.CronOptions;
  stopCalls: number;
};

type FakeBunWithCron = Omit<typeof Bun, "cron"> & {
  cron: (
    cronExpr: string,
    handler: () => void,
    options?: Bun.CronOptions,
  ) => {
    stop(): void;
  };
};

const bunWithCron = Bun as unknown as FakeBunWithCron;

function createFakeBunCron(): {
  registrations: FakeBunCronRegistration[];
  register: (
    cronExpr: string,
    handler: () => void,
    options?: Bun.CronOptions,
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
    register: (cronExpr, handler, options) => {
      const registration: FakeBunCronRegistration = {
        cronExpr,
        handler,
        options,
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
      timezone: string;
    };

    expect(internal.handles.size).toBe(0);
    expect(internal.started).toBe(false);
    expect(internal.jobs.length).toBe(0);
    expect(internal.timezone).toBe("UTC");
  });

  it("keeps UTC as the default in a non-UTC process", async () => {
    const cronUrl = new URL("./cron.ts", import.meta.url).href;
    const script = `
const { Cron } = await import(${JSON.stringify(cronUrl)});
const registrations = [];
Bun.cron = (cronExpr, handler, options) => {
  registrations.push({ cronExpr, options });
  return { stop() {} };
};
const cron = new Cron();
cron.Add("job", "0 9 * * *", () => {});
cron.Start();
console.log(JSON.stringify({ host: Intl.DateTimeFormat().resolvedOptions().timeZone, registration: registrations[0] }));
cron.Stop();
`;
    const child = Bun.spawn({
      cmd: [process.execPath, "-e", script],
      env: { ...process.env, TZ: "America/Los_Angeles" },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);

    expect(exitCode, stderr).toBe(0);
    expect(JSON.parse(stdout)).toEqual({
      host: "America/Los_Angeles",
      registration: { cronExpr: "0 9 * * *", options: { tz: "UTC" } },
    });
  });

  it("does not expose interval configuration", () => {
    const c = new Cron();
    expect("SetInterval" in (c as object)).toBe(false);
  });

  it("sets timezone before start", () => {
    const c = new Cron();
    const location = { string: () => "Asia/Tokyo" };

    c.SetTimezone(location);

    const internal = c as unknown as { timezone: string };
    expect(internal.timezone).toBe("Asia/Tokyo");
    expect(c.HasStarted()).toBe(false);
    expect(() => c.SetTimezone({ string: () => "invalid" })).toThrow("unknown time zone");
  });

  it("exposes the PocketBase JSVM timezone method", () => {
    const c = new Cron();
    c.setTimezone({ string: () => "Asia/Tokyo" });

    const internal = c as unknown as { timezone: string };
    expect(internal.timezone).toBe("Asia/Tokyo");
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

  it("uses Bun.cron for the default scheduler", async () => {
    const fake = createFakeBunCron();
    using _bunCronSpy = spyOn(bunWithCron, "cron").mockImplementation(fake.register);

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
    expect(fake.registrations.map((registration) => registration.options)).toEqual([{ tz: "UTC" }, { tz: "UTC" }]);

    fake.registrations[1]?.handler();
    fake.registrations[0]?.handler();
    await nextMicrotask();
    expect(calls).toBe("ba");

    c.Add("a", "3 * * * *", () => {
      calls += "A";
    });

    expect(fake.registrations.map((registration) => registration.cronExpr)).toEqual(["1 * * * *", "2 * * * *", "3 * * * *"]);
    expect(fake.registrations[0]?.stopCalls).toBe(1);

    c.Remove("b");
    expect(fake.registrations[1]?.stopCalls).toBe(1);

    fake.registrations[2]?.handler();
    await nextMicrotask();
    expect(calls).toBe("baA");

    c.Stop();
    expect(fake.registrations[2]?.stopCalls).toBe(1);
    expect(c.HasStarted()).toBe(false);
  });

  it("restarts running jobs after changing timezone", () => {
    const fake = createFakeBunCron();
    using _bunCronSpy = spyOn(bunWithCron, "cron").mockImplementation(fake.register);

    const c = new Cron();
    c.Add("job", "0 9 * * *", () => {});
    c.Start();
    c.SetTimezone({ string: () => "Asia/Tokyo" });

    expect(fake.registrations).toHaveLength(2);
    expect(fake.registrations[0]?.options).toEqual({ tz: "UTC" });
    expect(fake.registrations[0]?.stopCalls).toBe(1);
    expect(fake.registrations[1]?.options).toEqual({ tz: "Asia/Tokyo" });
    expect(c.HasStarted()).toBe(true);

    c.Stop();
  });

  it("recovers cron job panics", async () => {
    const fake = createFakeBunCron();
    using _bunCronSpy = spyOn(bunWithCron, "cron").mockImplementation(fake.register);
    using _warnSpy = spyOn(console, "warn").mockImplementation(() => {});

    const c = new Cron();
    let calls = 0;

    c.Add("panic", "* * * * *", () => {
      calls += 1;
      throw new Error("test panic");
    });

    c.Start();

    expect(fake.registrations.length).toBe(1);
    expect(() => fake.registrations[0]?.handler()).not.toThrow();
    await nextMicrotask();

    expect(calls).toBe(1);
    expect(_warnSpy).toHaveBeenCalled();
  });
});

function nextMicrotask(): Promise<void> {
  return new Promise((resolve) => queueMicrotask(resolve));
}
