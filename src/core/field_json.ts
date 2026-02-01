// Ported from pocketbase/core/field_json.go

import type { App } from "./app.ts";
import type { Collection } from "./collection.ts";
import { ErrRequired, ValidationErrors, newError } from "../internal/compat/validation.ts";
import { JSONRaw } from "../tools/types/json_raw.ts";
import {
  Fields,
  type Field,
  type MaxBodySizeCalculator,
  defaultFieldIdValidationRule,
  defaultFieldNameValidationRule,
  maxSafeJSONInt,
} from "./field.ts";
import { ErrUnsupportedValueType } from "./validators/validators.ts";

export const FieldTypeJSON = "json";
export const DefaultJSONFieldMaxSize = 1 << 20;

const emptyJSONValues = new Set(["null", '""', "[]", "{}", ""]);

// JSONField defines "json" type field for storing any serialized JSON value.
//
// The respective zero record field value is the zero [types.JSONRaw].
export class JSONField implements Field, MaxBodySizeCalculator {
  Name = "";
  Id = "";
  System = false;
  Hidden = false;
  Presentable = false;
  MaxSize = 0;
  Required = false;

  // Type implements [Field.Type] interface method.
  Type(): string {
    return FieldTypeJSON;
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
    return "JSON DEFAULT NULL";
  }

  // PrepareValue implements [Field.PrepareValue] interface method.
  PrepareValue(_record: unknown, raw: unknown): JSONRaw {
    let value = raw;
    if (typeof raw === "string") {
      if (raw === "") {
        value = JSON.stringify(raw);
      } else if (raw === "null" || raw === "true" || raw === "false") {
        value = raw;
      } else {
        const first = raw[0];
        if (first && ((first >= "0" && first <= "9") || first === "-" || first === '"' || first === "[" || first === "{")) {
          if (isJson(raw)) {
            value = raw;
          } else {
            value = JSON.stringify(raw);
          }
        } else {
          value = JSON.stringify(raw);
        }
      }
    }

    return JSONRaw.parse(value);
  }

  // ValidateValue implements [Field.ValidateValue] interface method.
  ValidateValue(_ctx: unknown, _app: App, record: RecordLike): Error | null {
    const raw = record.GetRaw(this.Name);
    if (!(raw instanceof JSONRaw)) {
      return ErrUnsupportedValueType;
    }

    const maxSize = this.CalculateMaxBodySize();
    if (raw.toString().length > maxSize) {
      return newError("validation_json_size_limit", "The maximum allowed JSON size is {{.maxSize}} bytes").setParams({
        maxSize,
      });
    }

    if (!isJson(raw.toString())) {
      return newError("validation_invalid_json", "Must be a valid json value");
    }

    const rawStr = raw.toString().trim();
    if (this.Required && emptyJSONValues.has(rawStr)) {
      return ErrRequired;
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
    if (this.MaxSize < 0 || this.MaxSize > maxSafeJSONInt) {
      errors.maxSize = newError("validation_invalid_max", "Invalid maxSize value.");
    }
    return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
  }

  // CalculateMaxBodySize implements the [MaxBodySizeCalculator] interface.
  CalculateMaxBodySize(): number {
    return this.MaxSize > 0 ? this.MaxSize : DefaultJSONFieldMaxSize;
  }
}

type RecordLike = {
  GetRaw: (field: string) => unknown;
};

function isJson(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

Fields[FieldTypeJSON] = () => new JSONField();
