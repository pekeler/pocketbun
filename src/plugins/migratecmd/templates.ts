// Ported from pocketbase/plugins/migratecmd/templates.go.
// Note: helpers are module-level in TS to avoid splitting class methods across files.

import { basename } from "node:path";
import { Collection } from "../../core/collection_model.ts";

export const TemplateLangJS = "js";
export const TemplateLangGo = "go";

// note: this usually should be configurable similar to the jsvm plugin,
// but for simplicity is static as users can easily change the
// reference path if they use custom dirs structure
const jsTypesDirective = `/// <reference path="../pb_data/types.d.ts" />\n`;

export const ErrEmptyTemplate = new Error("empty template");

// -------------------------------------------------------------------
// JavaScript templates
// -------------------------------------------------------------------

export function jsBlankTemplate(): string {
  const template =
    jsTypesDirective +
    `migrate((app) => {
  // add up queries...
}, (app) => {
  // add down queries...
})
`;

  return template;
}

export function jsSnapshotTemplate(collections: Collection[]): string {
  // unset timestamp fields
  const collectionsData: Array<Record<string, unknown>> = [];
  for (const collection of collections) {
    const data = toMap(collection);
    delete data.created;
    delete data.updated;
    deleteNestedMapKey(data, "oauth2", "providers");
    collectionsData.push(data);
  }

  const jsonData = marhshalWithoutEscape(collectionsData, "  ", "  ");

  const template =
    jsTypesDirective +
    `migrate((app) => {
  const snapshot = %s;

  return app.importCollections(snapshot, false);
}, (app) => {
  return null;
})
`;

  return formatTemplate(template, jsonData);
}

export function jsCreateTemplate(collection: Collection): string {
  // unset timestamp fields
  const collectionData = toMap(collection);
  delete collectionData.created;
  delete collectionData.updated;
  deleteNestedMapKey(collectionData, "oauth2", "providers");

  const jsonData = marhshalWithoutEscape(collectionData, "  ", "  ");

  const template =
    jsTypesDirective +
    `migrate((app) => {
  const collection = new Collection(%s);

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId(%q);

  return app.delete(collection);
})
`;

  return formatTemplate(template, jsonData, JSON.stringify(collection.id));
}

export function jsDeleteTemplate(collection: Collection): string {
  // unset timestamp fields
  const collectionData = toMap(collection);
  delete collectionData.created;
  delete collectionData.updated;
  deleteNestedMapKey(collectionData, "oauth2", "providers");

  const jsonData = marhshalWithoutEscape(collectionData, "  ", "  ");

  const template =
    jsTypesDirective +
    `migrate((app) => {
  const collection = app.findCollectionByNameOrId(%q);

  return app.delete(collection);
}, (app) => {
  const collection = new Collection(%s);

  return app.save(collection);
})
`;

  return formatTemplate(template, JSON.stringify(collection.id), jsonData);
}

