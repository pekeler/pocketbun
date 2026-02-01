// Ported from pocketbase/tools/cron/cron_test.go

import { describe, expect, it } from "bun:test";
import type { Job } from "./job.ts";
import { Cron } from "./cron.ts";

function normalizeSchedule(job: Job): unknown {
  return JSON.parse(JSON.stringify(job.Schedule()));
}

describe("Cron", () => {
  it("uses defaults", () => {
    const c = new Cron();
    const internal = c as unknown as {
      intervalMs: number;
      timezone: string;
      jobs: Job[];
      ticker: ReturnType<typeof setInterval> | null;
    };

    expect(internal.intervalMs).toBe(60_000);
    expect(internal.timezone).toBe("UTC");
    expect(internal.jobs.length).toBe(0);
    expect(internal.ticker).toBeNull();
  });

  it("sets interval", () => {
    const c = new Cron();
    c.SetInterval(120_000);
    const internal = c as unknown as { intervalMs: number };
    expect(internal.intervalMs).toBe(120_000);
  });

  it("sets timezone", () => {
    const c = new Cron();
    c.SetTimezone("Asia/Tokyo");
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

    const expectedSchedules: Record<string, string> = {
      test2: `{"minutes":{"1":{}},"hours":{"2":{}},"days":{"3":{}},"months":{"4":{}},"daysOfWeek":{"5":{}}}`,
      test3: `{"minutes":{"0":{},"1":{},"10":{},"11":{},"12":{},"13":{},"14":{},"15":{},"16":{},"17":{},"18":{},"19":{},"2":{},"20":{},"21":{},"22":{},"23":{},"24":{},"25":{},"26":{},"27":{},"28":{},"29":{},"3":{},"30":{},"31":{},"32":{},"33":{},"34":{},"35":{},"36":{},"37":{},"38":{},"39":{},"4":{},"40":{},"41":{},"42":{},"43":{},"44":{},"45":{},"46":{},"47":{},"48":{},"49":{},"5":{},"50":{},"51":{},"52":{},"53":{},"54":{},"55":{},"56":{},"57":{},"58":{},"59":{},"6":{},"7":{},"8":{},"9":{}},"hours":{"0":{},"1":{},"10":{},"11":{},"12":{},"13":{},"14":{},"15":{},"16":{},"17":{},"18":{},"19":{},"2":{},"20":{},"21":{},"22":{},"23":{},"3":{},"4":{},"5":{},"6":{},"7":{},"8":{},"9":{}},"days":{"1":{},"10":{},"11":{},"12":{},"13":{},"14":{},"15":{},"16":{},"17":{},"18":{},"19":{},"2":{},"20":{},"21":{},"22":{},"23":{},"24":{},"25":{},"26":{},"27":{},"28":{},"29":{},"3":{},"30":{},"31":{},"4":{},"5":{},"6":{},"7":{},"8":{},"9":{}},"months":{"1":{},"10":{},"11":{},"12":{},"2":{},"3":{},"4":{},"5":{},"6":{},"7":{},"8":{},"9":{}},"daysOfWeek":{"0":{},"1":{},"2":{},"3":{},"4":{},"5":{},"6":{}}}`,
      test5: `{"minutes":{"1":{}},"hours":{"2":{}},"days":{"3":{}},"months":{"4":{}},"daysOfWeek":{"5":{}}}`,
    };

    for (const [key, expected] of Object.entries(expectedSchedules)) {
      const job = indexedJobs.get(key);
      expect(job).toBeTruthy();
      if (!job) {
        continue;
      }
      expect(normalizeSchedule(job)).toEqual(JSON.parse(expected));
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

  it("starts and stops ticking", async () => {
    const c = new Cron();
    let test1 = 0;
    let test2 = 0;

    const intervalMs = 250;
    c.SetInterval(intervalMs);

    // Align start close to the next interval boundary to avoid timer edge flakiness in JS.
    const alignDelay = intervalMs - (Date.now() % intervalMs);
    await new Promise((resolve) => setTimeout(resolve, alignDelay + 5));

    c.Add("test1", "* * * * *", () => {
      test1 += 1;
    });
    c.Add("test2", "* * * * *", () => {
      test2 += 1;
    });

    c.Start();
    c.Start();

    await new Promise((resolve) => setTimeout(resolve, 505));

    c.Stop();
    c.Stop();

    expect(test1).toBe(2);
    expect(test2).toBe(2);

    const alignDelay2 = intervalMs - (Date.now() % intervalMs);
    await new Promise((resolve) => setTimeout(resolve, alignDelay2 + 5));

    c.Start();

    await new Promise((resolve) => setTimeout(resolve, 1005));

    c.Stop();

    expect(test1).toBe(6);
    expect(test2).toBe(6);
  });
});
