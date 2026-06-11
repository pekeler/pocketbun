// Ported from pocketbase/core/field_autodate.go

import type { App } from "./app.ts";
import type { Collection } from "./collection_model.ts";
import { ValidationErrors, newError } from "../internal/compat/validation.ts";
import { DateTime, NowDateTime, ParseDateTime } from "../tools/types/index.ts";
import {
  Fields,
  InterceptorActionCreate,
  InterceptorActionUpdate,
  type Field,
  type RecordInterceptor,
  type RecordLike,
  type SetterFinder,
  type SetterFunc,
  noopSetter,
  defaultFieldIdValidationRule,
  defaultFieldNameValidationRule,
} from "./field.ts";
import { internalCustomFieldKeyPrefix } from "./record_model.ts";
import { Equal } from "./validators/equal.ts";

export const FieldTypeAutodate = "autodate";
// used to keep track of the last set autodate value
const autodateLastKnownPrefix = `${internalCustomFieldKeyPrefix}_last_autodate_`;

// AutodateField defines an "autodate" type field, aka.
// field which datetime value could be auto set on record create/update.
//
// This field is usually used for defining timestamp fields like "created" and "updated".
//
// Requires either both or at least one of the OnCreate or OnUpdate options to be set.
export class AutodateField implements Field, SetterFinder, RecordInterceptor {
  Name = "";
  Id = "";
  System = false;
  Hidden = false;
  Presentable = false;
  OnCreate = false;
  OnUpdate = false;

  // Type implements [Field.Type] interface method.
  Type(): string {
    return FieldTypeAutodate;
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
  PrepareValue(_record: unknown, raw: unknown) {
    return ParseDateTime(raw);
  }

  // ValidateValue implements [Field.ValidateValue] interface method.
  ValidateValue(_ctx: unknown, _app: App, _record: RecordLike): Error | null {
    return null;
  }

  // ValidateSettings implements [Field.ValidateSettings] interface method.
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

    const oldCollection = app.findCollectionByNameOrIdOrNull(collection.id);
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
        errors.onCreate = newError("validation_required", "either onCreate or onUpdate must be enabled");
      }
    }
    if (!this.OnCreate) {
      if (!this.OnUpdate) {
        errors.onUpdate = newError("validation_required", "either onCreate or onUpdate must be enabled");
      }
    }

    return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
  }

  // FindSetter implements the [SetterFinder] interface.
  FindSetter(key: string): SetterFunc | null {
    switch (key) {
      case this.Name:
        return noopSetter;
      default:
        return null;
    }
  }

  // Intercept implements the [RecordInterceptor] interface.
  CanInterceptAction(actionName: string): boolean {
    if (actionName === InterceptorActionCreate) {
      return this.OnCreate;
    }
    if (actionName === InterceptorActionUpdate) {
      return this.OnUpdate;
    }
    return false;
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
      case InterceptorActionCreate:
        if (this.OnCreate && this.getCurrentValue(record).Equal(this.getLastKnownValue(record))) {
          const now = NowDateTime();
          record.SetRaw(this.Name, now);
          record.SetRaw(autodateLastKnownPrefix + this.Name, now);
        }
        return this.finishIntercept(record, actionFunc);
      case InterceptorActionUpdate:
        if (this.OnUpdate && this.getCurrentValue(record).Equal(this.getLastKnownValue(record))) {
          const now = NowDateTime();
          record.SetRaw(this.Name, now);
          record.SetRaw(autodateLastKnownPrefix + this.Name, now);
        }
        return this.finishIntercept(record, actionFunc);
      default:
        return actionFunc();
    }
  }

  private finishIntercept(
    record: RecordLike,
    actionFunc: () => Error | null | Promise<Error | null>,
  ): Error | null | Promise<Error | null> {
    const result = actionFunc();

    if (result instanceof Promise) {
      return result.then((err) => {
        if (err) {
          return err;
        }
        record.SetRaw(autodateLastKnownPrefix + this.Name, record.GetRaw(this.Name));
        return null;
      });
    }

    if (result) {
      return result;
    }

    record.SetRaw(autodateLastKnownPrefix + this.Name, record.GetRaw(this.Name));
    return null;
  }

  private getLastKnownValue(record: RecordLike) {
    const last = this.asDateTime(record.GetRaw(autodateLastKnownPrefix + this.Name));
    if (!last.IsZero()) {
      return last;
    }
    return this.asDateTime(record.Original?.().GetRaw(this.Name)) ?? last;
  }

  private getCurrentValue(record: RecordLike) {
    return this.asDateTime(record.GetRaw(this.Name));
  }

  private asDateTime(raw: unknown) {
    if (raw instanceof DateTime) {
      return raw;
    }
    return ParseDateTime(raw);
  }
}

Fields[FieldTypeAutodate] = () => new AutodateField();
