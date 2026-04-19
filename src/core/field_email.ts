// Ported from pocketbase/core/field_email.go

import type { App } from "./app.ts";
import type { Collection } from "./collection_model.ts";
import { toStringValue } from "../internal/compat/cast.ts";
import { ValidationErrors, newError, required } from "../internal/compat/validation.ts";
import {
  Fields,
  type Field,
  defaultFieldHelpValidationRule,
  defaultFieldIdValidationRule,
  defaultFieldNameValidationRule,
} from "./field.ts";
import { ErrUnsupportedValueType } from "./validators/validators.ts";

export const FieldTypeEmail = "email";

// EmailField defines "email" type field for storing a single email string address.
//
// The respective zero record field value is empty string.
export class EmailField implements Field {
  Name = "";
  Id = "";
  System = false;
  Hidden = false;
  Presentable = false;
  Help = "";
  ExceptDomains: string[] | null = null;
  OnlyDomains: string[] | null = null;
  Required = false;

  // Type implements [Field.Type] interface method.
  Type(): string {
    return FieldTypeEmail;
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

    if (this.Required) {
      const err = required(value);
      if (err) {
        return err;
      }
    }

    if (value === "") {
      return null;
    }

    if (!isEmail(value)) {
      return newError("validation_invalid_email", "Invalid email address");
    }

    const domain = value.slice(value.lastIndexOf("@") + 1);
    const onlyDomains = Array.isArray(this.OnlyDomains) ? this.OnlyDomains : [];
    const exceptDomains = Array.isArray(this.ExceptDomains) ? this.ExceptDomains : [];
    if (onlyDomains.length > 0 && !onlyDomains.includes(domain)) {
      return newError("validation_email_domain_not_allowed", "Email domain is not allowed");
    }
    if (exceptDomains.length > 0 && exceptDomains.includes(domain)) {
      return newError("validation_email_domain_not_allowed", "Email domain is not allowed");
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

    const onlyDomains = Array.isArray(this.OnlyDomains) ? this.OnlyDomains : [];
    const exceptDomains = Array.isArray(this.ExceptDomains) ? this.ExceptDomains : [];

    if (onlyDomains.length > 0 && exceptDomains.length > 0) {
      errors.onlyDomains = newError("validation_email_domain_not_allowed", "Only one of onlyDomains/exceptDomains can be set");
      errors.exceptDomains = newError(
        "validation_email_domain_not_allowed",
        "Only one of onlyDomains/exceptDomains can be set",
      );
    } else if (onlyDomains.length > 0) {
      for (const domain of onlyDomains) {
        if (!isDomain(domain)) {
          errors.onlyDomains = newError("validation_invalid_domain", "Invalid domain");
          break;
        }
      }
    } else if (exceptDomains.length > 0) {
      for (const domain of exceptDomains) {
        if (!isDomain(domain)) {
          errors.exceptDomains = newError("validation_invalid_domain", "Invalid domain");
          break;
        }
      }
    }

    return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
  }
}

type RecordLike = {
  GetRaw: (field: string) => unknown;
};

function isEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

function isDomain(value: string): boolean {
  if (!value.includes(".")) {
    return false;
  }
  return /^(?=.{1,255}$)([A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/.test(
    value,
  );
}

Fields[FieldTypeEmail] = () => new EmailField();
