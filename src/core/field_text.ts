// Ported from pocketbase/core/field_text.go
// Note: validation aggregation and some DB helper checks are simplified.

import type { App } from "./app.ts";
import type { Collection } from "./collection_model.ts";
import { toStringValue } from "../internal/compat/cast.ts";
import { ErrRequired, ValidationErrors, newError, required } from "../internal/compat/validation.ts";
import { randomStringByRegex } from "../tools/security/random.ts";
import {
  Fields,
  InterceptorActionCreate,
  InterceptorActionValidate,
  type Field,
  type RecordLike,
  type SetterFinder,
  type SetterFunc,
  type RecordInterceptor,
  defaultFieldHelpValidationRule,
  defaultFieldIdValidationRule,
  defaultFieldNameValidationRule,
  maxSafeJSONInt,
} from "./field.ts";
import { isRegex } from "./validators/string.ts";
import { ErrUnsupportedValueType } from "./validators/validators.ts";

export const FieldTypeText = "text";
export const autogenerateModifier = ":autogenerate";
export const defaultLowercaseRecordIdPattern = "^[a-z0-9]+$";
const idColumn = "id";

const forbiddenPKCharacters = [
  ".",
  "/",
  "\\",
  "|",
  '"',
  "'",
  "`",
  "<",
  ">",
  ":",
  "?",
  "*",
  "%",
  "$",
  "\u0000",
  "\t",
  "\n",
  "\r",
  " ",
];

// (see largestReservedPKLength)
const caseInsensitiveReservedPKs = [
  "CON",
  "PRN",
  "AUX",
  "NUL",
  "COM1",
  "COM2",
  "COM3",
  "COM4",
  "COM5",
  "COM6",
  "COM7",
  "COM8",
  "COM9",
  "LPT1",
  "LPT2",
  "LPT3",
  "LPT4",
  "LPT5",
  "LPT6",
  "LPT7",
  "LPT8",
  "LPT9",
];

const largestReservedPKLength = 4;

// TextField defines "text" type field for storing any string value.
//
// The respective zero record field value is empty string.
//
// The following additional setter keys are available:
//
// - "fieldName:autogenerate" - autogenerate field value if AutogeneratePattern is set. For example:
//
//	record.Set("slug:autogenerate", "") // [random value]
//	record.Set("slug:autogenerate", "abc-") // abc-[random value]
export class TextField implements Field, SetterFinder, RecordInterceptor {
  Name = "";
  Id = "";
  System = false;
  Hidden = false;
  Presentable = false;
  Help = "";
  Min = 0;
  Max = 0;
  Pattern = "";
  AutogeneratePattern = "";
  Required = false;
  PrimaryKey = false;
  // PocketBun perf deviation (behavior-compatible): cache compiled pattern regexes
  // to avoid recompiling on every ValidatePlainValue() call.
  #cachedPattern = "";
  #cachedPatternRegex: RegExp | null = null;

  // Type implements [Field.Type] interface method.
  Type(): string {
    return FieldTypeText;
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
    if (this.PrimaryKey) {
      return "TEXT PRIMARY KEY DEFAULT ('r'||lower(hex(randomblob(7)))) NOT NULL";
    }
    return "TEXT DEFAULT '' NOT NULL";
  }

  // PrepareValue implements [Field.PrepareValue] interface method.
  PrepareValue(_record: unknown, raw: unknown): string {
    return toStringValue(raw);
  }

  // ValidateValue implements [Field.ValidateValue] interface method.
  ValidateValue(_ctx: unknown, app: App, record: RecordLike): Error | null {
    const newVal = record.GetRaw(this.Name);
    if (typeof newVal !== "string") {
      return ErrUnsupportedValueType;
    }

    if (this.PrimaryKey) {
      if (!record.IsNew()) {
        const oldVal = record.LastSavedPK();
        if (oldVal !== newVal) {
          return newError("validation_pk_change", "The record primary key cannot be changed.");
        }
        if (oldVal !== "") {
          return null;
        }
      } else if (this.Pattern !== defaultLowercaseRecordIdPattern) {
        const exists = app
          .db()
          .query(`select 1 as "exists" from {{${record.TableName()}}} where id = ? COLLATE NOCASE limit 1`)
          .get(newVal) as { exists?: number } | undefined;
        if (exists?.exists) {
          return newError("validation_pk_invalid", "The record primary key is invalid or already exists.");
        }
      }
    }

    return this.ValidatePlainValue(newVal);
  }

