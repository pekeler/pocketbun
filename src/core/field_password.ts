// Ported from pocketbase/core/field_password.go
// Note: uses Bun.password hashing/verification in place of Go bcrypt package.

import type { App } from "./app.ts";
import type { Collection } from "./collection.ts";
import { ValidationErrors, newError, required } from "../internal/compat/validation.ts";
import { toStringValue } from "../internal/compat/cast.ts";
import {
  Fields,
  type Field,
  type GetterFinder,
  type GetterFunc,
  type SetterFinder,
  type SetterFunc,
  type DriverValuer,
  type RecordInterceptor,
  defaultFieldIdValidationRule,
  defaultFieldNameValidationRule,
} from "./field.ts";
import { ErrUnsupportedValueType } from "./validators/validators.ts";
import { isRegex } from "./validators/string.ts";

export const FieldTypePassword = "password";

const bcryptMinCost = 4;
const bcryptMaxCost = 31;
const bcryptDefaultCost = 12;

export class PasswordField
  implements Field, GetterFinder, SetterFinder, DriverValuer, RecordInterceptor
{
  Name = "";
  Id = "";
  System = false;
  Hidden = false;
  Presentable = false;
  Pattern = "";
  Min = 0;
  Max = 0;
  Cost = 0;
  Required = false;

  Type(): string {
    return FieldTypePassword;
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
    return "TEXT DEFAULT '' NOT NULL";
  }

  DriverValue(record: RecordLike): [string, Error | null] {
    const value = this.getPasswordValue(record);
    return [value.Hash, value.LastError];
  }

  PrepareValue(_record: unknown, raw: unknown): PasswordFieldValue {
    return new PasswordFieldValue("", toStringValue(raw));
  }

  ValidateValue(_ctx: unknown, _app: App, record: RecordLike): Error | null {
    const raw = record.GetRaw(this.Name);
    if (!(raw instanceof PasswordFieldValue)) {
      return ErrUnsupportedValueType;
    }
    if (raw.LastError) {
      return raw.LastError;
    }
    if (this.Required) {
      const err = required(raw.Hash);
      if (err) {
        return err;
      }
    }
    if (raw.Plain === "") {
      return null;
    }

    const length = Array.from(raw.Plain).length;
    if (length < this.Min) {
      return newError(
        "validation_min_text_constraint",
        `Must be at least ${this.Min} character(s)`,
      );
    }

    let maxLength = this.Max;
    if (maxLength <= 0) {
      maxLength = 71;
    }
    if (length > maxLength) {
      return newError(
        "validation_max_text_constraint",
        `Must be less than ${maxLength} character(s)`,
      );
    }

    if (this.Pattern !== "") {
      const regex = new RegExp(this.Pattern);
      if (!regex.test(raw.Plain)) {
        return newError("validation_invalid_format", "Invalid value format");
      }
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
    if (this.Min < 0 || this.Min > 71) {
      errors.min = newError("validation_invalid_min", "Invalid min value.");
    }
    if (this.Max < 0 || (this.Max > 0 && this.Max < this.Min) || this.Max > 71) {
      errors.max = newError("validation_invalid_max", "Invalid max value.");
    }
    if (this.Cost > 0 && (this.Cost < bcryptMinCost || this.Cost > bcryptMaxCost)) {
      errors.cost = newError("validation_invalid_cost", "Invalid cost value.");
    }
    if (this.Pattern) {
      const regexErr = isRegex(this.Pattern);
      if (regexErr) {
        errors.pattern = regexErr;
      }
    }
    return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
  }

  Intercept(
    _ctx: unknown,
    _app: App,
    record: RecordLike,
    actionName: string,
    actionFunc: () => Error | null,
  ): Error | null {
    if (actionName === "afterCreate" || actionName === "afterUpdate") {
      const value = this.getPasswordValue(record);
      value.Plain = "";
    }
    return actionFunc();
  }

  FindGetter(key: string): GetterFunc | null {
    switch (key) {
      case this.Name:
        return (record) => this.getPasswordValue(record).Plain;
      case this.Name + ":hash":
        return (record) => this.getPasswordValue(record).Hash;
      default:
        return null;
    }
  }

  FindSetter(key: string): SetterFunc | null {
    switch (key) {
      case this.Name:
        return (record, raw) => this.setValue(record, raw);
      default:
        return null;
    }
  }

  private getPasswordValue(record: RecordLike): PasswordFieldValue {
    const raw = record.GetRaw(this.Name);
    if (raw instanceof PasswordFieldValue) {
      return raw;
    }
    if (typeof raw === "string" && raw.startsWith("$2")) {
      return new PasswordFieldValue("", raw);
    }
    return new PasswordFieldValue("");
  }

  private setValue(record: RecordLike, raw: unknown): void {
    const value = new PasswordFieldValue(toStringValue(raw));
    if (value.Plain !== "") {
      const cost = this.Cost > 0 ? this.Cost : bcryptDefaultCost;
      try {
        value.Hash = Bun.password.hashSync(value.Plain, {
          algorithm: "bcrypt",
          cost,
        });
      } catch (error) {
        value.LastError = error as Error;
      }
    }
    record.SetRaw(this.Name, value);
  }
}

export class PasswordFieldValue {
  LastError: Error | null;
  Hash: string;
  Plain: string;

  constructor(plain: string, hash = "") {
    this.Plain = plain;
    this.Hash = hash || (plain.startsWith("$2") ? plain : "");
    this.LastError = null;
  }

  Validate(pass: string): boolean {
    if (!this.Hash || this.LastError) {
      return false;
    }
    return Bun.password.verifySync(pass, this.Hash);
  }
}

type RecordLike = {
  GetRaw: (field: string) => unknown;
  SetRaw: (field: string, value: unknown) => void;
};

Fields[FieldTypePassword] = () => new PasswordField();
