// Ported from pocketbase/core/field_relation.go
// Note: uses direct DB queries instead of dbx helpers.

import type { App } from "./app.ts";
import type { Collection } from "./collection.ts";
import { ValidationErrors, newError, required } from "../internal/compat/validation.ts";
import { toUniqueStringSlice } from "../tools/list/list.ts";
import { JSONArray } from "../tools/types/json_array.ts";
import {
  Fields,
  type Field,
  type MultiValuer,
  type DriverValuer,
  type SetterFinder,
  type SetterFunc,
  defaultFieldIdValidationRule,
  defaultFieldNameValidationRule,
} from "./field.ts";

export const FieldTypeRelation = "relation";

export class RelationField implements Field, MultiValuer, DriverValuer, SetterFinder {
  Name = "";
  Id = "";
  System = false;
  Hidden = false;
  Presentable = false;
  CollectionId = "";
  CascadeDelete = false;
  MinSelect = 0;
  MaxSelect = 0;
  Required = false;

  Type(): string {
    return FieldTypeRelation;
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

  IsMultiple(): boolean {
    return this.MaxSelect > 1;
  }

  ColumnType(_app: App): string {
    return this.IsMultiple() ? "JSON DEFAULT '[]' NOT NULL" : "TEXT DEFAULT '' NOT NULL";
  }

  PrepareValue(_record: unknown, raw: unknown): unknown {
    return this.normalizeValue(raw);
  }

  DriverValue(record: RecordLike): [string | JSONArray<string>, Error | null] {
    const values = toUniqueStringSlice(record.GetRaw(this.Name));
    if (!this.IsMultiple()) {
      return [values.length > 0 ? (values[values.length - 1] ?? "") : "", null];
    }
    return [new JSONArray(...values), null];
  }

  ValidateValue(_ctx: unknown, app: App, record: RecordLike): Error | null {
    const ids = toUniqueStringSlice(record.GetRaw(this.Name));
    if (ids.length === 0) {
      if (this.Required) {
        return required(ids);
      }
      return null;
    }

    if (this.MinSelect > 0 && ids.length < this.MinSelect) {
      return newError("validation_not_enough_values", "Select at least {{.minSelect}}").setParams({
        minSelect: this.MinSelect,
      });
    }

    const maxSelect = Math.max(this.MaxSelect, 1);
    if (ids.length > maxSelect) {
      return newError("validation_too_many_values", "Select no more than {{.maxSelect}}").setParams({
        maxSelect,
      });
    }

    const relCollection = app.findCollectionByNameOrId(this.CollectionId);
    if (!relCollection) {
      return newError("validation_missing_rel_collection", "Relation connection is missing or cannot be accessed");
    }

    const placeholders = ids.map(() => "?").join(", ");
    const sql = `select count(*) as total from {{${relCollection.name}}} where [[id]] in (${placeholders})`;
    const row = app
      .db()
      .query(sql)
      .get(...ids) as { total?: number } | undefined;
    if ((row?.total ?? 0) !== ids.length) {
      return newError("validation_missing_rel_records", "Failed to find all relation records with the provided ids");
    }

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
    if (!this.CollectionId) {
      errors.collectionId = newError("validation_missing_rel_collection", "Relation collection is required.");
    } else {
      const collectionErr = this.checkCollectionId(app, collection);
      if (collectionErr) {
        errors.collectionId = collectionErr;
      }
    }
    if (this.MinSelect < 0) {
      errors.minSelect = newError("validation_invalid_min", "Invalid minSelect value.");
    }
    if (this.MinSelect > 0 && this.MaxSelect <= 0) {
      errors.maxSelect = newError("validation_invalid_max", "maxSelect must be set.");
    }
    if (this.MaxSelect > 0 && this.MaxSelect < this.MinSelect) {
      errors.maxSelect = newError("validation_invalid_max", "Invalid maxSelect value.");
    }
    return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
  }

  FindSetter(key: string): SetterFunc | null {
    switch (key) {
      case this.Name:
        return (record, raw) => {
          record.SetRaw(this.Name, this.normalizeValue(raw));
        };
      case "+" + this.Name:
        return (record, raw) => {
          const value = toUniqueStringSlice(record.GetRaw(this.Name));
          const merged = toUniqueStringSlice(raw).concat(value);
          record.SetRaw(this.Name, this.normalizeValue(merged));
        };
      case this.Name + "+":
        return (record, raw) => {
          const value = toUniqueStringSlice(record.GetRaw(this.Name));
          const merged = value.concat(toUniqueStringSlice(raw));
          record.SetRaw(this.Name, this.normalizeValue(merged));
        };
      case this.Name + "-":
        return (record, raw) => {
          const value = toUniqueStringSlice(record.GetRaw(this.Name));
          const subtract = toUniqueStringSlice(raw);
          const remaining = value.filter((item) => !subtract.includes(item));
          record.SetRaw(this.Name, this.normalizeValue(remaining));
        };
      default:
        return null;
    }
  }

  private normalizeValue(raw: unknown): unknown {
    const values = toUniqueStringSlice(raw);
    if (!this.IsMultiple()) {
      return values.length > 0 ? (values[values.length - 1] ?? "") : "";
    }
    return values;
  }

  private checkCollectionId(app: App, collection: Collection): Error | null {
    if (!this.CollectionId) {
      return null;
    }

    let oldCollection: Collection | null = null;
    if (!collection.isNew()) {
      oldCollection = app.findCollectionByNameOrId(collection.id);
    }

    if (oldCollection) {
      const oldFields = oldCollection.Fields.length > 0 ? oldCollection.Fields : oldCollection.fields;
      const oldField = oldFields.find(
        (field) =>
          (field as any)?.Id === this.Id ||
          (field as any)?.id === this.Id ||
          (typeof (field as any)?.GetId === "function" && (field as any).GetId() === this.Id),
      ) as { collectionId?: string; CollectionId?: string } | undefined;
      const oldCollectionId = oldField?.collectionId ?? oldField?.CollectionId ?? "";
      if (oldCollectionId && oldCollectionId !== this.CollectionId) {
        return newError("validation_field_relation_change", "The relation collection cannot be changed.");
      }
    }

    const relCollection = app.findCollectionByNameOrId(this.CollectionId);
    if (!relCollection || relCollection.id !== this.CollectionId) {
      return newError("validation_field_relation_missing_collection", "The relation collection doesn't exist.");
    }

    if (!collection.isView() && relCollection.isView()) {
      return newError(
        "validation_relation_field_non_view_base_collection",
        "Only view collections are allowed to have relations to other views.",
      );
    }

    return null;
  }
}

type RecordLike = {
  GetRaw: (field: string) => unknown;
  SetRaw: (field: string, value: unknown) => void;
};

Fields[FieldTypeRelation] = () => new RelationField();