export function jsDiffTemplate(newCollection: Collection | null, oldCollection: Collection | null): string {
  if (!newCollection && !oldCollection) {
    throw new Error("the diff template require at least one of the collection to be non-nil");
  }

  if (!newCollection && oldCollection) {
    return jsDeleteTemplate(oldCollection);
  }

  if (!oldCollection && newCollection) {
    return jsCreateTemplate(newCollection);
  }

  const newCollectionRef = newCollection as Collection;
  const oldCollectionRef = oldCollection as Collection;

  const upParts: string[] = [];
  const downParts: string[] = [];
  const varName = "collection";

  const newMap = toMap(newCollectionRef);
  const oldMap = toMap(oldCollectionRef);

  // non-fields
  // -----------------------------------------------------------------

  const upDiff = diffMaps(oldMap, newMap, "fields", "created", "updated");
  if (Object.keys(upDiff).length > 0) {
    const downDiff = diffMaps(newMap, oldMap, "fields", "created", "updated");

    const rawUpDiff = marhshalWithoutEscape(upDiff, "  ", "  ");
    const rawDownDiff = marhshalWithoutEscape(downDiff, "  ", "  ");

    upParts.push("// update collection data");
    upParts.push(`unmarshal(${rawUpDiff}, ${varName})\n`);
    // ---
    downParts.push("// update collection data");
    downParts.push(`unmarshal(${rawDownDiff}, ${varName})\n`);
  }

  // fields
  // -----------------------------------------------------------------

  const oldFieldsSlice = oldMap.fields;
  if (!Array.isArray(oldFieldsSlice)) {
    throw new Error('oldMap["fields"] is not []any');
  }

  const newFieldsSlice = newMap.fields;
  if (!Array.isArray(newFieldsSlice)) {
    throw new Error('newMap["fields"] is not []any');
  }

  // deleted fields
  for (let i = 0; i < oldCollectionRef.Fields.length; i += 1) {
    const oldField = oldCollectionRef.Fields[i];
    if (!oldField) {
      continue;
    }
    if (newCollectionRef.Fields.GetById(oldField.GetId())) {
      continue; // exist
    }

    const rawOldField = marhshalWithoutEscape(oldFieldsSlice[i], "  ", "  ");

    upParts.push("// remove field");
    upParts.push(`${varName}.fields.removeById(${JSON.stringify(oldField.GetId())})\n`);

    downParts.push("// add field");
    downParts.push(`${varName}.fields.addAt(${i}, new Field(${rawOldField}))\n`);
  }

  // created fields
  for (let i = 0; i < newCollectionRef.Fields.length; i += 1) {
    const newField = newCollectionRef.Fields[i];
    if (!newField) {
      continue;
    }
    if (oldCollectionRef.Fields.GetById(newField.GetId())) {
      continue; // exist
    }

    const rawNewField = marhshalWithoutEscape(newFieldsSlice[i], "  ", "  ");

    upParts.push("// add field");
    upParts.push(`${varName}.fields.addAt(${i}, new Field(${rawNewField}))\n`);

    downParts.push("// remove field");
    downParts.push(`${varName}.fields.removeById(${JSON.stringify(newField.GetId())})\n`);
  }

  // modified fields
  // (note currently ignoring order-only changes as it comes with too many edge-cases)
  for (let i = 0; i < newCollectionRef.Fields.length; i += 1) {
    const newField = newCollectionRef.Fields[i];
    if (!newField) {
      continue;
    }

    const rawNewField = marhshalWithoutEscape(newFieldsSlice[i], "  ", "  ");

    let rawOldField: string | null = null;
    let oldFieldIndex = 0;

    for (let j = 0; j < oldCollectionRef.Fields.length; j += 1) {
      const oldField = oldCollectionRef.Fields[j];
      if (!oldField) {
        continue;
      }
      if (oldField.GetId() === newField.GetId()) {
        rawOldField = marhshalWithoutEscape(oldFieldsSlice[j], "  ", "  ");
        oldFieldIndex = j;
        break;
      }
    }

    if (!rawOldField || rawNewField === rawOldField) {
      continue; // new field or no change
    }

    upParts.push("// update field");
    upParts.push(`${varName}.fields.addAt(${i}, new Field(${rawNewField}))\n`);

    downParts.push("// update field");
    downParts.push(`${varName}.fields.addAt(${oldFieldIndex}, new Field(${rawOldField}))\n`);
  }

  // -----------------------------------------------------------------

  if (upParts.length === 0 && downParts.length === 0) {
    throw ErrEmptyTemplate;
  }

  const up = upParts.join("\n  ");
  const down = downParts.join("\n  ");

  const template =
    jsTypesDirective +
    `migrate((app) => {
  const collection = app.findCollectionByNameOrId(%q)

  %s

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId(%q)

  %s

  return app.save(collection)
})
`;

  return formatTemplate(
    template,
    JSON.stringify(oldCollectionRef.id),
    up.trim(),
    JSON.stringify(newCollectionRef.id),
    down.trim(),
  );
}

// -------------------------------------------------------------------
// Go templates
// -------------------------------------------------------------------

export function goBlankTemplate(dir: string): string {
  const template = `package %s

import (
\t"github.com/pocketbase/pocketbase/core"
\tm "github.com/pocketbase/pocketbase/migrations"
)

func init() {
\tm.Register(func(app core.App) error {
\t\t// add up queries...

\t\treturn nil
\t}, func(app core.App) error {
\t\t// add down queries...

\t\treturn nil
\t})
}
`;

  return formatTemplate(template, basename(dir));
}

