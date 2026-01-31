// Ported from pocketbase/core/field_url.go

import type { App } from "./app.ts";
import type { Collection } from "./collection.ts";
import { ValidationErrors, ErrRequired, newError } from "../internal/compat/validation.ts";
import { toStringValue } from "../internal/compat/cast.ts";
import {
  Fields,
  type Field,
  defaultFieldIdValidationRule,
  defaultFieldNameValidationRule,
} from "./field.ts";
import { ErrUnsupportedValueType } from "./validators/validators.ts";

export const FieldTypeURL = "url";

export class URLField implements Field {
  Name = "";
  Id = "";
  System = false;
  Hidden = false;
  Presentable = false;
  ExceptDomains: string[] = [];
  OnlyDomains: string[] = [];
  Required = false;

  Type(): string {
    return FieldTypeURL;
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

    if (this.Required && value === "") {
      return ErrRequired;
    }

    if (!value) {
      return null;
    }

    if (!isValidUrl(value)) {
      return newError("validation_invalid_url", "Must be a valid url");
    }

    const host = new URL(value).host;

    if (this.OnlyDomains.length > 0 && !this.OnlyDomains.includes(host)) {
      return newError("validation_url_domain_not_allowed", "Url domain is not allowed");
    }

    if (this.ExceptDomains.length > 0 && this.ExceptDomains.includes(host)) {
      return newError("validation_url_domain_not_allowed", "Url domain is not allowed");
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

    const hasOnly = this.OnlyDomains.length > 0;
    const hasExcept = this.ExceptDomains.length > 0;

    if (hasOnly && hasExcept) {
      errors.onlyDomains = newError("validation_invalid_domains", "OnlyDomains must be empty.");
      errors.exceptDomains = newError("validation_invalid_domains", "ExceptDomains must be empty.");
      return new ValidationErrors(errors);
    }

    if (hasOnly && !areDomainsValid(this.OnlyDomains)) {
      errors.onlyDomains = newError("validation_invalid_domains", "Invalid domains.");
    }

    if (hasExcept && !areDomainsValid(this.ExceptDomains)) {
      errors.exceptDomains = newError("validation_invalid_domains", "Invalid domains.");
    }

    return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
  }
}

type RecordLike = {
  GetRaw: (field: string) => unknown;
};

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return Boolean(parsed.protocol && parsed.host);
  } catch {
    return false;
  }
}

function areDomainsValid(domains: string[]): boolean {
  for (const domain of domains) {
    if (!isDomain(domain)) {
      return false;
    }
  }
  return true;
}

function isDomain(value: string): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.toLowerCase();
  if (normalized.includes("://") || normalized.includes("/") || normalized.includes(" ")) {
    return false;
  }

  const parts = normalized.split(".");
  if (parts.length < 2) {
    return false;
  }

  for (const part of parts) {
    if (!part) {
      return false;
    }
    if (part.length > 63) {
      return false;
    }
    if (!/^[a-z0-9-]+$/.test(part)) {
      return false;
    }
    if (part.startsWith("-") || part.endsWith("-")) {
      return false;
    }
  }

  return true;
}

Fields[FieldTypeURL] = () => new URLField();
