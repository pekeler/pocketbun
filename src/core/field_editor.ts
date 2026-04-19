// Ported from pocketbase/core/field_editor.go

import type { App } from "./app.ts";
import type { Collection } from "./collection_model.ts";
import { toStringValue } from "../internal/compat/cast.ts";
import { ValidationErrors, ErrRequired, newError } from "../internal/compat/validation.ts";
import {
  Fields,
  type Field,
  type MaxBodySizeCalculator,
  defaultFieldHelpValidationRule,
  defaultFieldIdValidationRule,
  defaultFieldNameValidationRule,
  maxSafeJSONInt,
} from "./field.ts";
import { ErrUnsupportedValueType } from "./validators/validators.ts";

export const FieldTypeEditor = "editor";
export const DefaultEditorFieldMaxSize = 5 << 20;

// EditorField defines "editor" type field to store HTML formatted text.
//
// The respective zero record field value is empty string.
export class EditorField implements Field, MaxBodySizeCalculator {
  Name = "";
  Id = "";
  System = false;
  Hidden = false;
  Presentable = false;
  Help = "";
  MaxSize = 0;
  ConvertURLs = false;
  Required = false;

  // Type implements [Field.Type] interface method.
  Type(): string {
    return FieldTypeEditor;
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
    return "TEXT DEFAULT '' NOT NULL";
  }

  // PrepareValue implements [Field.PrepareValue] interface method.
  PrepareValue(_record: unknown, raw: unknown): string {
    return toStringValue(raw);
  }

  // ValidateValue implements [Field.ValidateValue] interface method.
  ValidateValue(_ctx: unknown, _app: App, record: RecordLike): Error | null {
    const value = record.GetRaw(this.Name);
    if (typeof value !== "string") {
      return ErrUnsupportedValueType;
    }

    if (this.Required && value === "") {
      return ErrRequired;
    }

    const maxSize = this.CalculateMaxBodySize();
    if (value.length > maxSize) {
      return newError("validation_content_size_limit", "The maximum allowed content size is {{.maxSize}} bytes").setParams({
        maxSize,
      });
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
    const helpErr = defaultFieldHelpValidationRule(this.Help);
    if (helpErr) {
      errors.help = helpErr;
    }
    if (this.MaxSize < 0 || this.MaxSize > maxSafeJSONInt) {
      errors.maxSize = newError("validation_invalid_max", "Invalid maxSize value.");
    }
    return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
  }

  // CalculateMaxBodySize implements the [MaxBodySizeCalculator] interface.
  CalculateMaxBodySize(): number {
    if (this.MaxSize <= 0) {
      return DefaultEditorFieldMaxSize;
    }
    return this.MaxSize;
  }
}

type RecordLike = {
  GetRaw: (field: string) => unknown;
};

Fields[FieldTypeEditor] = () => new EditorField();
