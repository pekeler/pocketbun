// Ported from pocketbase/core/field_geo_point.go

import type { App } from "./app.ts";
import type { Collection } from "./collection.ts";
import { ValidationErrors, ErrRequired, newError } from "../internal/compat/validation.ts";
import { GeoPoint } from "../tools/types/index.ts";
import { Fields, type Field, defaultFieldIdValidationRule, defaultFieldNameValidationRule } from "./field.ts";
import { ErrUnsupportedValueType } from "./validators/validators.ts";

export const FieldTypeGeoPoint = "geoPoint";

// GeoPointField defines "geoPoint" type field for storing latitude and longitude GPS coordinates.
//
// You can set the record field value as [types.GeoPoint], map or serialized json object with lat-lon props.
// The stored value is always converted to [types.GeoPoint].
// Nil, empty map, empty bytes slice, etc. results in zero [types.GeoPoint].
//
// Examples of updating a record's GeoPointField value programmatically:
//
//	record.Set("location", types.GeoPoint{Lat: 123, Lon: 456})
//	record.Set("location", map[string]any{"lat":123, "lon":456})
//	record.Set("location", []byte(`{"lat":123, "lon":456}`)
export class GeoPointField implements Field {
  Name = "";
  Id = "";
  System = false;
  Hidden = false;
  Presentable = false;
  Required = false;

  // Type implements [Field.Type] interface method.
  Type(): string {
    return FieldTypeGeoPoint;
  }

  // GetId implements [Field.GetId] interface method.
  GetId(): string {
    return this.Id;
  }

  // SetId implements [Field.SetId] interface method.
  SetId(id: string): void {
    this.Id = id;
  }

  // GetName implements [Field.GetName] interface method.
  GetName(): string {
    return this.Name;
  }

  // SetName implements [Field.SetName] interface method.
  SetName(name: string): void {
    this.Name = name;
  }

  // GetSystem implements [Field.GetSystem] interface method.
  GetSystem(): boolean {
    return this.System;
  }

  // SetSystem implements [Field.SetSystem] interface method.
  SetSystem(system: boolean): void {
    this.System = system;
  }

  // GetHidden implements [Field.GetHidden] interface method.
  GetHidden(): boolean {
    return this.Hidden;
  }

  // SetHidden implements [Field.SetHidden] interface method.
  SetHidden(hidden: boolean): void {
    this.Hidden = hidden;
  }

  // ColumnType implements [Field.ColumnType] interface method.
  ColumnType(_app: App): string {
    return `JSON DEFAULT '{"lon":0,"lat":0}' NOT NULL`;
  }

  // PrepareValue implements [Field.PrepareValue] interface method.
  PrepareValue(_record: unknown, raw: unknown): GeoPoint {
    const point = new GeoPoint();
    void point.Scan(raw);
    return point;
  }

  // ValidateValue implements [Field.ValidateValue] interface method.
  ValidateValue(_ctx: unknown, _app: App, record: RecordLike): Error | null {
    const value = record.GetRaw(this.Name);
    if (!(value instanceof GeoPoint)) {
      return ErrUnsupportedValueType;
    }

    if (value.Lat === 0 && value.Lon === 0) {
      if (this.Required) {
        return ErrRequired;
      }
      return null;
    }

    if (value.Lat < -90 || value.Lat > 90) {
      return newError("validation_invalid_latitude", "Latitude must be between -90 and 90 degrees.");
    }

    if (value.Lon < -180 || value.Lon > 180) {
      return newError("validation_invalid_longitude", "Longitude must be between -180 and 180 degrees.");
    }

    return null;
  }

  // ValidateSettings implements [Field.ValidateSettings] interface method.
  ValidateSettings(_ctx: unknown, _app: App, _collection: Collection): Error | null {
    const errors: Record<string, Error> = {};
    const idErr = defaultFieldIdValidationRule(this.Id);
    if (idErr) {
      errors.id = idErr;
    }
    const nameErr = defaultFieldNameValidationRule(this.Name);
    if (nameErr) {
      errors.name = nameErr;
    }
    return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
  }
}

type RecordLike = {
  GetRaw: (field: string) => unknown;
};

Fields[FieldTypeGeoPoint] = () => new GeoPointField();
