// Ported from pocketbase/core/record_field_resolver_runner.go

import type { Collection, CollectionField } from "./collection.ts";
import type { RecordFieldResolver } from "./record_field_resolver.ts";
import {
  FieldNameCollectionId,
  FieldNameCollectionName,
  FieldNameEmail,
  FieldNameEmailVisibility,
  FieldNameId,
  FieldNameVerified,
} from "./record.ts";
import { columnify } from "../tools/inflector/inflector.ts";
import { JSONArrayLength, JSONEach, JSONExtract } from "../tools/dbutils/json.ts";
import { findSingleColumnUniqueIndex } from "../tools/dbutils/index.ts";
import { existInSliceWithRegex, toUniqueStringSlice } from "../tools/list/list.ts";
import { buildFilterExpr } from "../tools/search/filter.ts";
import type { ResolverResult } from "../tools/search/field_resolver.ts";
import { DefaultFilterExprLimit } from "../tools/search/types.ts";
import { MultiMatchSubquery } from "../tools/search/multi_match_subquery.ts";

export const eachModifier = "each";
export const issetModifier = "isset";
export const lengthModifier = "length";
export const lowerModifier = "lower";
export const changedModifier = "changed";

export const FieldTypeRelation = "relation";
export const FieldTypeSelect = "select";
export const FieldTypeFile = "file";
export const FieldTypeJSON = "json";
export const FieldTypeGeoPoint = "geoPoint";

const maxNestedRels = 6;

const plainRequestAuthFields = new Set<string>([
  `@request.auth.${FieldNameId}`,
  `@request.auth.${FieldNameCollectionId}`,
  `@request.auth.${FieldNameCollectionName}`,
  `@request.auth.${FieldNameEmail}`,
  `@request.auth.${FieldNameEmailVisibility}`,
  `@request.auth.${FieldNameVerified}`,
]);

