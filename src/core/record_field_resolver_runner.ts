// Ported from pocketbase/core/record_field_resolver_runner.go

import type { Collection, CollectionField } from "./collection.ts";
import type { RequestInfo } from "./event_request.ts";
import type { RecordFieldResolver } from "./record_field_resolver.ts";
import { FieldNameCollectionId, FieldNameCollectionName, FieldNameEmail, FieldNameEmailVisibility } from "./record.ts";
import { FieldNameId, FieldNameVerified } from "./record.ts";
import { columnify } from "../tools/inflector/inflector.ts";
import { JSONArrayLength, JSONExtract } from "../tools/dbutils/index.ts";
import { existInSliceWithRegex } from "../tools/list/list.ts";
export const eachModifier = "each";
export const issetModifier = "isset";
export const lengthModifier = "length";
export const lowerModifier = "lower";
export const changedModifier = "changed";

export const FieldTypeRelation = "relation";
export const FieldTypeSelect = "select";
export const FieldTypeFile = "file";
import type { ResolverResult } from "../tools/search/field_resolver.ts";

const plainRequestAuthFields = new Set<string>([
  `@request.auth.${FieldNameId}`,
  `@request.auth.${FieldNameCollectionId}`,
  `@request.auth.${FieldNameCollectionName}`,
  `@request.auth.${FieldNameEmail}`,
  `@request.auth.${FieldNameEmailVisibility}`,
  `@request.auth.${FieldNameVerified}`,
]);

export function parseAndRun(fieldName: string, resolver: RecordFieldResolver): ResolverResult {
  const runner = new Runner(fieldName, resolver);
  return runner.run();
}

class Runner {
  used = false;
  resolver: RecordFieldResolver;
  fieldName: string;
  activeProps: string[] = [];
  activeCollectionName = "";
  activeTableAlias = "";
  nullifyMissingField = false;

  constructor(fieldName: string, resolver: RecordFieldResolver) {
    this.fieldName = fieldName;
    this.resolver = resolver;
  }

  run(): ResolverResult {
    if (this.used) {
      throw new Error("the runner was already used");
    }

    if (
      this.resolver.allowedFields.length > 0 &&
      !existInSliceWithRegex(this.fieldName, this.resolver.allowedFields)
    ) {
      throw new Error(`failed to resolve field "${this.fieldName}"`);
    }

    this.used = true;
    this.prepare();

    if (this.activeProps[0] === "@collection") {
      return this.processCollectionField();
    }

    if (this.activeProps[0] === "@request") {
      if (!this.resolver.requestInfo) {
        return { identifier: "NULL", params: [], nullFallback: "auto" };
      }

      if (this.fieldName.startsWith("@request.auth.")) {
        return this.processRequestAuthField();
      }

      if (this.fieldName.startsWith("@request.body.") && this.activeProps.length > 2) {
        return this.processRequestBodyField();
      }

      return this.resolver.resolveStaticRequestField(...this.activeProps.slice(1));
    }

    return this.processActiveProps();
  }

  prepare(): void {
    this.activeProps = this.fieldName.split(".");
    this.activeCollectionName = this.resolver.baseCollection.name;
    this.activeTableAlias =
      this.resolver.baseCollectionAlias || columnify(this.activeCollectionName);
    this.nullifyMissingField = this.activeProps[0] === "@request";
  }

  processCollectionField(): ResolverResult {
    if (this.activeProps.length < 3) {
      throw new Error(`invalid @collection field path in "${this.fieldName}"`);
    }

    const collectionName = this.activeProps[1] ?? "";
    const [name] = collectionName.split(":", 2);
    const collection = this.resolver.loadCollection(name);
    if (!collection) {
      throw new Error(`failed to load collection "${name}" from field path "${this.fieldName}"`);
    }

    // TODO: relation joins will be ported later; for now we only allow direct fields.
    this.activeCollectionName = collection.name;
    this.activeTableAlias = columnify(collection.name);
    this.activeProps = this.activeProps.slice(2);

    return this.processActiveProps();
  }

  processRequestAuthField(): ResolverResult {
    const info = this.resolver.requestInfo;
    if (!info || !info.auth || !info.auth.collection()) {
      return { identifier: "NULL", params: [], nullFallback: "auto" };
    }

    if (plainRequestAuthFields.has(this.fieldName)) {
      return this.resolver.resolveStaticRequestField(...this.activeProps.slice(1));
    }

    return this.resolver.resolveStaticRequestField(...this.activeProps.slice(1));
  }