export function goSnapshotTemplate(dir: string, collections: Collection[]): string {
  // unset timestamp fields
  const collectionsData: Array<Record<string, unknown>> = [];
  for (const collection of collections) {
    const data = toMap(collection);
    delete data.created;
    delete data.updated;
    deleteNestedMapKey(data, "oauth2", "providers");
    collectionsData.push(data);
  }

  const jsonData = marhshalWithoutEscape(collectionsData, "\t\t", "\t");

  const template =
    `package %s

import (
\t"github.com/pocketbase/pocketbase/core"
\tm "github.com/pocketbase/pocketbase/migrations"
)

func init() {
\tm.Register(func(app core.App) error {
\t\tjsonData := ` +
    "`%s`" +
    `

\t\treturn app.ImportCollectionsByMarshaledJSON([]byte(jsonData), false)
\t}, func(app core.App) error {
\t\treturn nil
\t})
}
`;

  return formatTemplate(template, basename(dir), escapeBacktick(jsonData));
}

export function goCreateTemplate(dir: string, collection: Collection): string {
  // unset timestamp fields
  const collectionData = toMap(collection);
  delete collectionData.created;
  delete collectionData.updated;
  deleteNestedMapKey(collectionData, "oauth2", "providers");

  const jsonData = marhshalWithoutEscape(collectionData, "\t\t", "\t");

  const template =
    `package %s

import (
\t"encoding/json"

\t"github.com/pocketbase/pocketbase/core"
\tm "github.com/pocketbase/pocketbase/migrations"
)

func init() {
\tm.Register(func(app core.App) error {
\t\tjsonData := ` +
    "`%s`" +
    `

\t\tcollection := &core.Collection{}
\t\tif err := json.Unmarshal([]byte(jsonData), &collection); err != nil {
\t\t\treturn err
\t\t}

\t\treturn app.Save(collection)
\t}, func(app core.App) error {
\t\tcollection, err := app.FindCollectionByNameOrId(%q)
\t\tif err != nil {
\t\t\treturn err
\t\t}

\t\treturn app.Delete(collection)
\t})
}
`;

  return formatTemplate(template, basename(dir), escapeBacktick(jsonData), JSON.stringify(collection.id));
}

export function goDeleteTemplate(dir: string, collection: Collection): string {
  // unset timestamp fields
  const collectionData = toMap(collection);
  delete collectionData.created;
  delete collectionData.updated;
  deleteNestedMapKey(collectionData, "oauth2", "providers");

  const jsonData = marhshalWithoutEscape(collectionData, "\t\t", "\t");

  const template =
    `package %s

import (
\t"encoding/json"

\t"github.com/pocketbase/pocketbase/core"
\tm "github.com/pocketbase/pocketbase/migrations"
)

func init() {
\tm.Register(func(app core.App) error {
\t\tcollection, err := app.FindCollectionByNameOrId(%q)
\t\tif err != nil {
\t\t\treturn err
\t\t}

\t\treturn app.Delete(collection)
\t}, func(app core.App) error {
\t\tjsonData := ` +
    "`%s`" +
    `

\t\tcollection := &core.Collection{}
\t\tif err := json.Unmarshal([]byte(jsonData), &collection); err != nil {
\t\t\treturn err
\t\t}

\t\treturn app.Save(collection)
\t})
}
`;

  return formatTemplate(template, basename(dir), JSON.stringify(collection.id), escapeBacktick(jsonData));
}

