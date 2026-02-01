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

export class JSONField implements Field, MaxBodySizeCalculator {
  Name = "";
  Id = "";
  System = false;
  Hidden = false;
  Presentable = false;
  MaxSize = 0;
  Required = false;

  Type(): string {
    return FieldTypeJSON;
  }

  GetId(): string {
    return this.Id;
  }

  SetId(id: string): void {
    this.Id = id;
  }

  GetName(): string {
    return this.Name;
  }

  SetName(name: string): void {
    this.Name = name;
  }

  GetSystem(): boolean {
    return this.System;
  }

  SetSystem(system: boolean): void {
    this.System = system;
  }

  GetHidden(): boolean {
    return this.Hidden;
  }

  SetHidden(hidden: boolean): void {
    this.Hidden = hidden;
  }

  ColumnType(_app: App): string {
    return "JSON DEFAULT NULL";
  }

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
