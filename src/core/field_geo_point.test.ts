// Ported from pocketbase/core/field_geo_point_test.go

import { describe, expect, it } from "bun:test";
import { newUnbootstrappedTestApp } from "../tests/app.ts";
import { GeoPoint } from "../tools/types/index.ts";
import { NewBaseCollection } from "./collection_model.ts";
import {
  testDefaultFieldHelpValidation,
  testDefaultFieldIdValidation,
  testDefaultFieldNameValidation,
  testFieldBaseMethods,
} from "./field.test.ts";
import { GeoPointField, FieldTypeGeoPoint } from "./field_geo_point.ts";
import { NewRecord } from "./record_model.ts";

describe("geoPoint field", () => {
  it("base methods", () => {
    testFieldBaseMethods(FieldTypeGeoPoint);
  });

  it("column type", async () => {
    const { app, cleanup } = await newUnbootstrappedTestApp();
    try {
      const field = new GeoPointField();
      expect(field.ColumnType(app)).toBe(`JSON DEFAULT '{"lon":0,"lat":0}' NOT NULL`);
    } finally {
      await cleanup();
    }
  });

  it("prepare value", async () => {
    const { cleanup } = await newUnbootstrappedTestApp();
    try {
      const field = new GeoPointField();
      const record = NewRecord(NewBaseCollection("test"));
      const scenarios = [
        { raw: null, expected: `{"lon":0,"lat":0}` },
        { raw: "", expected: `{"lon":0,"lat":0}` },
        { raw: new Uint8Array(), expected: `{"lon":0,"lat":0}` },
        { raw: {}, expected: `{"lon":0,"lat":0}` },
        { raw: new GeoPoint(10, 20), expected: `{"lon":10,"lat":20}` },
        { raw: new GeoPoint(10, 20), expected: `{"lon":10,"lat":20}` },
        { raw: `{"lon": 10, "lat": 20}`, expected: `{"lon":10,"lat":20}` },
        { raw: { lon: 10, lat: 20 }, expected: `{"lon":10,"lat":20}` },
        { raw: { lon: 10, lat: 20 }, expected: `{"lon":10,"lat":20}` },
      ];

      for (const [index, scenario] of scenarios.entries()) {
        const value = field.PrepareValue(record, scenario.raw);
        expect(JSON.stringify(value), `scenario ${index}`).toBe(scenario.expected);
      }
    } finally {
      await cleanup();
    }
  });

  it("validate value", async () => {
    const { app, cleanup } = await newUnbootstrappedTestApp();
    try {
      const collection = NewBaseCollection("test_collection");
      const scenarios = [
        {
          name: "invalid raw value",
          field: Object.assign(new GeoPointField(), { Name: "test" }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", 123);
            return record;
          },
          expectError: true,
        },
        {
          name: "zero field value (non-required)",
          field: Object.assign(new GeoPointField(), { Name: "test" }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", new GeoPoint());
            return record;
          },
          expectError: false,
        },
        {
          name: "zero field value (required)",
          field: Object.assign(new GeoPointField(), { Name: "test", Required: true }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", new GeoPoint());
            return record;
          },
          expectError: true,
        },
        {
          name: "non-zero Lat field value (required)",
          field: Object.assign(new GeoPointField(), { Name: "test", Required: true }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", new GeoPoint(0, 1));
            return record;
          },
          expectError: false,
        },
        {
          name: "non-zero Lon field value (required)",
          field: Object.assign(new GeoPointField(), { Name: "test", Required: true }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", new GeoPoint(1, 0));
            return record;
          },
          expectError: false,
        },
        {
          name: "non-zero Lat-Lon field value (required)",
          field: Object.assign(new GeoPointField(), { Name: "test", Required: true }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", new GeoPoint(-1, -2));
            return record;
          },
          expectError: false,
        },
        {
          name: "lat < -90",
          field: Object.assign(new GeoPointField(), { Name: "test" }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", new GeoPoint(0, -90.1));
            return record;
          },
          expectError: true,
        },
        {
          name: "lat > 90",
          field: Object.assign(new GeoPointField(), { Name: "test" }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", new GeoPoint(0, 90.1));
            return record;
          },
          expectError: true,
        },
        {
          name: "lon < -180",
          field: Object.assign(new GeoPointField(), { Name: "test" }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", new GeoPoint(-180.1, 0));
            return record;
          },
          expectError: true,
        },
        {
          name: "lon > 180",
          field: Object.assign(new GeoPointField(), { Name: "test" }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", new GeoPoint(180.1, 0));
            return record;
          },
          expectError: true,
        },
      ];

      for (const scenario of scenarios) {
        const err = scenario.field.ValidateValue(null, app, scenario.record());
        expect(Boolean(err), scenario.name).toBe(scenario.expectError);
      }
    } finally {
      await cleanup();
    }
  });

  it("validate settings", async () => {
    await testDefaultFieldIdValidation(FieldTypeGeoPoint);
    await testDefaultFieldNameValidation(FieldTypeGeoPoint);
    await testDefaultFieldHelpValidation(FieldTypeGeoPoint);
  });
});
