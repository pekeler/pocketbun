// Ported from pocketbase/core/record_query_expand.go

import type { App } from "./app.ts";
import type { Collection } from "./collection_model.ts";
import { findSingleColumnUniqueIndex } from "../tools/dbutils/index.ts";
import { JSONEach } from "../tools/dbutils/json.ts";
import { toUniqueStringSlice } from "../tools/list/list.ts";
import { RelationField } from "./field_relation.ts";
import { Record as RecordModel } from "./record_model.ts";

// ExpandFetchFunc defines the function that is used to fetch the expanded relation records.
export type ExpandFetchFunc = (relCollection: Collection, relIds: string[]) => RecordModel[];

const maxNestedRels = 6;

// Deprecated
const indirectExpandRegexOld = /^(\w+)\((\w+)\)$/;
const indirectExpandRegex = /^(\w+)_via_(\w+)$/;

export function expandRecord(
  app: App,
  record: RecordModel,
  expands: string[],
  optFetchFunc?: ExpandFetchFunc | null,
): Record<string, Error> {
  return expandRecords(app, [record], expands, optFetchFunc ?? null);
}

export function expandRecords(
  app: App,
  records: RecordModel[],
  expands: string[],
  optFetchFunc?: ExpandFetchFunc | null,
): Record<string, Error> {
  const normalized = normalizeExpands(expands);
  const failed: Record<string, Error> = {};

  for (const expand of normalized) {
    const err = expandRecordsPath(app, records, expand, optFetchFunc ?? null, 1);
    if (err) {
      failed[expand] = err;
    }
  }

  return failed;
}

function expandRecordsPath(
  app: App,
  records: RecordModel[],
  expandPath: string,
  fetchFunc: ExpandFetchFunc | null,
  recursionLevel: number,
): Error | null {
  if (!fetchFunc) {
    fetchFunc = (relCollection: Collection, relIds: string[]) => app.FindRecordsByIds(relCollection.Id, relIds);
  }

  if (!expandPath || recursionLevel > maxNestedRels || records.length === 0) {
    return null;
  }

  const mainCollection = records[0]?.collection();
  if (!mainCollection) {
    return null;
  }

  let relField: RelationField | null = null;
  let relCollection: Collection | null = null;

  const dotIndex = expandPath.indexOf(".");
  const parts = dotIndex === -1 ? [expandPath] : [expandPath.slice(0, dotIndex), expandPath.slice(dotIndex + 1)];
  let matches: RegExpMatchArray | null = null;

  if (parts[0]?.includes("(")) {
    matches = parts[0].match(indirectExpandRegexOld);
    if (matches && matches.length === 3) {
      console.warn(
        `${matches[0]} expand format is deprecated and will be removed in the future. Consider replacing it with ${matches[1]}_via_${matches[2]}.`,
      );
    }
  } else {
    matches = parts[0]?.match(indirectExpandRegex) ?? null;
  }

  if (matches && matches.length === 3) {
    const indirectCollectionId = matches[1] ?? "";
    const indirectFieldName = matches[2] ?? "";
    const indirectRel = getCollectionByModelOrIdentifier(app, indirectCollectionId);
    if (!indirectRel) {
      return new Error(`couldn't find back-related collection ${JSON.stringify(indirectCollectionId)}`);
    }

    const indirectRelField = indirectRel.Fields.GetByName(indirectFieldName) as RelationField | null;
    if (!indirectRelField || indirectRelField.CollectionId !== mainCollection.Id) {
      return new Error(
        `couldn't find back-relation field ${JSON.stringify(indirectFieldName)} in collection ${JSON.stringify(indirectRel.name)}`,
      );
    }

    const prepErr = prepareIndirectRelation(app, indirectRel, indirectRelField, records, parts[0] ?? "");
    if (prepErr) {
      return prepErr;
    }

    relField = new RelationField();
    relField.Name = parts[0] ?? "";
    relField.MaxSelect = 2147483647;
    relField.CollectionId = indirectRel.Id;
    if (findSingleColumnUniqueIndex(indirectRel.indexes ?? [], indirectRelField.GetName())[1]) {
      relField.MaxSelect = 1;
    }

    relCollection = indirectRel;
  } else {
    const found = mainCollection.Fields.GetByName(parts[0] ?? "");
    if (!(found instanceof RelationField)) {
      return new Error(
        `couldn't find relation field ${JSON.stringify(parts[0])} in collection ${JSON.stringify(mainCollection.name)}`,
      );
    }
    relField = found;

    relCollection = getCollectionByModelOrIdentifier(app, relField.CollectionId);
    if (!relCollection) {
      return new Error(`couldn't find related collection ${JSON.stringify(relField.CollectionId)}`);
    }
  }

  if (!relField || !relCollection) {
    return null;
  }

  const relIds: string[] = [];
  for (const record of records) {
    relIds.push(...record.GetStringSlice(relField.Name));
  }

  let rels: RecordModel[];
  try {
    rels = fetchFunc(relCollection, relIds);
  } catch (err) {
    return err as Error;
  }

  if (parts.length > 1 && parts[1]) {
    const err = expandRecordsPath(app, rels, parts[1], fetchFunc, recursionLevel + 1);
    if (err) {
      return err;
    }
  }

  const indexed = new Map<string, RecordModel>();
  for (const rel of rels) {
    indexed.set(rel.Id, rel);
  }

  for (const model of records) {
    if (!model.HasExpand()) {
      model.SetExpand(null);
    }

    const ids = model.GetStringSlice(relField.Name);
    const validRels: RecordModel[] = [];
    for (const id of ids) {
      const rel = indexed.get(id);
      if (rel) {
        validRels.push(rel);
      }
    }

    if (validRels.length === 0) {
      continue;
    }

    const expandData = model.Expand();

    let oldExpandedRels: RecordModel[] = [];
    const oldVal = expandData[relField.Name] as unknown;
    if (oldVal instanceof RecordModel) {
      oldExpandedRels = [oldVal];
    } else if (Array.isArray(oldVal)) {
      oldExpandedRels = oldVal.filter((item): item is RecordModel => item instanceof RecordModel);
    }

    for (const oldExpanded of oldExpandedRels) {
      for (const rel of validRels) {
        if (rel.Id !== oldExpanded.Id) {
          continue;
        }
        rel.MergeExpand(oldExpanded.Expand());
      }
    }

    if (relField.IsMultiple()) {
      expandData[relField.Name] = validRels;
    } else {
      expandData[relField.Name] = validRels[0];
    }

    model.SetExpand(expandData);
  }

  return null;
}

