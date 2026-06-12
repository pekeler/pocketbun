// Ported from pocketbase/core/field_relation.go
// Note: uses direct DB queries instead of dbx helpers.

import type { App } from "./app.ts";
import type { Collection } from "./collection_model.ts";
import { ValidationErrors, newError, required } from "../internal/compat/validation.ts";
import { toUniqueStringSlice } from "../tools/list/list.ts";
import { JSONArray } from "../tools/types/json_array.ts";
import {
  Fields,
  type Field,
  type MultiValuer,
  type DriverValuer,
  type RecordLike,
  type SetterFinder,
  type SetterFunc,
  defaultFieldHelpValidationRule,
  defaultFieldIdValidationRule,
  defaultFieldNameValidationRule,
} from "./field.ts";

export const FieldTypeRelation = "relation";

// RelationField defines "relation" type field for storing single or
// multiple collection record references.
//
// Requires the CollectionId option to be set.
//
// If MaxSelect is not set or <= 1, then the field value is expected to be a single record id.
//
// If MaxSelect is > 1, then the field value is expected to be a slice of record ids.
//
// The respective zero record field value is either empty string (single) or empty string slice (multiple).
//
// ---
//
// The following additional setter keys are available:
//
//   - "fieldName+" - append one or more values to the existing record one. For example:
//
//     record.Set("categories+", []string{"new1", "new2"}) // []string{"old1", "old2", "new1", "new2"}
//
//   - "+fieldName" - prepend one or more values to the existing record one. For example:
//
//     record.Set("+categories", []string{"new1", "new2"}) // []string{"new1", "new2", "old1", "old2"}
//
//   - "fieldName-" - subtract one or more values from the existing record one. For example:
//
//     record.Set("categories-", "old1") // []string{"old2"}
export class RelationField implements Field, MultiValuer, DriverValuer, SetterFinder {
  Name = "";
  Id = "";
  System = false;
  Hidden = false;
  Presentable = false;
  Help = "";
  CollectionId = "";
  CascadeDelete = false;
  MinSelect = 0;
  MaxSelect = 0;
  Required = false;

  // Type implements [Field.Type] interface method.
  Type(): string {
    return FieldTypeRelation;
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

  // IsMultiple implements [MultiValuer] interface and checks whether the
  // current field options support multiple values.
  IsMultiple(): boolean {
    return this.MaxSelect > 1;
  }

  // ColumnType implements [Field.ColumnType] interface method.
  ColumnType(_app: App): string {
    return this.IsMultiple() ? "JSON DEFAULT '[]' NOT NULL" : "TEXT DEFAULT '' NOT NULL";
  }

  // PrepareValue implements [Field.PrepareValue] interface method.
  PrepareValue(_record: unknown, raw: unknown): unknown {
    return this.normalizeValue(raw);
  }

  // DriverValue implements the [DriverValuer] interface.
  DriverValue(record: RecordLike): [string | JSONArray<string>, Error | null] {
    const values = toUniqueStringSlice(record.GetRaw(this.Name));
    if (!this.IsMultiple()) {
      return [values.length > 0 ? (values[values.length - 1] ?? "") : "", null];
    }
    return [new JSONArray(...values), null];
  }

  // ValidateValue implements [Field.ValidateValue] interface method.
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

    let relCollection: Collection | null = null;
    try {
      relCollection = app.FindCachedCollectionByNameOrId(this.CollectionId);
    } catch {
      relCollection = null;
    }
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
    const helpErr = defaultFieldHelpValidationRule(this.Help);
    if (helpErr) {
      errors.help = helpErr;
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

  // FindSetter implements [SetterFinder] interface method.
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
          const subtractSet = new Set(subtract);
          const remaining = value.filter((item) => !subtractSet.has(item));
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
      try {
        oldCollection = app.FindCachedCollectionByNameOrId(collection.id);
      } catch {
        oldCollection = null;
      }
    }

    if (oldCollection) {
      const oldFields = oldCollection.Fields.length > 0 ? oldCollection.Fields : oldCollection.rawFields;
      const oldField = oldFields.find((field) => {
        const candidate = field as FieldIdCandidate;
        if (candidate.Id === this.Id || candidate.id === this.Id) {
          return true;
        }
        return typeof candidate.GetId === "function" && candidate.GetId() === this.Id;
      }) as FieldIdCandidate | undefined;
      const oldCollectionId = oldField?.collectionId ?? oldField?.CollectionId ?? "";
      if (oldCollectionId && oldCollectionId !== this.CollectionId) {
        return newError("validation_field_relation_change", "The relation collection cannot be changed.");
      }
    }

    let relCollection: Collection | null = null;
    try {
      relCollection = app.FindCachedCollectionByNameOrId(this.CollectionId);
    } catch {
      relCollection = null;
    }
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

type FieldIdCandidate = {
  Id?: string;
  id?: string;
  GetId?: () => string;
  collectionId?: string;
  CollectionId?: string;
};

Fields[FieldTypeRelation] = () => new RelationField();