export function goDiffTemplate(dir: string, newCollection: Collection | null, oldCollection: Collection | null): string {
  if (!newCollection && !oldCollection) {
    throw new Error("the diff template require at least one of the collection to be non-nil");
  }

  if (!newCollection && oldCollection) {
    return goDeleteTemplate(dir, oldCollection);
  }

  if (!oldCollection && newCollection) {
    return goCreateTemplate(dir, newCollection);
  }

  const newCollectionRef = newCollection as Collection;
  const oldCollectionRef = oldCollection as Collection;

  const upParts: string[] = [];
  const downParts: string[] = [];
  const varName = "collection";

  const newMap = toMap(newCollectionRef);
  const oldMap = toMap(oldCollectionRef);

  // non-fields
  // -----------------------------------------------------------------

  const upDiff = diffMaps(oldMap, newMap, "fields", "created", "updated");
  if (Object.keys(upDiff).length > 0) {
    const downDiff = diffMaps(newMap, oldMap, "fields", "created", "updated");

    const rawUpDiff = marhshalWithoutEscape(upDiff, "\t\t", "\t");
    const rawDownDiff = marhshalWithoutEscape(downDiff, "\t\t", "\t");

    upParts.push("// update collection data");
    upParts.push(goErrIf(`json.Unmarshal([]byte(\`${escapeBacktick(rawUpDiff)}\`), &${varName})`));
    // ---
    downParts.push("// update collection data");
    downParts.push(goErrIf(`json.Unmarshal([]byte(\`${escapeBacktick(rawDownDiff)}\`), &${varName})`));
  }

  // fields
  // -----------------------------------------------------------------

  const oldFieldsSlice = oldMap.fields;
  if (!Array.isArray(oldFieldsSlice)) {
    throw new Error('oldMap["fields"] is not []any');
  }

  const newFieldsSlice = newMap.fields;
  if (!Array.isArray(newFieldsSlice)) {
    throw new Error('newMap["fields"] is not []any');
  }

  // deleted fields
  for (let i = 0; i < oldCollectionRef.Fields.length; i += 1) {
    const oldField = oldCollectionRef.Fields[i];
    if (!oldField) {
      continue;
    }
    if (newCollectionRef.Fields.GetById(oldField.GetId())) {
      continue; // exist
    }

    const rawOldField = marhshalWithoutEscape(oldFieldsSlice[i], "\t\t", "\t");

    upParts.push("// remove field");
    upParts.push(`${varName}.Fields.RemoveById(${JSON.stringify(oldField.GetId())})\n`);

    downParts.push("// add field");
    downParts.push(goErrIf(`${varName}.Fields.AddMarshaledJSONAt(${i}, []byte(\`${escapeBacktick(rawOldField)}\`))`));
  }

  // created fields
  for (let i = 0; i < newCollectionRef.Fields.length; i += 1) {
    const newField = newCollectionRef.Fields[i];
    if (!newField) {
      continue;
    }
    if (oldCollectionRef.Fields.GetById(newField.GetId())) {
      continue; // exist
    }

    const rawNewField = marhshalWithoutEscape(newFieldsSlice[i], "\t\t", "\t");

    upParts.push("// add field");
    upParts.push(goErrIf(`${varName}.Fields.AddMarshaledJSONAt(${i}, []byte(\`${escapeBacktick(rawNewField)}\`))`));

    downParts.push("// remove field");
    downParts.push(`${varName}.Fields.RemoveById(${JSON.stringify(newField.GetId())})\n`);
  }

  // modified fields
  // (note currently ignoring order-only changes as it comes with too many edge-cases)
  for (let i = 0; i < newCollectionRef.Fields.length; i += 1) {
    const newField = newCollectionRef.Fields[i];
    if (!newField) {
      continue;
    }

    const rawNewField = marhshalWithoutEscape(newFieldsSlice[i], "\t\t", "\t");

    let rawOldField: string | null = null;
    let oldFieldIndex = 0;

    for (let j = 0; j < oldCollectionRef.Fields.length; j += 1) {
      const oldField = oldCollectionRef.Fields[j];
      if (!oldField) {
        continue;
      }
      if (oldField.GetId() === newField.GetId()) {
        rawOldField = marhshalWithoutEscape(oldFieldsSlice[j], "\t\t", "\t");
        oldFieldIndex = j;
        break;
      }
    }

    if (!rawOldField || rawNewField === rawOldField) {
      continue; // new field or no change
    }

    upParts.push("// update field");
    upParts.push(goErrIf(`${varName}.Fields.AddMarshaledJSONAt(${i}, []byte(\`${escapeBacktick(rawNewField)}\`))`));

    downParts.push("// update field");
    downParts.push(
      goErrIf(`${varName}.Fields.AddMarshaledJSONAt(${oldFieldIndex}, []byte(\`${escapeBacktick(rawOldField)}\`))`),
    );
  }

  // ---------------------------------------------------------------

  if (upParts.length === 0 && downParts.length === 0) {
    throw ErrEmptyTemplate;
  }

  const up = upParts.join("\n\t\t");
  const down = downParts.join("\n\t\t");
  const combined = up + down;

  // generate imports
  // ---
  let imports = "";

  if (combined.includes("json.Unmarshal(") || combined.includes("json.Marshal(")) {
    imports += '\n\t"encoding/json"\n';
  }

  imports += '\n\t"github.com/pocketbase/pocketbase/core"';
  imports += '\n\tm "github.com/pocketbase/pocketbase/migrations"';
  // ---

  const template = `package %s

import (%s
)

func init() {
\tm.Register(func(app core.App) error {
\t\tcollection, err := app.FindCollectionByNameOrId(%q)
\t\tif err != nil {
\t\t\treturn err
\t\t}

\t\t%s

\t\treturn app.Save(collection)
\t}, func(app core.App) error {
\t\tcollection, err := app.FindCollectionByNameOrId(%q)
\t\tif err != nil {
\t\t\treturn err
\t\t}

\t\t%s

\t\treturn app.Save(collection)
\t})
}
`;

  return formatTemplate(
    template,
    basename(dir),
    imports,
    JSON.stringify(oldCollectionRef.id),
    up.trim(),
    JSON.stringify(newCollectionRef.id),
    down.trim(),
  );
}

