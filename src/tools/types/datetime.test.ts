// Ported from pocketbase/tools/types/datetime_test.go.

import { describe, expect, it } from "bun:test";
import { DateTime, NowDateTime, ParseDateTime } from "./datetime.ts";

describe("DateTime", () => {
  it("NowDateTime", () => {
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    const dt = NowDateTime();
    expect(dt.String()).toContain(now);
  });

  it("ParseDateTime", () => {
    const nowTime = new Date();
    const nowDateTime = ParseDateTime(nowTime);
    const nowStr = nowTime.toISOString().replace("T", " ").replace("Z", "Z");

    const scenarios: Array<{ value: unknown; expected: string }> = [
      { value: null, expected: "" },
      { value: "", expected: "" },
      { value: "invalid", expected: "" },
      { value: nowDateTime, expected: nowStr },
      { value: nowTime, expected: nowStr },
      { value: 1641024040, expected: "2022-01-01 08:00:40.000Z" },
      { value: 1641024040n, expected: "2022-01-01 08:00:40.000Z" },
      { value: "2022-01-01 11:23:45.678", expected: "2022-01-01 11:23:45.678Z" },
    ];

    for (const scenario of scenarios) {
      const dt = ParseDateTime(scenario.value);
      if (scenario.expected === nowStr) {
        expect(dt.String()).toContain(nowStr.slice(0, 19));
      } else {
        expect(dt.String()).toBe(scenario.expected);
      }
    }
  });

  it("DateTime Time", () => {
    const str = "2022-01-01 11:23:45.678Z";
    const expected = new Date(str);
    const dt = ParseDateTime(str);
    const result = dt.Time();
    expect(result.getTime()).toBe(expected.getTime());
  });

  it("DateTime Add", () => {
    const d1 = ParseDateTime("2024-01-01 10:00:00.123Z");
    const d2 = d1.Add(1 * 60 * 60 * 1000);
    expect(d1.String()).toBe("2024-01-01 10:00:00.123Z");
    expect(d2.String()).toBe("2024-01-01 11:00:00.123Z");
  });

  it("DateTime Sub", () => {
    const d1 = ParseDateTime("2024-01-01 10:00:00.123Z");
    const d2 = ParseDateTime("2024-01-01 10:30:00.123Z");
    const result = d2.Sub(d1);
    expect(result / (60 * 1000)).toBe(30);
  });

  it("DateTime AddDate", () => {
    const d1 = ParseDateTime("2024-01-01 10:00:00.123Z");
    const d2 = d1.AddDate(1, 2, 3);
    expect(d1.String()).toBe("2024-01-01 10:00:00.123Z");
    expect(d2.String()).toBe("2025-03-04 10:00:00.123Z");
  });

  it("DateTime After", () => {
    const d1 = ParseDateTime("2024-01-01 10:00:00.123Z");
    const d2 = ParseDateTime("2024-01-02 10:00:00.123Z");
    const d3 = ParseDateTime("2024-01-03 10:00:00.123Z");

    const scenarios = [
      { a: d1, b: d1, expect: false },
      { a: d1, b: d2, expect: false },
      { a: d1, b: d3, expect: false },
      { a: d2, b: d1, expect: true },
      { a: d2, b: d2, expect: false },
      { a: d2, b: d3, expect: false },
      { a: d3, b: d1, expect: true },
      { a: d3, b: d2, expect: true },
      { a: d3, b: d3, expect: false },
    ];

    for (const scenario of scenarios) {
      expect(scenario.a.After(scenario.b)).toBe(scenario.expect);
    }
  });

  it("DateTime Before", () => {
    const d1 = ParseDateTime("2024-01-01 10:00:00.123Z");
    const d2 = ParseDateTime("2024-01-02 10:00:00.123Z");
    const d3 = ParseDateTime("2024-01-03 10:00:00.123Z");

    const scenarios = [
      { a: d1, b: d1, expect: false },
      { a: d1, b: d2, expect: true },
      { a: d1, b: d3, expect: true },
      { a: d2, b: d1, expect: false },
      { a: d2, b: d2, expect: false },
      { a: d2, b: d3, expect: true },
      { a: d3, b: d1, expect: false },
      { a: d3, b: d2, expect: false },
      { a: d3, b: d3, expect: false },
    ];

    for (const scenario of scenarios) {
      expect(scenario.a.Before(scenario.b)).toBe(scenario.expect);
    }
  });

  it("DateTime Compare", () => {
    const d1 = ParseDateTime("2024-01-01 10:00:00.123Z");
    const d2 = ParseDateTime("2024-01-02 10:00:00.123Z");
    const d3 = ParseDateTime("2024-01-03 10:00:00.123Z");

    const scenarios = [
      { a: d1, b: d1, expect: 0 },
      { a: d1, b: d2, expect: -1 },
      { a: d1, b: d3, expect: -1 },
      { a: d2, b: d1, expect: 1 },
      { a: d2, b: d2, expect: 0 },
      { a: d2, b: d3, expect: -1 },
      { a: d3, b: d1, expect: 1 },
      { a: d3, b: d2, expect: 1 },
      { a: d3, b: d3, expect: 0 },
    ];

    for (const scenario of scenarios) {
      expect(scenario.a.Compare(scenario.b)).toBe(scenario.expect);
    }
  });

  it("DateTime Equal", () => {
    const d1 = ParseDateTime("2024-01-01 10:00:00.123Z");
    const d2 = ParseDateTime("2024-01-01 10:00:00.123Z");
    const d3 = ParseDateTime("2024-01-01 10:00:00.124Z");

    const scenarios = [
      { a: d1, b: d1, expect: true },
      { a: d1, b: d2, expect: true },
      { a: d1, b: d3, expect: false },
    ];

    for (const scenario of scenarios) {
      expect(scenario.a.Equal(scenario.b)).toBe(scenario.expect);
    }
  });

  it("DateTime Unix", () => {
    const scenarios = [
      { date: "", expected: -62135596800 },
      { date: "2022-01-01 11:23:45.678Z", expected: 1641036225 },
    ];

    for (const scenario of scenarios) {
      const dt = ParseDateTime(scenario.date);
      expect(dt.Unix()).toBe(scenario.expected);
    }
  });

  it("DateTime IsZero", () => {
    const dt0 = new DateTime();
    expect(dt0.IsZero()).toBe(true);

    const dt1 = NowDateTime();
    expect(dt1.IsZero()).toBe(false);
  });

  it("DateTime String", () => {
    const dt0 = new DateTime();
    expect(dt0.String()).toBe("");

    const expected = "2022-01-01 11:23:45.678Z";
    const dt1 = ParseDateTime(expected);
    expect(dt1.String()).toBe(expected);
  });

  it("DateTime MarshalJSON", () => {
    const scenarios = [
      { date: "", expected: '""' },
      { date: "2022-01-01 11:23:45.678", expected: '"2022-01-01 11:23:45.678Z"' },
    ];

    for (const scenario of scenarios) {
      const dt = ParseDateTime(scenario.date);
      expect(dt.MarshalJSON()).toBe(scenario.expected);
    }
  });

  it("DateTime UnmarshalJSON", () => {
    const scenarios = [
      { date: "", expected: "" },
      { date: "invalid_json", expected: "" },
      { date: "'123'", expected: "" },
      { date: "2022-01-01 11:23:45.678", expected: "" },
      { date: `"2022-01-01 11:23:45.678"`, expected: "2022-01-01 11:23:45.678Z" },
    ];

    for (const scenario of scenarios) {
      const dt = new DateTime();
      dt.UnmarshalJSON(scenario.date);
      expect(dt.String()).toBe(scenario.expected);
    }
  });

  it("DateTime Value", () => {
    const scenarios = [
      { value: "", expected: "" },
      { value: "invalid", expected: "" },
      { value: 1641024040, expected: "2022-01-01 08:00:40.000Z" },
      { value: "2022-01-01 11:23:45.678", expected: "2022-01-01 11:23:45.678Z" },
    ];

    for (const scenario of scenarios) {
      const dt = ParseDateTime(scenario.value);
      expect(dt.Value()).toBe(scenario.expected);
    }
  });

  it("DateTime Scan", () => {
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");

    const scenarios: Array<{ value: unknown; expected: string }> = [
      { value: null, expected: "" },
      { value: "", expected: "" },
      { value: "invalid", expected: "" },
      { value: NowDateTime(), expected: now },
      { value: new Date(), expected: now },
      { value: 1.0, expected: "1970-01-01 00:00:01.000Z" },
      { value: 1641024040, expected: "2022-01-01 08:00:40.000Z" },
      { value: "2022-01-01 11:23:45.678", expected: "2022-01-01 11:23:45.678Z" },
    ];

    for (const scenario of scenarios) {
      const dt = new DateTime();
      dt.Scan(scenario.value);
      if (scenario.expected === "") {
        expect(dt.String()).toBe("");
      } else if (scenario.expected === now) {
        expect(dt.String()).toContain(now);
      } else {
        expect(dt.String()).toBe(scenario.expected);
      }
    }
  });
});
