// Ported from pocketbase/core/field_email.go

import type { App } from "./app.ts";
import type { Collection } from "./collection.ts";
import { ValidationErrors, newError, required } from "../internal/compat/validation.ts";
import { toStringValue } from "../internal/compat/cast.ts";
import {
  Fields,
  type Field,
  defaultFieldIdValidationRule,
  defaultFieldNameValidationRule,
} from "./field.ts";
import { ErrUnsupportedValueType } from "./validators/validators.ts";

export const FieldTypeEmail = "email";

export class EmailField implements Field {
  Name = "";
  Id = "";
  System = false;
  Hidden = false;
  Presentable = false;
  ExceptDomains: string[] = [];
  OnlyDomains: string[] = [];
  Required = false;

  Type(): string {
    return FieldTypeEmail;
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

  PrepareValue(_record: unknown, raw: unknown): string {
    return toStringValue(raw);
  }

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
    if (this.OnlyDomains.length > 0 && !this.OnlyDomains.includes(domain)) {
      return newError("validation_email_domain_not_allowed", "Email domain is not allowed");
    }
    if (this.ExceptDomains.length > 0 && this.ExceptDomains.includes(domain)) {
      return newError("validation_email_domain_not_allowed", "Email domain is not allowed");
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

    if (this.OnlyDomains.length > 0 && this.ExceptDomains.length > 0) {
      errors.onlyDomains = newError(
        "validation_email_domain_not_allowed",
        "Only one of onlyDomains/exceptDomains can be set",
      );
      errors.exceptDomains = newError(
        "validation_email_domain_not_allowed",
        "Only one of onlyDomains/exceptDomains can be set",
      );
    } else if (this.OnlyDomains.length > 0) {
      for (const domain of this.OnlyDomains) {
        if (!isDomain(domain)) {
          errors.onlyDomains = newError("validation_invalid_domain", "Invalid domain");
          break;
        }
      }
    } else if (this.ExceptDomains.length > 0) {
      for (const domain of this.ExceptDomains) {
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