const viaRegex = /^(\w+)_via_(\w+)$/;

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
  withMultiMatch = false;
  multiMatchActiveTableAlias = "";
  multiMatch: MultiMatchSubquery;

  constructor(fieldName: string, resolver: RecordFieldResolver) {
    this.fieldName = fieldName;
    this.resolver = resolver;
    this.multiMatch = new MultiMatchSubquery();
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

    this.multiMatch.targetTableAlias = this.activeTableAlias;
    this.multiMatch.fromTableName = columnify(this.activeCollectionName);
    this.multiMatch.fromTableAlias = `__mm_${this.activeTableAlias}`;
    this.multiMatchActiveTableAlias = this.multiMatch.fromTableAlias;
  }

  processCollectionField(): ResolverResult {
    if (this.activeProps.length < 3) {
      throw new Error(`invalid @collection field path in "${this.fieldName}"`);
    }

    const collectionName = this.activeProps[1] ?? "";
    const [name = "", alias] = collectionName.split(":", 2);
    const collection = this.resolver.loadCollection(name);
    if (!collection) {
      throw new Error(`failed to load collection "${name}" from field path "${this.fieldName}"`);
    }

    this.activeCollectionName = collection.name;
    if (alias) {
      this.activeTableAlias =
        columnify(`__collection_alias_${alias}`) + this.resolver.joinAliasSuffix;
    } else {
      this.activeTableAlias =
        columnify(`__collection_${this.activeCollectionName}`) + this.resolver.joinAliasSuffix;
    }

    this.withMultiMatch = true;

    this.resolver.registerJoin(columnify(collection.name), this.activeTableAlias, null);

    this.multiMatchActiveTableAlias = `__mm_${this.activeTableAlias}`;
    this.multiMatch.joins.push({
      tableName: columnify(collection.name),
      tableAlias: this.multiMatchActiveTableAlias,
    });

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

    const collection = info.auth.collection();
    this.activeCollectionName = collection.name;
    this.activeTableAlias = `__auth_${columnify(this.activeCollectionName)}${this.resolver.joinAliasSuffix}`;

    this.resolver.registerJoin(
      columnify(this.activeCollectionName),
      this.activeTableAlias,
      { sql: `[[${this.activeTableAlias}.id]] = ?`, params: [info.auth.id] },
    );

    this.multiMatchActiveTableAlias = `__mm_${this.activeTableAlias}`;
    this.multiMatch.joins.push({
      tableName: columnify(this.activeCollectionName),
      tableAlias: this.multiMatchActiveTableAlias,
      on: { sql: `[[${this.multiMatchActiveTableAlias}.id]] = ?`, params: [info.auth.id] },
    });

    this.activeProps = this.activeProps.slice(2);
    return this.processActiveProps();
  }

  processRequestBodyField(): ResolverResult {
    const name = this.activeProps[2] ?? "";
    const [fieldName, modifier] = splitModifier(name);
    const bodyField = getCollectionField(this.resolver.baseCollection, fieldName);

    if (!bodyField) {
      return this.resolver.resolveStaticRequestField(...this.activeProps.slice(1));
    }

    if (bodyField.type === FieldTypeRelation && this.activeProps.length > 3) {
      return this.processRequestBodyRelationField(bodyField);
    }

    if (this.activeProps.length === 3) {
      if (modifier === eachModifier) {
        return this.processRequestBodyEachModifier(bodyField);
      }
      if (modifier === lengthModifier) {
        return this.processRequestBodyLengthModifier(bodyField);
      }
      if (modifier === lowerModifier) {
        return this.processRequestBodyLowerModifier(bodyField);
      }
      if (modifier === changedModifier) {
        return this.processRequestBodyChangedModifier(bodyField);
      }
    }

    return this.resolver.resolveStaticRequestField(...this.activeProps.slice(1));
  }

  processRequestBodyChangedModifier(bodyField: CollectionField): ResolverResult {
    const name = bodyField.name;
    const expr = buildFilterExpr(
      `@request.body.${name}:isset = true && @request.body.${name} != ${name}`,
      this.resolver,
      DefaultFilterExprLimit,
    );

    return {
      identifier: `(${expr.sql})`,
      params: expr.params,
      nullFallback: "disabled",
    };
  }

  processRequestBodyLowerModifier(bodyField: CollectionField): ResolverResult {
    const rawValue = toStringValue(this.resolver.requestInfo?.body[bodyField.name]);
    return {
      identifier: "LOWER(?)",
      params: [rawValue],
      nullFallback: "auto",
    };
  }

  processRequestBodyLengthModifier(bodyField: CollectionField): ResolverResult {
    if (!isMultiValuerField(bodyField)) {
      throw new Error(`field "${bodyField.name}" doesn't support multivalue operations`);
    }

    const bodyItems = toSlice(this.resolver.requestInfo?.body[bodyField.name]);
    return { identifier: String(bodyItems.length), params: [], nullFallback: "auto" };
  }

  processRequestBodyEachModifier(bodyField: CollectionField): ResolverResult {
    if (!isMultiValuerField(bodyField)) {
      throw new Error(`field "${bodyField.name}" doesn't support multivalue operations`);
    }

    const bodyItems = toSlice(this.resolver.requestInfo?.body[bodyField.name]);
    const bodyItemsRaw = JSON.stringify(bodyItems);

    const cleanFieldName = columnify(bodyField.name);
    const jeAlias = `__dataEach_je_${cleanFieldName}${this.resolver.joinAliasSuffix}`;
    this.resolver.registerJoin(`json_each(?)`, jeAlias, null, [bodyItemsRaw]);

    const result: ResolverResult = {
      identifier: `[[${jeAlias}.value]]`,
      params: [],
      nullFallback: "auto",
    };

    if (isMultiValuerField(bodyField)) {
      this.withMultiMatch = true;
    }

    if (this.withMultiMatch) {
      const jeAlias2 = `__mm_${jeAlias}`;
      this.multiMatch.joins.push({
        tableName: "json_each(?)",
        tableAlias: jeAlias2,
        params: [bodyItemsRaw],
      });
      this.multiMatch.valueIdentifier = `[[${jeAlias2}.value]]`;
      result.multiMatchSubquery = this.multiMatch;
    }

    return result;
  }

  processRequestBodyRelationField(bodyField: CollectionField): ResolverResult {
    const relCollectionId = toStringValue(
      (bodyField.raw as Record<string, unknown>).collectionId,
    );
    const relCollection = this.resolver.loadCollection(relCollectionId);
    if (!relCollection) {
      throw new Error(`failed to load collection "${relCollectionId}" from data field "${bodyField.name}"`);
    }

    const dataRelIds = toUniqueStringSlice(this.resolver.requestInfo?.body[bodyField.name]);
    if (dataRelIds.length === 0) {
      return { identifier: "NULL", params: [], nullFallback: "auto" };
    }

    this.activeCollectionName = relCollection.name;
    this.activeTableAlias =
      columnify(`__data_${relCollection.name}_${bodyField.name}`) + this.resolver.joinAliasSuffix;

    this.resolver.registerJoin(
      this.activeCollectionName,
      this.activeTableAlias,
      {
        sql: buildInExpr(`[[${this.activeTableAlias}.id]]`, dataRelIds.length),
        params: dataRelIds,
      },
    );

    if (isMultiValuerField(bodyField)) {
      this.withMultiMatch = true;
    }

    this.multiMatchActiveTableAlias = `__mm_${this.activeTableAlias}`;
    this.multiMatch.joins.push({
      tableName: this.activeCollectionName,
      tableAlias: this.multiMatchActiveTableAlias,
      on: {
        sql: buildInExpr(`[[${this.multiMatchActiveTableAlias}.id]]`, dataRelIds.length),
        params: dataRelIds,
      },
    });

    this.activeProps = this.activeProps.slice(3);
    return this.processActiveProps();
  }

  processActiveProps(): ResolverResult {
    const totalProps = this.activeProps.length;
    if (totalProps === 0) {
      throw new Error(`invalid field path "${this.fieldName}"`);
    }

    for (let i = 0; i < totalProps; i += 1) {
      const prop = this.activeProps[i] ?? "";
      const collection = this.resolver.loadCollection(this.activeCollectionName);
      if (!collection) {
        throw new Error(`failed to resolve field "${prop}"`);
      }

      if (i === totalProps - 1) {
        return this.finalizeActivePropsProcessing(collection, prop);
      }

      const field = getCollectionField(collection, prop);

      if (field && field.hidden && !this.resolver.allowHiddenFields) {
        throw new Error(`non-filterable field "${prop}"`);
      }

      if (field && (field.type === FieldTypeJSON || field.type === FieldTypeGeoPoint)) {
        const jsonPath = buildJsonPath(this.activeProps.slice(i + 1));
        const result: ResolverResult = {
          nullFallback: "disabled",
          identifier: JSONExtract(`${this.activeTableAlias}.${columnify(prop)}`, jsonPath),
          params: [],
        };

        if (this.withMultiMatch) {
          this.multiMatch.valueIdentifier = JSONExtract(
            `${this.multiMatchActiveTableAlias}.${columnify(prop)}`,
            jsonPath,
          );
          result.multiMatchSubquery = this.multiMatch;
        }

        return result;
      }

      if (i >= maxNestedRels) {
        throw new Error(`max nested relations reached for field "${prop}"`);
      }

      if (!field) {
        const parts = viaRegex.exec(prop);
        if (!parts || parts.length !== 3) {
          if (this.nullifyMissingField) {
            return { identifier: "NULL", params: [], nullFallback: "auto" };
          }
          throw new Error(`failed to resolve field "${prop}"`);
        }

        const backCollection = this.resolver.loadCollection(parts[1] ?? "");
        if (!backCollection) {
          if (this.nullifyMissingField) {
            return { identifier: "NULL", params: [], nullFallback: "auto" };
          }
          throw new Error(`failed to load back relation field "${prop}" collection`);
        }

        const backField = getCollectionField(backCollection, parts[2] ?? "");
        if (!backField) {
          if (this.nullifyMissingField) {
            return { identifier: "NULL", params: [], nullFallback: "auto" };
          }
          throw new Error(`missing back relation field "${parts[2] ?? ""}"`);
        }

        if (backField.type !== FieldTypeRelation) {
          if (this.nullifyMissingField) {
            return { identifier: "NULL", params: [], nullFallback: "auto" };
          }
          throw new Error(`invalid back relation field "${parts[2] ?? ""}"`);
        }

        if (backField.hidden && !this.resolver.allowHiddenFields) {
          throw new Error(`non-filterable back relation field "${backField.name}"`);
        }

        const backRelCollectionId = toStringValue(
          (backField.raw as Record<string, unknown>).collectionId,
        );
        if (backRelCollectionId !== collection.id) {
          if (this.nullifyMissingField) {
            return { identifier: "NULL", params: [], nullFallback: "auto" };
          }
          throw new Error(`invalid collection reference of a back relation field "${backField.name}"`);
        }

        const cleanProp = columnify(prop);
        const cleanBackFieldName = columnify(backField.name);
        const newTableAlias = `${this.activeTableAlias}_${cleanProp}${this.resolver.joinAliasSuffix}`;
        const newCollectionName = columnify(backCollection.name);

        const isBackRelMultiple = isMultiValuerField(backField);

        if (!isBackRelMultiple) {
          this.resolver.registerJoin(
            newCollectionName,
            newTableAlias,
            {
              sql: `[[${newTableAlias}.${cleanBackFieldName}]] = [[${this.activeTableAlias}.id]]`,
              params: [],
            },
          );
        } else {
          const jeAlias = `__je_${newTableAlias}`;
          this.resolver.registerJoin(
            newCollectionName,
            newTableAlias,
            {
              sql: `[[${this.activeTableAlias}.id]] IN (SELECT [[${jeAlias}.value]] FROM ${JSONEach(
                `${newTableAlias}.${cleanBackFieldName}`,
              )} {{${jeAlias}}})`,
              params: [],
            },
          );
        }

        this.activeCollectionName = newCollectionName;
        this.activeTableAlias = newTableAlias;

        if (isBackRelMultiple) {
          this.withMultiMatch = true;
        } else if (!this.withMultiMatch) {
          const hasUniqueIndex = findSingleColumnUniqueIndex(
            backCollection.indexes,
            backField.name,
          )[1];
          this.withMultiMatch = !hasUniqueIndex;
        }

        const newTableAlias2 = `${this.multiMatchActiveTableAlias}_${cleanProp}${this.resolver.joinAliasSuffix}`;

        if (!isBackRelMultiple) {
          this.multiMatch.joins.push({
            tableName: newCollectionName,
            tableAlias: newTableAlias2,
            on: {
              sql: `[[${newTableAlias2}.${cleanBackFieldName}]] = [[${this.multiMatchActiveTableAlias}.id]]`,
              params: [],
            },
          });
        } else {
          const jeAlias2 = `__je_${newTableAlias2}`;
          this.multiMatch.joins.push({
            tableName: newCollectionName,
            tableAlias: newTableAlias2,
            on: {
              sql: `[[${this.multiMatchActiveTableAlias}.id]] IN (SELECT [[${jeAlias2}.value]] FROM ${JSONEach(
                `${newTableAlias2}.${cleanBackFieldName}`,
              )} {{${jeAlias2}}})`,
              params: [],
            },
          });
        }

        this.multiMatchActiveTableAlias = newTableAlias2;
        continue;
      }

      if (field.type !== FieldTypeRelation) {
        throw new Error(`field "${prop}" is not a valid relation`);
      }

      const relCollectionId = toStringValue((field.raw as Record<string, unknown>).collectionId);
      const relCollection = this.resolver.loadCollection(relCollectionId);
      if (!relCollection) {
        throw new Error(`failed to load field "${prop}" collection`);
      }

      if (!isMultiValuerField(field) && i === totalProps - 2 && this.activeProps[i + 1] === FieldNameId) {
        return this.finalizeActivePropsProcessing(collection, field.name);
      }

      const cleanFieldName = columnify(field.name);
      const prefixedFieldName = `${this.activeTableAlias}.${cleanFieldName}`;
      const newTableAlias = `${this.activeTableAlias}_${cleanFieldName}${this.resolver.joinAliasSuffix}`;
      const newCollectionName = relCollection.name;

      if (!isMultiValuerField(field)) {
        this.resolver.registerJoin(
          columnify(newCollectionName),
          newTableAlias,
          {
            sql: `[[${newTableAlias}.id]] = [[${prefixedFieldName}]]`,
            params: [],
          },
        );
      } else {
        const jeAlias = `__je_${newTableAlias}`;
        this.resolver.registerJoin(JSONEach(prefixedFieldName), jeAlias, null);
        this.resolver.registerJoin(
          columnify(newCollectionName),
          newTableAlias,
          {
            sql: `[[${newTableAlias}.id]] = [[${jeAlias}.value]]`,
            params: [],
          },
        );
      }

      this.activeCollectionName = newCollectionName;
      this.activeTableAlias = newTableAlias;

      if (isMultiValuerField(field)) {
        this.withMultiMatch = true;
      }

      const newTableAlias2 = `${this.multiMatchActiveTableAlias}_${cleanFieldName}`;
      const prefixedFieldName2 = `${this.multiMatchActiveTableAlias}.${cleanFieldName}`;

      if (!isMultiValuerField(field)) {
        this.multiMatch.joins.push({
          tableName: columnify(newCollectionName),
          tableAlias: newTableAlias2,
          on: {
            sql: `[[${newTableAlias2}.id]] = [[${prefixedFieldName2}]]`,
            params: [],
          },
        });
      } else {
        const jeAlias2 = `${this.multiMatchActiveTableAlias}_${cleanFieldName}_je`;
        this.multiMatch.joins.push(
          {
            tableName: JSONEach(prefixedFieldName2),
            tableAlias: jeAlias2,
          },
          {
            tableName: columnify(newCollectionName),
            tableAlias: newTableAlias2,
            on: {
              sql: `[[${newTableAlias2}.id]] = [[${jeAlias2}.value]]`,
              params: [],
            },
          },
        );
      }

      this.multiMatchActiveTableAlias = newTableAlias2;
    }

    throw new Error(`failed to resolve field "${this.fieldName}"`);
  }

  finalizeActivePropsProcessing(collection: Collection, prop: string): ResolverResult {
    const [name, modifier] = splitModifier(prop);

    const field = getCollectionField(collection, name);
    if (!field) {
      if (this.nullifyMissingField) {
        return { identifier: "NULL", params: [], nullFallback: "auto" };
      }
      throw new Error(`unknown field "${name}"`);
    }

    if (field.hidden && !this.resolver.allowHiddenFields) {
      throw new Error(`non-filterable field "${name}"`);
    }

    const cleanFieldName = columnify(field.name);

    if (modifier === lengthModifier && isMultiValuerField(field)) {
      const result: ResolverResult = {
        identifier: JSONArrayLength(`${this.activeTableAlias}.${cleanFieldName}`),
        params: [],
        nullFallback: "auto",
      };

      if (this.withMultiMatch) {
        this.multiMatch.valueIdentifier = JSONArrayLength(
          `${this.multiMatchActiveTableAlias}.${cleanFieldName}`,
        );
        result.multiMatchSubquery = this.multiMatch;
      }

      return result;
    }

    if (modifier === eachModifier && isMultiValuerField(field)) {
      const jeAlias = `__je_${this.activeTableAlias}_${cleanFieldName}${this.resolver.joinAliasSuffix}`;
      this.resolver.registerJoin(JSONEach(`${this.activeTableAlias}.${cleanFieldName}`), jeAlias, null);

      const result: ResolverResult = {
        identifier: `[[${jeAlias}.value]]`,
        params: [],
        nullFallback: "auto",
      };

      if (isMultiValuerField(field)) {
        this.withMultiMatch = true;
      }

      if (this.withMultiMatch) {
        const jeAlias2 = `__je_${this.multiMatchActiveTableAlias}_${cleanFieldName}${this.resolver.joinAliasSuffix}`;
        this.multiMatch.joins.push({
          tableName: JSONEach(`${this.multiMatchActiveTableAlias}.${cleanFieldName}`),
          tableAlias: jeAlias2,
        });
        this.multiMatch.valueIdentifier = `[[${jeAlias2}.value]]`;
        result.multiMatchSubquery = this.multiMatch;
      }

      return result;
    }

    const result: ResolverResult = {
      identifier: `[[${this.activeTableAlias}.${cleanFieldName}]]`,
      params: [],
      nullFallback: "auto",
    };

    if (this.withMultiMatch) {
      this.multiMatch.valueIdentifier = `[[${this.multiMatchActiveTableAlias}.${cleanFieldName}]]`;
      result.multiMatchSubquery = this.multiMatch;
    }

    if (
      field.name === FieldNameEmail &&
      !this.resolver.allowHiddenFields &&
      collection.type === "auth"
    ) {
      result.afterBuild = (expr) => ({
        sql: `(${expr.sql} AND [[${this.activeTableAlias}.${FieldNameEmailVisibility}]] = TRUE)`,
        params: expr.params,
      });
    }

    if (field.type === FieldTypeJSON) {
      result.nullFallback = "disabled";
      result.identifier = JSONExtract(`${this.activeTableAlias}.${cleanFieldName}`, "");
      if (this.withMultiMatch) {
        this.multiMatch.valueIdentifier = JSONExtract(
          `${this.multiMatchActiveTableAlias}.${cleanFieldName}`,
          "",
        );
      }
    }

    if (modifier === lowerModifier) {
      result.identifier = `LOWER(${result.identifier})`;
      if (this.withMultiMatch) {
        this.multiMatch.valueIdentifier = `LOWER(${this.multiMatch.valueIdentifier})`;
      }
    }

    return result;
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

function buildInExpr(column: string, count: number): string {
  const placeholders = Array.from({ length: Math.max(count, 1) }, () => "?").join(", ");
  return `${column} IN (${placeholders})`;
}

export function getCollectionField(collection: Collection, name: string): CollectionField | null {
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
  const key = keys[0];
  if (!key || !(key in raw)) {
    throw new Error(`invalid key path - missing key "${key ?? ""}"`);
  }

  const result = raw[key];
  if (keys.length === 1) {
    return result;
  }

  return extractNestedVal(result, ...keys.slice(1));
}

function arrVal(raw: unknown[], keys: string[]): unknown {
  const key = keys[0];
  if (!key) {
    throw new Error('invalid key path - invalid or missing array index ""');
  }
  const idx = Number.parseInt(key, 10);
  if (!Number.isFinite(idx) || idx < 0 || idx >= raw.length) {
    throw new Error(`invalid key path - invalid or missing array index "${key}"`);
  }

  const result = raw[idx];
  if (keys.length === 1) {
    return result;
  }

  return extractNestedVal(result, ...keys.slice(1));
}

function toSlice(value: unknown): unknown[] {
  if (value == null) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  return [value];
}

function toStringValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return "";
}