function prepareIndirectRelation(
  app: App,
  indirectRel: Collection,
  indirectRelField: RelationField,
  records: RecordModel[],
  fieldName: string,
): Error | null {
  const table = indirectRel.name;
  const column = indirectRelField.GetName();

  let sql = `select id from [[${table}]]`;
  if (indirectRelField.IsMultiple()) {
    sql += ` where exists (select 1 from ${JSONEach(column)} as je where je.value = ?)`;
  } else {
    sql += ` where [[${column}]] = ?`;
  }
  sql += " limit 1000";

  const stmt = app.db().query(sql);

  for (const record of records) {
    const rows = stmt.all(record.Id) as Array<{ id?: string }>;
    const relIds = rows.map((row) => (typeof row?.id === "string" ? row.id : "")).filter(Boolean);
    if (relIds.length > 0) {
      record.Set(fieldName, relIds);
    }
  }

  return null;
}

// normalizeExpands normalizes expand strings and merges self containing paths
// (eg. ["a.b.c", "a.b", "   test  ", "  ", "test"] -> ["a.b.c", "test"]).
function normalizeExpands(paths: string[]): string[] {
  const normalized: string[] = [];
  for (const p of paths) {
    const trimmed = p.replace(/\s+/g, "").replace(/^[.]+|[.]+$/g, "");
    if (trimmed) {
      normalized.push(trimmed);
    }
  }

  const result: string[] = [];
  for (let i = 0; i < normalized.length; i += 1) {
    const p1 = normalized[i]!;
    let skip = false;
    for (let j = 0; j < normalized.length; j += 1) {
      if (i === j) {
        continue;
      }
      const p2 = normalized[j]!;
      if (p2.startsWith(`${p1}.`)) {
        skip = true;
        break;
      }
    }
    if (!skip) {
      result.push(p1);
    }
  }

  return toUniqueStringSlice(result);
}

function getCollectionByModelOrIdentifier(app: App, value: string | Collection): Collection | null {
  if (typeof value === "string") {
    try {
      return app.FindCachedCollectionByNameOrId(value);
    } catch {
      return null;
    }
  }
  return value ?? null;
}
