// Ported from pocketbase/core/field_autodate.go

import type { App } from "./app.ts";
import type { Collection } from "./collection.ts";
import { ValidationErrors, newError } from "../internal/compat/validation.ts";
import { NowDateTime, ParseDateTime } from "../tools/types/index.ts";
import {
  Fields,
  type Field,
  type RecordInterceptor,
  type RecordLike,
  type SetterFinder,
  type SetterFunc,
  noopSetter,
  defaultFieldIdValidationRule,
  defaultFieldNameValidationRule,
} from "./field.ts";
import { internalCustomFieldKeyPrefix } from "./record.ts";
import { Equal } from "./validators/equal.ts";

export const FieldTypeAutodate = "autodate";
const autodateLastKnownPrefix = `${internalCustomFieldKeyPrefix}_last_autodate_`;

export class AutodateField implements Field, SetterFinder, RecordInterceptor {
  Name = "";
  Id = "";
  System = false;
  Hidden = false;
  Presentable = false;
  OnCreate = false;
  OnUpdate = false;

  Type(): string {
    return FieldTypeAutodate;
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

  PrepareValue(_record: unknown, raw: unknown) {
    return ParseDateTime(raw);
  }

  ValidateValue(_ctx: unknown, _app: App, _record: RecordLike): Error | null {
    return null;
  }

  ValidateSettings(_ctx: unknown, app: App, collection: Collection): Error | null {
    const errors: Record<string, Error> = {};
    const idErr = defaultFieldIdValidationRule(this.Id);
    if (idErr) {
      errors.id = idErr;
    }
    const nameErr = defaultFieldNameValidationRule(this.Name);
    if (nameErr) {
      errors.name = nameErr;
    }

    let oldOnCreate = this.OnCreate;
    let oldOnUpdate = this.OnUpdate;

    const oldCollection = app.findCollectionByNameOrId(collection.id);
    if (oldCollection) {
      const oldField = oldCollection.Fields.GetById(this.Id);
      if (oldField instanceof AutodateField) {
        oldOnCreate = oldField.OnCreate;
        oldOnUpdate = oldField.OnUpdate;
      }
    }

    if (this.System) {
      const onCreateErr = Equal(oldOnCreate)(this.OnCreate);
      if (onCreateErr) {
        errors.onCreate = onCreateErr;
      }
      const onUpdateErr = Equal(oldOnUpdate)(this.OnUpdate);
      if (onUpdateErr) {
        errors.onUpdate = onUpdateErr;
      }
    }

    if (!this.OnUpdate) {
      if (!this.OnCreate) {
        errors.onCreate = newError(
          "validation_required",
          "either onCreate or onUpdate must be enabled",
        );
      }
    }
    if (!this.OnCreate) {
      if (!this.OnUpdate) {
        errors.onUpdate = newError(
          "validation_required",
          "either onCreate or onUpdate must be enabled",
        );
      }
    }

    return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
  }

  FindSetter(key: string): SetterFunc | null {
    switch (key) {
      case this.Name:
        return noopSetter;
      default:
        return null;
    }
  }

  Intercept(
    _ctx: unknown,
    _app: App,
    record: RecordLike,
    actionName: string,
    actionFunc: () => Error | null,
  ): Error | null {
    const typed = record as RecordLike & {
      GetDateTime: (field: string) => { IsZero: () => boolean; Equal: (other: unknown) => boolean };
      Original: () => RecordLike;
    };
    switch (actionName) {
      case "create":
        if (this.OnCreate && typed.GetDateTime(this.Name).Equal(this.getLastKnownValue(typed))) {
          const now = NowDateTime();
          record.SetRaw(this.Name, now);
          record.SetRaw(autodateLastKnownPrefix + this.Name, now);
        }
        {
          const err = actionFunc();
          if (err) {
            return err;
          }
        }
        record.SetRaw(autodateLastKnownPrefix + this.Name, record.GetRaw(this.Name));
        return null;
      case "update":
        if (this.OnUpdate && typed.GetDateTime(this.Name).Equal(this.getLastKnownValue(typed))) {
          const now = NowDateTime();
          record.SetRaw(this.Name, now);
          record.SetRaw(autodateLastKnownPrefix + this.Name, now);
        }
        {
          const err = actionFunc();
          if (err) {
            return err;
          }
        }
        record.SetRaw(autodateLastKnownPrefix + this.Name, record.GetRaw(this.Name));
        return null;
      default:
        return actionFunc();
    }
  }

  private getLastKnownValue(record: RecordLike) {
    const typed = record as RecordLike & {
      GetDateTime: (field: string) => { IsZero: () => boolean; Equal: (other: unknown) => boolean };
      Original: () => RecordLike;
    };
    const last = typed.GetDateTime(autodateLastKnownPrefix + this.Name);
    if (!last.IsZero()) {
      return last;
    }
    return typed.Original().GetDateTime?.(this.Name) ?? last;
  }
}

Fields[FieldTypeAutodate] = () => new AutodateField();