  processRequestBodyField(): ResolverResult {
    const info = this.resolver.requestInfo as RequestInfo;
    const name = this.activeProps[2] ?? "";
    const [fieldName, modifier] = splitModifier(name);
    const bodyValue = info.body[fieldName];

    if (modifier === lengthModifier) {
      const items = Array.isArray(bodyValue) ? bodyValue : bodyValue == null ? [] : [bodyValue];
      return { identifier: "?", params: [items.length], nullFallback: "auto" };
    }

    if (modifier === lowerModifier) {
      return {
        identifier: "LOWER(?)",
        params: [bodyValue == null ? "" : String(bodyValue)],
        nullFallback: "auto",
      };
    }

    if (modifier === changedModifier) {
      throw new Error(`modifier "${changedModifier}" is not supported yet`);
    }

    if (modifier === eachModifier) {
      throw new Error(`modifier "${eachModifier}" is not supported yet`);
    }

    return this.resolver.resolveStaticRequestField(...this.activeProps.slice(1));
  }

  processActiveProps(): ResolverResult {
    if (this.activeProps.length === 0) {
      throw new Error(`invalid field path "${this.fieldName}"`);
    }

    const [prop] = this.activeProps;
    if (!prop) {
      throw new Error(`invalid field path "${this.fieldName}"`);
    }

    const [name, modifier] = splitModifier(prop);
    const field = getCollectionField(this.resolver.baseCollection, name);

    if (!field) {
      if (this.nullifyMissingField) {
        return { identifier: "NULL", params: [], nullFallback: "auto" };
      }
      throw new Error(`unknown field "${name}"`);
    }

    if (field.hidden && !this.resolver.allowHiddenFields) {
      throw new Error(`non-filterable field "${name}"`);
    }

    const cleanName = columnify(field.name);

    if (modifier === lengthModifier) {
      if (!isMultiValuerField(field)) {
        throw new Error(`field "${field.name}" doesn't support multivalue operations`);
      }
      return {
        identifier: JSONArrayLength(`${this.activeTableAlias}.${cleanName}`),
        params: [],
        nullFallback: "auto",
      };
    }

    if (this.activeProps.length > 1) {
      const jsonPath = buildJsonPath(this.activeProps.slice(1));
      return {
        identifier: JSONExtract(`${this.activeTableAlias}.${cleanName}`, jsonPath),
        params: [],
        nullFallback: "disabled",
      };
    }

    return {
      identifier: `[[${this.activeTableAlias}.${cleanName}]]`,
      params: [],
      nullFallback: "auto",
    };
  }
}

function buildJsonPath(parts: string[]): string {
  let jsonPath = "";
  for (const part of parts) {
    if (!part) {
      continue;
    }
    if (/^\d+$/.test(part)) {
      jsonPath += `[${columnify(part)}]`;
    } else {
      jsonPath += `.${columnify(part)}`;
    }
  }
  return jsonPath;
}

export function getCollectionField(
  collection: Collection,
  name: string,
): CollectionField | null {
  for (const field of collection.fields) {
    if (field.name === name) {
      return field;
    }
  }
  return null;
}

export function isMultiValuerField(field: CollectionField | null): boolean {
  if (!field) {
    return false;
  }
  if (![FieldTypeRelation, FieldTypeSelect, FieldTypeFile].includes(field.type)) {
    return false;
  }
  const maxSelect = Number((field.raw as Record<string, unknown>).maxSelect ?? 1);
  return Number.isFinite(maxSelect) ? maxSelect > 1 : false;
}

export function splitModifier(combined: string): [string, string] {
  const parts = combined.split(":");
  if (parts.length !== 2) {
    return [combined, ""];
  }

  switch (parts[1]) {
    case issetModifier:
    case eachModifier:
    case lengthModifier:
    case lowerModifier:
    case changedModifier:
      return [parts[0] ?? "", parts[1] ?? ""];
    default:
      throw new Error(`unknown modifier in "${combined}"`);
  }
}

export function extractNestedVal(rawData: unknown, ...keys: string[]): unknown {
  if (keys.length === 0) {
    throw new Error("at least one key should be provided");
  }

  if (Array.isArray(rawData)) {
    return arrVal(rawData, keys);
  }

  if (rawData && typeof rawData === "object") {
    return mapVal(rawData as Record<string, unknown>, keys);
  }

  throw new Error("expected map or array");
}

function mapVal(raw: Record<string, unknown>, keys: string[]): unknown {
  if (!(keys[0] in raw)) {
    throw new Error(`invalid key path - missing key "${keys[0] ?? ""}"`);
  }

  const result = raw[keys[0] ?? ""];
  if (keys.length === 1) {
    return result;
  }

  return extractNestedVal(result, ...keys.slice(1));
}

function arrVal(raw: unknown[], keys: string[]): unknown {
  const idx = Number.parseInt(keys[0] ?? "", 10);
  if (!Number.isFinite(idx) || idx < 0 || idx >= raw.length) {
    throw new Error(`invalid key path - invalid or missing array index "${keys[0] ?? ""}"`);
  }

  const result = raw[idx];
  if (keys.length === 1) {
    return result;
  }

  return extractNestedVal(result, ...keys.slice(1));
}
