// PocketBun-only: typed constructors shared by package consumers and JSVM bindings.
// Adapted from heisdezz/pocketbun (1ffbc7b); MIT license in LICENSE.md.
// Collection initialization is shared with the hook binding to preserve JSON semantics.

import type { Field } from "./field.ts";
import { Collection as CollectionModel } from "./collection_model.ts";
import { AutodateField as CoreAutodateField } from "./field_autodate.ts";
import { BoolField as CoreBoolField } from "./field_bool.ts";
import { DateField as CoreDateField } from "./field_date.ts";
import { EditorField as CoreEditorField } from "./field_editor.ts";
import { EmailField as CoreEmailField } from "./field_email.ts";
import { FileField as CoreFileField } from "./field_file.ts";
import { GeoPointField as CoreGeoPointField } from "./field_geo_point.ts";
import { JSONField as CoreJSONField } from "./field_json.ts";
import { installFieldJSVMAliases, type FieldJSVMAliases } from "./field_jsvm_aliases.ts";
import { NumberField as CoreNumberField } from "./field_number.ts";
import { PasswordField as CorePasswordField } from "./field_password.ts";
import { RelationField as CoreRelationField } from "./field_relation.ts";
import { SelectField as CoreSelectField } from "./field_select.ts";
import { TextField as CoreTextField } from "./field_text.ts";
import { URLField as CoreURLField } from "./field_url.ts";
import { Record as RecordModel, type RecordData } from "./record_model.ts";

// Field options accept upstream properties and their JSVM lower-camel aliases,
// but exclude methods so constructor options cannot overwrite field behavior.
type FieldProperties<T> = {
  [K in keyof T as T[K] extends (...args: never[]) => unknown ? never : K]: T[K];
};
export type FieldOptions<T> = Partial<FieldProperties<T> & FieldJSVMAliases<FieldProperties<T>>>;
export type FieldInstance<T extends Field> = T & FieldJSVMAliases<T>;

// Collection options are JSON data, including type-specific auth and view settings.
export type CollectionInit = RecordData;

export class Collection extends CollectionModel {
  constructor(values?: CollectionInit) {
    super();
    if (values !== undefined) {
      const err = this.UnmarshalJSON(JSON.stringify(values));
      if (err) throw err;
    }
  }
}

export function assignStructValues(target: { [key: string]: unknown }, values: { [key: string]: unknown }): void {
  for (const [key, value] of Object.entries(values)) {
    if (key in target) {
      if (typeof target[key] !== "function") target[key] = value;
      continue;
    }
    const candidate = `${key.slice(0, 1).toUpperCase()}${key.slice(1)}`;
    if (candidate in target) {
      if (typeof target[candidate] !== "function") target[candidate] = value;
      continue;
    }
    target[key] = value;
  }
}

function fieldConstructor<T extends Field>(Ctor: new () => T): new (values?: FieldOptions<T>) => FieldInstance<T> {
  const Base: new () => Field = Ctor;
  class FieldConstructor extends Base {
    constructor(values: FieldOptions<T> = {}) {
      super();
      installFieldJSVMAliases();
      assignStructValues(this as unknown as { [key: string]: unknown }, values ?? {});
    }
  }
  return FieldConstructor as unknown as new (values?: FieldOptions<T>) => FieldInstance<T>;
}

// The internal Record constructor also loads persisted rows and defaults to
// isNew=false. Package consumers construct new records, like JSVM's new Record.
export class Record extends RecordModel {
  constructor(collection: CollectionModel, data: RecordData = {}) {
    super(collection, data, true);
  }

  isNew(): boolean {
    return this.IsNew();
  }
}

export const TextField = fieldConstructor(CoreTextField);
export type TextField = InstanceType<typeof TextField>;
export const NumberField = fieldConstructor(CoreNumberField);
export type NumberField = InstanceType<typeof NumberField>;
export const BoolField = fieldConstructor(CoreBoolField);
export type BoolField = InstanceType<typeof BoolField>;
export const URLField = fieldConstructor(CoreURLField);
export type URLField = InstanceType<typeof URLField>;
export const EmailField = fieldConstructor(CoreEmailField);
export type EmailField = InstanceType<typeof EmailField>;
export const EditorField = fieldConstructor(CoreEditorField);
export type EditorField = InstanceType<typeof EditorField>;
export const PasswordField = fieldConstructor(CorePasswordField);
export type PasswordField = InstanceType<typeof PasswordField>;
export const DateField = fieldConstructor(CoreDateField);
export type DateField = InstanceType<typeof DateField>;
export const AutodateField = fieldConstructor(CoreAutodateField);
export type AutodateField = InstanceType<typeof AutodateField>;
export const JSONField = fieldConstructor(CoreJSONField);
export type JSONField = InstanceType<typeof JSONField>;
export const RelationField = fieldConstructor(CoreRelationField);
export type RelationField = InstanceType<typeof RelationField>;
export const SelectField = fieldConstructor(CoreSelectField);
export type SelectField = InstanceType<typeof SelectField>;
export const FileField = fieldConstructor(CoreFileField);
export type FileField = InstanceType<typeof FileField>;
export const GeoPointField = fieldConstructor(CoreGeoPointField);
export type GeoPointField = InstanceType<typeof GeoPointField>;

export const fieldConstructors = {
  TextField,
  NumberField,
  BoolField,
  URLField,
  EmailField,
  EditorField,
  PasswordField,
  DateField,
  AutodateField,
  JSONField,
  RelationField,
  SelectField,
  FileField,
  GeoPointField,
};
export type FieldConstructors = typeof fieldConstructors;