  // ValidatePlainValue validates the provided string against the field options.
  ValidatePlainValue(value: string): Error | null {
    if (this.Required || this.PrimaryKey) {
      const err = required(value);
      if (err) {
        return err;
      }
    }

    if (value === "") {
      return null;
    }

    const length = countRunes(value);

    if (this.Min > 0 && length < this.Min) {
      return newError("validation_min_text_constraint", "Must be at least {{.min}} character(s).").setParams({
        min: this.Min,
      });
    }

    let max = this.Max;
    if (max === 0) {
      max = 5000;
    }

    if (max > 0 && length > max) {
      return newError("validation_max_text_constraint", "Must be no more than {{.max}} character(s).").setParams({ max });
    }

    if (this.Pattern !== "") {
      if (this.Pattern === defaultLowercaseRecordIdPattern) {
        if (!isAsciiLowercaseAlnum(value)) {
          return newError("validation_invalid_format", "Invalid value format.");
        }
      } else {
        const regex = this.resolvePatternRegex();
        if (!regex.test(value)) {
          return newError("validation_invalid_format", "Invalid value format.");
        }
      }
    }

    if (this.PrimaryKey && this.Pattern !== defaultLowercaseRecordIdPattern) {
      for (const ch of forbiddenPKCharacters) {
        if (value.includes(ch)) {
          return newError("validation_forbidden_pk_character", "'{{.ch}}' is not a valid primary key character.").setParams({
            ch,
          });
        }
      }

      if (largestReservedPKLength >= length) {
        for (const reserved of caseInsensitiveReservedPKs) {
          if (reserved.toLowerCase() === value.toLowerCase()) {
            return newError(
              "validation_reserved_pk",
              "The primary key '{{.reserved}}' is reserved and cannot be used.",
            ).setParams({ reserved });
          }
        }
      }
    }

    return null;
  }

  private resolvePatternRegex(): RegExp {
    if (this.#cachedPatternRegex && this.#cachedPattern === this.Pattern) {
      return this.#cachedPatternRegex;
    }

    const compiled = new RegExp(this.Pattern);
    this.#cachedPattern = this.Pattern;
    this.#cachedPatternRegex = compiled;
    return compiled;
  }

  // ValidateSettings implements [Field.ValidateSettings] interface method.
  ValidateSettings(_ctx: unknown, _app: App, collection: Collection): Error | null {
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
    if (this.PrimaryKey && this.Name !== idColumn) {
      errors.name = newError("validation_invalid_primary_key", 'The primary key must be named "id".');
    }

    if (this.Min < 0 || this.Min > maxSafeJSONInt) {
      errors.min = newError("validation_invalid_min", "Invalid min value.");
    }
    if (this.Max < 0 || (this.Max > 0 && this.Max < this.Min) || this.Max > maxSafeJSONInt) {
      errors.max = newError("validation_invalid_max", "Invalid max value.");
    }

    if (this.Pattern) {
      const regexErr = isRegex(this.Pattern);
      if (regexErr) {
        errors.pattern = regexErr;
      }
    } else if (this.PrimaryKey) {
      errors.pattern = ErrRequired;
    }

    if (this.PrimaryKey && this.Hidden) {
      errors.hidden = newError("validation_invalid_primary_key", "Primary key field cannot be hidden.");
    }
    if (this.PrimaryKey && !this.Required) {
      errors.required = ErrRequired;
    }

    if (this.AutogeneratePattern) {
      const regexErr = isRegex(this.AutogeneratePattern);
      if (regexErr) {
        errors.autogeneratePattern = regexErr;
      } else {
        const autoErr = this.checkAutogeneratePattern(this.AutogeneratePattern);
        if (autoErr) {
          errors.autogeneratePattern = autoErr;
        }
      }
    }

    const pkErr = this.checkOtherFieldsForPK(collection);
    if (pkErr) {
      errors.primaryKey = pkErr;
    }

    return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
  }

