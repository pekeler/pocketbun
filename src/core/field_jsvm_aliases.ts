// PocketBun-only: installs direct JSVM compatibility aliases on field classes.
//
// PocketBase server-side JavaScript exposes field settings and methods with
// lower-camel names, while the TypeScript port keeps the upstream Go-style
// field names in each field file. Field classes intentionally do not share a
// concrete base class, so the aliases are centralized here instead of using
// bind-layer object facades.

import { AutodateField } from "./field_autodate.ts";
import { BoolField } from "./field_bool.ts";
import { DateField } from "./field_date.ts";
import { EditorField } from "./field_editor.ts";
import { EmailField } from "./field_email.ts";
import { FileField } from "./field_file.ts";
import { GeoPointField } from "./field_geo_point.ts";
import { JSONField } from "./field_json.ts";
import { NumberField } from "./field_number.ts";
import { PasswordField } from "./field_password.ts";
import { RelationField } from "./field_relation.ts";
import { SelectField } from "./field_select.ts";
import { TextField } from "./field_text.ts";
import { URLField } from "./field_url.ts";

const fieldConstructors = [
  AutodateField,
  BoolField,
  DateField,
  EditorField,
  EmailField,
  FileField,
  GeoPointField,
  JSONField,
  NumberField,
  PasswordField,
  RelationField,
  SelectField,
  TextField,
  URLField,
] as const;

const fieldPropertyAliases = [
  ["id", "Id"],
  ["name", "Name"],
  ["system", "System"],
  ["hidden", "Hidden"],
  ["presentable", "Presentable"],
  ["help", "Help"],
  ["required", "Required"],
  ["min", "Min"],
  ["max", "Max"],
  ["onlyInt", "OnlyInt"],
  ["exceptDomains", "ExceptDomains"],
  ["onlyDomains", "OnlyDomains"],
  ["maxSize", "MaxSize"],
  ["convertURLs", "ConvertURLs"],
  ["cost", "Cost"],
  ["autogeneratePattern", "AutogeneratePattern"],
  ["primaryKey", "PrimaryKey"],
  ["collectionId", "CollectionId"],
  ["cascadeDelete", "CascadeDelete"],
  ["minSelect", "MinSelect"],
  ["maxSelect", "MaxSelect"],
  ["values", "Values"],
  ["mimeTypes", "MimeTypes"],
  ["thumbs", "Thumbs"],
  ["protected", "Protected"],
  ["onCreate", "OnCreate"],
  ["onUpdate", "OnUpdate"],
  ["pattern", "Pattern"],
] as const;

const fieldMethodAliases = [
  ["type", "Type"],
  ["getId", "GetId"],
  ["setId", "SetId"],
  ["getName", "GetName"],
  ["setName", "SetName"],
  ["getSystem", "GetSystem"],
  ["setSystem", "SetSystem"],
  ["getHidden", "GetHidden"],
  ["setHidden", "SetHidden"],
  ["columnType", "ColumnType"],
  ["prepareValue", "PrepareValue"],
  ["validateValue", "ValidateValue"],
  ["validatePlainValue", "ValidatePlainValue"],
  ["validateSettings", "ValidateSettings"],
  ["findSetter", "FindSetter"],
  ["findGetter", "FindGetter"],
  ["driverValue", "DriverValue"],
  ["isMultiple", "IsMultiple"],
  ["calculateMaxBodySize", "CalculateMaxBodySize"],
  ["intercept", "Intercept"],
  ["canInterceptAction", "CanInterceptAction"],
] as const;

let installed = false;

export function installFieldJSVMAliases(): void {
  if (installed) {
    return;
  }
  installed = true;

  for (const Ctor of fieldConstructors) {
    const prototype = Ctor.prototype as object;
    for (const [aliasName, sourceName] of fieldPropertyAliases) {
      defineFieldPropertyAlias(prototype, aliasName, sourceName);
    }
    for (const [aliasName, sourceName] of fieldMethodAliases) {
      defineFieldMethodAlias(prototype, aliasName, sourceName);
    }
  }
}

function defineFieldPropertyAlias(prototype: object, aliasName: string, sourceName: string): void {
  if (aliasName in prototype) {
    return;
  }

  Object.defineProperty(prototype, aliasName, {
    configurable: true,
    enumerable: false,
    get(this: Record<string, unknown>) {
      return this[sourceName];
    },
    set(this: Record<string, unknown>, value: unknown) {
      this[sourceName] = value;
    },
  });
}

function defineFieldMethodAlias(prototype: object, aliasName: string, sourceName: string): void {
  if (aliasName in prototype) {
    return;
  }

  Object.defineProperty(prototype, aliasName, {
    configurable: true,
    enumerable: false,
    writable: true,
    value(this: Record<string, unknown>, ...args: unknown[]) {
      const method = this[sourceName];
      if (typeof method !== "function") {
        throw new Error(`${sourceName} is not available`);
      }
      const result = method.apply(this, args);
      if (result instanceof Error) {
        throw result;
      }
      return result;
    },
  });
}
