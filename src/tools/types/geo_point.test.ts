// Ported from pocketbase/tools/types/geo_point_test.go

import { describe, expect, it } from "bun:test";
import { GeoPoint } from "./geo_point.ts";
import { JSONRaw } from "./json_raw.ts";

describe("GeoPoint", () => {
  it("as map", () => {
    const scenarios = [
      { name: "zero", point: new GeoPoint(), expected: { lon: 0, lat: 0 } },
      { name: "non-zero", point: new GeoPoint(-10, 20.123), expected: { lon: -10, lat: 20.123 } },
    ];

    for (const scenario of scenarios) {
      const result = scenario.point.AsMap();
      expect(Object.keys(result).length, scenario.name).toBe(Object.keys(scenario.expected).length);
      for (const [key, value] of Object.entries(scenario.expected)) {
        expect(result[key], `${scenario.name}-${key}`).toBe(value);
      }
    }
  });

  it("string and value", () => {
    const scenarios = [
      { name: "zero", point: new GeoPoint(), expected: `{"lon":0,"lat":0}` },
      {
        name: "non-zero",
        point: new GeoPoint(-10, 20.123),
        expected: `{"lon":-10,"lat":20.123}`,
      },
    ];

    for (const scenario of scenarios) {
      const str = scenario.point.String();
      const value = scenario.point.Value();
      expect(str, scenario.name).toBe(value);
      expect(str, scenario.name).toBe(scenario.expected);
    }
  });

  it("scan", () => {
    const scenarios = [
      { value: null, expectErr: false, expectStr: `{"lon":1,"lat":2}` },
      { value: "", expectErr: false, expectStr: `{"lon":1,"lat":2}` },
      { value: new JSONRaw(), expectErr: false, expectStr: `{"lon":1,"lat":2}` },
      { value: new Uint8Array(), expectErr: false, expectStr: `{"lon":1,"lat":2}` },
      { value: `{}`, expectErr: false, expectStr: `{"lon":1,"lat":2}` },
      { value: `[]`, expectErr: true, expectStr: `{"lon":1,"lat":2}` },
      { value: 0, expectErr: true, expectStr: `{"lon":1,"lat":2}` },
      { value: `{"lon":"1.23","lat":"4.56"}`, expectErr: true, expectStr: `{"lon":1,"lat":2}` },
      { value: `{"lon":1.23,"lat":4.56}`, expectErr: false, expectStr: `{"lon":1.23,"lat":4.56}` },
      {
        value: new TextEncoder().encode(`{"lon":1.23,"lat":4.56}`),
        expectErr: false,
        expectStr: `{"lon":1.23,"lat":4.56}`,
      },
      {
        value: new JSONRaw(`{"lon":1.23,"lat":4.56}`),
        expectErr: false,
        expectStr: `{"lon":1.23,"lat":4.56}`,
      },
      { value: new GeoPoint(), expectErr: false, expectStr: `{"lon":0,"lat":0}` },
      { value: new GeoPoint(1.23, 4.56), expectErr: false, expectStr: `{"lon":1.23,"lat":4.56}` },
      {
        value: new GeoPoint(1.23, 4.56),
        expectErr: false,
        expectStr: `{"lon":1.23,"lat":4.56}`,
      },
    ];

    for (const [index, scenario] of scenarios.entries()) {
      const point = new GeoPoint(1, 2);
      const err = point.Scan(scenario.value);
      expect(Boolean(err), `scenario ${index}`).toBe(scenario.expectErr);
      expect(point.String(), `scenario ${index}`).toBe(scenario.expectStr);
    }
  });
});