  private checkOtherFieldsForPK(collection: Collection): Error | null {
    if (!this.PrimaryKey) {
      return null;
    }
    let totalPrimaryKeys = 0;
    const fields = collection.Fields.length > 0 ? collection.Fields : collection.rawFields;
    for (const field of fields) {
      const candidate = field as {
        GetName?: () => string;
        PrimaryKey?: boolean;
        primaryKey?: boolean;
      };
      if (typeof candidate.GetName === "function") {
        if (candidate.PrimaryKey) {
          totalPrimaryKeys += 1;
        }
      } else if (candidate.primaryKey || candidate.PrimaryKey) {
        totalPrimaryKeys += 1;
      }
      if (totalPrimaryKeys > 1) {
        return newError(
          "validation_unsupported_composite_pk",
          "Composite PKs are not supported and the collection must have only 1 PK.",
        );
      }
    }
    return null;
  }

  private checkAutogeneratePattern(value: string): Error | null {
    if (!value) {
      return null;
    }
    for (let i = 0; i < 10; i += 1) {
      let generated = "";
      try {
        generated = randomStringByRegex(value);
      } catch (error) {
        return newError("validation_invalid_autogenerate_pattern", (error as Error).message);
      }
      const plainErr = this.ValidatePlainValue(generated);
      if (plainErr) {
        return newError(
          "validation_invalid_autogenerate_pattern_value",
          `The provided autogenerate pattern could produce invalid field values, ex.: "${generated}"`,
        );
      }
    }
    return null;
  }

  // Intercept implements the [RecordInterceptor] interface.
  CanInterceptAction(actionName: string): boolean {
    if (this.AutogeneratePattern === "") {
      return false;
    }
    return actionName === InterceptorActionValidate || actionName === InterceptorActionCreate;
  }

  // Intercept implements the [RecordInterceptor] interface.
  Intercept(
    _ctx: unknown,
    _app: App,
    record: RecordLike,
    actionName: string,
    actionFunc: () => Error | null | Promise<Error | null>,
  ): Error | null | Promise<Error | null> {
    switch (actionName) {
      case "validate":
      case "create":
        if (this.AutogeneratePattern !== "" && this.hasZeroValue(record) && record.IsNew()) {
          const generated = randomStringByRegex(this.AutogeneratePattern);
          record.SetRaw(this.Name, generated);
        }
        break;
      default:
        break;
    }
    return actionFunc();
  }

  private hasZeroValue(record: RecordLike): boolean {
    const value = record.GetRaw(this.Name);
    return typeof value !== "string" || value === "";
  }

  // FindSetter implements the [SetterFinder] interface.
  FindSetter(key: string): SetterFunc | null {
    switch (key) {
      case this.Name:
        return (record, raw) => {
          record.SetRaw(this.Name, toStringValue(raw));
        };
      case this.Name + autogenerateModifier:
        return (record, raw) => {
          let value = toStringValue(raw);
          if (this.AutogeneratePattern !== "") {
            value += randomStringByRegex(this.AutogeneratePattern);
          }
          record.SetRaw(this.Name, value);
        };
      default:
        return null;
    }
  }
}

Fields[FieldTypeText] = () => new TextField();

function countRunes(value: string): number {
  // Fast path: no surrogate pairs => .length equals rune count.
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdfff) {
      return Array.from(value).length;
    }
  }

  return value.length;
}

function isAsciiLowercaseAlnum(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    const isDigit = code >= 48 && code <= 57;
    const isLower = code >= 97 && code <= 122;
    if (!isDigit && !isLower) {
      return false;
    }
  }

  return true;
}