function formatTemplate(template: string, ...values: string[]): string {
  let index = 0;
  return template.replace(/%[sq]/g, (match) => {
    const value = values[index];
    index += 1;
    return value ?? match;
  });
}

function marhshalWithoutEscape(value: unknown, prefix: string, indent: string): string {
  const raw = stableStringify(value, indent);
  const prefixed = applyPrefix(raw, prefix);
  return unescapeUnicode(prefixed);
}

function escapeBacktick(value: string): string {
  return value.replaceAll("`", '` + "`" + `');
}

function goErrIf(value: string): string {
  return `if err := ${value}; err != nil {\n\t\t\treturn err\n\t\t}\n`;
}

function toMap(value: unknown): Record<string, unknown> {
  let raw = "";
  try {
    raw = JSON.stringify(value) ?? "";
  } catch (error) {
    throw error instanceof Error ? error : new Error("failed to marshal value");
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("failed to unmarshal value");
    }
    return parsed;
  } catch (error) {
    throw error instanceof Error ? error : new Error("failed to unmarshal value");
  }
}

function diffMaps(
  oldMap: Record<string, unknown>,
  newMap: Record<string, unknown>,
  ...excludeKeys: string[]
): Record<string, unknown> {
  const diff: Record<string, unknown> = {};
  const exclude = new Set(excludeKeys);

  for (const [key, valueNew] of Object.entries(newMap)) {
    if (exclude.has(key)) {
      continue;
    }

    if (!Object.prototype.hasOwnProperty.call(oldMap, key)) {
      // new field
      diff[key] = valueNew;
      continue;
    }

    const valueOld = oldMap[key];
    const rawOld = stableStringify(valueOld, "");
    const rawNew = stableStringify(valueNew, "");

    if (rawOld !== rawNew) {
      if (isPlainObject(valueOld) && isPlainObject(valueNew)) {
        const subDiff = diffMaps(valueOld, valueNew);
        if (Object.keys(subDiff).length > 0) {
          diff[key] = subDiff;
        }
      } else {
        diff[key] = valueNew;
      }
    }
  }

  // unset missing fields
  for (const key of Object.keys(oldMap)) {
    if (exclude.has(key) || Object.prototype.hasOwnProperty.call(diff, key)) {
      continue; // already added
    }

    if (!Object.prototype.hasOwnProperty.call(newMap, key)) {
      diff[key] = null;
    }
  }

  return diff;
}

function deleteNestedMapKey(data: Record<string, unknown>, ...parts: string[]): void {
  if (parts.length === 0) {
    return;
  }

  if (parts.length === 1) {
    delete data[parts[0] ?? ""];
    return;
  }

  const key = parts[0] ?? "";
  const next = data[key];
  if (next && typeof next === "object" && !Array.isArray(next)) {
    deleteNestedMapKey(next as Record<string, unknown>, ...parts.slice(1));
  }
}

function stableStringify(value: unknown, indent: string): string {
  const normalized = normalizeForJSON(value);
  return JSON.stringify(normalized, null, indent) ?? "";
}

function normalizeForJSON(value: unknown): unknown {
  if (value == null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeForJSON(item));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    const withJson = value as { toJSON?: () => unknown };
    if (typeof withJson.toJSON === "function") {
      return normalizeForJSON(withJson.toJSON());
    }

    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const result: Record<string, unknown> = {};

    for (const key of keys) {
      result[key] = normalizeForJSON(record[key]);
    }

    return result;
  }

  return value;
}

function applyPrefix(raw: string, prefix: string): string {
  if (!prefix) {
    return raw;
  }

  const lines = raw.split("\n");
  if (lines.length <= 1) {
    return raw;
  }

  const [first, ...rest] = lines;
  return [first, ...rest.map((line) => `${prefix}${line}`)].join("\n");
}

function unescapeUnicode(value: string): string {
  const quoted = JSON.stringify(value) ?? "";
  const replaced = quoted.replace(/\\\\u/g, "\\u");
  return JSON.parse(replaced) as string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
